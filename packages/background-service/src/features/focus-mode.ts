import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface FocusConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  blockedApps: string[];
}

interface PomodoroSession {
  id: number;
  startTime: string;
  endTime: string | null;
  type: 'work' | 'break' | 'long_break';
  completed: boolean;
  tasksCompleted: number;
}

export class FocusMode {
  private isActive = false;
  private currentSession: PomodoroSession | null = null;
  private sessionCount = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private config: FocusConfig;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.config = {
      workMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      blockedApps: [
        'chrome', 'edge', 'firefox',
        'slack', 'discord', 'teams',
        'twitter', 'facebook', 'instagram', 'youtube',
        'reddit', 'netflix',
      ],
    };

    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        type TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS focus_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pomodoro_time ON pomodoro_sessions(start_time);
    `);

    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const rows = this.db.prepare('SELECT key, value FROM focus_config').all() as Array<{ key: string; value: string }>;
      for (const row of rows) {
        const value = JSON.parse(row.value);
        (this.config as any)[row.key] = value;
      }
    } catch {}
  }

  saveConfig(updates: Partial<FocusConfig>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.db.prepare(`
        INSERT OR REPLACE INTO focus_config (key, value) VALUES (?, ?)
      `).run(key, JSON.stringify(value));
      (this.config as any)[key] = value;
    }
  }

  private setupEventListeners(): void {
    this.bus.on('CONTEXT_SWITCH', (event) => {
      if (!this.isActive) return;

      const { toApp, reason } = event.payload as any;
      const lower = toApp.toLowerCase();

      if (this.config.blockedApps.some(app => lower.includes(app))) {
        this.bus.emit('FOCUS_BLOCKED_APP', 'focus-mode', {
          app: toApp,
          message: `Focus Mode active! ${toApp} is blocked.`,
        });
      }
    });
  }

  async startFocus(): Promise<PomodoroSession> {
    if (this.isActive) {
      throw new Error('Focus mode already active');
    }

    this.isActive = true;
    this.sessionCount++;

    const session: PomodoroSession = {
      id: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      type: 'work',
      completed: false,
      tasksCompleted: 0,
    };

    const result = this.db.prepare(`
      INSERT INTO pomodoro_sessions (start_time, type) VALUES (?, ?)
    `).run(session.startTime, session.type);

    session.id = result.lastInsertRowid as number;
    this.currentSession = session;

    this.timer = setTimeout(() => {
      this.endWorkSession();
    }, this.config.workMinutes * 60 * 1000);

    this.bus.emit('FOCUS_STARTED', 'focus-mode', {
      sessionId: session.id,
      durationMinutes: this.config.workMinutes,
      sessionNumber: this.sessionCount,
    });

    log.info({ sessionId: session.id, sessionNumber: this.sessionCount }, 'Focus session started');

    return session;
  }

  private endWorkSession(): void {
    if (!this.currentSession) return;

    const endTime = new Date().toISOString();
    this.db.prepare(`
      UPDATE pomodoro_sessions SET end_time = ?, completed = 1 WHERE id = ?
    `).run(endTime, this.currentSession.id);

    this.bus.emit('FOCUS_COMPLETED', 'focus-mode', {
      sessionId: this.currentSession.id,
      sessionNumber: this.sessionCount,
    });

    this.currentSession = null;
    this.isActive = false;

    const isLongBreak = this.sessionCount % this.config.sessionsBeforeLongBreak === 0;
    const breakMinutes = isLongBreak ? this.config.longBreakMinutes : this.config.breakMinutes;

    this.bus.emit('BREAK_STARTED', 'focus-mode', {
      durationMinutes: breakMinutes,
      isLongBreak,
    });

    this.timer = setTimeout(() => {
      this.bus.emit('BREAK_ENDED', 'focus-mode', {
        message: 'Break is over! Ready for another focus session?',
      });
    }, breakMinutes * 60 * 1000);

    log.info({ sessionNumber: this.sessionCount, isLongBreak }, 'Work session ended, break started');
  }

  async stopFocus(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.currentSession) {
      const endTime = new Date().toISOString();
      this.db.prepare(`
        UPDATE pomodoro_sessions SET end_time = ?, completed = 0 WHERE id = ?
      `).run(endTime, this.currentSession.id);

      this.bus.emit('FOCUS_STOPPED', 'focus-mode', {
        sessionId: this.currentSession.id,
      });

      this.currentSession = null;
    }

    this.isActive = false;
    log.info('Focus mode stopped');
  }

  async getStats(date: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalFocusMinutes: number;
    averageSessionLength: number;
    longestStreak: number;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const sessions = this.db.prepare(`
      SELECT * FROM pomodoro_sessions WHERE start_time BETWEEN ? AND ?
    `).all(start, end) as Array<{ start_time: string; end_time: string; completed: number }>;

    const completed = sessions.filter(s => s.completed).length;
    const totalMinutes = sessions.reduce((sum, s) => {
      if (!s.end_time) return sum;
      const duration = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      return sum + Math.round(duration / 60000);
    }, 0);

    return {
      totalSessions: sessions.length,
      completedSessions: completed,
      totalFocusMinutes: totalMinutes,
      averageSessionLength: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      longestStreak: this.calculateLongestStreak(sessions),
    };
  }

  private calculateLongestStreak(sessions: Array<{ completed: number }>): number {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const session of sessions) {
      if (session.completed) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  getConfig(): FocusConfig {
    return { ...this.config };
  }

  isFocusActive(): boolean {
    return this.isActive;
  }

  getCurrentSession(): PomodoroSession | null {
    return this.currentSession;
  }

  getSessionCount(): number {
    return this.sessionCount;
  }
}
