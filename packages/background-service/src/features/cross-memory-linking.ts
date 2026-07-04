import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface MemoryLink {
  id: number;
  sourceType: string;
  sourceId: number;
  targetType: string;
  targetId: number;
  relationship: string;
  strength: number;
  metadata: string;
  createdAt: string;
}

interface LinkedMemory {
  type: string;
  id: number;
  title: string;
  timestamp: string;
  links: Array<{
    relationship: string;
    targetType: string;
    targetId: number;
    targetTitle: string;
  }>;
}

export class CrossMemoryLinking {
  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        relationship TEXT NOT NULL,
        strength REAL DEFAULT 1.0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_links_source ON memory_links(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_links_target ON memory_links(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_links_relationship ON memory_links(relationship);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('SCREENSHOT_CAPTURED', (event) => {
      this.autoLink('screenshot', event.payload);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      this.autoLink('commit', event.payload);
    });

    this.bus.on('WINDOW_CHANGED', (event) => {
      this.autoLink('activity', event.payload);
    });

    this.bus.on('SESSION_STARTED', (event) => {
      this.autoLink('session', event.payload);
    });
  }

  private async autoLink(sourceType: string, data: Record<string, unknown>): Promise<void> {
    const timestamp = new Date().toISOString();
    const timeWindow = 5 * 60 * 1000;

    const recentScreenshots = this.db.prepare(`
      SELECT id FROM screenshots 
      WHERE datetime(timestamp) > datetime(?, '-5 minutes')
      ORDER BY timestamp DESC LIMIT 3
    `).all(timestamp) as Array<{ id: number }>;

    const recentCommits = this.db.prepare(`
      SELECT id FROM git_events
      WHERE datetime(timestamp) > datetime(?, '-5 minutes')
      ORDER BY timestamp DESC LIMIT 3
    `).all(timestamp) as Array<{ id: number }>;

    const recentActivities = this.db.prepare(`
      SELECT id FROM activities
      WHERE datetime(timestamp) > datetime(?, '-5 minutes')
      ORDER BY timestamp DESC LIMIT 5
    `).all(timestamp) as Array<{ id: number }>;

    let sourceId: number | null = null;
    switch (sourceType) {
      case 'screenshot':
        sourceId = data.screenshotId as number;
        break;
      case 'commit':
        sourceId = data.commitId as number;
        break;
      case 'activity':
        sourceId = recentActivities[0]?.id || null;
        break;
    }

    if (!sourceId) return;

    for (const screenshot of recentScreenshots) {
      if (sourceType !== 'screenshot' || sourceId !== screenshot.id) {
        this.createLink(sourceType, sourceId, 'screenshot', screenshot.id, 'co_occurred', 1.0);
      }
    }

    for (const commit of recentCommits) {
      if (sourceType !== 'commit' || sourceId !== commit.id) {
        this.createLink(sourceType, sourceId, 'commit', commit.id, 'related_to', 1.0);
      }
    }

    for (const activity of recentActivities) {
      if (sourceType !== 'activity' || sourceId !== activity.id) {
        this.createLink(sourceType, sourceId, 'activity', activity.id, 'during', 0.8);
      }
    }
  }

  private createLink(
    sourceType: string,
    sourceId: number,
    targetType: string,
    targetId: number,
    relationship: string,
    strength: number
  ): void {
    const existing = this.db.prepare(`
      SELECT id FROM memory_links
      WHERE source_type = ? AND source_id = ? AND target_type = ? AND target_id = ? AND relationship = ?
    `).get(sourceType, sourceId, targetType, targetId, relationship) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE memory_links SET strength = MIN(strength + 0.1, 10.0) WHERE id = ?
      `).run(existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO memory_links (source_type, source_id, target_type, target_id, relationship, strength)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sourceType, sourceId, targetType, targetId, relationship, strength);
    }
  }

  async getLinks(type: string, id: number): Promise<MemoryLink[]> {
    return this.db.prepare(`
      SELECT * FROM memory_links
      WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)
      ORDER BY strength DESC
    `).all(type, id, type, id) as MemoryLink[];
  }

  async getLinkedMemories(type: string, id: number): Promise<LinkedMemory[]> {
    const links = await this.getLinks(type, id);
    const memories: LinkedMemory[] = [];

    for (const link of links) {
      const isSource = link.sourceType === type && link.sourceId === id;
      const targetType = isSource ? link.targetType : link.sourceType;
      const targetId = isSource ? link.targetId : link.sourceId;

      const memory = await this.getMemoryDetails(targetType, targetId);
      if (memory) {
        memories.push({
          ...memory,
          links: [{
            relationship: link.relationship,
            targetType,
            targetId,
            targetTitle: memory.title,
          }],
        });
      }
    }

    return memories;
  }

  private async getMemoryDetails(type: string, id: number): Promise<{ type: string; id: number; title: string; timestamp: string } | null> {
    switch (type) {
      case 'screenshot': {
        const row = this.db.prepare('SELECT id, ai_task as title, timestamp FROM screenshots WHERE id = ?').get(id) as any;
        return row ? { type, id: row.id, title: row.title || 'Screenshot', timestamp: row.timestamp } : null;
      }
      case 'commit': {
        const row = this.db.prepare('SELECT id, commit_message as title, timestamp FROM git_events WHERE id = ?').get(id) as any;
        return row ? { type, id: row.id, title: row.title || 'Commit', timestamp: row.timestamp } : null;
      }
      case 'activity': {
        const row = this.db.prepare('SELECT id, window_title as title, timestamp FROM activities WHERE id = ?').get(id) as any;
        return row ? { type, id: row.id, title: row.title || 'Activity', timestamp: row.timestamp } : null;
      }
      case 'session': {
        const row = this.db.prepare('SELECT id, summary as title, start_time as timestamp FROM sessions WHERE id = ?').get(id) as any;
        return row ? { type, id: row.id, title: row.title || 'Session', timestamp: row.timestamp } : null;
      }
      case 'bookmark': {
        const row = this.db.prepare('SELECT id, title, created_at as timestamp FROM bookmarks WHERE id = ?').get(id) as any;
        return row ? { type, id: row.id, title: row.title || 'Bookmark', timestamp: row.timestamp } : null;
      }
      default:
        return null;
    }
  }

  async getGraph(centerType: string, centerId: number, depth: number = 2): Promise<{
    nodes: Array<{ type: string; id: number; title: string }>;
    edges: Array<{ source: string; target: string; relationship: string; strength: number }>;
  }> {
    const nodes: Map<string, { type: string; id: number; title: string }> = new Map();
    const edges: Array<{ source: string; target: string; relationship: string; strength: number }> = [];

    const visited = new Set<string>();
    const queue: Array<{ type: string; id: number; currentDepth: number }> = [
      { type: centerType, id: centerId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;

      if (visited.has(key) || current.currentDepth > depth) continue;
      visited.add(key);

      const memory = await this.getMemoryDetails(current.type, current.id);
      if (memory) {
        nodes.set(key, { type: current.type, id: current.id, title: memory.title });
      }

      const links = await this.getLinks(current.type, current.id);
      for (const link of links) {
        const isSource = link.sourceType === current.type && link.sourceId === current.id;
        const targetType = isSource ? link.targetType : link.sourceType;
        const targetId = isSource ? link.targetId : link.sourceId;
        const targetKey = `${targetType}:${targetId}`;

        edges.push({
          source: key,
          target: targetKey,
          relationship: link.relationship,
          strength: link.strength,
        });

        if (!visited.has(targetKey) && current.currentDepth < depth) {
          queue.push({ type: targetType, id: targetId, currentDepth: current.currentDepth + 1 });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  async getStats(): Promise<{
    totalLinks: number;
    byRelationship: Record<string, number>;
    strongestLinks: MemoryLink[];
  }> {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM memory_links').get() as { count: number }).count;

    const byRelationship = this.db.prepare(`
      SELECT relationship, COUNT(*) as count FROM memory_links GROUP BY relationship
    `).all() as Array<{ relationship: string; count: number }>;

    const strongest = this.db.prepare(`
      SELECT * FROM memory_links ORDER BY strength DESC LIMIT 10
    `).all() as MemoryLink[];

    return {
      totalLinks: total,
      byRelationship: Object.fromEntries(byRelationship.map(r => [r.relationship, r.count])),
      strongestLinks: strongest,
    };
  }
}
