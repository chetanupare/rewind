import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface ReplayStep {
  timestamp: string;
  type: 'activity' | 'screenshot' | 'commit' | 'keystroke' | 'file_change';
  app: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

interface ReplaySession {
  id: number;
  startTime: string;
  endTime: string;
  project: string;
  steps: ReplayStep[];
  summary: string;
  duration: number;
}

export class SessionReplay {
  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS replay_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        project TEXT,
        step_count INTEGER DEFAULT 0,
        summary TEXT,
        duration_minutes INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_replay_start ON replay_sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_replay_project ON replay_sessions(project);
    `);
  }

  async createReplay(startTime: string, endTime: string, project?: string): Promise<ReplaySession> {
    const steps = await this.collectSteps(startTime, endTime, project);
    const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60);

    const summary = this.generateSummary(steps);

    const result = this.db.prepare(`
      INSERT INTO replay_sessions (start_time, end_time, project, step_count, summary, duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(startTime, endTime, project || '', steps.length, summary, duration);

    return {
      id: result.lastInsertRowid as number,
      startTime,
      endTime,
      project: project || '',
      steps,
      summary,
      duration,
    };
  }

  private async collectSteps(startTime: string, endTime: string, project?: string): Promise<ReplayStep[]> {
    const steps: ReplayStep[] = [];

    const activities = this.db.prepare(`
      SELECT * FROM activities
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(startTime, endTime) as any[];

    for (const a of activities) {
      steps.push({
        timestamp: a.timestamp,
        type: 'activity',
        app: a.app_name,
        title: a.window_title || '',
        description: `${a.app_name}: ${a.window_title || 'No title'}`,
        metadata: { duration: a.duration_seconds },
      });
    }

    const screenshots = this.db.prepare(`
      SELECT * FROM screenshots
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(startTime, endTime) as any[];

    for (const s of screenshots) {
      steps.push({
        timestamp: s.timestamp,
        type: 'screenshot',
        app: s.ai_app || 'Unknown',
        title: s.ai_task || 'Screenshot',
        description: s.ai_description || 'Screenshot captured',
        metadata: { filePath: s.file_path, aiProject: s.ai_project },
      });
    }

    const commits = this.db.prepare(`
      SELECT * FROM git_events
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(startTime, endTime) as any[];

    for (const c of commits) {
      steps.push({
        timestamp: c.timestamp,
        type: 'commit',
        app: 'git',
        title: c.commit_message || 'Git commit',
        description: `${c.repo_path}: ${c.commit_message || ''}`,
        metadata: { branch: c.branch, hash: c.commit_hash },
      });
    }

    steps.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return steps;
  }

  private generateSummary(steps: ReplayStep[]): string {
    if (steps.length === 0) return 'Empty session';

    const apps = new Set(steps.map(s => s.app));
    const commits = steps.filter(s => s.type === 'commit').length;
    const screenshots = steps.filter(s => s.type === 'screenshot').length;

    return `${steps.length} activities across ${apps.size} apps. ${commits} commits, ${screenshots} screenshots.`;
  }

  async getReplay(id: number): Promise<ReplaySession | null> {
    const session = this.db.prepare('SELECT * FROM replay_sessions WHERE id = ?').get(id) as any;
    if (!session) return null;

    const steps = await this.collectSteps(session.start_time, session.end_time, session.project);

    return {
      id: session.id,
      startTime: session.start_time,
      endTime: session.end_time,
      project: session.project,
      steps,
      summary: session.summary,
      duration: session.duration_minutes,
    };
  }

  async getReplays(limit = 20): Promise<Array<{
    id: number;
    startTime: string;
    endTime: string;
    project: string;
    stepCount: number;
    summary: string;
    duration: number;
  }>> {
    return this.db.prepare(`
      SELECT id, start_time, end_time, project, step_count, summary, duration_minutes
      FROM replay_sessions
      ORDER BY start_time DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  async getReplayByTimeRange(startTime: string, endTime: string): Promise<ReplaySession | null> {
    const steps = await this.collectSteps(startTime, endTime);
    
    if (steps.length === 0) return null;

    const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60);
    const summary = this.generateSummary(steps);

    return {
      id: 0,
      startTime,
      endTime,
      project: '',
      steps,
      summary,
      duration,
    };
  }

  async getStepAtTime(timestamp: string): Promise<ReplayStep | null> {
    const step = this.db.prepare(`
      SELECT * FROM activities
      WHERE timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(timestamp) as any;

    if (!step) return null;

    return {
      timestamp: step.timestamp,
      type: 'activity',
      app: step.app_name,
      title: step.window_title || '',
      description: `${step.app_name}: ${step.window_title || ''}`,
      metadata: {},
    };
  }

  async searchReplays(query: string): Promise<ReplaySession[]> {
    const sessions = this.db.prepare(`
      SELECT * FROM replay_sessions
      WHERE summary LIKE ? OR project LIKE ?
      ORDER BY start_time DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as any[];

    const results: ReplaySession[] = [];

    for (const session of sessions) {
      const steps = await this.collectSteps(session.start_time, session.end_time, session.project);
      results.push({
        id: session.id,
        startTime: session.start_time,
        endTime: session.end_time,
        project: session.project,
        steps,
        summary: session.summary,
        duration: session.duration_minutes,
      });
    }

    return results;
  }
}
