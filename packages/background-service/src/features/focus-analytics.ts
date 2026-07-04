import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface FocusSession {
  id: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  type: 'deep_work' | 'shallow_work' | 'break' | 'meeting';
  score: number;
  interruptions: number;
  apps: string[];
  project: string;
}

interface FocusStats {
  totalFocusMinutes: number;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  averageSessionLength: number;
  longestSession: number;
  interruptionCount: number;
  focusScore: number;
  productiveHours: Record<string, number>;
}

export class FocusAnalytics {
  private currentSession: {
    startTime: Date;
    lastActivity: Date;
    apps: Set<string>;
    interruptions: number;
    keystrokes: number;
    clicks: number;
  } | null = null;

  private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000;
  private readonly DEEP_WORK_THRESHOLD_MS = 25 * 60 * 1000;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER,
        type TEXT NOT NULL,
        score REAL DEFAULT 0,
        interruptions INTEGER DEFAULT 0,
        apps TEXT DEFAULT '[]',
        project TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS focus_interruptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        timestamp TEXT NOT NULL,
        type TEXT,
        app TEXT,
        duration_seconds INTEGER,
        FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_focus_start ON focus_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_focus_type ON focus_sessions(type);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      this.onActivity(event.payload as any);
    });

    this.bus.on('KEYSTROKE_BATCH', () => {
      this.onKeystroke();
    });

    this.bus.on('MOUSE_CLICKED', () => {
      this.onClick();
    });

    this.bus.on('MOUSE_IDLE', (event) => {
      const { idleDurationMs } = event.payload as any;
      if (idleDurationMs > this.IDLE_THRESHOLD_MS) {
        this.onIdle(idleDurationMs);
      }
    });
  }

  private onActivity(data: { appName: string }): void {
    const now = new Date();

    if (!this.currentSession) {
      this.startSession(now);
    }

    this.currentSession!.lastActivity = now;
    this.currentSession!.apps.add(data.appName || 'Unknown');

    const timeSinceLastActivity = now.getTime() - this.currentSession!.lastActivity.getTime();
    if (timeSinceLastActivity > this.IDLE_THRESHOLD_MS) {
      this.currentSession!.interruptions++;
      
      this.db.prepare(`
        INSERT INTO focus_interruptions (session_id, timestamp, type, app)
        VALUES (?, ?, ?, ?)
      `).run(
        0,
        now.toISOString(),
        'idle',
        data.appName
      );
    }
  }

  private onKeystroke(): void {
    if (this.currentSession) {
      this.currentSession.keystrokes++;
      this.currentSession.lastActivity = new Date();
    }
  }

  private onClick(): void {
    if (this.currentSession) {
      this.currentSession.clicks++;
      this.currentSession.lastActivity = new Date();
    }
  }

  private onIdle(durationMs: number): void {
    if (this.currentSession) {
      const sessionDuration = Date.now() - this.currentSession.startTime.getTime();
      
      if (sessionDuration > this.DEEP_WORK_THRESHOLD_MS) {
        this.endSession('deep_work');
      } else {
        this.endSession('shallow_work');
      }
    }
  }

  private startSession(startTime: Date): void {
    this.currentSession = {
      startTime,
      lastActivity: startTime,
      apps: new Set(),
      interruptions: 0,
      keystrokes: 0,
      clicks: 0,
    };

    this.bus.emit('FOCUS_SESSION_STARTED', 'focus-analytics', {
      startTime: startTime.toISOString(),
    });
  }

  private endSession(type: string): void {
    if (!this.currentSession) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.currentSession.startTime.getTime()) / 1000 / 60);

    const score = this.calculateFocusScore(
      durationMinutes,
      this.currentSession.interruptions,
      this.currentSession.keystrokes,
      this.currentSession.clicks
    );

    this.db.prepare(`
      INSERT INTO focus_sessions (start_time, end_time, duration_minutes, type, score, interruptions, apps)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.currentSession.startTime.toISOString(),
      endTime.toISOString(),
      durationMinutes,
      type,
      score,
      this.currentSession.interruptions,
      JSON.stringify(Array.from(this.currentSession.apps))
    );

    this.bus.emit('FOCUS_SESSION_ENDED', 'focus-analytics', {
      type,
      durationMinutes,
      score,
      interruptions: this.currentSession.interruptions,
    });

    this.currentSession = null;
  }

  private calculateFocusScore(duration: number, interruptions: number, keystrokes: number, clicks: number): number {
    let score = 50;

    score += Math.min(duration * 0.5, 30);
    score -= interruptions * 5;
    score += Math.min(keystrokes * 0.01, 10);
    score += Math.min(clicks * 0.005, 5);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async getStats(date: string): Promise<FocusStats> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const sessions = this.db.prepare(`
      SELECT * FROM focus_sessions
      WHERE start_time BETWEEN ? AND ?
    `).all(start, end) as any[];

    let totalFocusMinutes = 0;
    let deepWorkMinutes = 0;
    let shallowWorkMinutes = 0;
    let breakMinutes = 0;
    let meetingMinutes = 0;
    let totalInterruptions = 0;
    let longestSession = 0;
    const productiveHours: Record<string, number> = {};

    for (const session of sessions) {
      const duration = session.duration_minutes || 0;
      totalFocusMinutes += duration;

      switch (session.type) {
        case 'deep_work': deepWorkMinutes += duration; break;
        case 'shallow_work': shallowWorkMinutes += duration; break;
        case 'break': breakMinutes += duration; break;
        case 'meeting': meetingMinutes += duration; break;
      }

      totalInterruptions += session.interruptions || 0;
      if (duration > longestSession) longestSession = duration;

      const hour = new Date(session.start_time).getHours().toString().padStart(2, '0');
      productiveHours[hour] = (productiveHours[hour] || 0) + duration;
    }

    const averageSessionLength = sessions.length > 0
      ? Math.round(totalFocusMinutes / sessions.length)
      : 0;

    const focusScore = sessions.length > 0
      ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / sessions.length)
      : 0;

    return {
      totalFocusMinutes,
      deepWorkMinutes,
      shallowWorkMinutes,
      breakMinutes,
      meetingMinutes,
      averageSessionLength,
      longestSession,
      interruptionCount: totalInterruptions,
      focusScore,
      productiveHours,
    };
  }

  async getRecentSessions(limit = 20): Promise<FocusSession[]> {
    return this.db.prepare(`
      SELECT * FROM focus_sessions ORDER BY start_time DESC LIMIT ?
    `).all(limit) as FocusSession[];
  }

  async getWeeklyTrend(): Promise<Array<{ date: string; focusMinutes: number; score: number }>> {
    const results = this.db.prepare(`
      SELECT date(start_time) as date, 
             SUM(duration_minutes) as focusMinutes,
             AVG(score) as score
      FROM focus_sessions
      WHERE start_time > datetime('now', '-7 days')
      GROUP BY date(start_time)
      ORDER BY date ASC
    `).all() as Array<{ date: string; focusMinutes: number; score: number }>;

    return results.map(r => ({
      ...r,
      score: Math.round(r.score || 0),
    }));
  }

  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  getCurrentSessionDuration(): number {
    if (!this.currentSession) return 0;
    return Math.round((Date.now() - this.currentSession.startTime.getTime()) / 1000 / 60);
  }
}
