import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import cron from 'node-cron';

const log = getLogger();

interface Reflection {
  id: number;
  timestamp: string;
  type: 'daily' | 'weekly' | 'monthly';
  content: string;
  insights: string[];
  actions: string[];
  memoriesUpdated: number;
  patternsFound: number;
}

export class AIReflection {
  private reflectionSchedule: cron.ScheduledTask | null = null;

  constructor(
    private db: Database,
    private bus: EventBus,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
    this.setupSchedule();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        insights TEXT DEFAULT '[]',
        actions TEXT DEFAULT '[]',
        memories_updated INTEGER DEFAULT 0,
        patterns_found INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_reflections_time ON reflections(timestamp);
      CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
    `);
  }

  private setupSchedule(): void {
    this.reflectionSchedule = cron.schedule('0 23 * * *', () => {
      this.dailyReflection();
    });

    this.reflectionSchedule = cron.schedule('0 23 * * 0', () => {
      this.weeklyReflection();
    });
  }

  async dailyReflection(): Promise<Reflection | null> {
    log.info('Starting daily reflection...');

    const today = new Date().toISOString().split('T')[0];
    const start = `${today}T00:00:00.000Z`;
    const end = `${today}T23:59:59.999Z`;

    try {
      const activities = this.db.prepare(`
        SELECT app_name, window_title, timestamp, duration_seconds
        FROM activities WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `).all(start, end) as any[];

      const screenshots = this.db.prepare(`
        SELECT ai_app, ai_task, ai_state, timestamp
        FROM screenshots WHERE timestamp BETWEEN ? AND ? AND ai_processed = 1
      `).all(start, end) as any[];

      const commits = this.db.prepare(`
        SELECT repo_path, commit_message, timestamp
        FROM git_events WHERE timestamp BETWEEN ? AND ?
      `).all(start, end) as any[];

      const episodes = this.db.prepare(`
        SELECT title, outcome, importance, summary
        FROM episodes WHERE start_time BETWEEN ? AND ?
      `).all(start, end) as any[];

      const context = this.buildReflectionContext(activities, screenshots, commits, episodes);

      const content = await this.generateReflection('daily', context);
      const insights = this.extractInsights(activities, screenshots, commits, episodes);
      const actions = this.generateActions(insights);

      const result = this.db.prepare(`
        INSERT INTO reflections (timestamp, type, content, insights, actions, memories_updated, patterns_found)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        new Date().toISOString(),
        'daily',
        content,
        JSON.stringify(insights),
        JSON.stringify(actions),
        activities.length + screenshots.length,
        episodes.length
      );

      const reflection: Reflection = {
        id: result.lastInsertRowid as number,
        timestamp: new Date().toISOString(),
        type: 'daily',
        content,
        insights,
        actions,
        memoriesUpdated: activities.length + screenshots.length,
        patternsFound: episodes.length,
      };

      this.bus.emit('REFLECTION_COMPLETED', 'ai-reflection', {
        type: 'daily',
        insights: insights.length,
      });

