import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface IntentResult {
  type: string;
  context: string;
  summary: string;
  concepts: string[];
  confidence: number;
}

export class IntentEngine {
  private readonly INTENT_PATTERNS: Record<string, { apps: string[]; keywords: string[] }> = {
    coding: {
      apps: ['code', 'cursor', 'visual studio', 'intellij', 'webstorm'],
      keywords: ['editing', 'coding', 'programming', 'implementing', 'developing'],
    },
    debugging: {
      apps: ['code', 'cursor', 'chrome devtools'],
      keywords: ['debug', 'error', 'fix', 'bug', 'exception', 'stack trace', 'breakpoint'],
    },
    research: {
      apps: ['chrome', 'edge', 'firefox', 'brave'],
      keywords: ['search', 'research', 'documentation', 'reading', 'browsing', 'stackoverflow'],
    },
    meeting: {
      apps: ['zoom', 'teams', 'meet', 'webex', 'skype', 'slack'],
      keywords: ['meeting', 'call', 'standup', 'sync', 'discuss'],
    },
    writing: {
      apps: ['word', 'docs', 'notion', 'obsidian', 'typora'],
      keywords: ['writing', 'documenting', 'blog', 'notes', 'documentation'],
    },
    reviewing: {
      apps: ['github', 'gitlab', 'bitbucket'],
      keywords: ['review', 'pr', 'pull request', 'merge request', 'code review'],
    },
    testing: {
      apps: ['postman', 'insomnia'],
      keywords: ['test', 'testing', 'spec', 'coverage', 'jest', 'mocha'],
    },
    deploying: {
      apps: ['terminal', 'powershell', 'cmd'],
      keywords: ['deploy', 'release', 'build', 'ci', 'cd', 'pipeline'],
    },
    designing: {
      apps: ['figma', 'sketch', 'photoshop', 'illustrator'],
      keywords: ['design', 'ui', 'ux', 'mockup', 'wireframe'],
    },
    learning: {
      apps: ['chrome', 'edge', 'firefox'],
      keywords: ['learn', 'tutorial', 'course', 'documentation', 'guide'],
    },
  };

  constructor(
    private db: Database,
    private ollama: OllamaClient
  ) {}

  async detect(eventType: string, payload: Record<string, unknown>): Promise<IntentResult> {
    const appName = ((payload.appName || payload.app || '') as string).toLowerCase();
    const windowTitle = ((payload.windowTitle || payload.title || '') as string).toLowerCase();
    const combined = `${appName} ${windowTitle}`;

    for (const [intent, patterns] of Object.entries(this.INTENT_PATTERNS)) {
      const appMatch = patterns.apps.some(a => combined.includes(a));
      const keywordMatch = patterns.keywords.some(k => combined.includes(k));

      if (appMatch || keywordMatch) {
        return {
          type: intent,
          context: this.buildContext(payload),
          summary: this.buildSummary(intent, appName, windowTitle),
          concepts: this.extractConcepts(windowTitle),
          confidence: appMatch ? 0.8 : 0.6,
        };
      }
    }

    return {
      type: 'other',
      context: this.buildContext(payload),
      summary: `Working with ${appName}`,
      concepts: [],
      confidence: 0.3,
    };
  }

  private buildContext(payload: Record<string, unknown>): string {
    const parts: string[] = [];
    if (payload.appName) parts.push(`App: ${payload.appName}`);
    if (payload.windowTitle) parts.push(`Title: ${payload.windowTitle}`);
    if (payload.url) parts.push(`URL: ${payload.url}`);
    return parts.join(' | ');
  }

  private buildSummary(intent: string, app: string, title: string): string {
    const summaries: Record<string, string> = {
      coding: `Coding in ${app}`,
      debugging: `Debugging in ${app}`,
      research: `Researching: ${title.substring(0, 50)}`,
      meeting: `Meeting in ${app}`,
      writing: `Writing in ${app}`,
      reviewing: `Reviewing code`,
      testing: `Testing in ${app}`,
      deploying: `Deploying via ${app}`,
      designing: `Designing in ${app}`,
      learning: `Learning: ${title.substring(0, 50)}`,
    };

    return summaries[intent] || `Working with ${app}`;
  }

  private extractConcepts(title: string): string[] {
    const concepts: string[] = [];

    const techPatterns = [
      /react/i, /vue/i, /angular/i, /node/i, /python/i, /rust/i, /go/i,
      /typescript/i, /javascript/i, /docker/i, /kubernetes/i, /aws/i,
      /sql/i, /mongodb/i, /redis/i, /graphql/i, /rest/i, /api/i,
    ];

    for (const pattern of techPatterns) {
      const match = title.match(pattern);
      if (match) {
        concepts.push(match[0].charAt(0).toUpperCase() + match[0].slice(1));
      }
    }

    return [...new Set(concepts)];
  }
}
