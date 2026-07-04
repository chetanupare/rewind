import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface CuriosityQuestion {
  id: number;
  question: string;
  context: string;
  confidence: number;
  answered: boolean;
  createdAt: string;
}

export class CuriosityEngine {
  private recentObservations: Array<{
    type: string;
    entities: Array<{ type: string; name: string }>;
    intent: string;
    timestamp: Date;
  }> = [];

  private readonly OBSERVATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private db: Database,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS curiosity_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        context TEXT,
        confidence REAL DEFAULT 0.5,
        answered INTEGER DEFAULT 0,
        answer TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL UNIQUE,
        progress REAL DEFAULT 0,
        resources INTEGER DEFAULT 0,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_curiosity_answered ON curiosity_questions(answered);
    `);
  }

  async observe(data: {
    type: string;
    entities: Array<{ type: string; name: string }>;
    intent: string;
  }): Promise<void> {
    this.recentObservations.push({
      ...data,
      timestamp: new Date(),
    });

    this.recentObservations = this.recentObservations.filter(
      o => Date.now() - o.timestamp.getTime() < this.OBSERVATION_WINDOW_MS
    );

    await this.detectLearningPatterns();
    await this.generateQuestions();
  }

  private async detectLearningPatterns(): Promise<void> {
    const entityFrequency = new Map<string, number>();

    for (const obs of this.recentObservations) {
      for (const entity of obs.entities) {
        const key = `${entity.type}:${entity.name}`;
        entityFrequency.set(key, (entityFrequency.get(key) || 0) + 1);
      }
    }

    for (const [key, count] of entityFrequency) {
      if (count >= 5) {
        const [type, name] = key.split(':');

        const existing = this.db.prepare(
          'SELECT id, progress, resources FROM learning_topics WHERE topic = ?'
        ).get(name) as { id: number; progress: number; resources: number } | undefined;

        if (existing) {
          const newProgress = Math.min(100, existing.progress + 5);
          this.db.prepare(`
            UPDATE learning_topics SET progress = ?, resources = resources + 1, last_seen = datetime('now')
            WHERE id = ?
          `).run(newProgress, existing.id);
        } else {
          this.db.prepare(`
            INSERT INTO learning_topics (topic, progress, resources)
            VALUES (?, 10, 1)
          `).run(name);

          log.info({ topic: name }, 'New learning topic detected');
        }
      }
    }
  }

  private async generateQuestions(): Promise<void> {
    const topics = this.db.prepare(`
      SELECT topic, progress, resources FROM learning_topics
      WHERE progress < 80 AND last_seen > datetime('now', '-7 days')
      ORDER BY resources DESC
      LIMIT 5
    `).all() as Array<{ topic: string; progress: number; resources: number }>;

    for (const topic of topics) {
      const existing = this.db.prepare(
        'SELECT id FROM curiosity_questions WHERE question LIKE ? AND answered = 0'
      ).get(`%${topic.topic}%`) as { id: number } | undefined;

      if (!existing) {
        const question = this.generateQuestion(topic.topic, topic.progress);

        this.db.prepare(`
          INSERT INTO curiosity_questions (question, context, confidence)
          VALUES (?, ?, ?)
        `).run(
          question,
          `Learning ${topic.topic} - ${topic.progress}% progress`,
          Math.min(0.9, topic.resources / 10)
        );

        log.info({ topic: topic.topic, question }, 'Curiosity question generated');
      }
    }
  }

  private generateQuestion(topic: string, progress: number): string {
    if (progress < 20) {
      return `Are you learning ${topic}? I can help track your progress.`;
    } else if (progress < 50) {
      return `You've been working with ${topic} for a while. Want me to find related resources?`;
    } else {
      return `You're making good progress on ${topic}. Ready to start a project?`;
    }
  }

  getQuestions(): string[] {
    const questions = this.db.prepare(`
      SELECT question FROM curiosity_questions
      WHERE answered = 0
      ORDER BY confidence DESC, created_at DESC
      LIMIT 5
    `).all() as Array<{ question: string }>;

    return questions.map(q => q.question);
  }

  async answerQuestion(id: number, answer: string): Promise<void> {
    this.db.prepare(`
      UPDATE curiosity_questions SET answered = 1, answer = ? WHERE id = ?
    `).run(answer, id);
  }

  async getLearningTopics(): Promise<Array<{
    topic: string;
    progress: number;
    resources: number;
    firstSeen: string;
  }>> {
    return this.db.prepare(`
      SELECT topic, progress, resources, first_seen FROM learning_topics
      ORDER BY progress DESC, resources DESC
    `).all() as Array<{
      topic: string;
      progress: number;
      resources: number;
      firstSeen: string;
    }>;
  }

  async update(): Promise<void> {
    await this.detectLearningPatterns();
    await this.generateQuestions();
  }
}
