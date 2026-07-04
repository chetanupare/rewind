import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Meeting {
  id: number;
  startTime: string;
  endTime: string | null;
  platform: string;
  title: string;
  participants: string[];
  summary: string | null;
  actionItems: string[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  durationMinutes: number;
}

interface MeetingDetection {
  app: string;
  title: string;
  isInMeeting: boolean;
  confidence: number;
}

export class MeetingIntelligence {
  private ollama: OllamaClient;
  private currentMeeting: Meeting | null = null;
  private meetingStartTime: Date | null = null;
  private readonly MEETING_APPS = [
    'zoom', 'teams', 'meet', 'webex', 'skype', 'discord',
    'slack', 'gotomeeting', 'bluejeans', 'ringcentral',
  ];

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
      CREATE TABLE IF NOT EXISTS meetings_detected (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        platform TEXT NOT NULL,
        title TEXT,
        participants TEXT DEFAULT '[]',
        summary TEXT,
        action_items TEXT DEFAULT '[]',
        topics TEXT DEFAULT '[]',
        sentiment TEXT DEFAULT 'neutral',
        duration_minutes INTEGER DEFAULT 0,
        screenshot_ids TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS meeting_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'auto',
        FOREIGN KEY (meeting_id) REFERENCES meetings_detected(id)
      );

      CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings_detected(start_time);
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
        this.recordMeetingScreenshot(screenshotId);
      }
    });
  }

  private detectMeeting(appName: string, windowTitle: string): void {
    const detection = this.analyzeForMeeting(appName, windowTitle);

    if (detection.isInMeeting && detection.confidence > 0.7) {
      if (!this.currentMeeting) {
        this.startMeeting(detection);
      }
    } else {
      if (this.currentMeeting) {
        this.endMeeting();
      }
    }
  }

  private analyzeForMeeting(appName: string, windowTitle: string): MeetingDetection {
    const combined = `${appName} ${windowTitle}`.toLowerCase();

    let detectedApp = 'unknown';
    let confidence = 0;

    for (const app of this.MEETING_APPS) {
      if (combined.includes(app)) {
        detectedApp = app;
        confidence = 0.8;
        break;
      }
    }

    const meetingIndicators = [
      { pattern: /meeting/i, weight: 0.2 },
      { pattern: /call/i, weight: 0.15 },
      { pattern: /\d+:\d+/, weight: 0.1 },
      { pattern: /in progress/i, weight: 0.2 },
      { pattern: /live/i, weight: 0.15 },
      { pattern: /connected/i, weight: 0.1 },
      { pattern: /recording/i, weight: 0.2 },
      { pattern: /participants/i, weight: 0.15 },
      { pattern: /mute|unmute/i, weight: 0.2 },
      { pattern: /screen share/i, weight: 0.2 },
    ];

    for (const indicator of meetingIndicators) {
      if (indicator.pattern.test(windowTitle)) {
        confidence += indicator.weight;
      }
    }

    const notMeetingIndicators = [
      { pattern: /sign in/i, weight: -0.5 },
      { pattern: /log in/i, weight: -0.5 },
      { pattern: /home/i, weight: -0.3 },
      { pattern: /schedule/i, weight: -0.2 },
      { pattern: /calendar/i, weight: -0.2 },
      { pattern: /settings/i, weight: -0.3 },
    ];

    for (const indicator of notMeetingIndicators) {
      if (indicator.pattern.test(windowTitle)) {
        confidence += indicator.weight;
      }
    }

    return {
      app: detectedApp,
      title: windowTitle,
      isInMeeting: confidence > 0.5,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  private startMeeting(detection: MeetingDetection): void {
    const now = new Date();

    this.currentMeeting = {
      id: 0,
      startTime: now.toISOString(),
      endTime: null,
      platform: detection.app,
      title: this.extractMeetingTitle(detection.title),
      participants: [],
      summary: null,
      actionItems: [],
      topics: [],
      sentiment: 'neutral',
      durationMinutes: 0,
    };

    this.meetingStartTime = now;

    this.bus.emit('MEETING_STARTED', 'meeting-intelligence', {
      platform: detection.app,
      title: this.currentMeeting.title,
    });

    log.info({ platform: detection.app, title: this.currentMeeting.title }, 'Meeting detected');
  }

  private async endMeeting(): Promise<void> {
    if (!this.currentMeeting || !this.meetingStartTime) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.meetingStartTime.getTime()) / 60000);

    this.currentMeeting.endTime = endTime.toISOString();
    this.currentMeeting.durationMinutes = durationMinutes;

    if (durationMinutes >= 1) {
      await this.generateMeetingSummary();

      const result = this.db.prepare(`
        INSERT INTO meetings_detected (start_time, end_time, platform, title, participants, summary, action_items, topics, sentiment, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.currentMeeting.startTime,
        this.currentMeeting.endTime,
        this.currentMeeting.platform,
        this.currentMeeting.title,
        JSON.stringify(this.currentMeeting.participants),
        this.currentMeeting.summary,
        JSON.stringify(this.currentMeeting.actionItems),
        JSON.stringify(this.currentMeeting.topics),
        this.currentMeeting.sentiment,
        durationMinutes
      );

      this.currentMeeting.id = result.lastInsertRowid as number;

      this.bus.emit('MEETING_ENDED', 'meeting-intelligence', {
        meetingId: this.currentMeeting.id,
        platform: this.currentMeeting.platform,
        title: this.currentMeeting.title,
        durationMinutes,
        summary: this.currentMeeting.summary,
      });

      log.info({
        meetingId: this.currentMeeting.id,
        duration: durationMinutes,
        platform: this.currentMeeting.platform,
      }, 'Meeting ended');
    }

    this.currentMeeting = null;
    this.meetingStartTime = null;
  }

  private extractMeetingTitle(windowTitle: string): string {
    const patterns = [
      /(?:Meeting|Call|Session)\s*[-–:]\s*(.+)/i,
      /(.+?)\s*[-–]\s*(?:Meeting|Call)/i,
      /\[(.+?)\]/,
      /(.+?)\s*\|/,
    ];

    for (const pattern of patterns) {
      const match = windowTitle.match(pattern);
      if (match) return match[1].trim();
    }

    return windowTitle.substring(0, 50);
  }

  private async generateMeetingSummary(): Promise<void> {
    if (!this.currentMeeting) return;

    try {
      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) return;

      const prompt = `Generate a brief meeting summary for a ${this.currentMeeting.durationMinutes} minute ${this.currentMeeting.platform} meeting titled "${this.currentMeeting.title}".

Provide JSON:
{
  "summary": "Brief 2-3 sentence summary",
  "topics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "sentiment": "positive|neutral|negative"
}`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
        format: 'json',
      });

      try {
        const parsed = JSON.parse(response);
        this.currentMeeting.summary = parsed.summary;
        this.currentMeeting.topics = parsed.topics || [];
        this.currentMeeting.actionItems = parsed.actionItems || [];
        this.currentMeeting.sentiment = parsed.sentiment || 'neutral';
      } catch {
        this.currentMeeting.summary = `${this.currentMeeting.platform} meeting lasting ${this.currentMeeting.durationMinutes} minutes`;
      }
    } catch (err) {
      log.debug({ err }, 'Failed to generate meeting summary');
    }
  }

  private recordMeetingScreenshot(screenshotId: number): void {
    if (!this.currentMeeting) return;

    try {
      this.db.prepare(`
        UPDATE meetings_detected SET screenshot_ids = json_insert(screenshot_ids, '$', ?)
        WHERE id = ?
      `).run(screenshotId, this.currentMeeting.id || 0);
    } catch {}
  }

  async getMeetings(date?: string): Promise<Meeting[]> {
    let query = 'SELECT * FROM meetings_detected';
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
      topics: JSON.parse(r.topics || '[]'),
      screenshotIds: JSON.parse(r.screenshot_ids || '[]'),
    }));
  }

  async getMeetingStats(date: string): Promise<{
    totalMeetings: number;
    totalMinutes: number;
    averageDuration: number;
    topPlatforms: Array<{ platform: string; count: number }>;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const meetings = this.db.prepare(`
      SELECT platform, duration_minutes FROM meetings_detected
      WHERE start_time BETWEEN ? AND ?
    `).all(start, end) as Array<{ platform: string; duration_minutes: number }>;

    const totalMeetings = meetings.length;
    const totalMinutes = meetings.reduce((sum, m) => sum + m.duration_minutes, 0);
    const averageDuration = totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0;

    const platformCounts: Record<string, number> = {};
    for (const m of meetings) {
      platformCounts[m.platform] = (platformCounts[m.platform] || 0) + 1;
    }

    const topPlatforms = Object.entries(platformCounts)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalMeetings,
      totalMinutes,
      averageDuration,
      topPlatforms,
    };
  }

  isMeetingActive(): boolean {
    return this.currentMeeting !== null;
  }

  getCurrentMeeting(): Meeting | null {
    return this.currentMeeting;
  }
}
