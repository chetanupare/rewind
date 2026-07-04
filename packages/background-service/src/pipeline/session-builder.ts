import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface SessionData {
  id: number;
  startTime: string;
  endTime: string | null;
  appName: string | null;
  projectId: number | null;
  taskType: string | null;
  summary: string | null;
}

export class SessionBuilder {
  private currentSession: SessionData | null = null;
  private lastAppName: string = '';
  private lastActivityTime: Date = new Date();

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    // Listen for window changes to build sessions
    this.bus.on('WINDOW_CHANGED', (event) => {
      const appName = event.payload.appName as string;
      this.onWindowChange(appName);
    });

    // Listen for activities to track time
    this.bus.on('*', (event) => {
      this.lastActivityTime = new Date();
    });
  }

  async start(): Promise<void> {
    // Check for any open sessions on startup
    this.resumeExistingSession();
    log.info('Session builder started');
  }

  async stop(): Promise<void> {
    await this.endCurrentSession();
  }

  private onWindowChange(appName: string): void {
    const now = new Date();
    const idleMs = now.getTime() - this.lastActivityTime.getTime();

    if (!this.currentSession) {
      // Start new session
      this.startNewSession(appName);
    } else if (appName !== this.lastAppName) {
      // App changed — end current session if idle > 5 minutes
      if (idleMs > 5 * 60 * 1000) {
        this.endCurrentSession();
        this.startNewSession(appName);
      } else if (appName !== this.currentSession.appName) {
        // Different app — end and start new session
        this.endCurrentSession();
        this.startNewSession(appName);
      }
    }

    this.lastAppName = appName;
  }

  private startNewSession(appName: string): void {
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(
        `INSERT INTO sessions (start_time, app_name, task_type)
         VALUES (?, ?, ?)`
      );
      const result = stmt.run(now, appName, this.inferTaskType(appName));

      this.currentSession = {
        id: result.lastInsertRowid as number,
        startTime: now,
        endTime: null,
        appName,
        projectId: null,
        taskType: this.inferTaskType(appName),
        summary: null,
      };

      this.bus.emit('SESSION_STARTED', 'session-builder', {
        sessionId: this.currentSession.id,
        appName,
      });
    } catch (err) {
      log.warn({ err }, 'Failed to start new session');
    }
  }

  private async endCurrentSession(): Promise<void> {
    if (!this.currentSession) return;

    const endIso = this.lastActivityTime.toISOString();

    try {
      this.db.prepare(
        `UPDATE sessions SET end_time = ?, task_type = ? WHERE id = ?`
      ).run(endIso, this.currentSession.taskType, this.currentSession.id);

      this.bus.emit('SESSION_ENDED', 'session-builder', {
        sessionId: this.currentSession.id,
        appName: this.currentSession.appName,
        durationMs: new Date(endIso).getTime() - new Date(this.currentSession.startTime).getTime(),
      });

      this.currentSession = null;
    } catch (err) {
      log.warn({ err }, 'Failed to end session');
    }
  }

  private async resumeExistingSession(): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `SELECT id, start_time, app_name, task_type FROM sessions 
         WHERE end_time IS NULL ORDER BY id DESC LIMIT 1`
      );
      const row = stmt.get() as { id: number; start_time: string; app_name: string; task_type: string } | undefined;

      if (row) {
        this.currentSession = {
          id: row.id,
          startTime: row.start_time,
          endTime: null,
          appName: row.app_name,
          projectId: null,
          taskType: row.task_type,
          summary: null,
        };
        log.info({ sessionId: row.id }, 'Resumed existing session');
      }
    } catch (err) {
      log.warn({ err }, 'Failed to resume existing session');
    }
  }

  private inferTaskType(appName: string): string {
    const lower = appName.toLowerCase();

    if (lower.includes('code') || lower.includes('visual studio') || lower.includes('cursor')) {
      return 'coding';
    }
    if (lower.includes('terminal') || lower.includes('powershell') || lower.includes('cmd')) {
      return 'terminal';
    }
    if (lower.includes('chrome') || lower.includes('edge') || lower.includes('firefox')) {
      return 'browsing';
    }
    if (lower.includes('figma') || lower.includes('sketch') || lower.includes('photoshop')) {
      return 'designing';
    }
    if (lower.includes('slack') || lower.includes('teams') || lower.includes('discord')) {
      return 'communicating';
    }
    if (lower.includes('mail') || lower.includes('outlook')) {
      return 'email';
    }
    if (lower.includes('zoom') || lower.includes('meet')) {
      return 'meeting';
    }

    return 'other';
  }
}
