import { Database, getLogger, searchVectors } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import { getConfig } from '@ai-work-memory/shared';

const log = getLogger();

export class TextSearch {
  constructor(private db: Database) {}

  search(query: string, options: {
    limit?: number;
    offset?: number;
    types?: string[];
  } = {}): Array<{
    type: string;
    id: number;
    title: string;
    snippet: string;
    timestamp: string;
    rank: number;
  }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const results: Array<{
      type: string;
      id: number;
      title: string;
      snippet: string;
      timestamp: string;
      rank: number;
    }> = [];

    const sanitizedQuery = (query || '')
      .toString()
      .replace(/['"]/g, '')
      .replace(/[^\w\s\-\.]/g, ' ')
      .trim();

    if (sanitizedQuery.length < 2) return results;
    if (sanitizedQuery.length > 200) return results;

    const ftsQuery = sanitizedQuery
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 10)
      .map((w) => `"${w}"`)
      .join(' OR ');

    if (!ftsQuery) return results;

    try {
      // Search activities
      if (!options.types || options.types.includes('activity')) {
        const stmt = this.db.prepare(`
          SELECT a.id, a.app_name, a.window_title, a.timestamp,
                 snippet(activities_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                 fts.rank
          FROM activities_fts fts
          INNER JOIN activities a ON a.id = fts.rowid
          WHERE activities_fts MATCH ?
          ORDER BY fts.rank
          LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(ftsQuery, limit, offset) as Array<{
          id: number;
          app_name: string;
          window_title: string;
          timestamp: string;
          snippet: string;
          rank: number;
        }>;

        for (const row of rows) {
          results.push({
            type: 'activity',
            id: row.id,
            title: `${row.app_name} — ${row.window_title || ''}`,
            snippet: row.snippet,
            timestamp: row.timestamp,
            rank: row.rank,
          });
        }
      }

      // Search screenshots
      if (!options.types || options.types.includes('screenshot')) {
        const stmt = this.db.prepare(`
          SELECT s.id, s.ai_description, s.ai_app, s.ai_project, s.timestamp,
                 snippet(screenshots_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                 fts.rank
          FROM screenshots_fts fts
          INNER JOIN screenshots s ON s.id = fts.rowid
          WHERE screenshots_fts MATCH ?
          ORDER BY fts.rank
          LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(ftsQuery, limit, offset) as Array<{
          id: number;
          ai_description: string;
          ai_app: string;
          ai_project: string;
          timestamp: string;
          snippet: string;
          rank: number;
        }>;

        for (const row of rows) {
          results.push({
            type: 'screenshot',
            id: row.id,
            title: `${row.ai_app || 'Screenshot'} — ${row.ai_project || ''}`,
            snippet: row.snippet,
            timestamp: row.timestamp,
            rank: row.rank,
          });
        }
      }

      // Search sessions
      if (!options.types || options.types.includes('session')) {
        const stmt = this.db.prepare(`
          SELECT s.id, s.app_name, s.task_type, s.summary, s.start_time,
                 snippet(sessions_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                 fts.rank
          FROM sessions_fts fts
          INNER JOIN sessions s ON s.id = fts.rowid
          WHERE sessions_fts MATCH ?
          ORDER BY fts.rank
          LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(ftsQuery, limit, offset) as Array<{
          id: number;
          app_name: string;
          task_type: string;
          summary: string;
          start_time: string;
          snippet: string;
          rank: number;
        }>;

        for (const row of rows) {
          results.push({
            type: 'session',
            id: row.id,
            title: `${row.app_name} — ${row.task_type || ''}`,
            snippet: row.snippet || row.summary || '',
            timestamp: row.start_time,
            rank: row.rank,
          });
        }
      }
    } catch (err) {
      log.warn({ err }, 'Text search failed');
    }

    return results.sort((a, b) => a.rank - b.rank).slice(0, limit);
  }
}

export class VectorSearch {
  private ollama: OllamaClient;

  constructor() {
    this.ollama = new OllamaClient();
  }

  async search(query: string, options: {
    limit?: number;
    scoreThreshold?: number;
  } = {}): Promise<Array<{
    id: string;
    score: number;
    sourceType: string;
    sourceId: number;
    text: string;
    appName?: string;
    projectName?: string;
    timestamp?: string;
  }>> {
    const limit = options.limit ?? 10;
    const scoreThreshold = options.scoreThreshold ?? 0.5;

    try {
      const config = getConfig().get();
      const queryEmbedding = await this.ollama.embed({
        model: config.ai.embeddingModel,
        input: query,
      });

      const results = await searchVectors({
        vector: queryEmbedding,
        limit,
        scoreThreshold,
      });

      return results.map((r) => ({
        id: r.id,
        score: r.score,
        sourceType: r.payload.source_type as string,
        sourceId: r.payload.source_id as number,
        text: r.payload.text as string,
        appName: r.payload.app_name as string | undefined,
        projectName: r.payload.project_name as string | undefined,
        timestamp: r.payload.timestamp as string | undefined,
      }));
    } catch (err) {
      log.warn({ err }, 'Vector search failed');
      return [];
    }
  }
}

export class CombinedSearch {
  private textSearch: TextSearch;
  private vectorSearch: VectorSearch;

  constructor(db: Database) {
    this.textSearch = new TextSearch(db);
    this.vectorSearch = new VectorSearch();
  }

  async search(query: string, options: {
    limit?: number;
    dateRange?: { start: string; end: string };
    apps?: string[];
    projects?: string[];
  } = {}): Promise<{
    textResults: ReturnType<TextSearch['search']>;
    vectorResults: Awaited<ReturnType<VectorSearch['search']>>;
  }> {
    const textResults = this.textSearch.search(query, { limit: options.limit });
    const vectorResults = await this.vectorSearch.search(query, { limit: options.limit });

    return { textResults, vectorResults };
  }
}
