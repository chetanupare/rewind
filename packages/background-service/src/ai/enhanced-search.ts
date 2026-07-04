import { Database, getLogger, searchVectors } from '@ai-work-memory/shared';
import { OllamaClient } from './ollama-client.js';

const log = getLogger();

interface SearchResult {
  id: number;
  type: string;
  title: string;
  content: string;
  score: number;
  source: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  types?: string[];
  dateRange?: { start: string; end: string };
  useReranker?: boolean;
}

export class EnhancedSearch {
  private ollama: OllamaClient;

  constructor(private db: Database) {
    this.ollama = new OllamaClient();
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit || 20;
    const useReranker = options.useReranker !== false;

    const bm25Results = await this.bm25Search(query, options);
    const embeddingResults = await this.embeddingSearch(query, options);

    const merged = this.mergeResults(bm25Results, embeddingResults);

    if (useReranker && merged.length > 0) {
      const reranked = await this.rerank(query, merged);
      return reranked.slice(0, limit);
    }

    return merged.slice(0, limit);
  }

  private async bm25Search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const limit = options.limit || 50;

    const sanitizedQuery = query
      .replace(/['"]/g, '')
      .replace(/[^\w\s\-]/g, ' ')
      .trim();

    if (sanitizedQuery.length < 2) return results;

    const ftsQuery = sanitizedQuery
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .map(w => `"${w}"`)
      .join(' OR ');

    if (!ftsQuery) return results;

    // Search activities
    try {
      const activities = this.db.prepare(`
        SELECT a.id, a.app_name, a.window_title, a.timestamp,
               snippet(activities_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
               fts.rank
        FROM activities_fts fts
        INNER JOIN activities a ON a.id = fts.rowid
        WHERE activities_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(ftsQuery, limit) as any[];

      for (const a of activities) {
        results.push({
          id: a.id,
          type: 'activity',
          title: `${a.app_name} - ${a.window_title || ''}`,
          content: a.snippet || '',
          score: Math.abs(1 / (1 + a.rank)),
          source: 'activities',
          timestamp: a.timestamp,
          metadata: { appName: a.app_name },
        });
      }
    } catch (err) {
      log.debug({ err }, 'Activities FTS search failed');
    }

    // Search screenshots
    try {
      const screenshots = this.db.prepare(`
        SELECT s.id, s.ai_app, s.ai_task, s.ai_description, s.timestamp,
               snippet(screenshots_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
               fts.rank
        FROM screenshots_fts fts
        INNER JOIN screenshots s ON s.id = fts.rowid
        WHERE screenshots_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(ftsQuery, limit) as any[];

      for (const s of screenshots) {
        results.push({
          id: s.id,
          type: 'screenshot',
          title: `${s.ai_app || 'Screenshot'} - ${s.ai_task || ''}`,
          content: s.snippet || s.ai_description || '',
          score: Math.abs(1 / (1 + s.rank)),
          source: 'screenshots',
          timestamp: s.timestamp,
          metadata: { app: s.ai_app, task: s.ai_task },
        });
      }
    } catch (err) {
      log.debug({ err }, 'Screenshots FTS search failed');
    }

    // Search documents
    try {
      const docs = this.db.prepare(`
        SELECT id, file_name, title, content, updated_at as timestamp
        FROM documents
        WHERE content LIKE ? OR title LIKE ?
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(`%${query}%`, `%${query}%`, limit) as any[];

      for (const d of docs) {
        const snippet = this.extractSnippet(d.content || '', query);
        results.push({
          id: d.id,
          type: 'document',
          title: d.title || d.file_name,
          content: snippet,
          score: 0.7,
          source: 'documents',
          timestamp: d.timestamp,
          metadata: {},
        });
      }
    } catch (err) {
      log.debug({ err }, 'Documents search failed');
    }

    // Search git events
    try {
      const commits = this.db.prepare(`
        SELECT id, repo_path, commit_message, branch, timestamp
        FROM git_events
        WHERE commit_message LIKE ? OR branch LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(`%${query}%`, `%${query}%`, limit) as any[];

      for (const c of commits) {
        results.push({
          id: c.id,
          type: 'commit',
          title: `${c.repo_path}: ${c.commit_message || ''}`,
          content: `Branch: ${c.branch || 'unknown'}`,
          score: 0.8,
          source: 'git_events',
          timestamp: c.timestamp,
          metadata: { repo: c.repo_path, branch: c.branch },
        });
      }
    } catch (err) {
      log.debug({ err }, 'Git events search failed');
    }

    // Search terminal commands
    try {
      const commands = this.db.prepare(`
        SELECT id, terminal, command, timestamp
        FROM terminal_commands
        WHERE command LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(`%${query}%`, limit) as any[];

      for (const c of commands) {
        results.push({
          id: c.id,
          type: 'terminal',
          title: `${c.terminal}: ${c.command}`,
          content: c.command,
          score: 0.6,
          source: 'terminal_commands',
          timestamp: c.timestamp,
          metadata: { terminal: c.terminal },
        });
      }
    } catch (err) {
      log.debug({ err }, 'Terminal commands search failed');
    }

    return results;
  }

  private async embeddingSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) return [];

      const config = { ai: { embeddingModel: 'nomic-embed-text' } };
      const embedding = await this.ollama.embed({
        model: config.ai.embeddingModel,
        input: query,
      });

      const vectorResults = await searchVectors({
        vector: embedding,
        limit: options.limit || 20,
        scoreThreshold: 0.3,
      });

      return vectorResults.map(r => ({
        id: r.payload.source_id as number || 0,
        type: r.payload.source_type as string || 'unknown',
        title: r.payload.text as string?.substring(0, 100) || '',
        content: r.payload.text as string || '',
        score: r.score,
        source: 'embeddings',
        timestamp: r.payload.timestamp as string || new Date().toISOString(),
        metadata: r.payload,
      }));
    } catch (err) {
      log.debug({ err }, 'Embedding search failed');
      return [];
    }
  }

  private mergeResults(bm25: SearchResult[], embedding: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of bm25) {
      const key = `${result.type}:${result.id}`;
      merged.set(key, { ...result, score: result.score * 0.6 });
    }

    for (const result of embedding) {
      const key = `${result.type}:${result.id}`;
      const existing = merged.get(key);

      if (existing) {
        existing.score = Math.max(existing.score, result.score * 0.4);
      } else {
        merged.set(key, { ...result, score: result.score * 0.4 });
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }

  private async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) return results;

      const topResults = results.slice(0, 30);
      const passages = topResults.map((r, i) => `[${i}] ${r.title}: ${r.content.substring(0, 200)}`).join('\n');

      const prompt = `Rank these search results by relevance to the query: "${query}"

Results:
${passages}

Return ONLY the indices in order of relevance, comma-separated (e.g., "3,1,5,2,4"):`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
      });

      const indices = response.match(/\d+/g)?.map(Number) || [];
      const reranked: SearchResult[] = [];

      for (const idx of indices) {
        if (idx >= 0 && idx < topResults.length) {
          reranked.push({ ...topResults[idx], score: topResults[idx].score * 1.2 });
        }
      }

      for (let i = 0; i < topResults.length; i++) {
        if (!indices.includes(i)) {
          reranked.push(topResults[i]);
        }
      }

      return reranked;
    } catch (err) {
      log.debug({ err }, 'Reranking failed, returning original results');
      return results;
    }
  }

  private extractSnippet(content: string, query: string, contextLength: number = 150): string {
    const lower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx = lower.indexOf(queryLower);

    if (idx === -1) {
      return content.substring(0, contextLength * 2) + (content.length > contextLength * 2 ? '...' : '');
    }

    const start = Math.max(0, idx - contextLength);
    const end = Math.min(content.length, idx + query.length + contextLength);
    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }
}
