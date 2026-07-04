import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Decision {
  id: number;
  timestamp: string;
  decision: string;
  reason: string;
  alternatives: string[];
  outcome: 'pending' | 'successful' | 'failed' | 'mixed';
  outcomeNotes: string;
  confidence: number;
  importance: number;
  relatedEpisodes: number[];
  context: string;
}

export class DecisionTracker {
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
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        alternatives TEXT DEFAULT '[]',
        outcome TEXT DEFAULT 'pending',
        outcome_notes TEXT,
        confidence REAL DEFAULT 0.5,
        importance REAL DEFAULT 0.5,
        related_episodes TEXT DEFAULT '[]',
        context TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS decision_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        decision_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        outcome TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (decision_id) REFERENCES decisions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_time ON decisions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON decisions(outcome);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('GIT_COMMIT', (event) => {
      const { commitMessage } = event.payload as any;
      this.detectDecision(commitMessage);
    });

    this.bus.on('FILE_SAVED', (event) => {
      const { filePath } = event.payload as any;
      this.detectDecisionFromContext(filePath);
    });
  }

  private detectDecision(context: string): void {
    const decisionPatterns = [
      { pattern: /(?:switch|migrat|mov)(?:ed|ing)?\s+to\s+(.+)/i, type: 'migration' },
      { pattern: /(?:chose|choos|select|pick)(?:ed|ing)?\s+(.+)/i, type: 'selection' },
      { pattern: /(?:replac|replac)(?:ed|ing)?\s+(.+)\s+with/i, type: 'replacement' },
      { pattern: /(?:remov|delet)(?:ed|ing)?\s+(.+)/i, type: 'removal' },
      { pattern: /(?:add|implement|integrat)(?:ed|ing)?\s+(.+)/i, type: 'addition' },
    ];

    for (const { pattern, type } of decisionPatterns) {
      const match = context.match(pattern);
      if (match) {
        this.recordDecision({
          timestamp: new Date().toISOString(),
          decision: context.substring(0, 200),
          reason: `Detected ${type} decision`,
          alternatives: [],
          outcome: 'pending',
          outcomeNotes: '',
          confidence: 0.6,
          importance: 0.5,
          context,
        });
        break;
      }
    }
  }

  private detectDecisionFromContext(filePath: string): void {
    const fileName = filePath.split(/[/\\]/).pop() || '';

    if (fileName === 'package.json') {
      this.recordDecision({
        timestamp: new Date().toISOString(),
        decision: 'Modified package.json',
        reason: 'Dependency change',
        alternatives: [],
        outcome: 'pending',
        outcomeNotes: '',
        confidence: 0.7,
        importance: 0.6,
        context: filePath,
      });
    }
  }

  async recordDecision(data: Omit<Decision, 'id' | 'relatedEpisodes'>): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO decisions (timestamp, decision, reason, alternatives, outcome, outcome_notes, confidence, importance, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.timestamp,
      data.decision,
      data.reason,
      JSON.stringify(data.alternatives),
      data.outcome,
      data.outcomeNotes,
      data.confidence,
      data.importance,
      data.context
    );

    const decisionId = result.lastInsertRowid as number;

    this.bus.emit('DECISION_RECORDED', 'decision-tracker', {
      decisionId,
      decision: data.decision,
    });

    log.info({ decisionId, decision: data.decision }, 'Decision recorded');

    return decisionId;
  }

  async recordOutcome(decisionId: number, outcome: Decision['outcome'], notes: string): Promise<void> {
    this.db.prepare(`
      UPDATE decisions SET outcome = ?, outcome_notes = ? WHERE id = ?
    `).run(outcome, notes, decisionId);

    this.db.prepare(`
      INSERT INTO decision_outcomes (decision_id, timestamp, outcome, notes)
      VALUES (?, ?, ?, ?)
    `).run(decisionId, new Date().toISOString(), outcome, notes);

    if (outcome === 'successful') {
      this.db.prepare(`
        UPDATE decisions SET confidence = MIN(1.0, confidence + 0.1) WHERE id = ?
      `).run(decisionId);
    } else if (outcome === 'failed') {
      this.db.prepare(`
        UPDATE decisions SET confidence = MAX(0.0, confidence - 0.2) WHERE id = ?
      `).run(decisionId);
    }
  }

  async searchDecisions(query: string): Promise<Decision[]> {
    const decisions = this.db.prepare(`
      SELECT * FROM decisions
      WHERE decision LIKE ? OR reason LIKE ? OR context LIKE ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as any[];

    return decisions.map(d => ({
      ...d,
      alternatives: JSON.parse(d.alternatives || '[]'),
      relatedEpisodes: JSON.parse(d.relatedEpisodes || '[]'),
    }));
  }

  async getRecentDecisions(limit = 20): Promise<Decision[]> {
    const decisions = this.db.prepare(`
      SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return decisions.map(d => ({
      ...d,
      alternatives: JSON.parse(d.alternatives || '[]'),
      relatedEpisodes: JSON.parse(d.relatedEpisodes || '[]'),
    }));
  }

  async getSuccessfulDecisions(): Promise<Decision[]> {
    const decisions = this.db.prepare(`
      SELECT * FROM decisions WHERE outcome = 'successful'
      ORDER BY confidence DESC
    `).all() as any[];

    return decisions.map(d => ({
      ...d,
      alternatives: JSON.parse(d.alternatives || '[]'),
      relatedEpisodes: JSON.parse(d.relatedEpisodes || '[]'),
    }));
  }

  async getFailedDecisions(): Promise<Decision[]> {
    const decisions = this.db.prepare(`
      SELECT * FROM decisions WHERE outcome = 'failed'
      ORDER BY timestamp DESC
    `).all() as any[];

    return decisions.map(d => ({
      ...d,
      alternatives: JSON.parse(d.alternatives || '[]'),
      relatedEpisodes: JSON.parse(d.relatedEpisodes || '[]'),
    }));
  }
}
