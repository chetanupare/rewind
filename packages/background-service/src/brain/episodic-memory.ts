import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Episode {
  id: number;
  title: string;
  startTime: string;
  endTime: string | null;
  goal: string;
  outcome: 'completed' | 'abandoned' | 'in_progress' | 'blocked';
  problems: string[];
  solutions: string[];
  confidence: number;
  importance: number;
  entities: string[];
  events: EpisodeEvent[];
  summary: string;
  lessons: string[];
}

interface EpisodeEvent {
  timestamp: string;
  type: string;
  description: string;
  importance: number;
}

export class EpisodicMemory {
  private currentEpisode: Episode | null = null;
  private episodeBuffer: EpisodeEvent[] = [];
  private readonly BUFFER_TIMEOUT_MS = 30 * 60 * 1000;
  private lastActivityTime: Date = new Date();

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
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        goal TEXT,
        outcome TEXT DEFAULT 'in_progress',
        problems TEXT DEFAULT '[]',
        solutions TEXT DEFAULT '[]',
        confidence REAL DEFAULT 0.5,
        importance REAL DEFAULT 0.5,
        entities TEXT DEFAULT '[]',
        event_count INTEGER DEFAULT 0,
        summary TEXT,
        lessons TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS episode_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        importance REAL DEFAULT 0.5,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (episode_id) REFERENCES episodes(id)
      );

      CREATE TABLE IF NOT EXISTS episode_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_a INTEGER NOT NULL,
        episode_b INTEGER NOT NULL,
        relationship TEXT NOT NULL,
        strength REAL DEFAULT 0.5,
        FOREIGN KEY (episode_a) REFERENCES episodes(id),
        FOREIGN KEY (episode_b) REFERENCES episodes(id)
      );

      CREATE INDEX IF NOT EXISTS idx_episodes_time ON episodes(start_time);
      CREATE INDEX IF NOT EXISTS idx_episodes_outcome ON episodes(outcome);
      CREATE INDEX IF NOT EXISTS idx_episode_events_ep ON episode_events(episode_id);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.onActivity(appName, windowTitle, 'app_switch');
    });

    this.bus.on('GIT_COMMIT', (event) => {
      const { commitMessage, repoPath } = event.payload as any;
      this.onActivity('git', commitMessage, 'commit');
    });

    this.bus.on('FILE_SAVED', (event) => {
      const { filePath } = event.payload as any;
      this.onActivity('file', filePath, 'file_save');
    });

    this.bus.on('TERMINAL_COMMAND', (event) => {
      const { command } = event.payload as any;
      this.onActivity('terminal', command, 'terminal');
    });
  }

  private onActivity(app: string, context: string, type: string): void {
    this.lastActivityTime = new Date();

    const event: EpisodeEvent = {
      timestamp: new Date().toISOString(),
      type,
      description: `${app}: ${context}`,
      importance: this.calculateEventImportance(type, app),
    };

    this.episodeBuffer.push(event);

    if (this.currentEpisode) {
      this.currentEpisode.events.push(event);
      this.currentEpisode.entities = this.extractEntities(this.currentEpisode.events);
    }

    if (this.shouldStartNewEpisode()) {
      this.endCurrentEpisode();
      this.startNewEpisode(app, context);
    }

    if (this.episodeBuffer.length > 100) {
      this.episodeBuffer = this.episodeBuffer.slice(-50);
    }
  }

  private calculateEventImportance(type: string, app: string): number {
    const typeImportance: Record<string, number> = {
      'commit': 0.8,
      'file_save': 0.5,
      'terminal': 0.6,
      'app_switch': 0.2,
    };

    let importance = typeImportance[type] || 0.3;

    const importantApps = ['code', 'cursor', 'visual studio', 'terminal', 'powershell'];
    if (importantApps.some(a => app.toLowerCase().includes(a))) {
      importance += 0.2;
    }

    return Math.min(1, importance);
  }

  private extractEntities(events: EpisodeEvent[]): string[] {
    const entities = new Set<string>();

    for (const event of events) {
      const words = event.description.split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && /^[A-Z]/.test(word)) {
          entities.add(word);
        }
      }
    }

    return Array.from(entities).slice(0, 20);
  }

  private shouldStartNewEpisode(): boolean {
    if (!this.currentEpisode) return true;

    const timeSinceLastActivity = Date.now() - this.lastActivityTime.getTime();
    if (timeSinceLastActivity > this.BUFFER_TIMEOUT_MS) return true;

    if (this.currentEpisode.events.length > 50) return true;

    return false;
  }

  private startNewEpisode(app: string, context: string): void {
    const title = this.generateEpisodeTitle(app, context);
    const goal = this.detectGoal(app, context);

    this.currentEpisode = {
      id: 0,
      title,
      startTime: new Date().toISOString(),
      endTime: null,
      goal,
      outcome: 'in_progress',
      problems: [],
      solutions: [],
      confidence: 0.7,
      importance: 0.5,
      entities: [],
      events: [],
      summary: '',
      lessons: [],
    };

    log.info({ title, goal }, 'New episode started');
  }

  private generateEpisodeTitle(app: string, context: string): string {
    const lower = context.toLowerCase();

    if (lower.includes('fix') || lower.includes('bug')) return `Fixing: ${context.substring(0, 50)}`;
    if (lower.includes('implement') || lower.includes('add')) return `Implementing: ${context.substring(0, 50)}`;
    if (lower.includes('test')) return `Testing: ${context.substring(0, 50)}`;
    if (lower.includes('debug')) return `Debugging: ${context.substring(0, 50)}`;
    if (lower.includes('review')) return `Reviewing: ${context.substring(0, 50)}`;

    return `Working with ${app}`;
  }

  private detectGoal(app: string, context: string): string {
    const lower = context.toLowerCase();

    if (lower.includes('fix') || lower.includes('bug')) return 'Fix a bug';
    if (lower.includes('implement') || lower.includes('add')) return 'Implement a feature';
    if (lower.includes('test')) return 'Test functionality';
    if (lower.includes('debug')) return 'Debug an issue';
    if (lower.includes('deploy')) return 'Deploy changes';
    if (lower.includes('review')) return 'Review code';

    return 'Complete task';
  }

  async endCurrentEpisode(): Promise<void> {
    if (!this.currentEpisode) return;

    this.currentEpisode.endTime = new Date().toISOString();
    this.currentEpisode.summary = await this.generateSummary(this.currentEpisode);
    this.currentEpisode.importance = this.calculateEpisodeImportance(this.currentEpisode);
    this.currentEpisode.lessons = this.extractLessons(this.currentEpisode);

    try {
      const result = this.db.prepare(`
        INSERT INTO episodes (title, start_time, end_time, goal, outcome, problems, solutions, confidence, importance, entities, event_count, summary, lessons)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.currentEpisode.title,
        this.currentEpisode.startTime,
        this.currentEpisode.endTime,
        this.currentEpisode.goal,
        this.currentEpisode.outcome,
        JSON.stringify(this.currentEpisode.problems),
        JSON.stringify(this.currentEpisode.solutions),
        this.currentEpisode.confidence,
        this.currentEpisode.importance,
        JSON.stringify(this.currentEpisode.entities),
        this.currentEpisode.events.length,
        this.currentEpisode.summary,
        JSON.stringify(this.currentEpisode.lessons)
      );

      const episodeId = result.lastInsertRowid as number;

      for (const event of this.currentEpisode.events) {
        this.db.prepare(`
          INSERT INTO episode_events (episode_id, timestamp, type, description, importance)
          VALUES (?, ?, ?, ?, ?)
        `).run(episodeId, event.timestamp, event.type, event.description, event.importance);
      }

      this.bus.emit('EPISODE_COMPLETED', 'episodic-memory', {
        episodeId,
        title: this.currentEpisode.title,
        outcome: this.currentEpisode.outcome,
        importance: this.currentEpisode.importance,
      });

      log.info({ episodeId, title: this.currentEpisode.title }, 'Episode completed');
    } catch (err) {
      log.warn({ err }, 'Failed to save episode');
    }

    this.currentEpisode = null;
  }

  private async generateSummary(episode: Episode): Promise<string> {
    const duration = episode.endTime
      ? Math.round((new Date(episode.endTime).getTime() - new Date(episode.startTime).getTime()) / 60000)
      : 0;

    const eventTypes = episode.events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `${episode.title} (${duration}min) - ${episode.events.length} events. Goal: ${episode.goal}`;
  }

  private calculateEpisodeImportance(episode: Episode): number {
    let importance = 0.5;

    if (episode.outcome === 'completed') importance += 0.2;
    if (episode.problems.length > 0) importance += 0.1;
    if (episode.solutions.length > 0) importance += 0.1;
    if (episode.events.length > 10) importance += 0.1;

    const avgEventImportance = episode.events.reduce((sum, e) => sum + e.importance, 0) / episode.events.length;
    importance += avgEventImportance * 0.2;

    return Math.min(1, importance);
  }

  private extractLessons(episode: Episode): string[] {
    const lessons: string[] = [];

    if (episode.problems.length > 0 && episode.solutions.length > 0) {
      lessons.push(`Solved: ${episode.problems[0]} by ${episode.solutions[0]}`);
    }

    if (episode.outcome === 'completed' && episode.events.length > 20) {
      lessons.push(`Complex task completed: ${episode.title}`);
    }

    return lessons;
  }

  async getRecentEpisodes(limit = 20): Promise<Episode[]> {
    const episodes = this.db.prepare(`
      SELECT * FROM episodes ORDER BY start_time DESC LIMIT ?
    `).all(limit) as any[];

    return episodes.map(e => ({
      ...e,
      problems: JSON.parse(e.problems || '[]'),
      solutions: JSON.parse(e.solutions || '[]'),
      entities: JSON.parse(e.entities || '[]'),
      lessons: JSON.parse(e.lessons || '[]'),
      events: [],
    }));
  }

  async getEpisodeWithEvents(id: number): Promise<Episode | null> {
    const episode = this.db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as any;
    if (!episode) return null;

    const events = this.db.prepare(
      'SELECT * FROM episode_events WHERE episode_id = ? ORDER BY timestamp ASC'
    ).all(id) as EpisodeEvent[];

    return {
      ...episode,
      problems: JSON.parse(episode.problems || '[]'),
      solutions: JSON.parse(episode.solutions || '[]'),
      entities: JSON.parse(episode.entities || '[]'),
      lessons: JSON.parse(episode.lessons || '[]'),
      events,
    };
  }

  async searchEpisodes(query: string): Promise<Episode[]> {
    const episodes = this.db.prepare(`
      SELECT * FROM episodes
      WHERE title LIKE ? OR summary LIKE ? OR goal LIKE ?
      ORDER BY importance DESC, start_time DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as any[];

    return episodes.map(e => ({
      ...e,
      problems: JSON.parse(e.problems || '[]'),
      solutions: JSON.parse(e.solutions || '[]'),
      entities: JSON.parse(e.entities || '[]'),
      lessons: JSON.parse(e.lessons || '[]'),
      events: [],
    }));
  }

  async getEpisodeStats(date: string): Promise<{
    totalEpisodes: number;
    completed: number;
    abandoned: number;
    averageImportance: number;
    topGoals: Array<{ goal: string; count: number }>;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const episodes = this.db.prepare(`
      SELECT outcome, goal, importance FROM episodes WHERE start_time BETWEEN ? AND ?
    `).all(start, end) as Array<{ outcome: string; goal: string; importance: number }>;

    const completed = episodes.filter(e => e.outcome === 'completed').length;
    const abandoned = episodes.filter(e => e.outcome === 'abandoned').length;
    const avgImportance = episodes.length > 0
      ? episodes.reduce((sum, e) => sum + e.importance, 0) / episodes.length
      : 0;

    const goalCounts: Record<string, number> = {};
    for (const e of episodes) {
      goalCounts[e.goal] = (goalCounts[e.goal] || 0) + 1;
    }

    const topGoals = Object.entries(goalCounts)
      .map(([goal, count]) => ({ goal, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEpisodes: episodes.length,
      completed,
      abandoned,
      averageImportance: Math.round(avgImportance * 100) / 100,
      topGoals,
    };
  }

  getCurrentEpisode(): Episode | null {
    return this.currentEpisode;
  }
}
