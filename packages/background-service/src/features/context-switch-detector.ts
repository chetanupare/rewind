import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface ContextSwitch {
  id: number;
  timestamp: string;
  fromApp: string;
  toApp: string;
  reason: 'intentional' | 'notification' | 'distraction' | 'reference' | 'unknown';
  durationBeforeSwitch: number;
  productivityImpact: 'positive' | 'neutral' | 'negative';
}

interface FocusSession {
  startTime: Date;
  app: string;
  switchCount: number;
  lastSwitchTime: Date;
}

export class ContextSwitchDetector {
  private currentApp: string = '';
  private currentAppStartTime: Date = new Date();
  private switchHistory: ContextSwitch[] = [];
  private focusSession: FocusSession | null = null;
  private readonly FOCUS_THRESHOLD_MS = 5 * 60 * 1000;
  private readonly DISTRACTION_APPS = ['chrome', 'edge', 'firefox', 'slack', 'discord', 'teams'];
  private readonly PRODUCTIVE_APPS = ['code', 'cursor', 'visual studio', 'intellij', 'webstorm'];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_switches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        from_app TEXT,
        to_app TEXT NOT NULL,
        reason TEXT,
        duration_before_switch INTEGER,
        productivity_impact TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        app TEXT,
        switch_count INTEGER DEFAULT 0,
        duration_minutes INTEGER,
        focus_score REAL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ctx_switch_timestamp ON context_switches(timestamp);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_time ON focus_sessions(start_time);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName } = event.payload as any;
      this.onAppChange(appName);
    });

    this.bus.on('MOUSE_CLICKED', () => {
      if (this.focusSession) {
        this.focusSession.switchCount++;
      }
    });
  }

  private onAppChange(newApp: string): void {
    if (!newApp || newApp === this.currentApp) return;

    const now = new Date();
    const durationMs = now.getTime() - this.currentAppStartTime.getTime();
    const durationSeconds = Math.round(durationMs / 1000);

    if (this.currentApp && durationSeconds > 2) {
      const reason = this.detectSwitchReason(newApp);
      const impact = this.assessProductivityImpact(this.currentApp, newApp, durationMs);

      const switchEvent: ContextSwitch = {
        id: 0,
        timestamp: now.toISOString(),
        fromApp: this.currentApp,
        toApp: newApp,
        reason,
        durationBeforeSwitch: durationSeconds,
        productivityImpact: impact,
      };

      this.recordSwitch(switchEvent);
      this.analyzeFocusPattern(switchEvent);
    }

    this.currentApp = newApp;
    this.currentAppStartTime = now;
  }

  private detectSwitchReason(newApp: string): ContextSwitch['reason'] {
    const lower = newApp.toLowerCase();

    if (this.DISTRACTION_APPS.some(a => lower.includes(a))) {
      return 'distraction';
    }

    if (lower.includes('notification') || lower.includes('alert')) {
      return 'notification';
    }

    if (lower.includes('browser') || lower.includes('chrome') || lower.includes('edge')) {
      return 'reference';
    }

    if (this.PRODUCTIVE_APPS.some(a => lower.includes(a))) {
      return 'intentional';
    }

    return 'unknown';
  }

  private assessProductivityImpact(fromApp: string, toApp: string, durationMs: number): ContextSwitch['productivityImpact'] {
    const fromLower = fromApp.toLowerCase();
    const toLower = toApp.toLowerCase();

    const wasProductive = this.PRODUCTIVE_APPS.some(a => fromLower.includes(a));
    const isProductive = this.PRODUCTIVE_APPS.some(a => toLower.includes(a));
    const isDistracted = this.DISTRACTION_APPS.some(a => toLower.includes(a));

    if (wasProductive && isDistracted) return 'negative';
    if (wasProductive && isProductive) return 'positive';
    if (durationMs > this.FOCUS_THRESHOLD_MS) return 'positive';

    return 'neutral';
  }

  private recordSwitch(switchEvent: ContextSwitch): void {
    try {
      const result = this.db.prepare(`
        INSERT INTO context_switches (timestamp, from_app, to_app, reason, duration_before_switch, productivity_impact)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        switchEvent.timestamp,
        switchEvent.fromApp,
        switchEvent.toApp,
        switchEvent.reason,
        switchEvent.durationBeforeSwitch,
        switchEvent.productivityImpact
      );

      switchEvent.id = result.lastInsertRowid as number;
      this.switchHistory.push(switchEvent);

      if (this.switchHistory.length > 100) {
        this.switchHistory.shift();
      }

      this.bus.emit('CONTEXT_SWITCH', 'context-detector', {
        fromApp: switchEvent.fromApp,
        toApp: switchEvent.toApp,
        reason: switchEvent.reason,
        impact: switchEvent.productivityImpact,
      });

      log.debug({
        from: switchEvent.fromApp,
        to: switchEvent.toApp,
        reason: switchEvent.reason,
        impact: switchEvent.productivityImpact,
      }, 'Context switch detected');
    } catch (err) {
      log.warn({ err }, 'Failed to record context switch');
    }
  }

  private analyzeFocusPattern(switchEvent: ContextSwitch): void {
    const recentSwitches = this.switchHistory.slice(-10);
    const negativeSwitches = recentSwitches.filter(s => s.productivityImpact === 'negative').length;

    if (negativeSwitches >= 3) {
      this.bus.emit('THRASHING_DETECTED', 'context-detector', {
        switchCount: negativeSwitches,
        message: 'You seem to be context switching frequently. Consider enabling Focus Mode.',
      });
    }

    if (!this.focusSession && this.PRODUCTIVE_APPS.some(a => switchEvent.toApp.toLowerCase().includes(a))) {
      this.focusSession = {
        startTime: new Date(),
        app: switchEvent.toApp,
        switchCount: 0,
        lastSwitchTime: new Date(),
      };
    }

    if (this.focusSession) {
      if (switchEvent.productivityImpact === 'negative') {
        this.focusSession.switchCount++;
      }

      if (this.focusSession.switchCount > 5) {
        this.endFocusSession();
      }
    }
  }

  private endFocusSession(): void {
    if (!this.focusSession) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.focusSession.startTime.getTime()) / 60000);
    const focusScore = Math.max(0, 100 - (this.focusSession.switchCount * 10));

    try {
      this.db.prepare(`
        INSERT INTO focus_sessions (start_time, end_time, app, switch_count, duration_minutes, focus_score)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        this.focusSession.startTime.toISOString(),
        endTime.toISOString(),
        this.focusSession.app,
        this.focusSession.switchCount,
        durationMinutes,
        focusScore
      );
    } catch (err) {
      log.warn({ err }, 'Failed to save focus session');
    }

    this.focusSession = null;
  }

  async getStats(date: string): Promise<{
    totalSwitches: number;
    negativeSwitches: number;
    topReasons: Array<{ reason: string; count: number }>;
    focusSessions: number;
    averageFocusScore: number;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const total = (this.db.prepare(
      'SELECT COUNT(*) as count FROM context_switches WHERE timestamp BETWEEN ? AND ?'
    ).get(start, end) as { count: number }).count;

    const negative = (this.db.prepare(
      "SELECT COUNT(*) as count FROM context_switches WHERE timestamp BETWEEN ? AND ? AND productivity_impact = 'negative'"
    ).get(start, end) as { count: number }).count;

    const reasons = this.db.prepare(`
      SELECT reason, COUNT(*) as count FROM context_switches 
      WHERE timestamp BETWEEN ? AND ? 
      GROUP BY reason ORDER BY count DESC
    `).all(start, end) as Array<{ reason: string; count: number }>;

    const sessions = this.db.prepare(
      'SELECT AVG(focus_score) as avg_score, COUNT(*) as count FROM focus_sessions WHERE start_time BETWEEN ? AND ?'
    ).get(start, end) as { avg_score: number; count: number };

    return {
      totalSwitches: total,
      negativeSwitches: negative,
      topReasons: reasons,
      focusSessions: sessions.count,
      averageFocusScore: Math.round(sessions.avg_score || 0),
    };
  }

  async getRecentSwitches(limit = 50): Promise<ContextSwitch[]> {
    return this.db.prepare(
      'SELECT * FROM context_switches ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as ContextSwitch[];
  }
}
