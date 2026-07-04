import { Database, getConfig, getLogger, ensureQdrantCollection } from '@ai-work-memory/shared';
import type { EventBus, AppConfig } from '@ai-work-memory/shared';
import { UnifiedTracker } from './collectors/unified-tracker.js';
import { ScreenshotService } from './collectors/screenshot-service.js';
import { ClipboardMonitor } from './collectors/clipboard-monitor.js';
import { SystemEvents } from './collectors/system-events.js';
import { FilesystemWatcher } from './collectors/filesystem-watcher.js';
import { GitTracker } from './collectors/git-tracker.js';
import { FlowStateTracker } from './collectors/flow-state-tracker.js';
import { ThrashingDetector } from './collectors/thrashing-detector.js';
import { WikiGenerator } from './collectors/wiki-generator.js';
import { SessionBuilder } from './pipeline/session-builder.js';
import { VisionAnalyzer } from './ai/vision-analyzer.js';
import { startScheduler } from './scheduler.js';
import { startRetentionManager, stopRetentionManager } from './cleanup/retention-manager.js';
import {
  SemanticTimeline,
  MemoryBookmarks,
  ProjectDetector,
  DeveloperMode,
  MeetingIntelligence,
  FocusAnalytics,
  NaturalLanguageAutomation,
  CrossMemoryLinking,
  SessionReplay,
  MemoryApi,
} from './features/index.js';

const log = getLogger();

let collectors: Array<{ stop(): Promise<void> }> = [];
let memoryApi: MemoryApi | null = null;
let nlAutomation: NaturalLanguageAutomation | null = null;

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

  // Unified tracker replaces window, keyboard, mouse trackers
  const unifiedTracker = new UnifiedTracker(bus, database);
  const screenshotService = new ScreenshotService(bus, database);
  const clipboardMonitor = new ClipboardMonitor(bus, database);
  const systemEvents = new SystemEvents(bus, database);
  const filesystemWatcher = new FilesystemWatcher(bus);
  const gitTracker = new GitTracker(bus, database);
  const flowStateTracker = new FlowStateTracker(bus);
  const thrashingDetector = new ThrashingDetector(bus, database);
  const wikiGenerator = new WikiGenerator(bus, database);
  const sessionBuilder = new SessionBuilder(bus, database);
  const visionAnalyzer = new VisionAnalyzer(bus, database);

  // Lazy load features
  log.info('Initializing features...');
  const semanticTimeline = new SemanticTimeline(database, bus);
  const memoryBookmarks = new MemoryBookmarks(database, bus);
  const projectDetector = new ProjectDetector(database, bus);
  const developerMode = new DeveloperMode(database, bus);
  const meetingIntelligence = new MeetingIntelligence(database, bus);
  const focusAnalytics = new FocusAnalytics(database, bus);
  nlAutomation = new NaturalLanguageAutomation(database, bus);
  const crossMemoryLinking = new CrossMemoryLinking(database, bus);
  const sessionReplay = new SessionReplay(database, bus);
  
  memoryApi = new MemoryApi(database, bus);
  await memoryApi.start();
  log.info({ port: memoryApi.getPort() }, 'Memory API started');

  // Start collectors in sequence with delays to reduce startup memory spike
  await unifiedTracker.start();
  log.info('Unified tracker started (window + keyboard + mouse)');

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

  collectors = [
    unifiedTracker, screenshotService, clipboardMonitor, systemEvents,
    filesystemWatcher, gitTracker, flowStateTracker, thrashingDetector,
    wikiGenerator, sessionBuilder, visionAnalyzer,
  ];

  startScheduler(database, bus);
  startRetentionManager(config);

  log.info('RewindX background service running');
}

export async function stopBackgroundService(): Promise<void> {
  log.info('Shutting down background service...');
  
  if (memoryApi) {
    await memoryApi.stop();
    memoryApi = null;
  }

  if (nlAutomation) {
    nlAutomation.destroy();
    nlAutomation = null;
  }

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
