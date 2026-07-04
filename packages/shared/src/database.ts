import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger.js';

const log = getLogger();

const SCHEMA_VERSION = 2;

const MIGRATIONS: Record<number, string[]> = {
  1: [
    `CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      app_name TEXT NOT NULL,
      app_executable TEXT,
      window_title TEXT,
      duration_seconds INTEGER,
      project_id INTEGER,
      session_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )`,

    `CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_path_original TEXT,
      image_hash TEXT,
      width INTEGER,
      height INTEGER,
      ocr_text TEXT,
      ai_description TEXT,
      ai_app TEXT,
      ai_task TEXT,
      ai_project TEXT,
      ai_language TEXT,
      ai_framework TEXT,
      ai_state TEXT,
      ocr_processed INTEGER DEFAULT 0,
      ai_processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      app_name TEXT,
      project_id INTEGER,
      task_type TEXT,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,

    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT,
      first_seen TEXT,
      last_seen TEXT,
      technologies TEXT,
      is_manual INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS project_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      first_seen TEXT,
      last_seen TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,

    `CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS knowledge_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      relationship TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      FOREIGN KEY (source_id) REFERENCES knowledge_nodes(id),
      FOREIGN KEY (target_id) REFERENCES knowledge_nodes(id)
    )`,

    `CREATE TABLE IF NOT EXISTS timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      hour INTEGER,
      activity_summary TEXT,
      primary_app TEXT,
      primary_project TEXT,
      total_mouse_clicks INTEGER DEFAULT 0,
      total_keystrokes INTEGER DEFAULT 0,
      total_screenshots INTEGER DEFAULT 0,
      productivity_score REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      generated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS git_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      repo_path TEXT,
      branch TEXT,
      commit_hash TEXT,
      commit_message TEXT,
      files_changed TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS app_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL UNIQUE,
      reason TEXT,
      added_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      content_type TEXT,
      content_hash TEXT,
      content_preview TEXT,
      is_sensitive INTEGER DEFAULT 0,
      source_app TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // FTS5 indexes
    `CREATE VIRTUAL TABLE IF NOT EXISTS activities_fts USING fts5(
      app_name, window_title, content=activities, content_rowid=id
    )`,

    `CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
      ocr_text, ai_description, ai_project, ai_task,
      content=screenshots, content_rowid=id
    )`,

    `CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
      app_name, task_type, summary,
      content=sessions, content_rowid=id
    )`,

    // Regular indexes
    `CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_app ON activities(app_name)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_screenshots_hash ON screenshots(image_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,
    `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_timeline_date ON timeline(date)`,
    `CREATE INDEX IF NOT EXISTS idx_git_events_repo ON git_events(repo_path)`,
  ],
  2: [
    // FTS sync triggers - keep FTS tables in sync with content tables
    `CREATE TRIGGER IF NOT EXISTS activities_ai AFTER INSERT ON activities BEGIN
      INSERT INTO activities_fts(rowid, app_name, window_title) VALUES (new.id, new.app_name, new.window_title);
    END`,
    `CREATE TRIGGER IF NOT EXISTS activities_ad AFTER DELETE ON activities BEGIN
      INSERT INTO activities_fts(activities_fts, rowid, app_name, window_title) VALUES('delete', old.id, old.app_name, old.window_title);
    END`,
    `CREATE TRIGGER IF NOT EXISTS activities_au AFTER UPDATE ON activities BEGIN
      INSERT INTO activities_fts(activities_fts, rowid, app_name, window_title) VALUES('delete', old.id, old.app_name, old.window_title);
      INSERT INTO activities_fts(rowid, app_name, window_title) VALUES (new.id, new.app_name, new.window_title);
    END`,
    `CREATE TRIGGER IF NOT EXISTS screenshots_ai AFTER INSERT ON screenshots BEGIN
      INSERT INTO screenshots_fts(rowid, ocr_text, ai_description, ai_project, ai_task) VALUES (new.id, new.ocr_text, new.ai_description, new.ai_project, new.ai_task);
    END`,
    `CREATE TRIGGER IF NOT EXISTS screenshots_ad AFTER DELETE ON screenshots BEGIN
      INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text, ai_description, ai_project, ai_task) VALUES('delete', old.id, old.ocr_text, old.ai_description, old.ai_project, old.ai_task);
    END`,
    `CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
      INSERT INTO sessions_fts(rowid, app_name, task_type, summary) VALUES (new.id, new.app_name, new.task_type, new.summary);
    END`,
    `CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
      INSERT INTO sessions_fts(sessions_fts, rowid, app_name, task_type, summary) VALUES('delete', old.id, old.app_name, old.task_type, old.summary);
    END`,
    // Rebuild FTS indexes for existing data
    `INSERT INTO activities_fts(activities_fts) VALUES('rebuild')`,
    `INSERT INTO screenshots_fts(screenshots_fts) VALUES('rebuild')`,
    `INSERT INTO sessions_fts(sessions_fts) VALUES('rebuild')`,
  ],
};

export class AppDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(dbPath);
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS wiki (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic TEXT NOT NULL,
          content TEXT NOT NULL,
          repo_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.runMigrations();
    log.info({ dbPath }, 'Database initialized');
  }

  private runMigrations(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);

    const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
    const currentVersion = row?.version ?? 0;

    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const migrations = MIGRATIONS[v];
      if (migrations) {
        log.info({ version: v }, 'Running migration');
        const transaction = this.db.transaction(() => {
          for (const sql of migrations) {
            this.db.exec(sql);
          }
          this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(v);
        });
        transaction();
      }
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql) as Database.Statement;
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
    log.info('Database closed');
  }
}
