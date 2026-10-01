/* ==========================================================================
   Destiny 1 Grimoire Stream Overlay - Client Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const scoreElement = document.getElementById('grimoire-score');
  const lastUpdatedElement = document.getElementById('last-updated');
  const liveDot = document.getElementById('live-dot');
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const pollingSelect = document.getElementById('polling-select');
  const themeSelect = document.getElementById('theme-select');
  const compactToggle = document.getElementById('compact-toggle');
  const container = document.getElementById('overlay-container');

  const cardElement = document.getElementById('card-count');

  let currentScore = 0;
  let animFrameId = null;
  let pollIntervalId = null;
  let isFetching = false;

  // Animate number count-up
  function animateScore(start, end, duration = 1000) {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (!scoreElement) return;

    // On initial load, display score immediately without animating from 0
    if (start === 0 || start === end) {
      scoreElement.textContent = end.toLocaleString();
      currentScore = end;
      return;
    }

    const startTime = performance.now();
    scoreElement.classList.add('updated-flash');

    function updateNumber(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.floor(start + (end - start) * easeProgress);

      scoreElement.textContent = val.toLocaleString();

      if (progress < 1) {
        animFrameId = requestAnimationFrame(updateNumber);
      } else {
        scoreElement.textContent = end.toLocaleString();
        animFrameId = null;
        setTimeout(() => scoreElement.classList.remove('updated-flash'), 1000);
      }
    }

    animFrameId = requestAnimationFrame(updateNumber);
  }

  // Fetch Grimoire score from server proxy API
  async function fetchGrimoireData() {
    if (isFetching) return;
    isFetching = true;

    // Visual loading state
    if (refreshBtn) refreshBtn.classList.add('spinning');
    if (liveDot) liveDot.classList.add('updating');
    if (lastUpdatedElement) lastUpdatedElement.textContent = 'Updating...';

    try {
      const response = await fetch('/api/grimoire');
      const data = await response.json();

      if (data.success) {
        if (typeof data.grimoireScore === 'number' && scoreElement) {
          const newScore = data.grimoireScore;
          animateScore(currentScore, newScore);
          currentScore = newScore;
        }

        if (typeof data.cardCount === 'number' && cardElement) {
          cardElement.textContent = `${data.cardCount} CARDS`;
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (lastUpdatedElement) lastUpdatedElement.textContent = `Refreshed ${timeStr}`;
      } else {
        if (lastUpdatedElement) lastUpdatedElement.textContent = data.error || 'Fetch failed';
      }
    } catch (err) {
      console.error('Error fetching Grimoire data:', err);
      if (lastUpdatedElement) lastUpdatedElement.textContent = 'Connection Error';
    } finally {
      isFetching = false;
      if (refreshBtn) refreshBtn.classList.remove('spinning');
      if (liveDot) liveDot.classList.remove('updating');
    }
  }

  // Configure polling timer
  function setupPolling(seconds) {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }

    const intervalSec = parseInt(seconds, 10);
    if (intervalSec > 0) {
      pollIntervalId = setInterval(fetchGrimoireData, intervalSec * 1000);
      if (liveDot) liveDot.style.display = 'block';
    } else {
      if (liveDot) liveDot.style.display = 'none';
    }
  }

  // Event Listeners
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchGrimoireData();
      if (pollingSelect) setupPolling(pollingSelect.value);
    });
  }

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });
  }

  if (pollingSelect) {
    pollingSelect.addEventListener('change', (e) => {
      setupPolling(e.target.value);
    });
  }

  if (themeSelect && container) {
    themeSelect.addEventListener('change', (e) => {
      container.className = `overlay-card ${e.target.value}`;
      if (compactToggle && compactToggle.checked) {
        container.classList.add('compact');
      }
    });
  }

  if (compactToggle && container) {
    compactToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        container.classList.add('compact');
      } else {
        container.classList.remove('compact');
      }
    });
  }

  // Hotkey listener: Press 'R' to refresh manually
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      fetchGrimoireData();
      if (pollingSelect) setupPolling(pollingSelect.value);
    }
  });

  // Initial Fetch & Setup
  fetchGrimoireData();
  const initialPoll = pollingSelect ? pollingSelect.value : 30;
  setupPolling(initialPoll);
});
