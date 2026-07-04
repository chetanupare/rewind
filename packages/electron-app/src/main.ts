import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, globalShortcut, Notification, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { Config, Database, eventBus } from '@ai-work-memory/shared';
import { startBackgroundService, stopBackgroundService } from '@ai-work-memory/background-service';
import { TextSearch, CombinedSearch } from '../../background-service/src/search/search.js';
import { OllamaClient } from '../../background-service/src/ai/ollama-client.js';

const PROFIL_LOG = path.join(process.env.APPDATA || '', 'AIWorkMemory', 'profiler.log');
function plog(msg: string) {
  try { fs.appendFileSync(PROFIL_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

let mainWindow: BrowserWindow | null = null;
let omnibarWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let db: Database | null = null;
let textSearch: TextSearch | null = null;
let combinedSearch: CombinedSearch | null = null;
let ollama: OllamaClient | null = null;

const config = new Config();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'AI Work Memory',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const uiPath = path.join(process.resourcesPath, 'ui', 'index.html');
  mainWindow.loadFile(uiPath);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load UI:', code, desc);
  });

  // Monitor main process event loop lag
  let lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 1000;
    if (lag > 100) {
      plog(`EVENT_LOOP_LAG: ${lag}ms at ${new Date().toISOString()}`);
    }
    lastCheck = now;
  }, 1000);
}

function createOmnibar(): void {
  omnibarWindow = new BrowserWindow({
    width: 700,
    height: 100, // Reduced height for simple search bar initially
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const uiPath = path.join(process.resourcesPath, 'ui', 'index.html');
  // Hash routing will be needed for multiple windows, assuming index.html#/omnibar
  omnibarWindow.loadURL(`file://${uiPath}#/omnibar`);

  omnibarWindow.on('blur', () => {
    omnibarWindow?.hide();
  });
}

function toggleOmnibar(): void {
  if (!omnibarWindow) return;
  if (omnibarWindow.isVisible()) {
    omnibarWindow.hide();
  } else {
    omnibarWindow.show();
    omnibarWindow.focus();
  }
}


function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('AI Work Memory');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function profileHandler(name: string, fn: (...args: any[]) => any) {
  return async (...args: any[]) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const ms = Math.round(performance.now() - start);
      if (ms > 50) plog(`IPC_SLOW: ${name} took ${ms}ms`);
      else plog(`IPC: ${name} ${ms}ms`);
      return result;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      plog(`IPC_ERROR: ${name} failed in ${ms}ms - ${err}`);
      throw err;
    }
  };
}

