import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, globalShortcut, Notification, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { Config, Database, eventBus } from '@ai-work-memory/shared';
import { startBackgroundService, stopBackgroundService } from '@ai-work-memory/background-service';
import { TextSearch, CombinedSearch } from '../../background-service/src/search/search.js';
import { OllamaClient } from '../../background-service/src/ai/ollama-client.js';

const PROFIL_LOG = path.join(process.env.APPDATA || '', 'RewindX', 'profiler.log');
function plog(msg: string) {
  try { 
    const dir = path.dirname(PROFIL_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(PROFIL_LOG, `[${new Date().toISOString()}] ${msg}\n`); 
  } catch {}
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

function getUiPath(): string {
  // In development, load from packages/ui/dist
  // In production, load from resources
  const devPath = path.join(__dirname, '..', '..', '..', 'ui', 'dist', 'index.html');
  const prodPath = path.join(process.resourcesPath, 'ui', 'index.html');
  
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return prodPath;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    title: 'RewindX',
    backgroundColor: '#090B16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const uiPath = getUiPath();
  plog(`Loading UI from: ${uiPath}`);
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
    plog('UI loaded successfully');
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    plog(`Failed to load UI: ${code} - ${desc}`);
    console.error('Failed to load UI:', code, desc);
  });

  // Monitor main process event loop lag
  let lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 1000;
    if (lag > 100) {
      plog(`EVENT_LOOP_LAG: ${lag}ms`);
    }
    lastCheck = now;
  }, 1000);
}

