import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface MentorSuggestion {
  id: number;
  type: 'learning' | 'productivity' | 'workflow' | 'health';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  read: boolean;
  acted: boolean;
}

export class AIMentor {
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: Database,
    private bus: EventBus,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
    this.setupEventListeners();
    this.startChecking();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mentor_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        timestamp TEXT DEFAULT (datetime('now')),
        read INTEGER DEFAULT 0,
        acted INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_mentor_time ON mentor_suggestions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mentor_type ON mentor_suggestions(type);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('CONTEXT_SWITCH', (event) => {
      const { impact } = event.payload as any;
      if (impact === 'negative') {
        this.checkDistractionPattern();
      }
    });

    this.bus.on('FOCUS_COMPLETED', (event) => {
      const { sessionNumber } = event.payload as any;
      if (sessionNumber % 4 === 0) {
        this.suggest({
          type: 'health',
          title: 'Time for a longer break',
          description: "You've completed 4 focus sessions. Take a 15-30 minute break to recharge.",
          priority: 'medium',
        });
      }
    });
  }

  private startChecking(): void {
    this.checkInterval = setInterval(() => {
      this.checkPatterns();
    }, 30 * 60 * 1000);
  }

  private async checkPatterns(): Promise<void> {
    await this.checkCommitPatterns();
    await this.checkLearningPatterns();
    await this.checkProductivityPatterns();
  }

  private async checkCommitPatterns(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const commits = (this.db.prepare(
      "SELECT COUNT(*) as count FROM git_events WHERE date(timestamp) = ?"
    ).get(today) as { count: number }).count;

    if (commits === 0) {
      const hour = new Date().getHours();
      if (hour >= 16) {
        this.suggest({
          type: 'workflow',
          title: 'No commits today',
          description: "You haven't committed any code today. Consider saving your work.",
          priority: 'medium',
        });
      }
    }
  }

  private async checkLearningPatterns(): Promise<void> {
    const learningTopics = this.db.prepare(`
      SELECT topic, progress, resources FROM learning_topics
      WHERE progress > 20 AND progress < 80
      ORDER BY resources DESC LIMIT 3
    `).all() as Array<{ topic: string; progress: number; resources: number }>;

    for (const topic of learningTopics) {
      if (topic.resources > 10 && topic.progress < 50) {
        this.suggest({
          type: 'learning',
          title: `Continue learning ${topic.topic}`,
          description: `You've been researching ${topic.topic} with ${topic.resources} resources. Consider starting a practice project.`,
          priority: 'low',
        });
      }
    }
  }

  private async checkProductivityPatterns(): Promise<void> {
    const recentEpisodes = this.db.prepare(`
      SELECT outcome FROM episodes
      WHERE start_time > datetime('now', '-1 day')
    `).all() as Array<{ outcome: string }>;

    const abandoned = recentEpisodes.filter(e => e.outcome === 'abandoned').length;
    if (abandoned > 3) {
      this.suggest({
        type: 'productivity',
        title: 'High task abandonment',
        description: `You've abandoned ${abandoned} tasks recently. Consider breaking them into smaller pieces.`,
        priority: 'high',
      });
    }
  }

  private async checkDistractionPattern(): Promise<void> {
    const recentSwitches = this.db.prepare(`
      SELECT COUNT(*) as count FROM context_switches
      WHERE timestamp > datetime('now', '-30 minutes') AND productivity_impact = 'negative'
    `).get() as { count: number };

    if (recentSwitches.count > 5) {
      this.suggest({
        type: 'productivity',
        title: 'Frequent distractions detected',
        description: "You've been context switching frequently. Consider enabling Focus Mode.",
        priority: 'high',
      });
    }
  }

  private async suggest(data: Omit<MentorSuggestion, 'id' | 'timestamp' | 'read' | 'acted'>): Promise<void> {
    try {
      const existing = this.db.prepare(`
        SELECT id FROM mentor_suggestions
        WHERE type = ? AND title = ? AND read = 0 AND timestamp > datetime('now', '-1 day')
      `).get(data.type, data.title) as { id: number } | undefined;

      if (existing) return;

      this.db.prepare(`
        INSERT INTO mentor_suggestions (type, title, description, priority)
        VALUES (?, ?, ?, ?)
      `).run(data.type, data.title, data.description, data.priority);

      this.bus.emit('MENTOR_SUGGESTION', 'ai-mentor', {
        type: data.type,
        title: data.title,
        priority: data.priority,
      });

      log.info({ type: data.type, title: data.title }, 'Mentor suggestion created');
    } catch (err) {
      log.warn({ err }, 'Failed to create mentor suggestion');
    }
  }

  async getSuggestions(unreadOnly = true): Promise<MentorSuggestion[]> {
    let query = 'SELECT * FROM mentor_suggestions';
    if (unreadOnly) query += ' WHERE read = 0';
    query += ' ORDER BY priority DESC, timestamp DESC LIMIT 20';

    return this.db.prepare(query).all() as MentorSuggestion[];
  }

  async markAsRead(id: number): Promise<void> {
    this.db.prepare('UPDATE mentor_suggestions SET read = 1 WHERE id = ?').run(id);
  }

  async markAsActed(id: number): Promise<void> {
    this.db.prepare('UPDATE mentor_suggestions SET acted = 1 WHERE id = ?').run(id);
  }

  async getUnreadCount(): Promise<number> {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM mentor_suggestions WHERE read = 0'
    ).get() as { count: number };
    return result.count;
  }

  async generateProactiveSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];

    const learningTopics = this.db.prepare(`
      SELECT topic, progress FROM learning_topics WHERE progress > 20
      ORDER BY progress DESC LIMIT 5
    `).all() as Array<{ topic: string; progress: number }>;

    if (learningTopics.length > 0) {
      const topic = learningTopics[0];
      suggestions.push(`You're making progress on ${topic.topic} (${topic.progress}%). Keep going!`);
    }

    const recentDecisions = this.db.prepare(`
      SELECT decision FROM decisions ORDER BY timestamp DESC LIMIT 3
    `).all() as Array<{ decision: string }>;

    if (recentDecisions.length > 0) {
      suggestions.push(`Recent decision: ${recentDecisions[0].decision}`);
    }

    return suggestions;
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
