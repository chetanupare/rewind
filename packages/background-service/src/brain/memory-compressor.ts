import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface CompressedMemory {
  id: number;
  timeRange: { start: string; end: string };
  summary: string;
  keyEvents: string[];
  concepts: string[];
  importance: number;
}

export class MemoryCompressor {
  constructor(
    private db: Database,
    private ollama: OllamaClient
  ) {}

  async compress(): Promise<void> {
    log.info('Starting memory compression...');

    await this.compressScreenshots();
    await this.compressActivities();
    await this.compressSessions();

    log.info('Memory compression complete');
  }

  private async compressScreenshots(): Promise<void> {
    const oldScreenshots = this.db.prepare(`
      SELECT id, timestamp, ai_app, ai_task, ai_description
      FROM screenshots
      WHERE ai_processed = 1 AND timestamp < datetime('now', '-7 days')
      ORDER BY timestamp ASC
    `).all() as any[];

    if (oldScreenshots.length < 10) return;

    const groups = this.groupByTimeWindow(oldScreenshots, 30);

    for (const group of groups) {
      if (group.length < 3) continue;

      const summary = await this.summarizeGroup(group.map((s: any) => ({
        app: s.ai_app,
        task: s.ai_task,
        description: s.ai_description,
      })));

      this.db.prepare(`
        INSERT INTO ltm_memories (type, name, summary, importance, source)
        VALUES ('screenshot_session', ?, ?, 0.6, 'compression')
      `).run(
        `Screenshots from ${new Date(group[0].timestamp).toLocaleDateString()}`,
        summary
      );

      const ids = group.map((s: any) => s.id);
      this.db.prepare(`
        UPDATE screenshots SET ai_description = '[Compressed]' WHERE id IN (${ids.map(() => '?').join(',')})
      `).run(...ids);
    }
  }

  private async compressActivities(): Promise<void> {
    const oldActivities = this.db.prepare(`
      SELECT app_name, window_title, timestamp, duration_seconds
      FROM activities
      WHERE timestamp < datetime('now', '-7 days')
      ORDER BY timestamp ASC
    `).all() as Array<{ app_name: string; window_title: string; timestamp: string; duration_seconds: number }>;

    if (oldActivities.length < 50) return;

    const byApp = new Map<string, typeof oldActivities>();
    for (const activity of oldActivities) {
      const existing = byApp.get(activity.app_name) || [];
      existing.push(activity);
      byApp.set(activity.app_name, existing);
    }

    for (const [app, activities] of byApp) {
      const totalMinutes = Math.round(activities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0) / 60);

      this.db.prepare(`
        INSERT INTO ltm_memories (type, name, summary, importance, source)
        VALUES ('app_usage', ?, ?, 0.4, 'compression')
      `).run(
        app,
        `Used ${app} for ${totalMinutes} minutes across ${activities.length} sessions`
      );
    }
  }

  private async compressSessions(): Promise<void> {
    const oldSessions = this.db.prepare(`
      SELECT id, start_time, end_time, app_name, task_type, summary
      FROM sessions
      WHERE start_time < datetime('now', '-7 days') AND summary IS NULL
    `).all() as Array<{ id: number; start_time: string; end_time: string; app_name: string; task_type: string; summary: string }>;

    for (const session of oldSessions) {
      if (session.end_time) {
        const duration = Math.round(
          (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000
        );

        this.db.prepare(`
          UPDATE sessions SET summary = ? WHERE id = ?
        `).run(
          `${session.app_name} session (${duration}min)`,
          session.id
        );
      }
    }
  }

  private groupByTimeWindow(items: Array<{ timestamp: string }>, windowMinutes: number): typeof items[] {
    const groups: typeof items[] = [];
    let currentGroup: typeof items = [];
    let windowStart: Date | null = null;

    for (const item of items) {
      const time = new Date(item.timestamp);

      if (!windowStart || (time.getTime() - windowStart.getTime()) > windowMinutes * 60000) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [item];
        windowStart = time;
      } else {
        currentGroup.push(item);
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private async summarizeGroup(items: Array<{ app?: string; task?: string; description?: string }>): Promise<string> {
    const apps = [...new Set(items.map(i => i.app).filter(Boolean))];
    const tasks = [...new Set(items.map(i => i.task).filter(Boolean))];

    return `Session with ${apps.join(', ')}: ${tasks.slice(0, 3).join(', ')}`;
  }
}
