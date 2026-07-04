import { app, JumpListCategory, Notification, nativeImage } from 'electron';
import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

export class WindowsIntegration {
  constructor(private db: Database) {}

  setupJumpList(): void {
    try {
      const jumpList: JumpListCategory[] = [
        {
          type: 'custom',
          name: 'Recent Searches',
          items: this.getRecentSearches().map(search => ({
            type: 'task',
            title: search,
            program: process.execPath,
            args: `--search "${search}"`,
            iconPath: process.execPath,
            iconIndex: 0,
          })),
        },
        {
          type: 'custom',
          name: 'Quick Actions',
          items: [
            {
              type: 'task',
              title: 'Today\'s Timeline',
              program: process.execPath,
              args: '--page timeline',
              iconPath: process.execPath,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: 'Resume Last Session',
              program: process.execPath,
              args: '--action resume-session',
              iconPath: process.execPath,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: 'New Bookmark',
              program: process.execPath,
              args: '--action new-bookmark',
              iconPath: process.execPath,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: 'Start Focus Mode',
              program: process.execPath,
              args: '--action focus-mode',
              iconPath: process.execPath,
              iconIndex: 0,
            },
          ],
        },
        {
          type: 'recent',
        },
      ];

      app.setJumpList(jumpList);
      log.info('Jump list configured');
    } catch (err) {
      log.warn({ err }, 'Failed to set jump list');
    }
  }

  private getRecentSearches(): string[] {
    try {
      const searches = this.db.prepare(`
        SELECT DISTINCT query FROM nl_commands 
        WHERE query IS NOT NULL 
        ORDER BY created_at DESC LIMIT 5
      `).all() as Array<{ query: string }>;
      return searches.map(s => s.query);
    } catch {
      return ['React work', 'meetings today', 'git commits'];
    }
  }

  showActionableNotification(options: {
    title: string;
    body: string;
    actions?: Array<{ text: string; id: string }>;
    onAction?: (id: string) => void;
  }): void {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        actions: options.actions?.map(a => ({ type: 'button' as const, text: a.text })) || [],
        closeButtonText: 'Dismiss',
      });

      if (options.actions && options.onAction) {
        notification.on('action', (_event, index) => {
          const action = options.actions![index];
          if (action) {
            options.onAction!(action.id);
          }
        });
      }

      notification.show();
    } catch (err) {
      log.warn({ err }, 'Failed to show notification');
    }
  }

  showFocusComplete(sessionNumber: number): void {
    this.showActionableNotification({
      title: `Focus Session #${sessionNumber} Complete!`,
      body: 'Great work! Time for a break.',
      actions: [
        { text: 'Take Break', id: 'break' },
        { text: '+5 Minutes', id: 'extend' },
        { text: 'Skip', id: 'skip' },
      ],
      onAction: (id) => {
        log.info({ action: id }, 'Focus notification action');
      },
    });
  }

  showDistractionAlert(app: string): void {
    this.showActionableNotification({
      title: 'Getting Distracted?',
      body: `You've been on ${app} for a while. Back to work?`,
      actions: [
        { text: 'Enable Focus Mode', id: 'focus' },
        { text: 'I\'m Fine', id: 'dismiss' },
      ],
      onAction: (id) => {
        log.info({ action: id, app }, 'Distraction alert action');
      },
    });
  }

  showDailySummary(summary: string): void {
    this.showActionableNotification({
      title: 'Daily Summary Ready',
      body: summary.substring(0, 200),
      actions: [
        { text: 'View Full Report', id: 'view' },
        { text: 'Export', id: 'export' },
      ],
      onAction: (id) => {
        log.info({ action: id }, 'Daily summary action');
      },
    });
  }
}
