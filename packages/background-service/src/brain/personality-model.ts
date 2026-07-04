import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface UserPersonality {
  workStyle: {
    preferredHours: string[];
    averageSessionLength: number;
    commitFrequency: string;
    focusPattern: string;
  };
  preferences: {
    preferredApps: string[];
    shortcuts: string[];
    workflow: string;
  };
  habits: {
    morningRoutine: string[];
    breakPatterns: string[];
    commitStyle: string;
  };
  productivity: {
    peakHours: string[];
    distractionTriggers: string[];
    focusScore: number;
  };
}

export class UserPersonalityModel {
  private personality: UserPersonality;

  constructor(private db: Database) {
    this.ensureTables();
    this.personality = this.createDefaultPersonality();
    this.loadPersonality();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_personality (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        last_updated TEXT DEFAULT (datetime('now')),
        UNIQUE(category, key)
      );

      CREATE TABLE IF NOT EXISTS personality_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        category TEXT NOT NULL,
        observation TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  private createDefaultPersonality(): UserPersonality {
    return {
      workStyle: {
        preferredHours: [],
        averageSessionLength: 0,
        commitFrequency: 'unknown',
        focusPattern: 'unknown',
      },
      preferences: {
        preferredApps: [],
        shortcuts: [],
        workflow: 'unknown',
      },
      habits: {
        morningRoutine: [],
        breakPatterns: [],
        commitStyle: 'unknown',
      },
      productivity: {
        peakHours: [],
        distractionTriggers: [],
        focusScore: 50,
      },
    };
  }

  private loadPersonality(): void {
    const rows = this.db.prepare('SELECT * FROM user_personality').all() as Array<{
      category: string;
      key: string;
      value: string;
      confidence: number;
    }>;

    for (const row of rows) {
      const category = this.personality[row.category as keyof UserPersonality];
      if (category && typeof category === 'object') {
        (category as any)[row.key] = JSON.parse(row.value);
      }
    }
  }

  async observe(category: string, key: string, value: unknown): Promise<void> {
    const existing = this.db.prepare(
      'SELECT confidence FROM user_personality WHERE category = ? AND key = ?'
    ).get(category, key) as { confidence: number } | undefined;

    if (existing) {
      const newConfidence = Math.min(1, existing.confidence + 0.05);
      this.db.prepare(`
        UPDATE user_personality SET value = ?, confidence = ?, last_updated = datetime('now')
        WHERE category = ? AND key = ?
      `).run(JSON.stringify(value), newConfidence, category, key);
    } else {
      this.db.prepare(`
        INSERT INTO user_personality (category, key, value, confidence)
        VALUES (?, ?, ?, 0.5)
      `).run(category, key, JSON.stringify(value));
    }

    this.loadPersonality();
  }

  async observeHabit(habit: string, context: string): Promise<void> {
    this.db.prepare(`
      INSERT INTO personality_observations (timestamp, category, observation)
      VALUES (?, 'habit', ?)
    `).run(new Date().toISOString(), `${habit}: ${context}`);
  }

  getPersonality(): UserPersonality {
    return { ...this.personality };
  }

  async getProductivityInsights(): Promise<string[]> {
    const insights: string[] = [];

    if (this.personality.productivity.peakHours.length > 0) {
      insights.push(`Your peak productivity hours: ${this.personality.productivity.peakHours.join(', ')}`);
    }

    if (this.personality.productivity.distractionTriggers.length > 0) {
      insights.push(`Common distractions: ${this.personality.productivity.distractionTriggers.join(', ')}`);
    }

    if (this.personality.workStyle.averageSessionLength > 0) {
      insights.push(`Average focus session: ${this.personality.workStyle.averageSessionLength} minutes`);
    }

    return insights;
  }

  async getWorkingStyleSummary(): Promise<string> {
    const parts: string[] = [];

    if (this.personality.workStyle.preferredHours.length > 0) {
      parts.push(`Works best during: ${this.personality.workStyle.preferredHours.join(', ')}`);
    }

    if (this.personality.preferences.preferredApps.length > 0) {
      parts.push(`Preferred tools: ${this.personality.preferences.preferredApps.slice(0, 5).join(', ')}`);
    }

    if (this.personality.workStyle.focusPattern !== 'unknown') {
      parts.push(`Focus pattern: ${this.personality.workStyle.focusPattern}`);
    }

    return parts.join('. ') || 'Still learning your work style...';
  }
}
