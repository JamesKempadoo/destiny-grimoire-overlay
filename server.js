const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Read .env file if available
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const BUNGIE_API_KEY = process.env.BUNGIE_API_KEY || '';

// Active Player State
let activePlayer = {
  displayName: process.env.DEFAULT_PLAYER || 'GrimoireLord',
  membershipType: process.env.DEFAULT_PLATFORM || '1', // 1=Xbox, 2=PSN
  membershipId: '4611686018558160946'
};

// Cache player info in memory
let cachedData = {
  grimoireScore: null,
  cardCount: null,
  lastUpdated: null,
  displayName: activePlayer.displayName,
  membershipId: activePlayer.membershipId
};

function fetchBungieData(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'X-API-Key': BUNGIE_API_KEY,
        'User-Agent': 'DestinyGrimoireOverlay/1.0',
        'Accept': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : new URL(res.headers.location, url).href;
        return fetchBungieData(redirectUrl).then(resolve).catch(reject);
      }

      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(new Error('Invalid JSON response from Bungie API'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function searchAndSetPlayer(name, platform) {
  const encoded = encodeURIComponent(name);
  const searchUrl = `https://www.bungie.net/Platform/Destiny/SearchDestinyPlayer/${platform}/${encoded}/`;
  const searchRes = await fetchBungieData(searchUrl);

  if (searchRes.ErrorCode !== 1) {
    throw new Error(searchRes.Message || 'Bungie API search error');
  }

  const results = searchRes.Response || [];
  if (!results.length) {
    throw new Error(`No player found named '${name}' on platform ${platform}`);
  }

  const match = results[0];
  activePlayer = {
    displayName: match.displayName,
    membershipType: String(match.membershipType),
    membershipId: match.membershipId
  };

  // Reset cache
  cachedData.grimoireScore = null;
  return activePlayer;
}

async function getGrimoireScore() {
  try {
    const grimoireUrl = `https://www.bungie.net/Platform/Destiny/Vanguard/Grimoire/${activePlayer.membershipType}/${activePlayer.membershipId}/`;
    const grimoireRes = await fetchBungieData(grimoireUrl);

    if (grimoireRes.ErrorCode !== 1) {
      throw new Error(grimoireRes.Message || 'Bungie API error');
    }

    const dataObj = grimoireRes.Response?.data || {};
    const grimoireScore = dataObj.score ?? 0;
    const cardCollection = dataObj.cardCollection || [];
    const cardCount = cardCollection.length;

    cachedData = {
      grimoireScore,
      cardCount,
      lastUpdated: new Date().toISOString(),
      displayName: activePlayer.displayName,
      membershipId: activePlayer.membershipId,
      membershipType: activePlayer.membershipType
    };

    return { success: true, ...cachedData };
  } catch (err) {
    console.error('Error fetching Grimoire score:', err.message);
    if (cachedData.grimoireScore !== null) {
      return { success: true, ...cachedData, warning: err.message };
    }
    return { success: false, error: err.message };
  }
}

function extractDefinitionsMap(response) {
  const map = new Map();
  if (!response) return map;

  const res = response.Response || response;
  const dataObj = res.data || {};

  const defs = res.definitions?.cards ||
               res.definitions?.grimoireCards ||
               res.cardDefinitions ||
               dataObj.cardDefinitions ||
               res.definitions ||
               {};

  if (Array.isArray(defs)) {
    defs.forEach(def => {
      if (def && (def.cardId || def.id)) {
        const id = String(def.cardId || def.id);
        map.set(id, def);
      }
    });
  } else if (typeof defs === 'object' && defs !== null) {
    Object.keys(defs).forEach(key => {
      const def = defs[key];
      if (def && typeof def === 'object') {
        const id = String(def.cardId || key);
        map.set(id, def);
      }
    });
  }

  return map;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n');
}

async function getGrimoireCards() {
  try {
    const grimoireUrl = `https://www.bungie.net/Platform/Destiny/Vanguard/Grimoire/${activePlayer.membershipType}/${activePlayer.membershipId}/?definitions=true`;
    const grimoireRes = await fetchBungieData(grimoireUrl);

    if (grimoireRes.ErrorCode !== 1) {
      throw new Error(grimoireRes.Message || 'Bungie API error');
    }

    const dataObj = grimoireRes.Response?.data || {};
    const grimoireScore = dataObj.score ?? 0;
    const cardCollection = dataObj.cardCollection || [];
    const defMap = extractDefinitionsMap(grimoireRes);

    const cards = cardCollection.map(card => {
      const idStr = String(card.cardId);
      const def = defMap.get(idStr) || card;
      let icon = null;
      if (def.icon && def.icon.sheetPath) {
        icon = def.icon.sheetPath.startsWith('http') ? def.icon.sheetPath : `https://www.bungie.net${def.icon.sheetPath}`;
      } else if (def.highGraphic && def.highGraphic.image && def.highGraphic.image.sheetPath) {
        icon = def.highGraphic.image.sheetPath.startsWith('http') ? def.highGraphic.image.sheetPath : `https://www.bungie.net${def.highGraphic.image.sheetPath}`;
      }

      const rawCardName = def.cardName || def.name || def.title || def.displayName || `Card #${card.cardId}`;

      return {
        cardId: card.cardId,
        score: card.score || 0,
        points: card.points ?? def.grimoirePointValue ?? 0,
        cardName: decodeHtmlEntities(rawCardName),
        cardIntro: decodeHtmlEntities(def.cardIntro || ''),
        cardDescription: decodeHtmlEntities(def.cardDescription || ''),
        icon: icon,
        themeId: def.themeId || 'General'
      };
    });

    return {
      success: true,
      grimoireScore,
      cardCount: cards.length,
      cards,
      lastUpdated: new Date().toISOString(),
      displayName: activePlayer.displayName,
      membershipId: activePlayer.membershipId,
      membershipType: activePlayer.membershipType
    };
  } catch (err) {
    console.error('Error fetching Grimoire cards:', err.message);
    return { success: false, error: err.message };
  }
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = req.url.split('?')[0];

  // API Endpoints
  if (reqUrl === '/api/grimoire') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const result = await getGrimoireScore();
    res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (reqUrl === '/api/cards') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const result = await getGrimoireCards();
    res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (reqUrl === '/api/player') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, player: activePlayer }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (!parsed.name) throw new Error('Player Gamertag is required.');

          const platform = parsed.platform || '1';
          const newPlayer = await searchAndSetPlayer(parsed.name, platform);
          const scoreData = await getGrimoireScore();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, player: newPlayer, scoreData }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // Serve static files from root directory or public/ directory fallback
  let targetFile = reqUrl;
  if (reqUrl === '/' || reqUrl === '/stream') {
    targetFile = 'index.html';
  } else if (reqUrl === '/settings') {
    targetFile = 'settings.html';
  } else if (reqUrl === '/cards') {
    targetFile = 'cards.html';
  }

  const sanitizedTarget = targetFile.replace(/^\//, '');
  let filePath = path.join(__dirname, sanitizedTarget);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'public', sanitizedTarget);
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase() || '.html';
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
      res.end(content, 'utf-8');
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n[Notice] Port ${PORT} is already running the Grimoire Stream Overlay server!`);
    console.log(`Access your stream browser source at: http://localhost:${PORT}\n`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  DESTINY 1 GRIMOIRE STREAM OVERLAY SERVER RUNNING`);
  console.log(`==================================================`);
  console.log(`  Active Player:   ${activePlayer.displayName}`);
  console.log(`  Stream Overlay:  http://localhost:${PORT}`);
  console.log(`  Control Panel:   http://localhost:${PORT}/settings`);
  console.log(`  API Proxy:       http://localhost:${PORT}/api/grimoire`);
  console.log(`--------------------------------------------------`);
  console.log(`  Add http://localhost:${PORT} as a Browser Source`);
  console.log(`  in OBS Studio / Streamlabs Desktop.`);
  console.log(`==================================================\n`);
});
