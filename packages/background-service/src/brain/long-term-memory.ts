import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface Memory {
  id: number;
  type: string;
  name: string;
  summary: string;
  properties: Record<string, unknown>;
  importance: number;
  confidence: number;
  source: string;
  firstSeen: string;
  lastSeen: string;
  timesAccessed: number;
  decayFactor: number;
}

export class LongTermMemory {
  private readonly DECAY_RATE = 0.01;
  private readonly IMPORTANCE_THRESHOLD = 0.3;

  constructor(private db: Database) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ltm_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT,
        properties TEXT DEFAULT '{}',
        importance REAL DEFAULT 0.5,
        confidence REAL DEFAULT 0.5,
        source TEXT,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        times_accessed INTEGER DEFAULT 1,
        decay_factor REAL DEFAULT 1.0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(type, name)
      );

      CREATE TABLE IF NOT EXISTS ltm_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        context TEXT,
        FOREIGN KEY (memory_id) REFERENCES ltm_memories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_ltm_type ON ltm_memories(type);
      CREATE INDEX IF NOT EXISTS idx_ltm_name ON ltm_memories(name);
      CREATE INDEX IF NOT EXISTS idx_ltm_importance ON ltm_memories(importance);
    `);
  }

  async remember(data: {
    type: string;
    name: string;
    properties?: Record<string, unknown>;
    importance?: number;
    source?: string;
    summary?: string;
  }): Promise<number> {
    const existing = this.db.prepare(
      'SELECT id, importance, times_accessed FROM ltm_memories WHERE type = ? AND name = ?'
    ).get(data.type, data.name) as { id: number; importance: number; times_accessed: number } | undefined;

    if (existing) {
      const newImportance = Math.min(1, existing.importance + 0.05);
      this.db.prepare(`
        UPDATE ltm_memories SET 
          importance = ?,
          last_seen = datetime('now'),
          times_accessed = times_accessed + 1,
          decay_factor = 1.0,
          properties = ?
        WHERE id = ?
      `).run(newImportance, JSON.stringify(data.properties || {}), existing.id);

      return existing.id;
    }

    const result = this.db.prepare(`
      INSERT INTO ltm_memories (type, name, summary, properties, importance, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.type,
      data.name,
      data.summary || '',
      JSON.stringify(data.properties || {}),
      data.importance || 0.5,
      data.source
    );

    return result.lastInsertRowid as number;
  }

  async recall(type: string, name: string): Promise<Memory | null> {
    const memory = this.db.prepare(
      'SELECT * FROM ltm_memories WHERE type = ? AND name = ?'
    ).get(type, name) as any;

    if (!memory) return null;

    this.db.prepare(
      'UPDATE ltm_memories SET times_accessed = times_accessed + 1, last_seen = datetime("now") WHERE id = ?'
    ).run(memory.id);

    return {
      ...memory,
      properties: JSON.parse(memory.properties || '{}'),
    };
  }

  async search(query: string, limit: number = 20): Promise<Memory[]> {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results: Memory[] = [];

    for (const word of words) {
      const memories = this.db.prepare(`
        SELECT * FROM ltm_memories
        WHERE name LIKE ? OR summary LIKE ? OR properties LIKE ?
        ORDER BY importance DESC, last_seen DESC
        LIMIT ?
      `).all(`%${word}%`, `%${word}%`, `%${word}%`, limit) as any[];

      results.push(...memories.map((m: any) => ({
        ...m,
        properties: JSON.parse(m.properties || '{}'),
      })));
    }

    const unique = results.filter((r, i, self) =>
      i === self.findIndex(t => t.type === r.type && t.name === r.name)
    );

    return unique.sort((a, b) => b.importance - a.importance).slice(0, limit);
  }

  async getByType(type: string, limit: number = 50): Promise<Memory[]> {
    const memories = this.db.prepare(`
      SELECT * FROM ltm_memories WHERE type = ?
      ORDER BY importance DESC, last_seen DESC
      LIMIT ?
    `).all(type, limit) as any[];

    return memories.map((m: any) => ({
      ...m,
      properties: JSON.parse(m.properties || '{}'),
    }));
  }

  async getImportant(limit: number = 20): Promise<Memory[]> {
    const memories = this.db.prepare(`
      SELECT * FROM ltm_memories
      WHERE importance >= ?
      ORDER BY importance DESC, last_seen DESC
      LIMIT ?
    `).all(this.IMPORTANCE_THRESHOLD, limit) as any[];

    return memories.map((m: any) => ({
      ...m,
      properties: JSON.parse(m.properties || '{}'),
    }));
  }

  async getRecent(limit: number = 20): Promise<Memory[]> {
    const memories = this.db.prepare(`
      SELECT * FROM ltm_memories
      ORDER BY last_seen DESC
      LIMIT ?
    `).all(limit) as any[];

    return memories.map((m: any) => ({
      ...m,
      properties: JSON.parse(m.properties || '{}'),
    }));
  }

  async decay(): Promise<number> {
    const result = this.db.prepare(`
      UPDATE ltm_memories SET 
        importance = importance * (1 - ?),
        decay_factor = decay_factor * (1 - ?)
      WHERE last_seen < datetime('now', '-7 days')
    `).run(this.DECAY_RATE, this.DECAY_RATE);

    const forgotten = this.db.prepare(`
      DELETE FROM ltm_memories
      WHERE importance < 0.1 AND last_seen < datetime('now', '-30 days')
    `).run();

    log.info({ decayed: result.changes, forgotten: forgotten.changes }, 'Memory decay applied');
    return result.changes;
  }

  async consolidate(): Promise<void> {
    const similar = this.db.prepare(`
      SELECT m1.id as id1, m2.id as id2, m1.name as name1, m2.name as name2
      FROM ltm_memories m1
      JOIN ltm_memories m2 ON m1.type = m2.type AND m1.id < m2.id
      WHERE m1.name LIKE '%' || m2.name || '%' OR m2.name LIKE '%' || m1.name || '%'
    `).all() as Array<{ id1: number; id2: number; name1: string; name2: string }>;

    for (const pair of similar) {
      const keepId = pair.id1;
      const removeId = pair.id2;

      this.db.prepare('UPDATE ltm_episodes SET memory_id = ? WHERE memory_id = ?').run(keepId, removeId);
      this.db.prepare('DELETE FROM ltm_memories WHERE id = ?').run(removeId);

      log.info({ kept: pair.name1, removed: pair.name2 }, 'Consolidated similar memories');
    }
  }

  getStats(): { total: number; byType: Record<string, number>; averageImportance: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM ltm_memories').get() as { count: number }).count;

    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM ltm_memories GROUP BY type
    `).all() as Array<{ type: string; count: number }>;

    const avg = (this.db.prepare('SELECT AVG(importance) as avg FROM ltm_memories').get() as { avg: number }).avg;

    return {
      total,
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      averageImportance: avg || 0,
    };
  }
}
