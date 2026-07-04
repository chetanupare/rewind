import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Meeting {
  id: number;
  startTime: string;
  endTime: string | null;
  title: string;
  platform: string;
  participants: string[];
  summary: string | null;
  actionItems: string[];
  transcript: string | null;
  screenshotIds: number[];
}

export class MeetingIntelligence {
  private ollama: OllamaClient;
  private currentMeeting: Meeting | null = null;
  private meetingApps = ['zoom', 'teams', 'meet', 'webex', 'skype', 'discord', 'slack'];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ollama = new OllamaClient();
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        title TEXT,
        platform TEXT,
        participants TEXT DEFAULT '[]',
        summary TEXT,
        action_items TEXT DEFAULT '[]',
        transcript TEXT,
        screenshot_ids TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS meeting_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'auto',
        FOREIGN KEY (meeting_id) REFERENCES meetings(id)
      );

      CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(start_time);
      CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes(meeting_id);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.detectMeeting(appName, windowTitle);
    });

    this.bus.on('SCREENSHOT_CAPTURED', (event) => {
      if (this.currentMeeting) {
        const { screenshotId } = event.payload as any;
        this.currentMeeting.screenshotIds.push(screenshotId);
      }
    });
  }

  private detectMeeting(appName: string, windowTitle: string): void {
    const lower = (appName + ' ' + windowTitle).toLowerCase();
    const isMeetingApp = this.meetingApps.some(app => lower.includes(app));

    if (!isMeetingApp) {
      if (this.currentMeeting) {
        this.endMeeting();
      }
      return;
    }

    const isInMeeting = this.detectInMeeting(windowTitle);
    
    if (isInMeeting && !this.currentMeeting) {
      this.startMeeting(appName, windowTitle);
    } else if (!isInMeeting && this.currentMeeting) {
      this.endMeeting();
    }
  }

  private detectInMeeting(windowTitle: string): boolean {
    const inMeetingPatterns = [
      /meeting/i,
      /call/i,
      /in progress/i,
      /live/i,
      /connected/i,
      /\d+:\d+/,
      /recording/i,
    ];

    const notInMeetingPatterns = [
      /sign in/i,
      /log in/i,
      /home/i,
      /schedule/i,
      /calendar/i,
    ];

    if (notInMeetingPatterns.some(p => p.test(windowTitle))) return false;
    return inMeetingPatterns.some(p => p.test(windowTitle));
  }

  private startMeeting(appName: string, windowTitle: string): void {
    const platform = this.detectPlatform(appName);
    const title = this.extractMeetingTitle(windowTitle) || `${platform} Meeting`;

    this.currentMeeting = {
      id: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      title,
      platform,
      participants: [],
      summary: null,
      actionItems: [],
      transcript: null,
      screenshotIds: [],
    };

    this.bus.emit('MEETING_STARTED', 'meeting-intelligence', {
      title,
      platform,
    });

    log.info({ title, platform }, 'Meeting detected');
  }

  private endMeeting(): void {
    if (!this.currentMeeting) return;

    this.currentMeeting.endTime = new Date().toISOString();

    const result = this.db.prepare(`
      INSERT INTO meetings (start_time, end_time, title, platform, participants, summary, action_items, screenshot_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.currentMeeting.startTime,
      this.currentMeeting.endTime,
      this.currentMeeting.title,
      this.currentMeeting.platform,
      JSON.stringify(this.currentMeeting.participants),
      this.currentMeeting.summary,
      JSON.stringify(this.currentMeeting.actionItems),
      JSON.stringify(this.currentMeeting.screenshotIds)
    );

    this.currentMeeting.id = result.lastInsertRowid as number;

    this.bus.emit('MEETING_ENDED', 'meeting-intelligence', {
      meetingId: this.currentMeeting.id,
      title: this.currentMeeting.title,
      platform: this.currentMeeting.platform,
      duration: Math.round(
        (new Date(this.currentMeeting.endTime).getTime() - new Date(this.currentMeeting.startTime).getTime()) / 1000 / 60
      ),
    });

    this.generateMeetingNotes(this.currentMeeting);

    log.info({ meetingId: this.currentMeeting.id }, 'Meeting ended');
    this.currentMeeting = null;
  }

  private detectPlatform(appName: string): string {
    const lower = appName.toLowerCase();
    if (lower.includes('zoom')) return 'Zoom';
    if (lower.includes('teams')) return 'Microsoft Teams';
    if (lower.includes('meet')) return 'Google Meet';
    if (lower.includes('webex')) return 'Webex';
    if (lower.includes('skype')) return 'Skype';
    if (lower.includes('discord')) return 'Discord';
    if (lower.includes('slack')) return 'Slack';
    return 'Unknown';
  }

  private extractMeetingTitle(windowTitle: string): string {
    const patterns = [
      /(?:Meeting|Call|Session)\s*[-–:]\s*(.+)/i,
      /(.+?)\s*[-–]\s*(?:Meeting|Call)/i,
      /\[(.+?)\]/,
    ];

    for (const pattern of patterns) {
      const match = windowTitle.match(pattern);
      if (match) return match[1].trim();
    }

    return windowTitle.substring(0, 50);
  }

  private async generateMeetingNotes(meeting: Meeting): Promise<void> {
    try {
      const duration = meeting.endTime
        ? Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / 1000 / 60)
        : 0;

      const context = `
Meeting: ${meeting.title}
Platform: ${meeting.platform}
Duration: ${duration} minutes
Time: ${new Date(meeting.startTime).toLocaleString()}
Screenshots captured: ${meeting.screenshotIds.length}
`;

      const prompt = `Based on the following meeting information, generate concise meeting notes:

${context}

Generate:
1. A brief summary (2-3 sentences)
2. Key discussion points (if inferrable)
3. Potential action items

Format as JSON: {"summary": "...", "discussionPoints": [...], "actionItems": [...]}`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
        format: 'json',
      });

      try {
        const parsed = JSON.parse(response);
        this.db.prepare('UPDATE meetings SET summary = ?, action_items = ? WHERE id = ?')
          .run(parsed.summary, JSON.stringify(parsed.actionItems || []), meeting.id);

        this.db.prepare('INSERT INTO meeting_notes (meeting_id, timestamp, content, type) VALUES (?, ?, ?, ?)')
          .run(meeting.id, new Date().toISOString(), parsed.summary, 'auto_summary');
      } catch {}
    } catch (err) {
      log.warn({ err }, 'Failed to generate meeting notes');
    }
  }

  async getMeetings(date?: string): Promise<Meeting[]> {
    let query = 'SELECT * FROM meetings';
    const params: unknown[] = [];

    if (date) {
      query += ' WHERE date(start_time) = ?';
      params.push(date);
    }

    query += ' ORDER BY start_time DESC LIMIT 50';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      ...r,
      participants: JSON.parse(r.participants || '[]'),
      actionItems: JSON.parse(r.action_items || '[]'),
      screenshotIds: JSON.parse(r.screenshot_ids || '[]'),
    }));
  }

  async addNote(meetingId: number, content: string): Promise<void> {
    this.db.prepare('INSERT INTO meeting_notes (meeting_id, timestamp, content, type) VALUES (?, ?, ?, ?)')
      .run(meetingId, new Date().toISOString(), content, 'manual');
  }

  async getNotes(meetingId: number): Promise<any[]> {
    return this.db.prepare('SELECT * FROM meeting_notes WHERE meeting_id = ? ORDER BY timestamp ASC')
      .all(meetingId);
  }

  isMeetingActive(): boolean {
    return this.currentMeeting !== null;
  }
}
