import fs from 'fs';
import path from 'path';
import { getLogger } from '@ai-work-memory/shared';
import type { AppConfig } from '@ai-work-memory/shared';

const log = getLogger();

let retentionInterval: ReturnType<typeof setInterval> | null = null;

export function startRetentionManager(config: AppConfig): void {
  const retentionDays = config.screenshot.retentionDays;

  cleanupOldScreenshots(config.screenshotsDir, retentionDays);

  retentionInterval = setInterval(() => {
    cleanupOldScreenshots(config.screenshotsDir, retentionDays);
  }, 24 * 60 * 60 * 1000);
}

export function stopRetentionManager(): void {
  if (retentionInterval) {
    clearInterval(retentionInterval);
    retentionInterval = null;
  }
}

function cleanupOldScreenshots(screenshotsDir: string, retentionDays: number): void {
  try {
    if (!fs.existsSync(screenshotsDir)) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const entries = fs.readdirSync(screenshotsDir);
    let deletedCount = 0;

    for (const entry of entries) {
      const dirPath = path.join(screenshotsDir, entry);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
      if (!fs.statSync(dirPath).isDirectory()) continue;

      const dirDate = new Date(entry);
      if (dirDate >= cutoff) continue;

      fs.rmSync(dirPath, { recursive: true, force: true });
      deletedCount++;
      log.info({ dir: entry }, 'Deleted old screenshot directory');
    }

    if (deletedCount > 0) {
      log.info({ deletedCount, retentionDays }, 'Retention cleanup completed');
    }
  } catch (err) {
    log.warn({ err }, 'Retention cleanup failed');
  }
}
