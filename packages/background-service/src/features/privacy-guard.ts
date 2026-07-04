import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface PrivacyRule {
  id: number;
  name: string;
  type: 'incognito' | 'drm' | 'banking' | 'sensitive';
  patterns: string[];
  action: 'pause' | 'blur' | 'skip' | 'alert';
  enabled: boolean;
}

export class PrivacyGuard {
  private rules: PrivacyRule[] = [];
  private isPaused = false;
  private pauseReason: string | null = null;

  private readonly INCOGNITO_PATTERNS = [
    'incognito',
    'private browsing',
    'inprivate',
    'private window',
  ];

  private readonly DRM_PATTERNS = [
    'netflix',
    'prime video',
    'disney+',
    'hbo max',
    'hulu',
    'spotify',
    'apple tv',
    'protected content',
    'drm',
  ];

  private readonly BANKING_PATTERNS = [
    'chase.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'citibank.com',
    'capitalone.com',
    'paypal.com',
    'stripe.com',
    'venmo.com',
    'zelle',
    'icicibank.com',
    'hdfcbank.com',
    'axisbank.com',
    'banking',
    'net banking',
    'online banking',
  ];

  private readonly SENSITIVE_APP_PATTERNS = [
    '1password',
    'bitwarden',
    'lastpass',
    'keepass',
    'dashlane',
    'nordpass',
    'roboform',
    'keychain',
  ];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.loadRules();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS privacy_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        patterns TEXT DEFAULT '[]',
        action TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS privacy_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        app TEXT,
        url TEXT,
        action_taken TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_privacy_time ON privacy_events(timestamp);
    `);
  }

  private loadRules(): void {
    this.rules = [
      {
        id: 1,
        name: 'Incognito Detection',
        type: 'incognito',
        patterns: this.INCOGNITO_PATTERNS,
        action: 'pause',
        enabled: true,
      },
      {
        id: 2,
        name: 'DRM Content',
        type: 'drm',
        patterns: this.DRM_PATTERNS,
        action: 'pause',
        enabled: true,
      },
      {
        id: 3,
        name: 'Banking Sites',
        type: 'banking',
        patterns: this.BANKING_PATTERNS,
        action: 'blur',
        enabled: true,
      },
      {
        id: 4,
        name: 'Password Managers',
        type: 'sensitive',
        patterns: this.SENSITIVE_APP_PATTERNS,
        action: 'skip',
        enabled: true,
      },
    ];
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.checkPrivacy(appName, windowTitle);
    });

    this.bus.on('BROWSER_URL_CHANGED', (event) => {
      const { url, pageTitle } = event.payload as any;
      this.checkBrowserPrivacy(url, pageTitle);
    });

    this.bus.on('SCREENSHOT_CAPTURED', (event) => {
      if (this.isPaused) {
        this.bus.emit('SCREENSHOT_BLOCKED', 'privacy-guard', {
          reason: this.pauseReason,
        });
      }
    });
  }

  private checkPrivacy(appName: string, windowTitle: string): void {
    const combined = `${appName} ${windowTitle}`.toLowerCase();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matched = rule.patterns.some(pattern => combined.includes(pattern.toLowerCase()));

      if (matched) {
        this.executeAction(rule, appName, windowTitle);
        return;
      }
    }

    if (this.isPaused && this.pauseReason) {
      this.resumeCapture();
    }
  }

  private checkBrowserPrivacy(url: string, title: string): void {
    const combined = `${url} ${title}`.toLowerCase();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matched = rule.patterns.some(pattern => combined.includes(pattern.toLowerCase()));

      if (matched) {
        this.executeAction(rule, 'browser', url);
        return;
      }
    }
  }

  private executeAction(rule: PrivacyRule, app: string, context: string): void {
    this.recordEvent(rule.type, app, context, rule.action);

    switch (rule.action) {
      case 'pause':
        this.pauseCapture(rule.name);
        this.bus.emit('PRIVACY_PAUSE', 'privacy-guard', {
          reason: rule.name,
          app,
        });
        break;

      case 'blur':
        this.bus.emit('PRIVACY_BLUR', 'privacy-guard', {
          reason: rule.name,
          app,
        });
        break;

      case 'skip':
        this.bus.emit('PRIVACY_SKIP', 'privacy-guard', {
          reason: rule.name,
          app,
        });
        break;

      case 'alert':
        this.bus.emit('PRIVACY_ALERT', 'privacy-guard', {
          reason: rule.name,
          app,
        });
        break;
    }
  }

  private pauseCapture(reason: string): void {
    this.isPaused = true;
    this.pauseReason = reason;
    log.info({ reason }, 'Capture paused for privacy');
  }

  private resumeCapture(): void {
    this.isPaused = false;
    this.pauseReason = null;
    log.info('Capture resumed');
  }

  private recordEvent(type: string, app: string, context: string, action: string): void {
    try {
      this.db.prepare(`
        INSERT INTO privacy_events (timestamp, type, app, url, action_taken)
        VALUES (?, ?, ?, ?, ?)
      `).run(new Date().toISOString(), type, app, context, action);
    } catch (err) {
      log.warn({ err }, 'Failed to record privacy event');
    }
  }

  isCapturePaused(): boolean {
    return this.isPaused;
  }

  getPauseReason(): string | null {
    return this.pauseReason;
  }

  async getPrivacyEvents(date?: string): Promise<Array<{
    id: number;
    timestamp: string;
    type: string;
    app: string;
    url: string;
    actionTaken: string;
  }>> {
    let query = 'SELECT * FROM privacy_events';
    const params: unknown[] = [];

    if (date) {
      query += ' WHERE date(timestamp) = ?';
      params.push(date);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    return this.db.prepare(query).all(...params) as any[];
  }

  async getPrivacyStats(date: string): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    pauseDuration: number;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const total = (this.db.prepare(
      'SELECT COUNT(*) as count FROM privacy_events WHERE timestamp BETWEEN ? AND ?'
    ).get(start, end) as { count: number }).count;

    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM privacy_events
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY type
    `).all(start, end) as Array<{ type: string; count: number }>;

    return {
      totalEvents: total,
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      pauseDuration: 0,
    };
  }

  addCustomRule(rule: Omit<PrivacyRule, 'id'>): void {
    this.rules.push({
      ...rule,
      id: this.rules.length + 1,
    });
    log.info({ name: rule.name }, 'Custom privacy rule added');
  }
}
