import { Database, getConfig, getLogger, ensureQdrantCollection } from '@ai-work-memory/shared';
import type { EventBus, AppConfig } from '@ai-work-memory/shared';
import { WindowTracker } from './collectors/window-tracker.js';
import { ScreenshotService } from './collectors/screenshot-service.js';
import { ClipboardMonitor } from './collectors/clipboard-monitor.js';
import { SystemEvents } from './collectors/system-events.js';
import { FilesystemWatcher } from './collectors/filesystem-watcher.js';
import { GitTracker } from './collectors/git-tracker.js';
import { KeyboardTracker } from './collectors/keyboard-tracker.js';
import { MouseTracker } from './collectors/mouse-tracker.js';
import { FlowStateTracker } from './collectors/flow-state-tracker.js';
import { ThrashingDetector } from './collectors/thrashing-detector.js';
import { WikiGenerator } from './collectors/wiki-generator.js';
import { SessionBuilder } from './pipeline/session-builder.js';
import { VisionAnalyzer } from './ai/vision-analyzer.js';
import { startScheduler } from './scheduler.js';
import { startRetentionManager, stopRetentionManager } from './cleanup/retention-manager.js';

const log = getLogger();

let collectors: Array<{ stop(): Promise<void> }> = [];

export async function startBackgroundService(
  database: Database,
  bus: EventBus,
  config: AppConfig
): Promise<void> {
  log.info('RewindX background service starting...');

  try {
    await ensureQdrantCollection();
    log.info('Qdrant collection ready');
  } catch (err) {
    log.warn({ err }, 'Qdrant not available — vector search disabled');
  }

  const windowTracker = new WindowTracker(bus, database);
  const screenshotService = new ScreenshotService(bus, database);
  const clipboardMonitor = new ClipboardMonitor(bus, database);
  const systemEvents = new SystemEvents(bus, database);
  const filesystemWatcher = new FilesystemWatcher(bus);
  const gitTracker = new GitTracker(bus, database);
  const keyboardTracker = new KeyboardTracker(bus);
  const mouseTracker = new MouseTracker(bus);
  const flowStateTracker = new FlowStateTracker(bus);
  const thrashingDetector = new ThrashingDetector(bus, database);
  const wikiGenerator = new WikiGenerator(bus, database);
  const sessionBuilder = new SessionBuilder(bus, database);
  const visionAnalyzer = new VisionAnalyzer(bus, database);

  await windowTracker.start();
  log.info('Window tracker started');

  await screenshotService.start();
  log.info('Screenshot service started');

  await clipboardMonitor.start();
  log.info('Clipboard monitor started');

  await systemEvents.start();
  log.info('System events started');

  await filesystemWatcher.start();
  log.info('Filesystem watcher started');

  await gitTracker.start();
  log.info('Git tracker started');

  await keyboardTracker.start();
  log.info('Keyboard tracker started');

  await mouseTracker.start();
  log.info('Mouse tracker started');

  await flowStateTracker.start();
  log.info('Flow state tracker started');

  await thrashingDetector.start();
  log.info('Thrashing detector started');

  await wikiGenerator.start();
  log.info('Wiki generator started');

  await sessionBuilder.start();
  log.info('Session builder started');

  await visionAnalyzer.start();
  log.info('Vision analyzer started');

  collectors = [windowTracker, screenshotService, clipboardMonitor, systemEvents, filesystemWatcher, gitTracker, keyboardTracker, mouseTracker, flowStateTracker, thrashingDetector, wikiGenerator, sessionBuilder, visionAnalyzer];

  startScheduler(database, bus);
  startRetentionManager(config);

  log.info('RewindX background service running');
}

export async function stopBackgroundService(): Promise<void> {
  log.info('Shutting down background service...');
  stopRetentionManager();
  for (const collector of collectors) {
    try {
      await collector.stop();
    } catch {
      // ignore
    }
  }
  collectors = [];
}
