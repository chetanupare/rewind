import { EventBus, getLogger } from '@ai-work-memory/shared';
import fs from 'fs';
import path from 'path';

const log = getLogger();

export class FilesystemWatcher {
  private watcher: any = null;

  constructor(private bus: EventBus) {}

  async start(dirs: string[] = []): Promise<void> {
    try {
      const chokidar = await import('chokidar');

      const watchPaths = dirs.length > 0 ? dirs : this.getDefaultWatchDirs();
      if (watchPaths.length === 0) {
        log.info('No directories to watch');
        return;
      }

      this.watcher = chokidar.default.watch(watchPaths, {
        ignored: /(^|[\/\\])\.|node_modules|\.git|\.exe|\.dll|\.lnk/,
        persistent: true,
        ignoreInitial: true,
        depth: 2,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 500,
        },
      });

      this.watcher.on('add', (filePath: string) => this.onFileEvent('opened', filePath));
      this.watcher.on('change', (filePath: string) => this.onFileEvent('modified', filePath));
      this.watcher.on('unlink', (filePath: string) => this.onFileEvent('deleted', filePath));
      this.watcher.on('error', () => {});

      log.info({ dirs: watchPaths }, 'Filesystem watcher started');
    } catch (err) {
      log.warn({ err }, 'Failed to start filesystem watcher');
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      try { await this.watcher.close(); } catch {}
      this.watcher = null;
    }
  }

  private getDefaultWatchDirs(): string[] {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const dirs = [
      path.join(home, 'Desktop'),
      path.join(home, 'Projects'),
    ];
    return dirs.filter((d) => {
      try { return fs.existsSync(d); } catch { return false; }
    });
  }

  private onFileEvent(type: 'opened' | 'modified' | 'deleted', filePath: string): void {
    const ext = path.extname(filePath);
    const eventType = type === 'opened' ? 'FILE_OPENED' : type === 'modified' ? 'FILE_MODIFIED' : 'FILE_DELETED';
    this.bus.emit(eventType, 'filesystem-watcher', {
      type,
      filePath,
      extension: ext,
    });
  }
}
