import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface PatternObservation {
  type: string;
  intent: string;
  entities: Array<{ type: string; name: string }>;
  timestamp: string;
}

interface Pattern {
  id: number;
  description: string;
  sequence: string[];
  frequency: number;
  confidence: number;
  lastSeen: string;
}

export class PatternLearner {
  private recentObservations: PatternObservation[] = [];
  private readonly MAX_OBSERVATIONS = 1000;

  constructor(private db: Database) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learned_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        sequence TEXT DEFAULT '[]',
        frequency INTEGER DEFAULT 1,
        confidence REAL DEFAULT 0.5,
        last_seen TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pattern_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        intent TEXT,
        entities TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON learned_patterns(confidence);
    `);
  }

  observe(observation: PatternObservation): void {
    this.recentObservations.push(observation);

    if (this.recentObservations.length > this.MAX_OBSERVATIONS) {
      this.recentObservations.shift();
    }

    this.db.prepare(`
      INSERT INTO pattern_observations (timestamp, type, intent, entities)
      VALUES (?, ?, ?, ?)
    `).run(
      observation.timestamp,
      observation.type,
      observation.intent,
      JSON.stringify(observation.entities)
    );

    this.detectSequences();
  }

  private detectSequences(): void {
    if (this.recentObservations.length < 5) return;

    const recent = this.recentObservations.slice(-10);
    const sequence = recent.map(o => o.intent);

    for (let len = 3; len <= Math.min(5, sequence.length); len++) {
      for (let i = 0; i <= sequence.length - len; i++) {
        const subSequence = sequence.slice(i, i + len);
        this.recordPattern(subSequence);
      }
    }
  }

  private recordPattern(sequence: string[]): void {
    const description = sequence.join(' → ');

    const existing = this.db.prepare(
      'SELECT id, frequency, confidence FROM learned_patterns WHERE description = ?'
    ).get(description) as { id: number; frequency: number; confidence: number } | undefined;

    if (existing) {
      const newConfidence = Math.min(1, existing.confidence + 0.05);
      this.db.prepare(`
        UPDATE learned_patterns SET 
          frequency = frequency + 1,
          confidence = ?,
          last_seen = datetime('now')
        WHERE id = ?
      `).run(newConfidence, existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO learned_patterns (description, sequence, confidence)
        VALUES (?, ?, 0.5)
      `).run(description, JSON.stringify(sequence));
    }
  }

  getTopPatterns(limit: number = 10): Pattern[] {
    const patterns = this.db.prepare(`
      SELECT * FROM learned_patterns
      WHERE frequency > 2
      ORDER BY confidence DESC, frequency DESC
      LIMIT ?
    `).all(limit) as any[];

    return patterns.map(p => ({
      ...p,
      sequence: JSON.parse(p.sequence || '[]'),
    }));
  }

  async consolidate(): Promise<void> {
    const similar = this.db.prepare(`
      SELECT p1.id as id1, p2.id as id2, p1.description as desc1, p2.description as desc2
      FROM learned_patterns p1
      JOIN learned_patterns p2 ON p1.id < p2.id
      WHERE p1.sequence = p2.sequence
    `).all() as Array<{ id1: number; id2: number; desc1: string; desc2: string }>;

    for (const pair of similar) {
      this.db.prepare('DELETE FROM learned_patterns WHERE id = ?').run(pair.id2);
      this.db.prepare('UPDATE learned_patterns SET frequency = frequency + 1 WHERE id = ?').run(pair.id1);
    }

    this.db.prepare(`
      DELETE FROM learned_patterns WHERE frequency < 3 AND last_seen < datetime('now', '-30 days')
    `).run();

    log.info({ consolidated: similar.length }, 'Pattern consolidation complete');
  }

  predictNext(currentSequence: string[]): { intent: string; confidence: number } | null {
    if (currentSequence.length < 2) return null;

    const lastTwo = currentSequence.slice(-2).join(' → ');

    const patterns = this.db.prepare(`
      SELECT * FROM learned_patterns
      WHERE description LIKE ?
      ORDER BY confidence DESC, frequency DESC
      LIMIT 5
    `).all(`%${lastTwo}%`) as any[];

    for (const pattern of patterns) {
      const seq = JSON.parse(pattern.sequence || '[]');
      const matchIndex = seq.indexOf(currentSequence[currentSequence.length - 1]);

      if (matchIndex >= 0 && matchIndex < seq.length - 1) {
        return {
          intent: seq[matchIndex + 1],
          confidence: pattern.confidence,
        };
      }
    }

    return null;
  }
}