function setupIpc(): void {
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('omnibar-hide', () => omnibarWindow?.hide());

  ipcMain.handle('get-config', profileHandler('get-config', () => config.get()));
  ipcMain.handle('update-config', profileHandler('update-config', (_event, partial) => {
    config.update(partial);
    return config.get();
  }));

  ipcMain.handle('get-dashboard-stats', profileHandler('get-dashboard-stats', () => {
    if (!db) return { totalActivities: 0, totalScreenshots: 0, totalSessions: 0, topApps: [] };
    try {
      const today = new Date().toISOString().split('T')[0];
      const actRow = db.prepare(`SELECT COUNT(*) as count FROM activities WHERE date(timestamp) = ?`).get(today) as { count: number };
      const ssRow = db.prepare(`SELECT COUNT(*) as count FROM screenshots WHERE date(timestamp) = ?`).get(today) as { count: number };
      const sessRow = db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE date(start_time) = ?`).get(today) as { count: number };
      const topApps = db.prepare(`SELECT app_name as name, COUNT(*) as count FROM activities WHERE date(timestamp) = ? AND duration_seconds IS NOT NULL GROUP BY app_name ORDER BY count DESC LIMIT 5`).all(today) as Array<{ name: string; count: number }>;
      return { totalActivities: actRow.count, totalScreenshots: ssRow.count, totalSessions: sessRow.count, topApps };
    } catch {
      return { totalActivities: 0, totalScreenshots: 0, totalSessions: 0, topApps: [] };
    }
  }));

  ipcMain.handle('get-recent-activities', profileHandler('get-recent-activities', (_event, limit = 20) => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT id, app_name, window_title, timestamp, duration_seconds FROM activities ORDER BY id DESC LIMIT ?`).all(limit);
    } catch { return []; }
  }));

  ipcMain.handle('search', profileHandler('search', async (_event, query: string) => {
    if (!textSearch || !query.trim()) return [];
    try { return textSearch.search(query, { limit: 20 }); } catch { return []; }
  }));

  ipcMain.handle('get-timeline', profileHandler('get-timeline', (_event, date: string) => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT hour, activity_summary, primary_app, primary_project, total_mouse_clicks, total_keystrokes, total_screenshots, productivity_score FROM timeline WHERE date = ? ORDER BY hour`).all(date);
    } catch { return []; }
  }));

  ipcMain.handle('get-sessions', profileHandler('get-sessions', (_event, limit = 20) => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT id, start_time, end_time, app_name, task_type, summary FROM sessions ORDER BY id DESC LIMIT ?`).all(limit);
    } catch { return []; }
  }));

  ipcMain.handle('get-screenshots-by-date', profileHandler('get-screenshots-by-date', (_event, date: string) => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT id, timestamp, file_path, ai_description, ai_app, ai_project FROM screenshots WHERE date(timestamp) = ? ORDER BY timestamp ASC`).all(date);
    } catch { return []; }
  }));

  ipcMain.handle('restore-context', profileHandler('restore-context', async (_event, projectPath: string) => {
    try {
      if (!projectPath) return false;
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Launch VS Code in the project directory
      await execAsync(`code "${projectPath}"`);
      return true;
    } catch (err) {
      console.error('Failed to restore context:', err);
      return false;
    }
  }));

  ipcMain.handle('get-screenshot-image', profileHandler('get-screenshot-image', (_event, filePath: string) => {
    if (!filePath) return null;
    try { return fs.readFileSync(filePath); } catch { return null; }
  }));

  ipcMain.handle('chat', profileHandler('chat', async (_event, message: string) => {
    if (!ollama || !db || !combinedSearch) {
      return { role: 'assistant', content: 'Ollama or Database is not available. Please ensure Ollama is running locally.' };
    }
    try {
      const isAvailable = await ollama.isAvailable();
      if (!isAvailable) {
        return { role: 'assistant', content: 'Ollama is not running. Please start Ollama to use AI chat.' };
      }
    } catch {
      return { role: 'assistant', content: 'Cannot connect to Ollama. Please ensure it is running on localhost:11434.' };
    }
    try {
      const searchResults = await combinedSearch.search(message, { limit: 10 });
      let contextBlock = '';
      
      const keywordResults = searchResults.textResults;
      const semanticResults = searchResults.vectorResults;

      if (keywordResults.length > 0 || semanticResults.length > 0) {
        if (keywordResults.length > 0) {
          contextBlock += '\n\nRelevant work history (Keyword Matches):\n' + keywordResults
            .map((r) => `- [${r.type}] ${r.title} (${new Date(r.timestamp).toLocaleString()}): ${(String(r.snippet || '')).replace(/<\/?mark>/g, '')}`)
            .join('\n');
        }
        
        if (semanticResults.length > 0) {
          contextBlock += '\n\nRelevant work history (Semantic/Visual Matches):\n' + semanticResults
            .map((r) => `- [${r.sourceType}] ${r.appName || 'Unknown App'} - ${r.projectName || ''} (${r.timestamp ? new Date(r.timestamp).toLocaleString() : 'Unknown Time'}): ${r.text}`)
            .join('\n');
        }
      } else {
        // Fallback: get recent activities directly from DB
        try {
          const recentStmt = db.prepare(`
            SELECT app_name, window_title, timestamp FROM activities
            ORDER BY timestamp DESC LIMIT 20
          `);
          const recent = recentStmt.all() as Array<{ app_name: string; window_title: string; timestamp: string }>;
          if (recent.length > 0) {
            contextBlock = '\n\nRecent computer activity (last 20 entries):\n' + recent
              .map((r) => `- ${r.app_name}: ${r.window_title || '(no title)'} (${new Date(r.timestamp).toLocaleString()})`)
              .join('\n');
          }
        } catch {
          // ignore
        }
      }
      const today = new Date().toISOString().split('T')[0];
      const systemPrompt = `You are an AI work memory assistant. You answer ONLY about the user's computer activity data provided below. You MUST use this data to answer questions. Never say you don't have access — the data is right here. Be specific with app names, times, and details. Current date: ${today}. Rules:
1. ONLY answer based on the activity data provided
2. Summarize patterns, not individual entries
3. If asked about today, look for today's date in the data
4. Always reference specific apps and times from the data`;
      const fullPrompt = `${systemPrompt}${contextBlock}\n\nUser question: ${message}\n\nAnswer based ONLY on the data above:`;
      const cfg = config.get();
      const response = await ollama.generate({ model: cfg.ai.textModel, prompt: fullPrompt });
      return { role: 'assistant', content: response };
    } catch (err: any) {
      return { role: 'assistant', content: `Sorry, I encountered an error communicating with Ollama: ${err.message || String(err)}` };
    }
  }));

  ipcMain.handle('get-service-status', profileHandler('get-service-status', () => ({
    running: db !== null,
    ollama: ollama !== null,
  })));

  ipcMain.handle('get-activity-log', profileHandler('get-activity-log', (_event, options: { limit?: number; offset?: number; appFilter?: string } = {}) => {
    if (!db) return { activities: [], screenshots: [], total: 0 };
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      let activityQuery = `SELECT id, app_name, app_executable, window_title, timestamp, duration_seconds FROM activities`;
      let countQuery = `SELECT COUNT(*) as count FROM activities`;
      const params: unknown[] = [];
      const countParams: unknown[] = [];
      if (options.appFilter) {
        activityQuery += ` WHERE app_name LIKE ?`;
        countQuery += ` WHERE app_name LIKE ?`;
        params.push(`%${options.appFilter}%`);
        countParams.push(`%${options.appFilter}%`);
      }
      activityQuery += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      const activities = db.prepare(activityQuery).all(...params);
      const total = (db.prepare(countQuery).get(...countParams) as { count: number }).count;
      const screenshots = db.prepare(`SELECT id, timestamp, file_path, image_hash, ai_description, ai_app, ai_task, ai_state, ai_processed, ai_project, ai_language, ai_framework FROM screenshots ORDER BY id DESC LIMIT 50`).all();
      return { activities, screenshots, total };
    } catch {
      return { activities: [], screenshots: [], total: 0 };
    }
  }));

  ipcMain.handle('get-reports', profileHandler('get-reports', (_event, options: { type?: string; limit?: number; date?: string } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 20;
      let query = `SELECT id, type, date, content, summary, generated_at FROM reports`;
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (options.type) {
        conditions.push(`type = ?`);
        params.push(options.type);
      }
      if (options.date) {
        conditions.push(`date = ?`);
        params.push(options.date);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY generated_at DESC LIMIT ?`;
      params.push(limit);

      return db.prepare(query).all(...params);
    } catch {
      return [];
    }
  }));
}

