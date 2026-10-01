# Destiny 1 Grimoire Stream Overlay 🎮📺

A live, real-time **Destiny 1 Grimoire Score Stream Widget** designed for **OBS Studio**, **Streamlabs Desktop**, and **Twitch Studio**.

- **Player:** `GrimoireLord` (Xbox Live)
- **Transparent Background:** Ready to overlay directly over gameplay.
- **Auto-Polling & Manual Refresh:** Polling every 15s/30s + instant manual refresh button or <kbd>R</kbd> key hotkey.
- **Dual Support:** Runs either locally with a Node.js server or statically hosted directly on **GitHub Pages**.

---

## 🌐 Deploying to GitHub Pages (Free Static Hosting)

You can host this overlay directly on **GitHub Pages** for free—no local server needed! The overlay automatically falls back to fetching directly from the Bungie API in browser when served statically.

### Setup Instructions:

1. **Commit and push** your project to GitHub:
   ```bash
   git add .
   git commit -m "Deploy overlay to GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Open your repository on **GitHub.com**.
   - Go to **Settings** → **Pages** (under *Code and automation*).
   - Under **Build and deployment**:
     - **Source:** Select `Deploy from a branch`
     - **Branch:** Select `main` and `/ (root)`
   - Click **Save**.

3. **Use in OBS / Streamlabs**:
   - Wait 1–2 minutes for GitHub Pages to build.
   - Your overlay URL will be:
     `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
   - In OBS Studio or Streamlabs Desktop, add a **Browser Source** pointing directly to your GitHub Pages URL!

---

## 🚀 How to Run Locally (Node.js Server)

### 1. Start the Server
Make sure your `.env` file contains your `BUNGIE_API_KEY`:
```bash
npm start
```
*The server will start at `http://localhost:3000`.*

---

## 🎥 How to Add Local Host to OBS Studio / Streamlabs

1. Open **OBS Studio** or **Streamlabs Desktop**.
2. In your Scene, click **`+` (Add Source)** and select **Browser** (or *Browser Source*).
3. Set the parameters:
   - **URL:** `http://localhost:3000`
   - **Width:** `360`
   - **Height:** `180`
   - **Custom CSS:** (Leave blank)
4. Click **OK**.

---

## ⌨️ Features & Controls

| Feature | Description |
|---|---|
| **Auto-Polling** | Automatically polls Bungie API (configurable: 5s, 10s, 15s, 30s, or custom). |
| **Manual Refresh** | Click the **🔄 Refresh** icon, double-click widget, or press <kbd>R</kbd> on keyboard. |
| **In-Widget Settings** | Click the ⚙ gear icon or double-click to adjust player name, console platform, and size. |
| **Interactive Resizing** | Drag the bottom-right handle ◢ to resize the stream overlay in real time. |
