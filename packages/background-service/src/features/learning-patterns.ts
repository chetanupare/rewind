import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface LearningPattern {
  id: number;
  type: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  lastSeen: string;
  metadata: string;
}

interface WorkPattern {
  productiveHours: Record<string, number>;
  topApps: Array<{ app: string; percentage: number }>;
  focusPatterns: Array<{ startTime: string; duration: number; app: string }>;
  distractionPatterns: Array<{ trigger: string; frequency: number }>;
  projectPatterns: Array<{ project: string; preferredTime: string; avgDuration: number }>;
}

export class LearningPatterns {
  private patterns: Map<string, LearningPattern> = new Map();
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.loadPatterns();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        occurrences INTEGER DEFAULT 1,
        last_seen TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pattern_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        context TEXT,
        FOREIGN KEY (pattern_id) REFERENCES learning_patterns(id)
      );

      CREATE TABLE IF NOT EXISTS work_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        insight TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        generated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_type ON learning_patterns(type);
      CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON learning_patterns(confidence);
    `);
  }

  private loadPatterns(): void {
    const rows = this.db.prepare('SELECT * FROM learning_patterns').all() as LearningPattern[];
    for (const row of rows) {
      this.patterns.set(`${row.type}:${row.pattern}`, row);
    }
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.learnAppPattern(appName, windowTitle);
    });

    this.bus.on('CONTEXT_SWITCH', (event) => {
      const { fromApp, toApp, reason } = event.payload as any;
      this.learnSwitchPattern(fromApp, toApp, reason);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      const { repoPath, commitMessage } = event.payload as any;
      this.learnCommitPattern(repoPath, commitMessage);
    });

    this.bus.on('FOCUS_COMPLETED', (event) => {
      const { sessionNumber } = event.payload as any;
      this.learnFocusPattern(sessionNumber);
    });
  }

  private learnAppPattern(appName: string, windowTitle: string): void {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    this.updatePattern('app_usage', `${appName}:${hour}`, {
      app: appName,
      hour,
      dayOfWeek,
    });

    if (windowTitle) {
      const projectMatch = windowTitle.match(/([A-Z][a-zA-Z]+(?:CRM|API|App|Web|UI|Service))/);
      if (projectMatch) {
        this.updatePattern('project_context', `${projectMatch[1]}:${appName}`, {
          project: projectMatch[1],
          app: appName,
        });
      }
    }
  }

  private learnSwitchPattern(fromApp: string, toApp: string, reason: string): void {
    this.updatePattern('app_switch', `${fromApp}->${toApp}`, {
      from: fromApp,
      to: toApp,
      reason,
    });

    if (reason === 'distraction') {
      this.updatePattern('distraction_trigger', toApp, {
        from: fromApp,
        to: toApp,
      });
    }
  }

  private learnCommitPattern(repoPath: string, message: string): void {
    const hour = new Date().getHours();
    const projectName = repoPath.split(/[/\\]/).pop() || 'unknown';

    this.updatePattern('commit_time', `${projectName}:${hour}`, {
      project: projectName,
      hour,
    });

    const typeMatch = message.match(/^(feat|fix|docs|style|refactor|test|chore)/i);
    if (typeMatch) {
      this.updatePattern('commit_type', typeMatch[1].toLowerCase(), {
        type: typeMatch[1],
        project: projectName,
      });
    }
  }

  private learnFocusPattern(sessionNumber: number): void {
    const hour = new Date().getHours();
    this.updatePattern('focus_time', `${hour}`, {
      hour,
      sessionNumber,
    });
  }

  private updatePattern(type: string, pattern: string, metadata: Record<string, unknown>): void {
    const key = `${type}:${pattern}`;
    const existing = this.patterns.get(key);

    if (existing) {
      existing.occurrences++;
      existing.confidence = Math.min(1, existing.confidence + 0.01);
      existing.lastSeen = new Date().toISOString();
      existing.metadata = JSON.stringify(metadata);

      this.db.prepare(`
        UPDATE learning_patterns SET occurrences = ?, confidence = ?, last_seen = ?, metadata = ?
        WHERE id = ?
      `).run(existing.occurrences, existing.confidence, existing.lastSeen, existing.metadata, existing.id);
    } else {
      const newPattern: LearningPattern = {
        id: 0,
        type,
        pattern,
        confidence: 0.5,
        occurrences: 1,
        lastSeen: new Date().toISOString(),
        metadata: JSON.stringify(metadata),
      };

      const result = this.db.prepare(`
        INSERT INTO learning_patterns (type, pattern, confidence, occurrences, last_seen, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(type, pattern, 0.5, 1, newPattern.lastSeen, newPattern.metadata);

      newPattern.id = result.lastInsertRowid as number;
      this.patterns.set(key, newPattern);
    }
  }

  async getWorkPatterns(): Promise<WorkPattern> {
    const appPatterns = this.getPatternsByType('app_usage');
    const switchPatterns = this.getPatternsByType('app_switch');
    const focusPatterns = this.getPatternsByType('focus_time');
    const distractionPatterns = this.getPatternsByType('distraction_trigger');

    const productiveHours: Record<string, number> = {};
    for (const p of appPatterns) {
      const meta = JSON.parse(p.metadata);
      const hour = meta.hour;
      if (hour !== undefined) {
        productiveHours[hour] = (productiveHours[hour] || 0) + p.occurrences;
      }
    }

    const appCounts: Record<string, number> = {};
    for (const p of appPatterns) {
      const meta = JSON.parse(p.metadata);
      appCounts[meta.app] = (appCounts[meta.app] || 0) + p.occurrences;
    }
    const totalAppUsage = Object.values(appCounts).reduce((a, b) => a + b, 0);
    const topApps = Object.entries(appCounts)
      .map(([app, count]) => ({ app, percentage: Math.round((count / totalAppUsage) * 100) }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);

    const focusPatternList = focusPatterns.map(p => {
      const meta = JSON.parse(p.metadata);
      return {
        startTime: `${meta.hour}:00`,
        duration: p.occurrences * 25,
        app: 'Focus Mode',
      };
    });

    const distractionPatternList = distractionPatterns.map(p => ({
      trigger: p.pattern,
      frequency: p.occurrences,
    }));

    const projectPatterns = this.getPatternsByType('project_context').map(p => {
      const meta = JSON.parse(p.metadata);
      return {
        project: meta.project,
        preferredTime: `${meta.hour || 9}:00`,
        avgDuration: p.occurrences * 15,
      };
    });

    return {
      productiveHours,
      topApps,
      focusPatterns: focusPatternList,
      distractionPatterns: distractionPatternList,
      projectPatterns,
    };
  }

  private getPatternsByType(type: string): LearningPattern[] {
    return Array.from(this.patterns.values()).filter(p => p.type === type);
  }

  async getConfidentPatterns(): Promise<LearningPattern[]> {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence >= this.CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async generateInsights(): Promise<string[]> {
    const insights: string[] = [];
    const patterns = await this.getWorkPatterns();

    const topHour = Object.entries(patterns.productiveHours)
      .sort(([, a], [, b]) => b - a)[0];
    if (topHour) {
      insights.push(`Your most productive hour is ${topHour[0]}:00 with ${topHour[1]} activities.`);
    }

    if (patterns.topApps.length > 0) {
      insights.push(`You spend ${patterns.topApps[0].percentage}% of your time in ${patterns.topApps[0].app}.`);
    }

    if (patterns.distractionPatterns.length > 0) {
      const topDistraction = patterns.distractionPatterns[0];
      insights.push(`Your biggest distraction is ${topDistraction.trigger} (${topDistraction.frequency} times).`);
    }

    if (patterns.projectPatterns.length > 0) {
      const topProject = patterns.projectPatterns[0];
      insights.push(`You work most on ${topProject.project}, typically around ${topProject.preferredTime}.`);
    }

    for (const insight of insights) {
      this.db.prepare(`
        INSERT INTO work_insights (type, insight, confidence) VALUES ('pattern', ?, 0.8)
      `).run(insight);
    }

    return insights;
  }

  async getInsights(limit = 10): Promise<Array<{ insight: string; generatedAt: string }>> {
    return this.db.prepare(`
      SELECT insight, generated_at FROM work_insights ORDER BY generated_at DESC LIMIT ?
    `).all(limit) as Array<{ insight: string; generatedAt: string }>;
  }

  async getPatternStats(): Promise<{
    totalPatterns: number;
    confidentPatterns: number;
    topTypes: Array<{ type: string; count: number }>;
  }> {
    const total = this.patterns.size;
    const confident = Array.from(this.patterns.values()).filter(p => p.confidence >= this.CONFIDENCE_THRESHOLD).length;

    const typeCounts: Record<string, number> = {};
    for (const p of this.patterns.values()) {
      typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
    }

    const topTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalPatterns: total,
      confidentPatterns: confident,
      topTypes,
    };
  }
}
