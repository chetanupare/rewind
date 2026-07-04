import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface SemanticQuery {
  text: string;
  timestamp?: string;
  project?: string;
  app?: string;
}

interface TimelineMoment {
  id: number;
  timestamp: string;
  type: 'activity' | 'screenshot' | 'commit' | 'meeting' | 'bookmark';
  title: string;
  description: string;
  app: string;
  project: string;
  relevance: number;
  metadata: Record<string, unknown>;
}

export class SemanticTimeline {
  private ollama: OllamaClient;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ollama = new OllamaClient();
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_moments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        app TEXT,
        project TEXT,
        relevance REAL DEFAULT 0,
        metadata TEXT,
        embedding_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_moments_timestamp ON timeline_moments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_moments_type ON timeline_moments(type);
      CREATE INDEX IF NOT EXISTS idx_moments_project ON timeline_moments(project);
    `);
  }

  async search(query: string): Promise<TimelineMoment[]> {
    const lower = query.toLowerCase();

    const intentPatterns: Record<string, RegExp[]> = {
      fixing: [/fix(ing)?/i, /bug/i, /debug/i, /error/i, /issue/i, /patch/i],
      coding: [/cod(e|ing)/i, /implement/i, /writ(e|ing)/i, /develop/i, /build/i],
      reading: [/read(ing)?/i, /doc/i, /research/i, /learn/i, /study/i, /browse/i],
      meeting: [/meet(ing)?/i, /call/i, /standup/i, /sync/i, /discuss/i],
      designing: [/design/i, /figma/i, /sketch/i, /ui/i, /ux/i, /layout/i],
      testing: [/test(ing)?/i, /qa/i, /spec/i, /coverage/i],
      deploying: [/deploy(ing)?/i, /release/i, /ship/i, /publish/i],
    };

    let detectedIntent = 'other';
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(p => p.test(lower))) {
        detectedIntent = intent;
        break;
      }
    }

    const keywordMatch = this.db.prepare(`
      SELECT id, timestamp, 'activity' as type, 
             app_name as app, window_title as title, '' as description,
             '' as project, 0 as relevance, '{}' as metadata
      FROM activities
      WHERE window_title LIKE ? OR app_name LIKE ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`) as TimelineMoment[];

    const screenshotMatch = this.db.prepare(`
      SELECT id, timestamp, 'screenshot' as type,
             ai_app as app, ai_task as title, ai_description as description,
             ai_project as project, 0 as relevance, '{}' as metadata
      FROM screenshots
      WHERE ai_description LIKE ? OR ai_task LIKE ? OR ocr_text LIKE ?
      ORDER BY timestamp DESC
      LIMIT 30
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as TimelineMoment[];

    const commitMatch = this.db.prepare(`
      SELECT id, timestamp, 'commit' as type,
             repo_path as app, commit_message as title, '' as description,
             repo_path as project, 0 as relevance, '{}' as metadata
      FROM git_events
      WHERE commit_message LIKE ? OR branch LIKE ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as TimelineMoment[];

    let results = [...keywordMatch, ...screenshotMatch, ...commitMatch];

    results = results.map(r => ({
      ...r,
      relevance: this.calculateRelevance(r, query, detectedIntent),
    }));

    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, 50);
  }

  private calculateRelevance(moment: TimelineMoment, query: string, intent: string): number {
    let score = 0;
    const lower = query.toLowerCase();
    const titleLower = (moment.title || '').toLowerCase();
    const descLower = (moment.description || '').toLowerCase();

    if (titleLower.includes(lower)) score += 3;
    if (descLower.includes(lower)) score += 2;
    if ((moment.app || '').toLowerCase().includes(lower)) score += 1;

    const intentKeywords: Record<string, string[]> = {
      fixing: ['fix', 'bug', 'error', 'debug', 'issue'],
      coding: ['code', 'implement', 'develop', 'build'],
      reading: ['read', 'doc', 'research', 'learn'],
      meeting: ['meeting', 'call', 'standup', 'zoom'],
      designing: ['design', 'figma', 'sketch'],
      testing: ['test', 'qa', 'spec'],
      deploying: ['deploy', 'release', 'ship'],
    };

    const keywords = intentKeywords[intent] || [];
    for (const kw of keywords) {
      if (titleLower.includes(kw) || descLower.includes(kw)) score += 2;
    }

    if (moment.type === 'screenshot') score += 1;
    if (moment.type === 'commit') score += 1.5;

    return score;
  }

  async addMoment(data: {
    timestamp: string;
    type: string;
    title: string;
    description?: string;
    app?: string;
    project?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.db.prepare(`
      INSERT INTO timeline_moments (timestamp, type, title, description, app, project, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.timestamp,
      data.type,
      data.title,
      data.description || '',
      data.app || '',
      data.project || '',
      JSON.stringify(data.metadata || {})
    );
  }

  async getMomentsByTimeRange(start: string, end: string): Promise<TimelineMoment[]> {
    return this.db.prepare(`
      SELECT * FROM timeline_moments
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(start, end) as TimelineMoment[];
  }
}
