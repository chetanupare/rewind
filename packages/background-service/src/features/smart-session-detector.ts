import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface DetectedSession {
  id: number;
  startTime: string;
  endTime: string | null;
  type: SessionType;
  confidence: number;
  apps: string[];
  activities: number;
  summary: string | null;
}

type SessionType = 
  | 'coding'
  | 'meeting'
  | 'research'
  | 'email'
  | 'design'
  | 'debugging'
  | 'testing'
  | 'deployment'
  | 'planning'
  | 'learning'
  | 'communication'
  | 'other';

interface SessionPattern {
  type: SessionType;
  apps: string[];
  keywords: string[];
  minDuration: number;
  maxGap: number;
}

export class SmartSessionDetector {
  private currentSession: {
    startTime: Date;
    type: SessionType;
    apps: Set<string>;
    activities: number;
    lastActivity: Date;
    confidence: number;
  } | null = null;

  private patterns: SessionPattern[] = [
    {
      type: 'coding',
      apps: ['code', 'cursor', 'visual studio', 'intellij', 'webstorm', 'android studio', 'vim', 'neovim'],
      keywords: ['editing', 'coding', 'programming', 'developing'],
      minDuration: 300000,
      maxGap: 300000,
    },
    {
      type: 'meeting',
      apps: ['zoom', 'teams', 'meet', 'webex', 'skype', 'slack', 'discord'],
      keywords: ['meeting', 'call', 'standup', 'sync'],
      minDuration: 60000,
      maxGap: 60000,
    },
    {
      type: 'research',
      apps: ['chrome', 'edge', 'firefox', 'brave'],
      keywords: ['search', 'research', 'documentation', 'reading', 'browsing'],
      minDuration: 120000,
      maxGap: 300000,
    },
    {
      type: 'email',
      apps: ['outlook', 'thunderbird', 'mail', 'gmail'],
      keywords: ['email', 'mail', 'inbox', 'compose'],
      minDuration: 60000,
      maxGap: 300000,
    },
    {
      type: 'design',
      apps: ['figma', 'sketch', 'photoshop', 'illustrator', 'canva', 'adobe'],
      keywords: ['design', 'ui', 'ux', 'mockup', 'wireframe'],
      minDuration: 300000,
      maxGap: 300000,
    },
    {
      type: 'debugging',
      apps: ['code', 'cursor', 'visual studio', 'chrome devtools'],
      keywords: ['debug', 'error', 'fix', 'bug', 'exception', 'stack trace'],
      minDuration: 120000,
      maxGap: 300000,
    },
    {
      type: 'testing',
      apps: ['code', 'cursor', 'terminal', 'postman', 'insomnia'],
      keywords: ['test', 'testing', 'spec', 'coverage', 'jest', 'mocha', 'cypress'],
      minDuration: 120000,
      maxGap: 300000,
    },
    {
      type: 'deployment',
      apps: ['terminal', 'powershell', 'cmd', 'docker'],
      keywords: ['deploy', 'release', 'build', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes'],
      minDuration: 60000,
      maxGap: 300000,
    },
  ];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detected_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        type TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        apps TEXT DEFAULT '[]',
        activities INTEGER DEFAULT 0,
        summary TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_det_session_time ON detected_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_det_session_type ON detected_sessions(type);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.onActivity(appName, windowTitle);
    });

    this.bus.on('KEYSTROKE_BATCH', () => {
      if (this.currentSession) {
        this.currentSession.activities++;
        this.currentSession.lastActivity = new Date();
      }
    });

    this.bus.on('MOUSE_CLICKED', () => {
      if (this.currentSession) {
        this.currentSession.lastActivity = new Date();
      }
    });
  }

  private onActivity(appName: string, windowTitle: string): void {
    const now = new Date();
    const lower = appName.toLowerCase();

    if (!this.currentSession) {
      const detectedType = this.detectSessionType(appName, windowTitle);
      if (detectedType) {
        this.startSession(detectedType, appName);
      }
      return;
    }

    const timeSinceLastActivity = now.getTime() - this.currentSession.lastActivity.getTime();
    const pattern = this.patterns.find(p => p.type === this.currentSession!.type);

    if (pattern && timeSinceLastActivity > pattern.maxGap) {
      this.endSession();
      const detectedType = this.detectSessionType(appName, windowTitle);
      if (detectedType) {
        this.startSession(detectedType, appName);
      }
      return;
    }

    const isRelevantApp = pattern?.apps.some(a => lower.includes(a)) ?? false;
    if (isRelevantApp) {
      this.currentSession.apps.add(appName);
      this.currentSession.activities++;
      this.currentSession.lastActivity = now;
      this.currentSession.confidence = Math.min(1, this.currentSession.confidence + 0.01);
    } else {
      const isDifferentType = this.patterns.some(p => 
        p.type !== this.currentSession!.type && p.apps.some(a => lower.includes(a))
      );

      if (isDifferentType) {
        const duration = now.getTime() - this.currentSession.startTime.getTime();
        if (duration > 60000) {
          this.endSession();
          const detectedType = this.detectSessionType(appName, windowTitle);
          if (detectedType) {
            this.startSession(detectedType, appName);
          }
        }
      }
    }
  }

  private detectSessionType(appName: string, windowTitle: string): SessionType | null {
    const combined = `${appName} ${windowTitle}`.toLowerCase();

    for (const pattern of this.patterns) {
      const appMatch = pattern.apps.some(a => combined.includes(a));
      const keywordMatch = pattern.keywords.some(k => combined.includes(k));

      if (appMatch || keywordMatch) {
        return pattern.type;
      }
    }

    return null;
  }

  private startSession(type: SessionType, appName: string): void {
    this.currentSession = {
      startTime: new Date(),
      type,
      apps: new Set([appName]),
      activities: 1,
      lastActivity: new Date(),
      confidence: 0.7,
    };

    log.info({ type, app: appName }, 'Session detected');
  }

  private async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.currentSession.startTime.getTime()) / 60000);

    if (durationMinutes < 1) {
      this.currentSession = null;
      return;
    }

    const summary = this.generateSummary();

    try {
      this.db.prepare(`
        INSERT INTO detected_sessions (start_time, end_time, type, confidence, apps, activities, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.currentSession.startTime.toISOString(),
        endTime.toISOString(),
        this.currentSession.type,
        this.currentSession.confidence,
        JSON.stringify(Array.from(this.currentSession.apps)),
        this.currentSession.activities,
        summary
      );

      this.bus.emit('SESSION_DETECTED', 'session-detector', {
        type: this.currentSession.type,
        duration: durationMinutes,
        apps: Array.from(this.currentSession.apps),
        confidence: this.currentSession.confidence,
      });

      log.info({ type: this.currentSession.type, duration: durationMinutes }, 'Session ended');
    } catch (err) {
      log.warn({ err }, 'Failed to save detected session');
    }

    this.currentSession = null;
  }

  private generateSummary(): string {
    if (!this.currentSession) return '';

    const apps = Array.from(this.currentSession.apps);
    const type = this.currentSession.type;
    const duration = Math.round((Date.now() - this.currentSession.startTime.getTime()) / 60000);

    const typeDescriptions: Record<SessionType, string> = {
      coding: 'Coding session',
      meeting: 'Meeting',
      research: 'Research session',
      email: 'Email session',
      design: 'Design session',
      debugging: 'Debugging session',
      testing: 'Testing session',
      deployment: 'Deployment session',
      planning: 'Planning session',
      learning: 'Learning session',
      communication: 'Communication',
      other: 'Work session',
    };

    return `${typeDescriptions[type]} with ${apps.slice(0, 3).join(', ')} (${duration}min)`;
  }

  async getRecentSessions(limit = 20): Promise<DetectedSession[]> {
    return this.db.prepare(`
      SELECT * FROM detected_sessions ORDER BY start_time DESC LIMIT ?
    `).all(limit).map((r: any) => ({
      ...r,
      apps: JSON.parse(r.apps || '[]'),
    })) as DetectedSession[];
  }

  async getSessionsByType(type: SessionType, limit = 20): Promise<DetectedSession[]> {
    return this.db.prepare(`
      SELECT * FROM detected_sessions WHERE type = ? ORDER BY start_time DESC LIMIT ?
    `).all(type, limit).map((r: any) => ({
      ...r,
      apps: JSON.parse(r.apps || '[]'),
    })) as DetectedSession[];
  }

  async getSessionStats(date: string): Promise<{
    totalSessions: number;
    byType: Record<string, number>;
    averageDuration: number;
    totalMinutes: number;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const sessions = this.db.prepare(`
      SELECT type, start_time, end_time FROM detected_sessions
      WHERE start_time BETWEEN ? AND ?
    `).all(start, end) as Array<{ type: string; start_time: string; end_time: string }>;

    const byType: Record<string, number> = {};
    let totalMinutes = 0;

    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
      if (session.end_time) {
        const duration = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
        totalMinutes += Math.round(duration / 60000);
      }
    }

    return {
      totalSessions: sessions.length,
      byType,
      averageDuration: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      totalMinutes,
    };
  }

  getCurrentSession(): DetectedSession | null {
    if (!this.currentSession) return null;

    return {
      id: 0,
      startTime: this.currentSession.startTime.toISOString(),
      endTime: null,
      type: this.currentSession.type,
      confidence: this.currentSession.confidence,
      apps: Array.from(this.currentSession.apps),
      activities: this.currentSession.activities,
      summary: this.generateSummary(),
    };
  }

  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  async forceEndSession(): Promise<void> {
    await this.endSession();
  }
}
