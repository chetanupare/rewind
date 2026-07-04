import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Concept {
  id: number;
  name: string;
  description: string;
  confidence: number;
  sources: string[];
  relatedConcepts: string[];
  firstLearned: string;
  lastUpdated: string;
  timesEncountered: number;
}

export class ConceptLearner {
  constructor(
    private db: Database,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS concepts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        confidence REAL DEFAULT 0.5,
        sources TEXT DEFAULT '[]',
        related_concepts TEXT DEFAULT '[]',
        first_learned TEXT DEFAULT (datetime('now')),
        last_updated TEXT DEFAULT (datetime('now')),
        times_encountered INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS concept_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concept_a TEXT NOT NULL,
        concept_b TEXT NOT NULL,
        relationship TEXT DEFAULT 'related_to',
        strength REAL DEFAULT 0.5,
        UNIQUE(concept_a, concept_b)
      );

      CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);
    `);
  }

  async learn(conceptName: string, context: {
    source: string;
    context: string;
    entities: string[];
  }): Promise<void> {
    const existing = this.db.prepare(
      'SELECT id, confidence, sources, times_encountered FROM concepts WHERE name = ?'
    ).get(conceptName) as { id: number; confidence: number; sources: string; times_encountered: number } | undefined;

    if (existing) {
      const sources = JSON.parse(existing.sources || '[]');
      if (!sources.includes(context.source)) {
        sources.push(context.source);
      }

      const newConfidence = Math.min(1, existing.confidence + 0.05);
      this.db.prepare(`
        UPDATE concepts SET 
          confidence = ?,
          sources = ?,
          last_updated = datetime('now'),
          times_encountered = times_encountered + 1
        WHERE id = ?
      `).run(newConfidence, JSON.stringify(sources), existing.id);

      for (const entity of context.entities) {
        if (entity !== conceptName) {
          this.addRelationship(conceptName, entity);
        }
      }
    } else {
      const description = await this.generateDescription(conceptName, context.context);

      this.db.prepare(`
        INSERT INTO concepts (name, description, confidence, sources, related_concepts)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        conceptName,
        description,
        0.5,
        JSON.stringify([context.source]),
        JSON.stringify(context.entities)
      );

      for (const entity of context.entities) {
        if (entity !== conceptName) {
          this.addRelationship(conceptName, entity);
        }
      }

      log.info({ concept: conceptName }, 'New concept learned');
    }
  }

  private async generateDescription(name: string, context: string): Promise<string> {
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) return `Concept: ${name}`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt: `Based on this context, describe what "${name}" means in 1-2 sentences:

Context: ${context}

Description:`,
      });

      return response.substring(0, 200);
    } catch {
      return `Concept: ${name}`;
    }
  }

  private addRelationship(conceptA: string, conceptB: string): void {
    const existing = this.db.prepare(
      'SELECT id, strength FROM concept_relationships WHERE concept_a = ? AND concept_b = ?'
    ).get(conceptA, conceptB) as { id: number; strength: number } | undefined;

    if (existing) {
      const newStrength = Math.min(1, existing.strength + 0.05);
      this.db.prepare('UPDATE concept_relationships SET strength = ? WHERE id = ?')
        .run(newStrength, existing.id);
    } else {
      this.db.prepare(
        'INSERT INTO concept_relationships (concept_a, concept_b) VALUES (?, ?)'
      ).run(conceptA, conceptB);
    }
  }

  async findRelated(query: string): Promise<string[]> {
    const concepts = this.db.prepare(`
      SELECT name FROM concepts
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY confidence DESC LIMIT 10
    `).all(`%${query}%`, `%${query}%`) as Array<{ name: string }>;

    return concepts.map(c => c.name);
  }

  async getConcept(name: string): Promise<Concept | null> {
    const concept = this.db.prepare(
      'SELECT * FROM concepts WHERE name = ?'
    ).get(name) as any;

    if (!concept) return null;

    return {
      ...concept,
      sources: JSON.parse(concept.sources || '[]'),
      relatedConcepts: JSON.parse(concept.related_concepts || '[]'),
    };
  }

  async getTopConcepts(limit: number = 20): Promise<Concept[]> {
    const concepts = this.db.prepare(`
      SELECT * FROM concepts ORDER BY confidence DESC, times_encountered DESC LIMIT ?
    `).all(limit) as any[];

    return concepts.map(c => ({
      ...c,
      sources: JSON.parse(c.sources || '[]'),
      relatedConcepts: JSON.parse(c.related_concepts || '[]'),
    }));
  }

  async getLearningTopics(): Promise<Array<{ concept: string; progress: number; resources: number }>> {
    const concepts = this.db.prepare(`
      SELECT name, confidence, times_encountered FROM concepts
      WHERE confidence < 0.8 AND times_encountered > 3
      ORDER BY times_encountered DESC LIMIT 10
    `).all() as Array<{ name: string; confidence: number; times_encountered: number }>;

    return concepts.map(c => ({
      concept: c.name,
      progress: Math.round(c.confidence * 100),
      resources: c.times_encountered,
    }));
  }
}