      log.info({ insights: insights.length }, 'Daily reflection completed');
      return reflection;
    } catch (err) {
      log.warn({ err }, 'Daily reflection failed');
      return null;
    }
  }

  async weeklyReflection(): Promise<Reflection | null> {
    log.info('Starting weekly reflection...');

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      const activities = this.db.prepare(`
        SELECT app_name, COUNT(*) as count, SUM(duration_seconds) as total_duration
        FROM activities WHERE timestamp BETWEEN ? AND ?
        GROUP BY app_name ORDER BY total_duration DESC
      `).all(weekAgo.toISOString(), today.toISOString()) as any[];

      const episodes = this.db.prepare(`
        SELECT title, outcome, importance FROM episodes
        WHERE start_time BETWEEN ? AND ?
      `).all(weekAgo.toISOString(), today.toISOString()) as any[];

      const context = `Weekly summary: ${activities.length} apps used, ${episodes.length} episodes completed`;

      const content = await this.generateReflection('weekly', context);
      const insights = this.extractWeeklyInsights(activities, episodes);

      const result = this.db.prepare(`
        INSERT INTO reflections (timestamp, type, content, insights, actions)
        VALUES (?, ?, ?, ?, ?)
      `).run(new Date().toISOString(), 'weekly', content, JSON.stringify(insights), JSON.stringify([]));

      return {
        id: result.lastInsertRowid as number,
        timestamp: new Date().toISOString(),
        type: 'weekly',
        content,
        insights,
        actions: [],
        memoriesUpdated: 0,
        patternsFound: 0,
      };
    } catch (err) {
      log.warn({ err }, 'Weekly reflection failed');
      return null;
    }
  }

  private buildReflectionContext(activities: any[], screenshots: any[], commits: any[], episodes: any[]): string {
    let context = 'Daily Activity Summary:\n';

    const apps = new Set(activities.map(a => a.app_name));
    context += `Apps used: ${Array.from(apps).join(', ')}\n`;
    context += `Total activities: ${activities.length}\n`;
    context += `Screenshots analyzed: ${screenshots.length}\n`;
    context += `Commits: ${commits.length}\n`;
    context += `Episodes: ${episodes.length}\n`;

    if (episodes.length > 0) {
      context += '\nEpisodes:\n';
      for (const ep of episodes.slice(0, 5)) {
        context += `- ${ep.title} (${ep.outcome})\n`;
      }
    }

    return context;
  }

  private async generateReflection(type: string, context: string): Promise<string> {
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) {
        return `${type} reflection: ${context.substring(0, 200)}`;
      }

      const prompt = `Generate a ${type} reflection based on this activity data:

${context}

Include:
1. What was accomplished
2. What patterns were observed
3. What could be improved
4. Key insights

Reflection:`;

      return await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
      });
    } catch {
      return `${type} reflection: ${context.substring(0, 200)}`;
    }
  }

  private extractInsights(activities: any[], screenshots: any[], commits: any[], episodes: any[]): string[] {
    const insights: string[] = [];

    const apps = new Set(activities.map(a => a.app_name));
    insights.push(`Used ${apps.size} different applications`);

    if (commits.length > 0) {
      insights.push(`Made ${commits.length} git commits`);
    }

    const completedEpisodes = episodes.filter(e => e.outcome === 'completed');
    if (completedEpisodes.length > 0) {
      insights.push(`Completed ${completedEpisodes.length} work episodes`);
    }

    return insights;
  }

  private extractWeeklyInsights(activities: any[], episodes: any[]): string[] {
    const insights: string[] = [];

    const topApp = activities[0];
    if (topApp) {
      insights.push(`Most used app: ${topApp.app_name} (${Math.round(topApp.total_duration / 3600)}h)`);
    }

    insights.push(`Total episodes: ${episodes.length}`);

    return insights;
  }

  private generateActions(insights: string[]): string[] {
    const actions: string[] = [];

    for (const insight of insights) {
      if (insight.includes('completed')) {
        actions.push('Review completed work');
      }
    }

    return actions;
  }

  async getRecentReflections(limit = 10): Promise<Reflection[]> {
    const reflections = this.db.prepare(`
      SELECT * FROM reflections ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return reflections.map(r => ({
      ...r,
      insights: JSON.parse(r.insights || '[]'),
      actions: JSON.parse(r.actions || '[]'),
    }));
  }

  async getReflection(date: string): Promise<Reflection | null> {
    const reflection = this.db.prepare(`
      SELECT * FROM reflections WHERE date(timestamp) = ? AND type = 'daily'
    `).get(date) as any;

    if (!reflection) return null;

    return {
      ...reflection,
      insights: JSON.parse(reflection.insights || '[]'),
      actions: JSON.parse(reflection.actions || '[]'),
    };
  }
}
