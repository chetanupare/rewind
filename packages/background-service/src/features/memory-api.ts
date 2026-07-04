import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import http from 'http';

const log = getLogger();

interface ApiQuery {
  type: string;
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

interface ApiResponse {
  success: boolean;
  data: unknown;
  error?: string;
}

export class MemoryApi {
  private server: http.Server | null = null;
  private port: number;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.port = 48291;
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        query TEXT,
        response_size INTEGER,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp);
    `);
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      log.info({ port: this.port }, 'Memory API started');
    });

    this.server.on('error', (err) => {
      log.warn({ err }, 'Memory API server error');
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let response: ApiResponse;

    try {
      response = await this.routeRequest(req.method || 'GET', url, req);
    } catch (err: any) {
      response = { success: false, data: null, error: err.message };
    }

    const duration = Date.now() - startTime;

    this.db.prepare(`
      INSERT INTO api_logs (timestamp, endpoint, method, query, response_size, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      url.pathname,
      req.method || 'GET',
      url.search,
      JSON.stringify(response).length,
      duration
    );

    res.writeHead(response.success ? 200 : 400);
    res.end(JSON.stringify(response));
  }

  private async routeRequest(method: string, url: URL, req: http.IncomingMessage): Promise<ApiResponse> {
    const path = url.pathname;

    switch (path) {
      case '/health':
        return { success: true, data: { status: 'ok', version: '0.1.0' } };

      case '/search':
        return this.handleSearch(url);

      case '/activities':
        return this.handleActivities(url);

      case '/screenshots':
        return this.handleScreenshots(url);

      case '/sessions':
        return this.handleSessions(url);

      case '/commits':
        return this.handleCommits(url);

      case '/projects':
        return this.handleProjects(url);

      case '/bookmarks':
        return this.handleBookmarks(url);

      case '/meetings':
        return this.handleMeetings(url);

      case '/focus':
        return this.handleFocus(url);

      case '/timeline':
        return this.handleTimeline(url);

      case '/replay':
        return this.handleReplay(url);

      case '/graph':
        return this.handleGraph(url);

      case '/stats':
        return this.handleStats(url);

      default:
        return { success: false, data: null, error: `Unknown endpoint: ${path}` };
    }
  }

  private async handleSearch(url: URL): Promise<ApiResponse> {
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!query) {
      return { success: false, data: null, error: 'Query parameter "q" is required' };
    }

    const activities = this.db.prepare(`
      SELECT 'activity' as type, id, app_name, window_title as title, timestamp
      FROM activities
      WHERE window_title LIKE ? OR app_name LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit);

    const screenshots = this.db.prepare(`
      SELECT 'screenshot' as type, id, ai_app as app_name, ai_task as title, timestamp
      FROM screenshots
      WHERE ai_description LIKE ? OR ai_task LIKE ? OR ocr_text LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);

    const commits = this.db.prepare(`
      SELECT 'commit' as type, id, repo_path as app_name, commit_message as title, timestamp
      FROM git_events
      WHERE commit_message LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(`%${query}%`, limit);

    return {
      success: true,
      data: {
        activities,
        screenshots,
        commits,
        total: activities.length + screenshots.length + commits.length,
      },
    };
  }

  private async handleActivities(url: URL): Promise<ApiResponse> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const app = url.searchParams.get('app');

    let query = 'SELECT * FROM activities';
    const params: unknown[] = [];

    if (app) {
      query += ' WHERE app_name LIKE ?';
      params.push(`%${app}%`);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const activities = this.db.prepare(query).all(...params);
    return { success: true, data: activities };
  }

  private async handleScreenshots(url: URL): Promise<ApiResponse> {
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const date = url.searchParams.get('date');

    let query = 'SELECT id, timestamp, file_path, ai_app, ai_task, ai_project, ai_description FROM screenshots';
    const params: unknown[] = [];

    if (date) {
      query += ' WHERE date(timestamp) = ?';
      params.push(date);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const screenshots = this.db.prepare(query).all(...params);
    return { success: true, data: screenshots };
  }

  private async handleSessions(url: URL): Promise<ApiResponse> {
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const sessions = this.db.prepare('SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?').all(limit);
    return { success: true, data: sessions };
  }

  private async handleCommits(url: URL): Promise<ApiResponse> {
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const repo = url.searchParams.get('repo');

    let query = 'SELECT * FROM git_events';
    const params: unknown[] = [];

    if (repo) {
      query += ' WHERE repo_path LIKE ?';
      params.push(`%${repo}%`);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const commits = this.db.prepare(query).all(...params);
    return { success: true, data: commits };
  }

  private async handleProjects(url: URL): Promise<ApiResponse> {
    const projects = this.db.prepare('SELECT * FROM detected_projects ORDER BY last_seen DESC').all();
    return { success: true, data: projects };
  }

  private async handleBookmarks(url: URL): Promise<ApiResponse> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const bookmarks = this.db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC LIMIT ?').all(limit);
    return { success: true, data: bookmarks };
  }

  private async handleMeetings(url: URL): Promise<ApiResponse> {
    const date = url.searchParams.get('date');
    let query = 'SELECT * FROM meetings';
    const params: unknown[] = [];

    if (date) {
      query += ' WHERE date(start_time) = ?';
      params.push(date);
    }

    query += ' ORDER BY start_time DESC LIMIT 20';
    const meetings = this.db.prepare(query).all(...params);
    return { success: true, data: meetings };
  }

  private async handleFocus(url: URL): Promise<ApiResponse> {
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const sessions = this.db.prepare(`
      SELECT * FROM focus_sessions WHERE date(start_time) = ? ORDER BY start_time DESC
    `).all(date);
    return { success: true, data: sessions };
  }

  private async handleTimeline(url: URL): Promise<ApiResponse> {
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const timeline = this.db.prepare('SELECT * FROM timeline WHERE date = ? ORDER BY hour').all(date);
    return { success: true, data: timeline };
  }

  private async handleReplay(url: URL): Promise<ApiResponse> {
    const id = url.searchParams.get('id');
    if (id) {
      const replay = this.db.prepare('SELECT * FROM replay_sessions WHERE id = ?').get(parseInt(id));
      return { success: true, data: replay };
    }
    const replays = this.db.prepare('SELECT * FROM replay_sessions ORDER BY start_time DESC LIMIT 20').all();
    return { success: true, data: replays };
  }

  private async handleGraph(url: URL): Promise<ApiResponse> {
    const type = url.searchParams.get('type') || 'activity';
    const id = parseInt(url.searchParams.get('id') || '0');
    
    const links = this.db.prepare(`
      SELECT * FROM memory_links
      WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)
      ORDER BY strength DESC LIMIT 50
    `).all(type, id, type, id);

    return { success: true, data: links };
  }

  private async handleStats(url: URL): Promise<ApiResponse> {
    const today = new Date().toISOString().split('T')[0];
    
    const activities = (this.db.prepare('SELECT COUNT(*) as count FROM activities WHERE date(timestamp) = ?').get(today) as { count: number }).count;
    const screenshots = (this.db.prepare('SELECT COUNT(*) as count FROM screenshots WHERE date(timestamp) = ?').get(today) as { count: number }).count;
    const sessions = (this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE date(start_time) = ?').get(today) as { count: number }).count;
    const commits = (this.db.prepare('SELECT COUNT(*) as count FROM git_events WHERE date(timestamp) = ?').get(today) as { count: number }).count;
    const bookmarks = (this.db.prepare('SELECT COUNT(*) as count FROM bookmarks').get() as { count: number }).count;
    const meetings = (this.db.prepare('SELECT COUNT(*) as count FROM meetings WHERE date(start_time) = ?').get(today) as { count: number }).count;

    return {
      success: true,
      data: {
        today: { activities, screenshots, sessions, commits, meetings },
        total: { bookmarks },
      },
    };
  }

  getPort(): number {
    return this.port;
  }
}
