import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface SessionMemory {
  id: number;
  startTime: string;
  endTime: string;
  summary: string;
  activities: Array<{ time: string; app: string; action: string }>;
  commits: Array<{ time: string; message: string; repo: string }>;
  screenshots: number;
  websites: Array<{ site: string; duration: number }>;
  productivity: 'high' | 'medium' | 'low';
}

export class SessionMemoryBuilder {
  private currentSession: {
    startTime: Date;
    activities: Array<{ time: Date; app: string; windowTitle: string }>;
    commits: Array<{ time: Date; message: string; repo: string }>;
    screenshots: number;
    websites: Map<string, number>;
  } | null = null;

  private sessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  constructor(
    private db: Database,
    private bus: EventBus,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        summary TEXT,
        activities TEXT DEFAULT '[]',
        commits TEXT DEFAULT '[]',
        screenshots INTEGER DEFAULT 0,
        websites TEXT DEFAULT '[]',
        productivity TEXT DEFAULT 'medium',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_session_mem_time ON session_memories(start_time);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.onActivity(appName, windowTitle);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      const { repoPath, commitMessage } = event.payload as any;
      this.onCommit(repoPath, commitMessage);
    });

    this.bus.on('SCREENSHOT_CAPTURED', () => {
      this.onScreenshot();
    });

    this.bus.on('BROWSER_CONTEXT', (event) => {
      const { site } = event.payload as any;
      this.onWebsite(site);
    });
  }

  private onActivity(app: string, windowTitle: string): void {
    if (!this.currentSession) {
      this.startSession();
    }

    this.currentSession!.activities.push({
      time: new Date(),
      app,
      windowTitle,
    });

    this.resetTimeout();
  }

  private onCommit(repo: string, message: string): void {
    if (!this.currentSession) {
      this.startSession();
    }

    this.currentSession!.commits.push({
      time: new Date(),
      message,
      repo,
    });

    this.resetTimeout();
  }

  private onScreenshot(): void {
    if (!this.currentSession) {
      this.startSession();
    }

    this.currentSession!.screenshots++;
    this.resetTimeout();
  }

  private onWebsite(site: string): void {
    if (!this.currentSession) {
      this.startSession();
    }

    const current = this.currentSession!.websites.get(site) || 0;
    this.currentSession!.websites.set(site, current + 1);
    this.resetTimeout();
  }

  private startSession(): void {
    this.currentSession = {
      startTime: new Date(),
      activities: [],
      commits: [],
      screenshots: 0,
      websites: new Map(),
    };

    log.info('Session memory started');
  }

  private resetTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(() => {
      this.endSession();
    }, this.SESSION_TIMEOUT_MS);
  }

  private async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.currentSession.startTime.getTime()) / 60000);

    if (durationMinutes < 2) {
      this.currentSession = null;
      return;
    }

    const summary = await this.generateSummary();

    const websites = Array.from(this.currentSession.websites.entries())
      .map(([site, visits]) => ({ site, visits }))
      .sort((a, b) => b.visits - a.visits);

    const productivity = this.calculateProductivity();

    try {
      this.db.prepare(`
        INSERT INTO session_memories (start_time, end_time, summary, activities, commits, screenshots, websites, productivity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.currentSession.startTime.toISOString(),
        endTime.toISOString(),
        summary,
        JSON.stringify(this.currentSession.activities.slice(0, 100).map(a => ({
          time: a.time.toISOString(),
          app: a.app,
          action: a.windowTitle,
        }))),
        JSON.stringify(this.currentSession.commits),
        this.currentSession.screenshots,
        JSON.stringify(websites),
        productivity
      );

      log.info({ duration: durationMinutes, productivity }, 'Session memory saved');
    } catch (err) {
      log.warn({ err }, 'Failed to save session memory');
    }

    this.currentSession = null;
  }

  private async generateSummary(): Promise<string> {
    if (!this.currentSession) return '';

    const apps = new Set(this.currentSession.activities.map(a => a.app));
    const commitCount = this.currentSession.commits.length;
    const screenshotCount = this.currentSession.screenshots;

    const activities = this.currentSession.activities.slice(0, 20);
    const activityContext = activities.map(a => `- ${a.app}: ${a.windowTitle}`).join('\n');

    const commitContext = this.currentSession.commits.map(c => `- ${c.message} (${c.repo})`).join('\n');

    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) {
        return `Session with ${apps.size} apps, ${commitCount} commits, ${screenshotCount} screenshots.`;
      }

      const prompt = `Summarize this work session in 2-3 sentences:

Apps used: ${Array.from(apps).join(', ')}
Commits: ${commitCount}
Screenshots: ${screenshotCount}

Activities:
${activityContext}

${commitContext ? 'Git Commits:\n' + commitContext : ''}`;

      return await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
      });
    } catch {
      return `Session with ${apps.size} apps, ${commitCount} commits, ${screenshotCount} screenshots.`;
    }
  }

  private calculateProductivity(): 'high' | 'medium' | 'low' {
    if (!this.currentSession) return 'low';

    const productiveApps = ['code', 'cursor', 'visual studio', 'intellij', 'terminal', 'figma'];
    const distractionApps = ['chrome', 'edge', 'firefox', 'slack', 'discord', 'twitter', 'youtube', 'reddit'];

    let productiveCount = 0;
    let distractionCount = 0;

    for (const activity of this.currentSession.activities) {
      const lower = activity.app.toLowerCase();
      if (productiveApps.some(a => lower.includes(a))) productiveCount++;
      if (distractionApps.some(a => lower.includes(a))) distractionCount++;
    }

    const ratio = productiveCount / (productiveCount + distractionCount + 1);

    if (ratio > 0.7) return 'high';
    if (ratio > 0.4) return 'medium';
    return 'low';
  }

  async getRecentMemories(limit = 20): Promise<SessionMemory[]> {
    const rows = this.db.prepare(`
      SELECT * FROM session_memories ORDER BY start_time DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      summary: r.summary,
      activities: JSON.parse(r.activities || '[]'),
      commits: JSON.parse(r.commits || '[]'),
      screenshots: r.screenshots,
      websites: JSON.parse(r.websites || '[]'),
      productivity: r.productivity,
    }));
  }

  async getMemoryByTime(timestamp: string): Promise<SessionMemory | null> {
    const row = this.db.prepare(`
      SELECT * FROM session_memories 
      WHERE start_time <= ? AND end_time >= ?
      ORDER BY start_time DESC LIMIT 1
    `).get(timestamp, timestamp) as any;

    if (!row) return null;

    return {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      summary: row.summary,
      activities: JSON.parse(row.activities || '[]'),
      commits: JSON.parse(row.commits || '[]'),
      screenshots: row.screenshots,
      websites: JSON.parse(row.websites || '[]'),
      productivity: row.productivity,
    };
  }

  async searchMemories(query: string): Promise<SessionMemory[]> {
    const rows = this.db.prepare(`
      SELECT * FROM session_memories 
      WHERE summary LIKE ? OR activities LIKE ? OR commits LIKE ?
      ORDER BY start_time DESC LIMIT 20
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as any[];

    return rows.map(r => ({
      id: r.id,
      startTime: r.start_time,
      endTime: r.end_time,
      summary: r.summary,
      activities: JSON.parse(r.activities || '[]'),
      commits: JSON.parse(r.commits || '[]'),
      screenshots: r.screenshots,
      websites: JSON.parse(r.websites || '[]'),
      productivity: r.productivity,
    }));
  }

  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  async forceEndSession(): Promise<void> {
    await this.endSession();
  }
}
