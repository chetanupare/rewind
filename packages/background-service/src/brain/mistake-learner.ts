import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface Mistake {
  id: number;
  timestamp: string;
  error: string;
  context: string;
  solution: string;
  timeTaken: number;
  commands: string[];
  links: string[];
  commitHash: string | null;
  occurrences: number;
  lastSeen: string;
  confidence: number;
}

export class MistakeLearner {
  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        error TEXT NOT NULL,
        context TEXT,
        solution TEXT,
        time_taken_minutes INTEGER,
        commands TEXT DEFAULT '[]',
        links TEXT DEFAULT '[]',
        commit_hash TEXT,
        occurrences INTEGER DEFAULT 1,
        last_seen TEXT DEFAULT (datetime('now')),
        confidence REAL DEFAULT 0.5,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS mistake_solutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mistake_id INTEGER NOT NULL,
        solution TEXT NOT NULL,
        worked INTEGER DEFAULT 1,
        time_taken INTEGER,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (mistake_id) REFERENCES mistakes(id)
      );

      CREATE INDEX IF NOT EXISTS idx_mistakes_error ON mistakes(error);
      CREATE INDEX IF NOT EXISTS idx_mistakes_confidence ON mistakes(confidence);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('TERMINAL_COMMAND', (event) => {
      const { command } = event.payload as any;
      this.detectError(command);
    });

    this.bus.on('SCREENSHOT_PROCESSED', (event) => {
      const { ocrText } = event.payload as any;
      if (ocrText) {
        this.detectErrorInText(ocrText);
      }
    });
  }

  private detectError(command: string): void {
    const errorPatterns = [
      /error[:\s]+(.+)/i,
      /failed[:\s]+(.+)/i,
      /cannot[:\s]+(.+)/i,
      /unable to[:\s]+(.+)/i,
      /not found[:\s]+(.+)/i,
      /permission denied/i,
      /EACCES/i,
      /ENOENT/i,
      /ECONNREFUSED/i,
    ];

    for (const pattern of errorPatterns) {
      const match = command.match(pattern);
      if (match) {
        const errorMsg = match[1] || match[0];
        this.recordMistake(errorMsg, command, 'terminal');
        break;
      }
    }
  }

  private detectErrorInText(text: string): void {
    const errorPatterns = [
      /Error[:\s]+(.+)/i,
      /Exception[:\s]+(.+)/i,
      /FATAL[:\s]+(.+)/i,
      /FAILED[:\s]+(.+)/i,
      /Traceback/i,
      /SyntaxError/i,
      /TypeError/i,
      /ReferenceError/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        if (match) {
          this.recordMistake(match[1] || match[0], text.substring(0, 500), 'screenshot');
          break;
        }
      }
    }
  }

  private async recordMistake(error: string, context: string, source: string): Promise<void> {
    const existing = this.db.prepare(`
      SELECT id, occurrences, confidence FROM mistakes
      WHERE error LIKE ? OR error LIKE ?
      ORDER BY occurrences DESC LIMIT 1
    `).get(`%${error.substring(0, 50)}%`, `%${error.substring(0, 30)}%`) as { id: number; occurrences: number; confidence: number } | undefined;

    if (existing) {
      const newConfidence = Math.min(1, existing.confidence + 0.1);
      this.db.prepare(`
        UPDATE mistakes SET occurrences = occurrences + 1, last_seen = datetime('now'), confidence = ? WHERE id = ?
      `).run(newConfidence, existing.id);

      log.info({ mistakeId: existing.id, occurrences: existing.occurrences + 1 }, 'Mistake reoccurred');
    } else {
      const result = this.db.prepare(`
        INSERT INTO mistakes (timestamp, error, context, confidence)
        VALUES (?, ?, ?, 0.5)
      `).run(new Date().toISOString(), error.substring(0, 500), context.substring(0, 1000));

      log.info({ mistakeId: result.lastInsertRowid, error: error.substring(0, 100) }, 'New mistake recorded');
    }
  }

  async findSolution(error: string): Promise<Mistake | null> {
    const mistake = this.db.prepare(`
      SELECT * FROM mistakes
      WHERE error LIKE ? AND solution IS NOT NULL
      ORDER BY confidence DESC, occurrences DESC
      LIMIT 1
    `).get(`%${error.substring(0, 50)}%`) as any;

    if (!mistake) return null;

    return {
      ...mistake,
      commands: JSON.parse(mistake.commands || '[]'),
      links: JSON.parse(mistake.links || '[]'),
    };
  }

  async addSolution(mistakeId: number, solution: string, worked: boolean): Promise<void> {
    this.db.prepare(`
      INSERT INTO mistake_solutions (mistake_id, solution, worked)
      VALUES (?, ?, ?)
    `).run(mistakeId, solution, worked ? 1 : 0);

    if (worked) {
      this.db.prepare(`
        UPDATE mistakes SET solution = ?, confidence = MIN(1.0, confidence + 0.2) WHERE id = ?
      `).run(solution, mistakeId);
    }
  }

  async getTopMistakes(limit = 10): Promise<Mistake[]> {
    const mistakes = this.db.prepare(`
      SELECT * FROM mistakes ORDER BY occurrences DESC, confidence DESC LIMIT ?
    `).all(limit) as any[];

    return mistakes.map(m => ({
      ...m,
      commands: JSON.parse(m.commands || '[]'),
      links: JSON.parse(m.links || '[]'),
    }));
  }

  async getRecentMistakes(limit = 20): Promise<Mistake[]> {
    const mistakes = this.db.prepare(`
      SELECT * FROM mistakes ORDER BY last_seen DESC LIMIT ?
    `).all(limit) as any[];

    return mistakes.map(m => ({
      ...m,
      commands: JSON.parse(m.commands || '[]'),
      links: JSON.parse(m.links || '[]'),
    }));
  }

  async getStats(): Promise<{
    totalMistakes: number;
    solvedMistakes: number;
    topErrors: Array<{ error: string; count: number }>;
  }> {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM mistakes').get() as { count: number }).count;
    const solved = (this.db.prepare('SELECT COUNT(*) as count FROM mistakes WHERE solution IS NOT NULL').get() as { count: number }).count;

    const topErrors = this.db.prepare(`
      SELECT error, occurrences as count FROM mistakes ORDER BY occurrences DESC LIMIT 10
    `).all() as Array<{ error: string; count: number }>;

    return { totalMistakes: total, solvedMistakes: solved, topErrors };
  }
}
