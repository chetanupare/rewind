import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface WorkingMemoryState {
  currentProject: string | null;
  currentTask: string | null;
  currentFile: string | null;
  currentApp: string | null;
  recentDecisions: string[];
  pendingItems: string[];
  blockedBy: string | null;
  context: Record<string, unknown>;
  lastUpdated: Date;
}

export class WorkingMemory {
  private state: WorkingMemoryState;
  private history: WorkingMemoryState[] = [];
  private readonly MAX_HISTORY = 50;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.state = this.createEmptyState();
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS working_memory_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_wm_time ON working_memory_snapshots(timestamp);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.updateApp(appName, windowTitle);
    });

    this.bus.on('FILE_SAVED', (event) => {
      const { filePath } = event.payload as any;
      this.updateFile(filePath);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      const { commitMessage } = event.payload as any;
      this.addDecision(`Committed: ${commitMessage}`);
    });

    this.bus.on('PROJECT_DETECTED', (event) => {
      const { name } = event.payload as any;
      this.updateProject(name);
    });
  }

  private createEmptyState(): WorkingMemoryState {
    return {
      currentProject: null,
      currentTask: null,
      currentFile: null,
      currentApp: null,
      recentDecisions: [],
      pendingItems: [],
      blockedBy: null,
      context: {},
      lastUpdated: new Date(),
    };
  }

  private updateApp(appName: string, windowTitle: string): void {
    this.state.currentApp = appName;
    this.state.lastUpdated = new Date();

    const taskMatch = windowTitle.match(/(?:fix|implement|debug|test|review|deploy)\s+(.+)/i);
    if (taskMatch) {
      this.state.currentTask = taskMatch[1].substring(0, 100);
    }

    this.snapshot();
  }

  private updateFile(filePath: string): void {
    this.state.currentFile = filePath.split(/[/\\]/).pop() || filePath;
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  private updateProject(projectName: string): void {
    this.state.currentProject = projectName;
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  addDecision(decision: string): void {
    this.state.recentDecisions.unshift(decision);
    if (this.state.recentDecisions.length > 10) {
      this.state.recentDecisions = this.state.recentDecisions.slice(0, 10);
    }
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  addPendingItem(item: string): void {
    if (!this.state.pendingItems.includes(item)) {
      this.state.pendingItems.push(item);
      this.state.lastUpdated = new Date();
      this.snapshot();
    }
  }

  removePendingItem(item: string): void {
    this.state.pendingItems = this.state.pendingItems.filter(i => i !== item);
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  setBlockedBy(reason: string): void {
    this.state.blockedBy = reason;
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  clearBlocked(): void {
    this.state.blockedBy = null;
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  updateContext(key: string, value: unknown): void {
    this.state.context[key] = value;
    this.state.lastUpdated = new Date();
    this.snapshot();
  }

  private snapshot(): void {
    this.history.push({ ...this.state });
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    try {
      this.db.prepare(`
        INSERT INTO working_memory_snapshots (timestamp, state)
        VALUES (?, ?)
      `).run(new Date().toISOString(), JSON.stringify(this.state));
    } catch (err) {
      log.debug({ err }, 'Failed to save working memory snapshot');
    }
  }

  getState(): WorkingMemoryState {
    return { ...this.state };
  }

  getContextString(): string {
    const parts: string[] = [];

    if (this.state.currentProject) parts.push(`Project: ${this.state.currentProject}`);
    if (this.state.currentTask) parts.push(`Task: ${this.state.currentTask}`);
    if (this.state.currentFile) parts.push(`File: ${this.state.currentFile}`);
    if (this.state.currentApp) parts.push(`App: ${this.state.currentApp}`);
    if (this.state.blockedBy) parts.push(`Blocked by: ${this.state.blockedBy}`);

    if (this.state.recentDecisions.length > 0) {
      parts.push(`Recent decisions: ${this.state.recentDecisions.slice(0, 3).join(', ')}`);
    }

    if (this.state.pendingItems.length > 0) {
      parts.push(`Pending: ${this.state.pendingItems.slice(0, 3).join(', ')}`);
    }

    return parts.join('\n');
  }

  getHistory(limit = 10): WorkingMemoryState[] {
    return this.history.slice(-limit);
  }

  clear(): void {
    this.state = this.createEmptyState();
    this.snapshot();
  }
}
