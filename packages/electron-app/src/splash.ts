import { BrowserWindow } from 'electron';
import path from 'path';

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .splash {
      width: 380px;
      height: 480px;
      background: linear-gradient(135deg, #090B16 0%, #121426 100%);
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
    }
    .splash::before {
      content: '';
      position: absolute;
      top: -100px;
      right: -100px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(109,76,255,0.2) 0%, transparent 70%);
      border-radius: 50%;
    }
    .splash::after {
      content: '';
      position: absolute;
      bottom: -100px;
      left: -100px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255,79,163,0.15) 0%, transparent 70%);
      border-radius: 50%;
    }
    .logo-container {
      position: relative;
      z-index: 1;
      margin-bottom: 32px;
    }
    .logo {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #6D4CFF 0%, #FF4FA3 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 30px rgba(109,76,255,0.4);
      animation: pulse 2s ease-in-out infinite;
    }
    .logo svg {
      width: 40px;
      height: 40px;
      color: white;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(109,76,255,0.4); }
      50% { transform: scale(1.05); box-shadow: 0 15px 40px rgba(109,76,255,0.5); }
    }
    .title {
      position: relative;
      z-index: 1;
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, #6D4CFF 0%, #FF4FA3 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      position: relative;
      z-index: 1;
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 48px;
    }
    .loader {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .loader-bar {
      width: 200px;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .loader-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6D4CFF, #FF4FA3);
      border-radius: 2px;
      animation: loading 2s ease-in-out infinite;
    }
    @keyframes loading {
      0% { width: 0%; margin-left: 0; }
      50% { width: 60%; margin-left: 20%; }
      100% { width: 0%; margin-left: 100%; }
    }
    .loader-text {
      font-size: 12px;
      color: #6B7280;
      font-weight: 500;
    }
    .version {
      position: absolute;
      bottom: 20px;
      font-size: 11px;
      color: #4A5078;
    }
  </style>
</head>
<body>
  <div class="splash">
    <div class="logo-container">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
    </div>
    <div class="title">RewindX</div>
    <div class="subtitle">AI-Powered Work Memory</div>
    <div class="loader">
      <div class="loader-bar">
        <div class="loader-fill"></div>
      </div>
      <div class="loader-text">Initializing...</div>
    </div>
    <div class="version">v0.1.0</div>
  </div>
</body>
</html>`;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  return splash;
}