function createOmnibar(): void {
  omnibarWindow = new BrowserWindow({
    width: 700,
    height: 100,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#090B16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const uiPath = getUiPath();
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
  const iconPath = path.join(__dirname, '..', '..', 'electron-app', 'build', 'icon.png');
  let icon: nativeImage;
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show RewindX',
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

  tray.setToolTip('RewindX');
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
      const systemPrompt = `You are RewindX, an AI work memory assistant. You answer ONLY about the user's computer activity data provided below. You MUST use this data to answer questions. Never say you don't have access — the data is right here. Be specific with app names, times, and details. Current date: ${today}. Rules:
1. ONLY answer based on the activity data provided
2. Summarize patterns, not individual entries
3. If asked about today, look for today's date in the data
4. Always reference specific apps and times from the data`;
      const fullPrompt = `${systemPrompt}${contextBlock}\n\nUser question: ${message}\n\nAnswer based ONLY on the data above:`;
      const cfg = config.get();
      const responsePromise = ollama.generate({ model: cfg.ai.textModel, prompt: fullPrompt });
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('AI response timeout')), 30000)
      );
      const response = await Promise.race([responsePromise, timeoutPromise]);
      return { role: 'assistant', content: response };
    } catch (err: any) {
      return { role: 'assistant', content: `Sorry, I encountered an error: ${err.message || String(err)}` };
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

  // Memory Bookmarks
  ipcMain.handle('get-memories', profileHandler('get-memories', (_event, options: { type?: string; limit?: number } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 100;
      let query = `SELECT * FROM bookmarks`;
      const params: unknown[] = [];
      if (options.type) {
        query += ` WHERE type = ?`;
        params.push(options.type);
      }
      query += ` ORDER BY pinned DESC, created_at DESC LIMIT ?`;
      params.push(limit);
      const rows = db.prepare(query).all(...params) as any[];
      return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]'), pinned: r.pinned === 1 }));
    } catch { return []; }
  }));

  ipcMain.handle('create-bookmark', profileHandler('create-bookmark', (_event, data: { type: string; title: string; description?: string; tags?: string[] }) => {
    if (!db) return null;
    try {
      const result = db.prepare(`INSERT INTO bookmarks (timestamp, type, title, description, tags) VALUES (?, ?, ?, ?, ?)`)
        .run(new Date().toISOString(), data.type, data.title, data.description || '', JSON.stringify(data.tags || []));
      return result.lastInsertRowid;
    } catch { return null; }
  }));

  ipcMain.handle('get-bookmarks', profileHandler('get-bookmarks', (_event, options: { limit?: number } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 50;
      const rows = db.prepare(`SELECT * FROM bookmarks ORDER BY pinned DESC, created_at DESC LIMIT ?`).all(limit) as any[];
      return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]'), pinned: r.pinned === 1 }));
    } catch { return []; }
  }));

  ipcMain.handle('toggle-bookmark-pin', profileHandler('toggle-bookmark-pin', (_event, id: number) => {
    if (!db) return false;
    try {
      db.prepare(`UPDATE bookmarks SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
      return true;
    } catch { return false; }
  }));

  ipcMain.handle('delete-bookmark', profileHandler('delete-bookmark', (_event, id: number) => {
    if (!db) return false;
    try {
      db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(id);
      return true;
    } catch { return false; }
  }));

  // Developer Mode
  ipcMain.handle('get-dev-events', profileHandler('get-dev-events', (_event, options: { type?: string; limit?: number; date?: string } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 100;
      let query = `SELECT * FROM dev_events`;
      const params: unknown[] = [];
      const conditions: string[] = [];
      if (options.type) { conditions.push(`type = ?`); params.push(options.type); }
      if (options.date) { conditions.push(`date(timestamp) = ?`); params.push(options.date); }
      if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);
      return db.prepare(query).all(...params);
    } catch { return []; }
  }));

  ipcMain.handle('get-dev-stats', profileHandler('get-dev-stats', (_event, date: string) => {
    if (!db) return { commits: 0, screenshots: 0, terminalSessions: 0, fileChanges: 0, activeHours: 0 };
    try {
      const start = `${date}T00:00:00.000Z`;
      const end = `${date}T23:59:59.999Z`;
      const stats = db.prepare(`SELECT type, COUNT(*) as count FROM dev_events WHERE timestamp BETWEEN ? AND ? GROUP BY type`).all(start, end) as Array<{ type: string; count: number }>;
      const result = { commits: 0, screenshots: 0, terminalSessions: 0, fileChanges: 0, activeHours: 0 };
      for (const stat of stats) {
        switch (stat.type) {
          case 'commit': result.commits = stat.count; break;
          case 'screenshot': result.screenshots = stat.count; break;
          case 'terminal': result.terminalSessions = stat.count; break;
          case 'file_change': result.fileChanges = stat.count; break;
        }
      }
      const hours = db.prepare(`SELECT DISTINCT strftime('%H', timestamp) as hour FROM dev_events WHERE timestamp BETWEEN ? AND ?`).all(start, end) as Array<{ hour: string }>;
      result.activeHours = hours.length;
      return result;
    } catch { return { commits: 0, screenshots: 0, terminalSessions: 0, fileChanges: 0, activeHours: 0 }; }
  }));

  // Focus Analytics
  ipcMain.handle('get-focus-stats', profileHandler('get-focus-stats', (_event, date: string) => {
    if (!db) return { totalFocusMinutes: 0, deepWorkMinutes: 0, shallowWorkMinutes: 0, breakMinutes: 0, meetingMinutes: 0, averageSessionLength: 0, longestSession: 0, interruptionCount: 0, focusScore: 0, productiveHours: {} };
    try {
      const start = `${date}T00:00:00.000Z`;
      const end = `${date}T23:59:59.999Z`;
      const sessions = db.prepare(`SELECT * FROM focus_sessions WHERE start_time BETWEEN ? AND ?`).all(start, end) as any[];
      const stats = { totalFocusMinutes: 0, deepWorkMinutes: 0, shallowWorkMinutes: 0, breakMinutes: 0, meetingMinutes: 0, averageSessionLength: 0, longestSession: 0, interruptionCount: 0, focusScore: 0, productiveHours: {} as Record<string, number> };
      for (const s of sessions) {
        const dur = s.duration_minutes || 0;
        stats.totalFocusMinutes += dur;
        switch (s.type) { case 'deep_work': stats.deepWorkMinutes += dur; break; case 'shallow_work': stats.shallowWorkMinutes += dur; break; case 'break': stats.breakMinutes += dur; break; case 'meeting': stats.meetingMinutes += dur; break; }
        stats.interruptionCount += s.interruptions || 0;
        if (dur > stats.longestSession) stats.longestSession = dur;
        const hour = new Date(s.start_time).getHours().toString().padStart(2, '0');
        stats.productiveHours[hour] = (stats.productiveHours[hour] || 0) + dur;
      }
      stats.averageSessionLength = sessions.length > 0 ? Math.round(stats.totalFocusMinutes / sessions.length) : 0;
      stats.focusScore = sessions.length > 0 ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / sessions.length) : 0;
      return stats;
    } catch { return { totalFocusMinutes: 0, deepWorkMinutes: 0, shallowWorkMinutes: 0, breakMinutes: 0, meetingMinutes: 0, averageSessionLength: 0, longestSession: 0, interruptionCount: 0, focusScore: 0, productiveHours: {} }; }
  }));

  ipcMain.handle('get-focus-sessions', profileHandler('get-focus-sessions', (_event, options: { limit?: number; date?: string } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 20;
      let query = `SELECT * FROM focus_sessions`;
      const params: unknown[] = [];
      if (options.date) { query += ` WHERE date(start_time) = ?`; params.push(options.date); }
      query += ` ORDER BY start_time DESC LIMIT ?`;
      params.push(limit);
      return db.prepare(query).all(...params);
    } catch { return []; }
  }));

  ipcMain.handle('get-weekly-focus-trend', profileHandler('get-weekly-focus-trend', () => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT date(start_time) as date, SUM(duration_minutes) as focusMinutes, AVG(score) as score FROM focus_sessions WHERE start_time > datetime('now', '-7 days') GROUP BY date(start_time) ORDER BY date ASC`).all();
    } catch { return []; }
  }));

  // Meetings
  ipcMain.handle('get-meetings', profileHandler('get-meetings', (_event, date?: string) => {
    if (!db) return [];
    try {
      let query = `SELECT * FROM meetings`;
      const params: unknown[] = [];
      if (date) { query += ` WHERE date(start_time) = ?`; params.push(date); }
      query += ` ORDER BY start_time DESC LIMIT 20`;
      const rows = db.prepare(query).all(...params) as any[];
      return rows.map(r => ({ ...r, participants: JSON.parse(r.participants || '[]'), actionItems: JSON.parse(r.action_items || '[]'), screenshotIds: JSON.parse(r.screenshot_ids || '[]') }));
    } catch { return []; }
  }));

  ipcMain.handle('get-meeting-notes', profileHandler('get-meeting-notes', (_event, meetingId: number) => {
    if (!db) return [];
    try { return db.prepare(`SELECT * FROM meeting_notes WHERE meeting_id = ? ORDER BY timestamp ASC`).all(meetingId); } catch { return []; }
  }));

  // Projects
  ipcMain.handle('get-projects', profileHandler('get-projects', () => {
    if (!db) return [];
    try {
      const rows = db.prepare(`SELECT * FROM detected_projects ORDER BY last_seen DESC`).all() as any[];
      return rows.map(r => ({ ...r, technologies: JSON.parse(r.technologies || '[]'), isActive: r.is_active === 1 }));
    } catch { return []; }
  }));

  ipcMain.handle('get-project-activities', profileHandler('get-project-activities', (_event, projectId: number, limit = 100) => {
    if (!db) return [];
    try { return db.prepare(`SELECT * FROM project_activities WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`).all(projectId, limit); } catch { return []; }
  }));

  // Session Replay
  ipcMain.handle('get-replays', profileHandler('get-replays', (_event, limit = 20) => {
    if (!db) return [];
    try { return db.prepare(`SELECT * FROM replay_sessions ORDER BY start_time DESC LIMIT ?`).all(limit); } catch { return []; }
  }));

  ipcMain.handle('get-replay', profileHandler('get-replay', (_event, id: number) => {
    if (!db) return null;
    try {
      const session = db.prepare(`SELECT * FROM replay_sessions WHERE id = ?`).get(id);
      if (!session) return null;
      return session;
    } catch { return null; }
  }));

  ipcMain.handle('create-replay', profileHandler('create-replay', (_event, startTime: string, endTime: string, project?: string) => {
    if (!db) return null;
    try {
      const activities = db.prepare(`SELECT * FROM activities WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC`).all(startTime, endTime);
      const screenshots = db.prepare(`SELECT * FROM screenshots WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC`).all(startTime, endTime);
      const commits = db.prepare(`SELECT * FROM git_events WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC`).all(startTime, endTime);
      const steps = [...activities, ...screenshots, ...commits].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60);
      const summary = `${steps.length} activities. ${commits.length} commits, ${screenshots.length} screenshots.`;
      const result = db.prepare(`INSERT INTO replay_sessions (start_time, end_time, project, step_count, summary, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)`).run(startTime, endTime, project || '', steps.length, summary, duration);
      return { id: result.lastInsertRowid, steps, summary, duration };
    } catch { return null; }
  }));

  // NL Automation
  ipcMain.handle('process-nl-command', profileHandler('process-nl-command', async (_event, input: string) => {
    try {
      const lower = input.toLowerCase();
      if (lower.startsWith('remind me') || lower.startsWith('set reminder')) {
        const now = new Date();
        if (lower.includes('tomorrow')) now.setDate(now.getDate() + 1);
        if (lower.includes('next hour')) now.setHours(now.getHours() + 1);
        const title = input.replace(/remind me|set reminder|tomorrow|next hour|about|to/gi, '').trim();
        if (db) {
          db.prepare(`INSERT INTO reminders (title, remind_at) VALUES (?, ?)`).run(title || 'Reminder', now.toISOString());
        }
        return { success: true, message: `Reminder set for ${now.toLocaleString()}` };
      }
      return { success: false, message: 'Command not recognized. Try "Remind me tomorrow about..."' };
    } catch { return { success: false, message: 'Failed to process command' }; }
  }));

  ipcMain.handle('get-reminders', profileHandler('get-reminders', (_event, includeCompleted = false) => {
    if (!db) return [];
    try {
      const query = includeCompleted ? `SELECT * FROM reminders ORDER BY remind_at DESC` : `SELECT * FROM reminders WHERE completed = 0 ORDER BY remind_at ASC`;
      return db.prepare(query).all();
    } catch { return []; }
  }));

  ipcMain.handle('get-automation-rules', profileHandler('get-automation-rules', () => {
    if (!db) return [];
    try { return db.prepare(`SELECT * FROM automation_rules ORDER BY created_at DESC`).all(); } catch { return []; }
  }));

  ipcMain.handle('complete-reminder', profileHandler('complete-reminder', (_event, id: number) => {
    if (!db) return false;
    try { db.prepare(`UPDATE reminders SET completed = 1 WHERE id = ?`).run(id); return true; } catch { return false; }
  }));

  // Knowledge Graph
  ipcMain.handle('get-knowledge-graph', profileHandler('get-knowledge-graph', (_event, type: string, id: number, depth = 2) => {
    if (!db) return { nodes: [], edges: [] };
    try {
      const links = db.prepare(`SELECT * FROM memory_links WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?) ORDER BY strength DESC LIMIT 50`).all(type, id, type, id);
      return { nodes: [], edges: links };
    } catch { return { nodes: [], edges: [] }; }
  }));

  ipcMain.handle('get-linked-memories', profileHandler('get-linked-memories', (_event, type: string, id: number) => {
    if (!db) return [];
    try {
      return db.prepare(`SELECT * FROM memory_links WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?) ORDER BY strength DESC LIMIT 20`).all(type, id, type, id);
    } catch { return []; }
  }));

  // Memory API Port
  ipcMain.handle('get-memory-api-port', profileHandler('get-memory-api-port', () => 48291));

  // Screenshots with AI Reviews
  ipcMain.handle('get-screenshots-with-reviews', profileHandler('get-screenshots-with-reviews', (_event, options: { date?: string; limit?: number } = {}) => {
    if (!db) return [];
    try {
      const limit = options.limit || 50;
      let query = `SELECT id, timestamp, file_path, image_hash, width, height, ocr_text, ai_description, ai_app, ai_task, ai_project, ai_language, ai_framework, ai_state, ai_processed, ocr_processed FROM screenshots`;
      const params: unknown[] = [];
      if (options.date) {
        query += ` WHERE date(timestamp) = ?`;
        params.push(options.date);
      }
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);
      return db.prepare(query).all(...params);
    } catch { return []; }
  }));

  ipcMain.handle('get-screenshot-stats', profileHandler('get-screenshot-stats', (_event, date: string) => {
    if (!db) return { total: 0, analyzed: 0, pending: 0, withOcr: 0 };
    try {
      const start = `${date}T00:00:00.000Z`;
      const end = `${date}T23:59:59.999Z`;
      const total = (db.prepare(`SELECT COUNT(*) as count FROM screenshots WHERE timestamp BETWEEN ? AND ?`).get(start, end) as { count: number }).count;
      const analyzed = (db.prepare(`SELECT COUNT(*) as count FROM screenshots WHERE timestamp BETWEEN ? AND ? AND ai_processed = 1`).get(start, end) as { count: number }).count;
      const withOcr = (db.prepare(`SELECT COUNT(*) as count FROM screenshots WHERE timestamp BETWEEN ? AND ? AND ocr_processed = 1`).get(start, end) as { count: number }).count;
      return { total, analyzed, pending: total - analyzed, withOcr };
    } catch { return { total: 0, analyzed: 0, pending: 0, withOcr: 0 }; }
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

    eventBus.on('SYSTEM_RESOURCE_UPDATE', (event) => {
      const data = event.payload;
      if (data.action === 'THRASHING_DETECTED' || data.action === 'DISTRACTION_NUDGE') {
        new Notification({
          title: 'RewindX',
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
    plog(`BG_SERVICE_ERROR: ${err}`);
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
