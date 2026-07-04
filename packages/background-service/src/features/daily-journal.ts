import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import fs from 'fs';
import path from 'path';

const log = getLogger();

interface JournalEntry {
  id: number;
  date: string;
  content: string;
  summary: string;
  highlights: string[];
  projects: string[];
  totalMinutes: number;
  focusScore: number;
  createdAt: string;
}

interface TimeBlock {
  startTime: string;
  endTime: string;
  app: string;
  project: string;
  activity: string;
  durationMinutes: number;
}

export class DailyJournal {
  private ollama: OllamaClient;
  private journalDir: string;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ollama = new OllamaClient();
    this.journalDir = path.join(process.env.APPDATA || '', 'RewindX', 'journals');
    this.ensureTables();
    this.ensureDirectory();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        summary TEXT,
        highlights TEXT DEFAULT '[]',
        projects TEXT DEFAULT '[]',
        total_minutes INTEGER DEFAULT 0,
        focus_score REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_journals_date ON daily_journals(date);
    `);
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.journalDir)) {
      fs.mkdirSync(this.journalDir, { recursive: true });
    }
  }

  async generateJournal(date?: string): Promise<JournalEntry | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const start = `${targetDate}T00:00:00.000Z`;
    const end = `${targetDate}T23:59:59.999Z`;

    try {
      const activities = this.db.prepare(`
        SELECT app_name, window_title, timestamp, duration_seconds
        FROM activities
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `).all(start, end) as Array<{ app_name: string; window_title: string; timestamp: string; duration_seconds: number }>;

      const screenshots = this.db.prepare(`
        SELECT ai_app, ai_task, ai_project, ai_description, ai_state, timestamp
        FROM screenshots
        WHERE timestamp BETWEEN ? AND ? AND ai_processed = 1
        ORDER BY timestamp ASC
      `).all(start, end) as Array<{ ai_app: string; ai_task: string; ai_project: string; ai_description: string; ai_state: string; timestamp: string }>;

      const commits = this.db.prepare(`
        SELECT repo_path, branch, commit_message, timestamp
        FROM git_events
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `).all(start, end) as Array<{ repo_path: string; branch: string; commit_message: string; timestamp: string }>;

      const sessions = this.db.prepare(`
        SELECT app_name, start_time, end_time, task_type, summary
        FROM sessions
        WHERE start_time BETWEEN ? AND ?
        ORDER BY start_time ASC
      `).all(start, end) as Array<{ app_name: string; start_time: string; end_time: string; task_type: string; summary: string }>;

      if (activities.length === 0 && screenshots.length === 0) {
        log.info({ date: targetDate }, 'No activity for journal');
        return null;
      }

      const timeBlocks = this.buildTimeBlocks(activities, screenshots);
      const projects = this.extractProjects(screenshots, commits);
      const totalMinutes = Math.round(activities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0) / 60);

      const context = this.buildContext(timeBlocks, screenshots, commits, sessions);
      const journalContent = await this.generateContent(targetDate, context);

      const highlights = this.extractHighlights(screenshots, commits);
      const focusScore = this.calculateFocusScore(timeBlocks);

      const existing = this.db.prepare('SELECT id FROM daily_journals WHERE date = ?').get(targetDate) as { id: number } | undefined;

      let journalId: number;
      if (existing) {
        this.db.prepare(`
          UPDATE daily_journals SET content = ?, summary = ?, highlights = ?, projects = ?, total_minutes = ?, focus_score = ?
          WHERE date = ?
        `).run(journalContent.content, journalContent.summary, JSON.stringify(highlights), JSON.stringify(projects), totalMinutes, focusScore, targetDate);
        journalId = existing.id;
      } else {
        const result = this.db.prepare(`
          INSERT INTO daily_journals (date, content, summary, highlights, projects, total_minutes, focus_score)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(targetDate, journalContent.content, journalContent.summary, JSON.stringify(highlights), JSON.stringify(projects), totalMinutes, focusScore);
        journalId = result.lastInsertRowid as number;
      }

      const journalPath = path.join(this.journalDir, `${targetDate}.md`);
      await fs.promises.writeFile(journalPath, journalContent.content, 'utf-8');

      this.bus.emit('JOURNAL_GENERATED', 'daily-journal', {
        date: targetDate,
        journalId,
        path: journalPath,
      });

      log.info({ date: targetDate, path: journalPath }, 'Daily journal generated');

      return {
        id: journalId,
        date: targetDate,
        content: journalContent.content,
        summary: journalContent.summary,
        highlights,
        projects,
        totalMinutes,
        focusScore,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      log.warn({ err, date: targetDate }, 'Failed to generate journal');
      return null;
    }
  }

  private buildTimeBlocks(activities: any[], screenshots: any[]): TimeBlock[] {
    const blocks: TimeBlock[] = [];
    let currentBlock: TimeBlock | null = null;

    for (const activity of activities) {
      const app = activity.app_name;
      const timestamp = new Date(activity.timestamp);

      if (!currentBlock || currentBlock.app !== app) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          startTime: activity.timestamp,
          endTime: activity.timestamp,
          app,
          project: '',
          activity: activity.window_title || '',
          durationMinutes: Math.round((activity.duration_seconds || 0) / 60),
        };
      } else {
        currentBlock.endTime = activity.timestamp;
        currentBlock.durationMinutes += Math.round((activity.duration_seconds || 0) / 60);
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    for (const screenshot of screenshots) {
      const block = blocks.find(b => {
        const blockTime = new Date(b.startTime).getTime();
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        return Math.abs(blockTime - screenshotTime) < 300000;
      });

      if (block && screenshot.ai_project) {
        block.project = screenshot.ai_project;
      }
    }

    return blocks;
  }

  private extractProjects(screenshots: any[], commits: any[]): string[] {
    const projects = new Set<string>();

    for (const s of screenshots) {
      if (s.ai_project) projects.add(s.ai_project);
    }

    for (const c of commits) {
      if (c.repo_path) {
        const projectName = c.repo_path.split(/[/\\]/).pop();
        if (projectName) projects.add(projectName);
      }
    }

    return Array.from(projects);
  }

  private extractHighlights(screenshots: any[], commits: any[]): string[] {
    const highlights: string[] = [];

    for (const c of commits) {
      if (c.commit_message) {
        highlights.push(`Git: ${c.commit_message}`);
      }
    }

    const uniqueTasks = new Set<string>();
    for (const s of screenshots) {
      if (s.ai_task && s.ai_state !== 'idle') {
        uniqueTasks.add(`${s.ai_app}: ${s.ai_task}`);
      }
    }

    for (const task of Array.from(uniqueTasks).slice(0, 5)) {
      highlights.push(task);
    }

    return highlights.slice(0, 10);
  }

  private calculateFocusScore(timeBlocks: TimeBlock[]): number {
    if (timeBlocks.length === 0) return 0;

    const totalMinutes = timeBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
    const longSessions = timeBlocks.filter(b => b.durationMinutes >= 25).length;
    const appSwitches = new Set(timeBlocks.map(b => b.app)).size;

    let score = 50;
    score += Math.min(longSessions * 5, 30);
    score -= Math.max(0, (appSwitches - 3) * 5);
    score += Math.min(totalMinutes / 10, 20);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildContext(timeBlocks: TimeBlock[], screenshots: any[], commits: any[], sessions: any[]): string {
    let context = 'Activity Timeline:\n';

    for (const block of timeBlocks) {
      const time = new Date(block.startTime).toLocaleTimeString();
      context += `- ${time}: ${block.app}`;
      if (block.project) context += ` (${block.project})`;
      context += ` - ${block.durationMinutes}min\n`;
    }

    if (commits.length > 0) {
      context += '\nGit Commits:\n';
      for (const c of commits) {
        context += `- ${c.commit_message} (${c.repo_path})\n`;
      }
    }

    const uniqueStates = new Set(screenshots.map(s => s.ai_state).filter(Boolean));
    if (uniqueStates.size > 0) {
      context += `\nWork Modes: ${Array.from(uniqueStates).join(', ')}\n`;
    }

    return context;
  }

  private async generateContent(date: string, context: string): Promise<{ content: string; summary: string }> {
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) {
        return this.generateBasicJournal(date, context);
      }

      const prompt = `Generate a daily work journal for ${date} based on this activity data:

${context}

Format as Markdown with:
1. **Summary** (2-3 sentences)
2. **Key Activities** (bullet points)
3. **Projects Worked On**
4. **Productivity Insights**

Be specific with times and app names. Keep it concise but informative.`;

      const content = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
      });

      const summaryMatch = content.match(/##?\s*Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
      const summary = summaryMatch ? summaryMatch[1].trim() : content.split('\n')[0];

      return { content, summary };
    } catch (err) {
      log.warn({ err }, 'AI journal generation failed, using basic template');
      return this.generateBasicJournal(date, context);
    }
  }

  private generateBasicJournal(date: string, context: string): { content: string; summary: string } {
    const lines = context.split('\n').filter(l => l.startsWith('-'));
    const apps = new Set<string>();
    const activities: string[] = [];

    for (const line of lines) {
      const match = line.match(/- \d+:\d+:\d+\s*(?:AM|PM)?: (.+)/);
      if (match) {
        const parts = match[1].split(' - ');
        apps.add(parts[0]);
        activities.push(line.substring(2));
      }
    }

    const summary = `Worked on ${apps.size} applications with ${activities.length} activities.`;
    const content = `# Daily Journal - ${date}

## Summary
${summary}

## Activities
${activities.map(a => `- ${a}`).join('\n')}

## Applications Used
${Array.from(apps).map(a => `- ${a}`).join('\n')}
`;

    return { content, summary };
  }

  async getJournal(date: string): Promise<JournalEntry | null> {
    const row = this.db.prepare('SELECT * FROM daily_journals WHERE date = ?').get(date) as any;
    if (!row) return null;

    return {
      ...row,
      highlights: JSON.parse(row.highlights || '[]'),
      projects: JSON.parse(row.projects || '[]'),
    };
  }

  async getRecentJournals(limit = 7): Promise<JournalEntry[]> {
    const rows = this.db.prepare('SELECT * FROM daily_journals ORDER BY date DESC LIMIT ?').all(limit) as any[];
    return rows.map(r => ({
      ...r,
      highlights: JSON.parse(r.highlights || '[]'),
      projects: JSON.parse(r.projects || '[]'),
    }));
  }

  async exportJournal(date: string, format: 'markdown' | 'json' = 'markdown'): Promise<string | null> {
    const journal = await this.getJournal(date);
    if (!journal) return null;

    if (format === 'json') {
      return JSON.stringify(journal, null, 2);
    }

    return journal.content;
  }
}
