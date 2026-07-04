import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface Bookmark {
  id: number;
  timestamp: string;
  type: 'moment' | 'screenshot' | 'commit' | 'session' | 'meeting';
  title: string;
  description: string;
  sourceId: number;
  sourceType: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

export class MemoryBookmarks {
  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        source_id INTEGER,
        source_type TEXT,
        tags TEXT DEFAULT '[]',
        pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_timestamp ON bookmarks(timestamp);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_pinned ON bookmarks(pinned);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('BOOKMARK_CREATED', (event) => {
      log.info({ bookmark: event.payload }, 'Bookmark created');
    });
  }

  async create(data: {
    timestamp: string;
    type: string;
    title: string;
    description?: string;
    sourceId?: number;
    sourceType?: string;
    tags?: string[];
  }): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO bookmarks (timestamp, type, title, description, source_id, source_type, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.timestamp,
      data.type,
      data.title,
      data.description || '',
      data.sourceId || null,
      data.sourceType || '',
      JSON.stringify(data.tags || [])
    );

    const bookmarkId = result.lastInsertRowid as number;

    this.bus.emit('BOOKMARK_CREATED', 'memory-bookmarks', {
      bookmarkId,
      ...data,
    });

    return bookmarkId;
  }

  async getAll(limit = 100): Promise<Bookmark[]> {
    const rows = this.db.prepare(`
      SELECT * FROM bookmarks ORDER BY pinned DESC, created_at DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      pinned: r.pinned === 1,
    }));
  }

  async getPinned(): Promise<Bookmark[]> {
    const rows = this.db.prepare(`
      SELECT * FROM bookmarks WHERE pinned = 1 ORDER BY created_at DESC
    `).all() as any[];

    return rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      pinned: true,
    }));
  }

  async togglePin(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE bookmarks SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?
    `).run(id);
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  }

  async addTag(id: number, tag: string): Promise<void> {
    const row = this.db.prepare('SELECT tags FROM bookmarks WHERE id = ?').get(id) as { tags: string } | undefined;
    if (row) {
      const tags = JSON.parse(row.tags || '[]');
      if (!tags.includes(tag)) {
        tags.push(tag);
        this.db.prepare('UPDATE bookmarks SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id);
      }
    }
  }

  async search(query: string): Promise<Bookmark[]> {
    const rows = this.db.prepare(`
      SELECT * FROM bookmarks 
      WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
      ORDER BY pinned DESC, created_at DESC
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as any[];

    return rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      pinned: r.pinned === 1,
    }));
  }

  async getByType(type: string): Promise<Bookmark[]> {
    const rows = this.db.prepare(`
      SELECT * FROM bookmarks WHERE type = ? ORDER BY created_at DESC
    `).all(type) as any[];

    return rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      pinned: r.pinned === 1,
    }));
  }
}
