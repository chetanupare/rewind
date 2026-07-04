import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { Notification } from 'electron';

const log = getLogger();

interface NotificationRule {
  id: number;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered: string | null;
}

interface SmartNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export class SmartNotifications {
  private rules: NotificationRule[] = [];
  private notifications: SmartNotification[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private distractionStartTime: Date | null = null;
  private lastCommitTime: Date | null = null;
  private lastMeetingReminder: Date | null = null;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.loadRules();
    this.setupEventListeners();
    this.startChecking();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        condition_expr TEXT NOT NULL,
        action TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        cooldown_minutes INTEGER DEFAULT 30,
        last_triggered TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        priority TEXT DEFAULT 'medium',
        timestamp TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        action_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_time ON notifications(timestamp);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    `);
  }

  private loadRules(): void {
    try {
      this.rules = this.db.prepare('SELECT * FROM notification_rules WHERE enabled = 1').all() as NotificationRule[];
    } catch {
      this.rules = [];
    }
  }

  private setupEventListeners(): void {
    this.bus.on('CONTEXT_SWITCH', (event) => {
      const { reason, impact } = event.payload as any;

      if (impact === 'negative') {
        if (!this.distractionStartTime) {
          this.distractionStartTime = new Date();
        }

        const distractionMinutes = (Date.now() - this.distractionStartTime.getTime()) / 60000;
        if (distractionMinutes > 15) {
          this.sendNotification({
            type: 'distraction',
            title: 'Getting distracted?',
            message: "You've been switching between apps for 15 minutes. Want to enable Focus Mode?",
            priority: 'medium',
          });
          this.distractionStartTime = null;
        }
      } else {
        this.distractionStartTime = null;
      }
    });

    this.bus.on('GIT_COMMIT', (event) => {
      this.lastCommitTime = new Date();
    });

    this.bus.on('FOCUS_COMPLETED', (event) => {
      const { sessionNumber } = event.payload as any;
      this.sendNotification({
        type: 'focus',
        title: 'Focus Session Complete!',
        message: `Great work! Session #${sessionNumber} done. Time for a break.`,
        priority: 'high',
      });
    });

    this.bus.on('BREAK_ENDED', () => {
      this.sendNotification({
        type: 'focus',
        title: 'Break Over',
        message: 'Ready for another focus session?',
        priority: 'medium',
      });
    });

    this.bus.on('THRASHING_DETECTED', (event) => {
      const { message } = event.payload as any;
      this.sendNotification({
        type: 'productivity',
        title: 'Context Switching Alert',
        message: message || 'You seem to be switching contexts frequently.',
        priority: 'medium',
      });
    });
  }

  private startChecking(): void {
    this.checkInterval = setInterval(() => {
      this.checkDistraction();
      this.checkCommitReminder();
      this.checkDailySummary();
    }, 60000);
  }

  private checkDistraction(): void {
    if (!this.distractionStartTime) return;

    const minutes = (Date.now() - this.distractionStartTime.getTime()) / 60000;
    if (minutes > 30) {
      this.sendNotification({
        type: 'distraction',
        title: 'Extended Distraction',
        message: "You've been distracted for 30+ minutes. Consider taking a short walk or enabling Focus Mode.",
        priority: 'high',
      });
      this.distractionStartTime = null;
    }
  }

  private checkCommitReminder(): void {
    if (!this.lastCommitTime) return;

    const hours = (Date.now() - this.lastCommitTime.getTime()) / 3600000;
    if (hours > 2) {
      const now = new Date();
      const lastNotif = this.notifications.find(n => n.type === 'commit_reminder');
      if (!lastNotif || (now.getTime() - new Date(lastNotif.timestamp).getTime()) > 3600000) {
        this.sendNotification({
          type: 'commit_reminder',
          title: 'Time to commit?',
          message: "You haven't committed code in 2+ hours. Consider saving your work.",
          priority: 'low',
        });
      }
    }
  }

  private checkDailySummary(): void {
    const now = new Date();
    if (now.getHours() === 17 && now.getMinutes() === 0) {
      this.sendNotification({
        type: 'daily_summary',
        title: 'Daily Summary Ready',
        message: 'Your daily work journal has been generated. Click to view.',
        priority: 'medium',
        actionUrl: '/journal',
      });
    }
  }

  sendNotification(data: Omit<SmartNotification, 'id' | 'timestamp' | 'read'>): void {
    try {
      const notification: SmartNotification = {
        id: 0,
        ...data,
        timestamp: new Date().toISOString(),
        read: false,
      };

      const result = this.db.prepare(`
        INSERT INTO notifications (type, title, message, priority, timestamp, action_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        notification.type,
        notification.title,
        notification.message,
        notification.priority,
        notification.timestamp,
        notification.actionUrl || null
      );

      notification.id = result.lastInsertRowid as number;
      this.notifications.push(notification);

      this.showSystemNotification(notification);

      this.bus.emit('NOTIFICATION_SENT', 'smart-notifications', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
      });

      log.debug({ type: notification.type, title: notification.title }, 'Notification sent');
    } catch (err) {
      log.warn({ err }, 'Failed to send notification');
    }
  }

  private showSystemNotification(notification: SmartNotification): void {
    try {
      new Notification({
        title: notification.title,
        body: notification.message,
      }).show();
    } catch (err) {
      log.debug({ err }, 'Failed to show system notification');
    }
  }

  async getNotifications(unreadOnly = false, limit = 50): Promise<SmartNotification[]> {
    let query = 'SELECT * FROM notifications';
    if (unreadOnly) query += ' WHERE read = 0';
    query += ' ORDER BY timestamp DESC LIMIT ?';

    return this.db.prepare(query).all(limit) as SmartNotification[];
  }

  async markAsRead(id: number): Promise<void> {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  }

  async markAllAsRead(): Promise<void> {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  }

  async getUnreadCount(): Promise<number> {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0').get() as { count: number };
    return result.count;
  }

  async addRule(rule: Omit<NotificationRule, 'id' | 'lastTriggered'>): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO notification_rules (name, condition_expr, action, enabled, cooldown_minutes)
      VALUES (?, ?, ?, ?, ?)
    `).run(rule.name, rule.condition, rule.action, rule.enabled ? 1 : 0, rule.cooldownMinutes);

    this.loadRules();
    return result.lastInsertRowid as number;
  }

  async removeRule(id: number): Promise<void> {
    this.db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id);
    this.loadRules();
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
