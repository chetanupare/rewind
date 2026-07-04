import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface WinInfo {
  title: string;
  owner?: {
    name: string;
    processId: number;
    path: string;
  };
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  monitor?: {
    index: number;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
  };
}

export class WindowTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastWindow: WinInfo | null = null;
  private lastChangeTime: Date = new Date();
  private pollMs: number;
  private activeWin: any = null;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.pollMs = 1000;
  }

  async start(): Promise<void> {
    try {
      const activeWinModule = await import('active-win');
      this.activeWin = activeWinModule.default;
      log.info('Window tracker started with native module');
    } catch (err) {
      log.warn({ err }, 'Failed to load active-win, falling back to basic tracking');
    }

    this.interval = setInterval(() => this.poll(), this.pollMs);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      if (!this.activeWin) return;

      const result = await this.activeWin();
      if (!result) return;

      const currentWindow: WinInfo = {
        title: result.title || '',
        owner: {
          name: result.owner?.name || 'Unknown',
          processId: result.owner?.processId || 0,
          path: result.owner?.path || '',
        },
        bounds: result.bounds ? {
          x: result.bounds.x,
          y: result.bounds.y,
          width: result.bounds.width,
          height: result.bounds.height,
        } : { x: 0, y: 0, width: 0, height: 0 },
      };

      const now = new Date();
      const changed =
        !this.lastWindow ||
        currentWindow.owner?.processId !== this.lastWindow.owner?.processId ||
        currentWindow.title !== this.lastWindow.title;

      if (changed) {
        const durationMs = now.getTime() - this.lastChangeTime.getTime();
        const durationSeconds = Math.round(durationMs / 1000);

        if (this.lastWindow && durationSeconds > 1) {
          this.recordWindowDuration(this.lastWindow, durationSeconds);
        }

        const appName = currentWindow.owner?.name ?? 'Unknown';
        const executable = currentWindow.owner?.path?.split('\\').pop() ?? 'unknown.exe';
        const pidNum = currentWindow.owner?.processId ?? 0;
        const windowTitle = currentWindow.title ?? '';

        this.bus.emit('WINDOW_CHANGED', 'window-tracker', {
          appName,
          executable,
          pid: pidNum,
          windowTitle,
          windowBounds: currentWindow.bounds || { x: 0, y: 0, width: 0, height: 0 },
          monitor: { index: 0, name: 'Primary', width: 1920, height: 1080, isPrimary: true },
          monitorCount: 1,
        });

        this.storeActivity({
          timestamp: now.toISOString(),
          appName,
          appExecutable: executable,
          windowTitle,
          durationSeconds,
        });

        this.lastWindow = currentWindow;
        this.lastChangeTime = now;
      }
    } catch (err) {
      // Silently handle errors to avoid crashing
    }
  }

  private recordWindowDuration(window: WinInfo, durationSeconds: number): void {
    try {
      const stmt = this.db.prepare(
        `UPDATE activities SET duration_seconds = ?
         WHERE id = (SELECT id FROM activities WHERE app_name = ? AND window_title = ? AND duration_seconds IS NULL ORDER BY id DESC LIMIT 1)`
      );
      stmt.run(durationSeconds, window.owner?.name ?? 'Unknown', window.title ?? '');
    } catch {
      // Ignore
    }
  }

  private storeActivity(data: {
    timestamp: string;
    appName: string;
    appExecutable: string;
    windowTitle: string;
    durationSeconds: number;
  }): void {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO activities (timestamp, app_name, app_executable, window_title, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(data.timestamp, data.appName, data.appExecutable, data.windowTitle, data.durationSeconds);
    } catch (err) {
      log.warn({ err }, 'Failed to store activity');
    }
  }
}
