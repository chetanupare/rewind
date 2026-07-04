import { Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

interface Entity {
  text: string;
  type: 'person' | 'organization' | 'technology' | 'project' | 'location' | 'date' | 'money' | 'other';
  confidence: number;
  start: number;
  end: number;
}

interface EntityExtractionResult {
  entities: Entity[];
  summary: Record<string, string[]>;
}

export class EntityRecognition {
  private spacyAvailable = false;

  constructor(private db: Database) {
    this.ensureTables();
    this.checkSpacy();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recognized_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        entity_text TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        context TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS entity_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity1_id INTEGER NOT NULL,
        entity2_id INTEGER NOT NULL,
        relationship TEXT NOT NULL,
        strength REAL DEFAULT 0.5,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_entities_text ON recognized_entities(entity_text);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON recognized_entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entity_rel_entity1 ON entity_relationships(entity1_id);
    `);
  }

  private async checkSpacy(): Promise<void> {
    try {
      const result = await this.execPython('import spacy; print("ok")');
      this.spacyAvailable = result.trim() === 'ok';
    } catch {
      this.spacyAvailable = false;
    }
    log.info({ available: this.spacyAvailable }, 'spaCy availability checked');
  }

  async extractEntities(text: string): Promise<EntityExtractionResult> {
    if (this.spacyAvailable) {
      try {
        return await this.extractWithSpacy(text);
      } catch (err) {
        log.debug({ err }, 'spaCy extraction failed, using regex');
      }
    }

    return this.extractWithRegex(text);
  }

  private async extractWithSpacy(text: string): Promise<EntityExtractionResult> {
    const script = `
import sys
import json
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("""${text.replace(/"/g, '\\"').replace(/\n/g, '\\n').substring(0, 5000)}""")

entities = []
for ent in doc.ents:
    entities.append({
        "text": ent.text,
        "type": ent.label_.lower(),
        "confidence": 0.8,
        "start": ent.start_char,
        "end": ent.end_char
    })

print(json.dumps({"entities": entities}))
`;

    const result = await this.execPython(script);
    const parsed = JSON.parse(result);

    const entities: Entity[] = (parsed.entities || []).map((e: any) => ({
      text: e.text,
      type: this.mapSpacyType(e.type),
      confidence: e.confidence || 0.8,
      start: e.start || 0,
      end: e.end || 0,
    }));

    return {
      entities,
      summary: this.summarizeEntities(entities),
    };
  }

  private extractWithRegex(text: string): EntityExtractionResult {
    const entities: Entity[] = [];

    const personPatterns = [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
      /\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+([A-Z][a-z]+)\b/g,
    ];

    for (const pattern of personPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] || match[0],
          type: 'person',
          confidence: 0.6,
          start: match.index,
          end: match.index + (match[1] || match[0]).length,
        });
      }
    }

    const techPatterns = [
      /\b(React|Vue|Angular|Node\.?js|TypeScript|JavaScript|Python|Rust|Go|Docker|Kubernetes|AWS|Azure|GCP|SQLite|PostgreSQL|MongoDB|Redis|GraphQL|REST|API)\b/gi,
      /\b(npm|yarn|pnpm|pip|cargo|brew|apt)\b/gi,
    ];

    for (const pattern of techPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] || match[0],
          type: 'technology',
          confidence: 0.9,
          start: match.index,
          end: match.index + (match[1] || match[0]).length,
        });
      }
    }

    const projectPatterns = [
      /\b([A-Z][a-zA-Z]+(?:CRM|API|App|Web|UI|Service|Module|System|Platform))\b/g,
      /\b(Project|Repo|Module|Component)\s*[:=]\s*(\w+)/gi,
    ];

    for (const pattern of projectPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] || match[0],
          type: 'project',
          confidence: 0.7,
          start: match.index,
          end: match.index + (match[1] || match[0]).length,
        });
      }
    }

    const orgPatterns = [
      /\b(Google|Microsoft|Apple|Amazon|Facebook|Meta|Netflix|Uber|Airbnb|Stripe|GitHub|GitLab)\b/g,
    ];

    for (const pattern of orgPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] || match[0],
          type: 'organization',
          confidence: 0.9,
          start: match.index,
          end: match.index + (match[1] || match[0]).length,
        });
      }
    }

    const uniqueEntities = this.deduplicateEntities(entities);

    return {
      entities: uniqueEntities,
      summary: this.summarizeEntities(uniqueEntities),
    };
  }

  private mapSpacyType(spacyType: string): Entity['type'] {
    const typeMap: Record<string, Entity['type']> = {
      'person': 'person',
      'org': 'organization',
      'gpe': 'location',
      'loc': 'location',
      'date': 'date',
      'time': 'date',
      'money': 'money',
      'product': 'technology',
      'tech': 'technology',
    };

    return typeMap[spacyType.toLowerCase()] || 'other';
  }

  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Map<string, Entity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.text.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  private summarizeEntities(entities: Entity[]): Record<string, string[]> {
    const summary: Record<string, string[]> = {};

    for (const entity of entities) {
      if (!summary[entity.type]) {
        summary[entity.type] = [];
      }
      if (!summary[entity.type].includes(entity.text)) {
        summary[entity.type].push(entity.text);
      }
    }

    return summary;
  }

  async storeEntities(sourceType: string, sourceId: number, text: string): Promise<void> {
    const result = await this.extractEntities(text);

    for (const entity of result.entities) {
      this.db.prepare(`
        INSERT INTO recognized_entities (source_type, source_id, entity_text, entity_type, confidence, context)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sourceType, sourceId, entity.text, entity.type, entity.confidence, text.substring(0, 500));
    }
  }

  async searchEntities(query: string, type?: string, limit = 20): Promise<Entity[]> {
    let sql = 'SELECT DISTINCT entity_text, entity_type, confidence FROM recognized_entities WHERE entity_text LIKE ?';
    const params: unknown[] = [`%${query}%`];

    if (type) {
      sql += ' AND entity_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY confidence DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      text: r.entity_text,
      type: r.entity_type,
      confidence: r.confidence,
      start: 0,
      end: 0,
    }));
  }

  async getEntityStats(): Promise<Record<string, number>> {
    const rows = this.db.prepare(`
      SELECT entity_type, COUNT(DISTINCT entity_text) as count
      FROM recognized_entities
      GROUP BY entity_type
    `).all() as Array<{ entity_type: string; count: number }>;

    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.entity_type] = row.count;
    }
    return stats;
  }

  private execPython(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptFile = path.join(os.tmpdir(), `rewindx-ner-${Date.now()}.py`);
      fs.writeFileSync(scriptFile, script, 'utf-8');

      execFile('python', [scriptFile], { timeout: 30000, windowsHide: true }, (err, stdout) => {
        try { fs.unlinkSync(scriptFile); } catch {}
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout || '');
      });
    });
  }
}
