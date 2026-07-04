import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface GraphNode {
  id: number;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  importance: number;
  lastSeen: string;
  connections: number;
}

interface GraphEdge {
  id: number;
  sourceId: number;
  targetId: number;
  sourceName: string;
  targetName: string;
  relationship: string;
  strength: number;
  lastConfirmed: string;
}

interface QueryResult {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
}

export class KnowledgeGraph {
  constructor(private db: Database) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        importance REAL DEFAULT 0.5,
        last_seen TEXT DEFAULT (datetime('now')),
        connections INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(type, name)
      );

      CREATE TABLE IF NOT EXISTS kg_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relationship TEXT NOT NULL,
        strength REAL DEFAULT 0.5,
        last_confirmed TEXT DEFAULT (datetime('now')),
        times_seen INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES kg_nodes(id),
        FOREIGN KEY (target_id) REFERENCES kg_nodes(id),
        UNIQUE(source_id, target_id, relationship)
      );

      CREATE TABLE IF NOT EXISTS kg_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        source TEXT,
        learned_at TEXT DEFAULT (datetime('now')),
        last_confirmed TEXT,
        times_confirmed INTEGER DEFAULT 1,
        UNIQUE(subject, predicate, object)
      );

      CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_kg_nodes_name ON kg_nodes(name);
      CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_kg_facts_subject ON kg_facts(subject);
      CREATE INDEX IF NOT EXISTS idx_kg_facts_object ON kg_facts(object);
    `);
  }

  getOrCreateNode(type: string, name: string, properties: Record<string, unknown> = {}): GraphNode {
    let node = this.db.prepare(
      'SELECT * FROM kg_nodes WHERE type = ? AND name = ?'
    ).get(type, name) as GraphNode | undefined;

    if (node) {
      this.db.prepare(
        'UPDATE kg_nodes SET last_seen = datetime("now"), connections = connections + 1 WHERE id = ?'
      ).run(node.id);
      return node;
    }

    const result = this.db.prepare(
      'INSERT INTO kg_nodes (type, name, properties) VALUES (?, ?, ?)'
    ).run(type, name, JSON.stringify(properties));

    return {
      id: result.lastInsertRowid as number,
      type,
      name,
      properties,
      importance: 0.5,
      lastSeen: new Date().toISOString(),
      connections: 0,
    };
  }

  addRelationship(sourceName: string, targetName: string, relationship: string, strength: number = 0.5): void {
    const source = this.db.prepare(
      'SELECT id FROM kg_nodes WHERE name = ?'
    ).get(sourceName) as { id: number } | undefined;

    const target = this.db.prepare(
      'SELECT id FROM kg_nodes WHERE name = ?'
    ).get(targetName) as { id: number } | undefined;

    if (!source || !target) return;

    const existing = this.db.prepare(
      'SELECT id, strength, times_seen FROM kg_edges WHERE source_id = ? AND target_id = ? AND relationship = ?'
    ).get(source.id, target.id, relationship) as { id: number; strength: number; times_seen: number } | undefined;

    if (existing) {
      const newStrength = Math.min(1, existing.strength + 0.05);
      this.db.prepare(
        'UPDATE kg_edges SET strength = ?, last_confirmed = datetime("now"), times_seen = times_seen + 1 WHERE id = ?'
      ).run(newStrength, existing.id);
    } else {
      this.db.prepare(
        'INSERT INTO kg_edges (source_id, target_id, relationship, strength) VALUES (?, ?, ?, ?)'
      ).run(source.id, target.id, relationship, strength);
    }
  }

  addFact(subject: string, predicate: string, object: string, confidence: number = 0.5, source?: string): void {
    const existing = this.db.prepare(
      'SELECT id, confidence, times_confirmed FROM kg_facts WHERE subject = ? AND predicate = ? AND object = ?'
    ).get(subject, predicate, object) as { id: number; confidence: number; times_confirmed: number } | undefined;

    if (existing) {
      const newConfidence = Math.min(1, existing.confidence + 0.05);
      this.db.prepare(
        'UPDATE kg_facts SET confidence = ?, last_confirmed = datetime("now"), times_confirmed = times_confirmed + 1 WHERE id = ?'
      ).run(newConfidence, existing.id);
    } else {
      this.db.prepare(
        'INSERT INTO kg_facts (subject, predicate, object, confidence, source) VALUES (?, ?, ?, ?, ?)'
      ).run(subject, predicate, object, confidence, source);
    }
  }

  async query(question: string): Promise<QueryResult[]> {
    const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const results: QueryResult[] = [];

    for (const word of words) {
      const facts = this.db.prepare(`
        SELECT subject, predicate, object, confidence, source FROM kg_facts
        WHERE subject LIKE ? OR object LIKE ?
        ORDER BY confidence DESC LIMIT 10
      `).all(`%${word}%`, `%${word}%`) as QueryResult[];

      results.push(...facts);
    }

    const uniqueResults = results.filter((r, i, self) =>
      i === self.findIndex(t => t.subject === r.subject && t.predicate === r.predicate && t.object === r.object)
    );

    return uniqueResults.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }

  getRelatedNodes(nodeName: string, depth: number = 2): GraphNode[] {
    const node = this.db.prepare(
      'SELECT id FROM kg_nodes WHERE name = ?'
    ).get(nodeName) as { id: number } | undefined;

    if (!node) return [];

    const visited = new Set<number>();
    const result: GraphNode[] = [];

    const traverse = (nodeId: number, currentDepth: number) => {
      if (currentDepth > depth || visited.has(nodeId)) return;
      visited.add(nodeId);

      const edges = this.db.prepare(`
        SELECT e.*, 
               CASE WHEN e.source_id = ? THEN n2.id ELSE n1.id END as related_id,
               CASE WHEN e.source_id = ? THEN n2.name ELSE n1.name END as related_name,
               CASE WHEN e.source_id = ? THEN n2.type ELSE n1.type END as related_type
        FROM kg_edges e
        JOIN kg_nodes n1 ON e.source_id = n1.id
        JOIN kg_nodes n2 ON e.target_id = n2.id
        WHERE e.source_id = ? OR e.target_id = ?
      `).all(nodeId, nodeId, nodeId, nodeId, nodeId) as any[];

      for (const edge of edges) {
        const relatedNode = this.db.prepare(
          'SELECT * FROM kg_nodes WHERE id = ?'
        ).get(edge.related_id) as GraphNode | undefined;

        if (relatedNode && !visited.has(relatedNode.id)) {
          result.push(relatedNode);
          traverse(relatedNode.id, currentDepth + 1);
        }
      }
    };

    traverse(node.id, 0);
    return result;
  }

  getStats(): { nodes: number; edges: number; facts: number } {
    const nodes = (this.db.prepare('SELECT COUNT(*) as count FROM kg_nodes').get() as { count: number }).count;
    const edges = (this.db.prepare('SELECT COUNT(*) as count FROM kg_edges').get() as { count: number }).count;
    const facts = (this.db.prepare('SELECT COUNT(*) as count FROM kg_facts').get() as { count: number }).count;

    return { nodes, edges, facts };
  }

  async cleanup(): Promise<void> {
    this.db.prepare(`
      DELETE FROM kg_nodes WHERE connections = 0 AND last_seen < datetime('now', '-30 days')
    `).run();

    this.db.prepare(`
      DELETE FROM kg_edges WHERE last_confirmed < datetime('now', '-60 days')
    `).run();

    log.info('Knowledge graph cleanup complete');
  }

  mergeNodes(name1: string, name2: string): void {
    const node1 = this.db.prepare('SELECT id FROM kg_nodes WHERE name = ?').get(name1) as { id: number } | undefined;
    const node2 = this.db.prepare('SELECT id FROM kg_nodes WHERE name = ?').get(name2) as { id: number } | undefined;

    if (!node1 || !node2) return;

    this.db.prepare('UPDATE kg_edges SET source_id = ? WHERE source_id = ?').run(node1.id, node2.id);
    this.db.prepare('UPDATE kg_edges SET target_id = ? WHERE target_id = ?').run(node1.id, node2.id);
    this.db.prepare('DELETE FROM kg_nodes WHERE id = ?').run(node2.id);

    log.info({ name1, name2 }, 'Merged knowledge graph nodes');
  }
}
