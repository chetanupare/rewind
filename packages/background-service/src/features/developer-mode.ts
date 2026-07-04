import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface DevEvent {
  id: number;
  timestamp: string;
  type: 'screenshot' | 'commit' | 'terminal' | 'file_change' | 'debug_session' | 'build';
  app: string;
  project: string;
  branch: string;
  description: string;
  metadata: Record<string, unknown>;
}

interface DevSession {
  id: number;
  startTime: string;
  endTime: string | null;
  project: string;
  branch: string;
  events: DevEvent[];
  summary: string | null;
}

export class DeveloperMode {
  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dev_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        app TEXT,
        project TEXT,
        branch TEXT,
        description TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dev_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        project TEXT,
        branch TEXT,
        summary TEXT,
        event_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_dev_events_timestamp ON dev_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_dev_events_project ON dev_events(project);
      CREATE INDEX IF NOT EXISTS idx_dev_events_type ON dev_events(type);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('SCREENSHOT_CAPTURED', (event) => {
      this.recordEvent({
        timestamp: new Date().toISOString(),
        type: 'screenshot',
        app: 'screenshot-service',
        project: '',
        branch: '',
        description: 'Screenshot captured',
        metadata: event.payload,
      });
    });

    this.bus.on('GIT_COMMIT', (event) => {
      const { repoPath, branch, commitMessage } = event.payload as any;
      this.recordEvent({
        timestamp: new Date().toISOString(),
        type: 'commit',
        app: 'git',
        project: repoPath,
        branch: branch || '',
        description: commitMessage || 'Git commit',
        metadata: event.payload,
      });
    });

    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      
      const terminalApps = ['WindowsTerminal', 'cmd', 'powershell', 'Terminal', 'iTerm'];
      if (terminalApps.some(t => appName?.toLowerCase().includes(t.toLowerCase()))) {
        this.recordEvent({
          timestamp: new Date().toISOString(),
          type: 'terminal',
          app: appName,
          project: '',
          branch: '',
          description: windowTitle || 'Terminal session',
          metadata: event.payload,
        });
      }

      const ideApps = ['Code', 'Visual Studio', 'Cursor', 'IntelliJ', 'WebStorm', 'Android Studio'];
      if (ideApps.some(t => appName?.includes(t))) {
        this.recordEvent({
          timestamp: new Date().toISOString(),
          type: 'file_change',
          app: appName,
          project: '',
          branch: '',
          description: windowTitle || 'IDE activity',
          metadata: event.payload,
        });
      }
    });

    this.bus.on('FILE_SAVED', (event) => {
      const { filePath } = event.payload as any;
      this.recordEvent({
        timestamp: new Date().toISOString(),
        type: 'file_change',
        app: 'filesystem',
        project: '',
        branch: '',
        description: `File saved: ${filePath}`,
        metadata: event.payload,
      });
    });
  }

  private async recordEvent(data: {
    timestamp: string;
    type: string;
    app: string;
    project: string;
    branch: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.db.prepare(`
      INSERT INTO dev_events (timestamp, type, app, project, branch, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.timestamp,
      data.type,
      data.app,
      data.project,
      data.branch,
      data.description,
      JSON.stringify(data.metadata || {})
    );
  }

  async getEventsByProject(project: string, limit = 100): Promise<DevEvent[]> {
    return this.db.prepare(`
      SELECT * FROM dev_events
      WHERE project LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(`%${project}%`, limit) as DevEvent[];
  }

  async getEventsByTimeRange(start: string, end: string): Promise<DevEvent[]> {
    return this.db.prepare(`
      SELECT * FROM dev_events
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(start, end) as DevEvent[];
  }

  async correlateEvents(startTime: string, endTime: string): Promise<{
    screenshots: DevEvent[];
    commits: DevEvent[];
    terminal: DevEvent[];
    fileChanges: DevEvent[];
    timeline: DevEvent[];
  }> {
    const events = await this.getEventsByTimeRange(startTime, endTime);

    return {
      screenshots: events.filter(e => e.type === 'screenshot'),
      commits: events.filter(e => e.type === 'commit'),
      terminal: events.filter(e => e.type === 'terminal'),
      fileChanges: events.filter(e => e.type === 'file_change'),
      timeline: events,
    };
  }

  async getSessionSummary(startTime: string, endTime: string): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    projects: string[];
    duration: number;
  }> {
    const events = await this.getEventsByTimeRange(startTime, endTime);
    const byType: Record<string, number> = {};
    const projects = new Set<string>();

    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      if (event.project) projects.add(event.project);
    }

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return {
      totalEvents: events.length,
      byType,
      projects: Array.from(projects),
      duration: Math.round((end - start) / 1000 / 60),
    };
  }

  async getDevStats(date: string): Promise<{
    commits: number;
    screenshots: number;
    terminalSessions: number;
    fileChanges: number;
    activeHours: number;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const stats = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM dev_events
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY type
    `).all(start, end) as Array<{ type: string; count: number }>;

    const result = {
      commits: 0,
      screenshots: 0,
      terminalSessions: 0,
      fileChanges: 0,
      activeHours: 0,
    };

    for (const stat of stats) {
      switch (stat.type) {
        case 'commit': result.commits = stat.count; break;
        case 'screenshot': result.screenshots = stat.count; break;
        case 'terminal': result.terminalSessions = stat.count; break;
        case 'file_change': result.fileChanges = stat.count; break;
      }
    }

    const hours = this.db.prepare(`
      SELECT DISTINCT strftime('%H', timestamp) as hour
      FROM dev_events
      WHERE timestamp BETWEEN ? AND ?
    `).all(start, end) as Array<{ hour: string }>;

    result.activeHours = hours.length;

    return result;
  }
}