async function initBackgroundService(): Promise<void> {
  try {
    const start = performance.now();
    const cfg = config.get();
    db = new Database(cfg.dbPath);
    plog(`DB_OPEN: ${Math.round(performance.now() - start)}ms`);

    textSearch = new TextSearch(db);
    combinedSearch = new CombinedSearch(db);
    ollama = new OllamaClient();

    // Listen for proactive AI events
    eventBus.on('SYSTEM_RESOURCE_UPDATE', (event) => {
      const data = event.payload;
      if (data.action === 'THRASHING_DETECTED' || data.action === 'DISTRACTION_NUDGE') {
        new Notification({
          title: 'AI Work Memory',
          body: data.message as string || 'Need some help?',
        }).show();
      }
    });

    eventBus.on('STANDUP_READY', (event) => {
      const data = event.payload;
      if (data.content) {
        clipboard.writeText(data.content as string);
        new Notification({
          title: 'Daily Standup Ready',
          body: 'Your automated standup draft has been copied to your clipboard!',
        }).show();
      }
    });

    const bgStart = performance.now();
    await startBackgroundService(db, eventBus, cfg);
    plog(`BG_SERVICE_START: ${Math.round(performance.now() - bgStart)}ms`);
    console.log('Background service started successfully');
  } catch (err) {
    console.error('Failed to start background service:', err);
  }
}

app.whenReady().then(async () => {
  plog('APP_READY');
  const start = performance.now();

  setupIpc();
  plog(`IPC_SETUP: ${Math.round(performance.now() - start)}ms`);

  createWindow();
  plog(`WINDOW_CREATE: ${Math.round(performance.now() - start)}ms`);

  createOmnibar();
  plog(`OMNIBAR_CREATE: ${Math.round(performance.now() - start)}ms`);

  globalShortcut.register('Alt+Space', toggleOmnibar);
  plog(`SHORTCUT_REGISTER: ${Math.round(performance.now() - start)}ms`);

  createTray();
  plog(`TRAY_CREATE: ${Math.round(performance.now() - start)}ms`);

  await initBackgroundService();
  plog(`TOTAL_STARTUP: ${Math.round(performance.now() - start)}ms`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  plog('APP_QUIT');
  isQuitting = true;
  await stopBackgroundService();
  if (db) {
    db.close();
    db = null;
  }
});
