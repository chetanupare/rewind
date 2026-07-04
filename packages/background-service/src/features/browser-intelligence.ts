import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface BrowserContext {
  id: number;
  timestamp: string;
  url: string;
  title: string;
  site: string;
  category: string;
  isProductive: boolean;
  metadata: Record<string, unknown>;
}

interface SitePattern {
  pattern: RegExp;
  site: string;
  category: string;
  extractMetadata?: (url: string, title: string) => Record<string, unknown>;
}

export class BrowserIntelligence {
  private sitePatterns: SitePattern[] = [
    {
      pattern: /github\.com\/([^/]+)\/([^/]+)/,
      site: 'GitHub',
      category: 'development',
      extractMetadata: (url, title) => {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/|$)/);
        return {
          owner: match?.[1],
          repo: match?.[2],
          isPR: url.includes('/pull/'),
          isIssue: url.includes('/issues/'),
          prNumber: url.match(/\/pull\/(\d+)/)?.[1],
          issueNumber: url.match(/\/issues\/(\d+)/)?.[1],
        };
      },
    },
    {
      pattern: /stackoverflow\.com/,
      site: 'StackOverflow',
      category: 'research',
      extractMetadata: (url, title) => ({
        question: title.replace(/ - Stack Overflow$/, '').trim(),
        tags: title.match(/\[([^\]]+)\]/g)?.map(t => t.slice(1, -1)) || [],
      }),
    },
    {
      pattern: /chat\.openai\.com/,
      site: 'ChatGPT',
      category: 'ai',
      extractMetadata: (url, title) => ({
        conversation: title.replace(/ \| ChatGPT$/, '').trim(),
      }),
    },
    {
      pattern: /claude\.ai/,
      site: 'Claude',
      category: 'ai',
      extractMetadata: (url, title) => ({
        conversation: title.replace(/ \| Claude$/, '').trim(),
      }),
    },
    {
      pattern: /linear\.app/,
      site: 'Linear',
      category: 'project-management',
      extractMetadata: (url, title) => ({
        issueId: url.match(/\/issue\/([A-Z]+-\d+)/)?.[1],
        issueTitle: title.replace(/ - Linear$/, '').trim(),
      }),
    },
    {
      pattern: /jira\./,
      site: 'Jira',
      category: 'project-management',
      extractMetadata: (url, title) => ({
        issueKey: url.match(/\/browse\/([A-Z]+-\d+)/)?.[1],
        issueTitle: title.replace(/ - Jira$/, '').trim(),
      }),
    },
    {
      pattern: /figma\.com/,
      site: 'Figma',
      category: 'design',
      extractMetadata: (url, title) => ({
        fileName: title.replace(/ – Figma$/, '').trim(),
      }),
    },
    {
      pattern: /notion\.so/,
      site: 'Notion',
      category: 'documentation',
      extractMetadata: (url, title) => ({
        pageName: title.replace(/ - Notion$/, '').trim(),
      }),
    },
    {
      pattern: /docs\.google\.com/,
      site: 'Google Docs',
      category: 'documentation',
    },
    {
      pattern: /youtube\.com/,
      site: 'YouTube',
      category: 'entertainment',
      extractMetadata: (url, title) => ({
        videoTitle: title.replace(/ - YouTube$/, '').trim(),
        isWatch: url.includes('/watch'),
      }),
    },
    {
      pattern: /mail\.google\.com/,
      site: 'Gmail',
      category: 'email',
    },
    {
      pattern: /outlook\./,
      site: 'Outlook',
      category: 'email',
    },
    {
      pattern: /teams\.microsoft\.com/,
      site: 'Microsoft Teams',
      category: 'communication',
    },
    {
      pattern: /slack\.com/,
      site: 'Slack',
      category: 'communication',
    },
    {
      pattern: /linkedin\.com/,
      site: 'LinkedIn',
      category: 'professional',
    },
    {
      pattern: /twitter\.com|x\.com/,
      site: 'Twitter/X',
      category: 'social',
    },
    {
      pattern: /reddit\.com/,
      site: 'Reddit',
      category: 'social',
    },
    {
      pattern: /azure\.devops/,
      site: 'Azure DevOps',
      category: 'development',
    },
    {
      pattern: /confluence\./,
      site: 'Confluence',
      category: 'documentation',
    },
    {
      pattern: /vercel\.com/,
      site: 'Vercel',
      category: 'deployment',
    },
    {
      pattern: /netlify\.com/,
      site: 'Netlify',
      category: 'deployment',
    },
    {
      pattern: /aws\.amazon\.com/,
      site: 'AWS',
      category: 'cloud',
    },
    {
      pattern: /console\.cloud\.google/,
      site: 'Google Cloud',
      category: 'cloud',
    },
  ];

  private productiveSites = new Set([
    'GitHub', 'StackOverflow', 'ChatGPT', 'Claude', 'Linear', 'Jira',
    'Figma', 'Notion', 'Google Docs', 'Azure DevOps', 'Confluence',
    'Vercel', 'Netlify', 'AWS', 'Google Cloud', 'LinkedIn',
  ]);

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS browser_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        site TEXT,
        category TEXT,
        is_productive INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_browser_time ON browser_contexts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_browser_site ON browser_contexts(site);
      CREATE INDEX IF NOT EXISTS idx_browser_category ON browser_contexts(category);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('BROWSER_URL_CHANGED', (event) => {
      const { url, pageTitle } = event.payload as any;
      this.analyzeUrl(url, pageTitle);
    });

    this.bus.on('BROWSER_TAB_CHANGED', (event) => {
      const { url, pageTitle } = event.payload as any;
      if (url) {
        this.analyzeUrl(url, pageTitle);
      }
    });
  }

  private analyzeUrl(url: string, title: string): void {
    if (!url) return;

    const context = this.matchSite(url, title);
    if (!context) return;

    this.recordContext(context);

    this.bus.emit('BROWSER_CONTEXT', 'browser-intelligence', {
      site: context.site,
      category: context.category,
      isProductive: context.isProductive,
      url,
      title,
    });
  }

  private matchSite(url: string, title: string): BrowserContext | null {
    for (const pattern of this.sitePatterns) {
      if (pattern.pattern.test(url)) {
        const metadata = pattern.extractMetadata ? pattern.extractMetadata(url, title) : {};
        const isProductive = this.productiveSites.has(pattern.site);

        return {
          id: 0,
          timestamp: new Date().toISOString(),
          url,
          title,
          site: pattern.site,
          category: pattern.category,
          isProductive,
          metadata,
        };
      }
    }

    return {
      id: 0,
      timestamp: new Date().toISOString(),
      url,
      title,
      site: new URL(url).hostname,
      category: 'other',
      isProductive: false,
      metadata: {},
    };
  }

  private recordContext(context: BrowserContext): void {
    try {
      this.db.prepare(`
        INSERT INTO browser_contexts (timestamp, url, title, site, category, is_productive, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        context.timestamp,
        context.url,
        context.title,
        context.site,
        context.category,
        context.isProductive ? 1 : 0,
        JSON.stringify(context.metadata)
      );
    } catch (err) {
      log.warn({ err }, 'Failed to record browser context');
    }
  }

  async getStats(date: string): Promise<{
    totalVisits: number;
    productiveVisits: number;
    topSites: Array<{ site: string; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
    timeByCategory: Record<string, number>;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const total = (this.db.prepare(
      'SELECT COUNT(*) as count FROM browser_contexts WHERE timestamp BETWEEN ? AND ?'
    ).get(start, end) as { count: number }).count;

    const productive = (this.db.prepare(
      'SELECT COUNT(*) as count FROM browser_contexts WHERE timestamp BETWEEN ? AND ? AND is_productive = 1'
    ).get(start, end) as { count: number }).count;

    const topSites = this.db.prepare(`
      SELECT site, COUNT(*) as count FROM browser_contexts
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY site ORDER BY count DESC LIMIT 10
    `).all(start, end) as Array<{ site: string; count: number }>;

    const topCategories = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM browser_contexts
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY category ORDER BY count DESC
    `).all(start, end) as Array<{ category: string; count: number }>;

    return {
      totalVisits: total,
      productiveVisits: productive,
      topSites,
      topCategories,
      timeByCategory: Object.fromEntries(topCategories.map(c => [c.category, c.count])),
    };
  }

  async getRecentContexts(limit = 50): Promise<BrowserContext[]> {
    return this.db.prepare(`
      SELECT * FROM browser_contexts ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as BrowserContext[];
  }

  async getBySite(site: string, limit = 50): Promise<BrowserContext[]> {
    return this.db.prepare(`
      SELECT * FROM browser_contexts WHERE site = ? ORDER BY timestamp DESC LIMIT ?
    `).all(site, limit) as BrowserContext[];
  }
}
