import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import type { EventPayload } from '@ai-work-memory/shared';

const log = getLogger();

export class ThrashingDetector {
  private windowHistory: Array<{ app: string; timestamp: number }> = [];
  private lastAlertTime = 0;
  private distractionStartTime: number | null = null;
  private distractionInterval: NodeJS.Timeout | null = null;
  private lastDistractionAlert = 0;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {}

  async start(): Promise<void> {
    this.bus.on('WINDOW_CHANGED', this.handleWindowChange.bind(this));
    this.distractionInterval = setInterval(() => this.checkDistraction(), 60_000);
    log.info('Thrashing Detector started');
  }

  async stop(): Promise<void> {
    this.bus.removeAllListeners('WINDOW_CHANGED');
    if (this.distractionInterval) clearInterval(this.distractionInterval);
  }

  private handleWindowChange(event: EventPayload): void {
    const data = event.payload;
    const appName = ((data.appName as string) || '').toLowerCase();
    
    const isDevApp = appName.includes('code') || appName.includes('cursor') || appName.includes('terminal');
    const isResearchApp = appName.includes('chrome') || appName.includes('edge') || appName.includes('firefox');
    
    // Distraction detection
    const isDistraction = ['twitter', 'x', 'facebook', 'instagram', 'reddit', 'tiktok', 'youtube'].some(d => appName.includes(d) || (data.title as string || '').toLowerCase().includes(d));

    if (isDistraction) {
      if (!this.distractionStartTime) {
        this.distractionStartTime = Date.now();
      }
    } else {
      this.distractionStartTime = null;
    }

    if (isDevApp || isResearchApp) {
      this.windowHistory.push({ app: isDevApp ? 'dev' : 'research', timestamp: Date.now() });
      
      // Keep only last 5 minutes
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      this.windowHistory = this.windowHistory.filter(h => h.timestamp > fiveMinsAgo);
      
      this.checkThrashing();
    }
  }

  private checkThrashing(): void {
    // Prevent spamming alerts (cooldown 30 mins)
    if (Date.now() - this.lastAlertTime < 30 * 60 * 1000) return;

    // Count transitions between dev and research
    let transitions = 0;
    for (let i = 1; i < this.windowHistory.length; i++) {
      if (this.windowHistory[i].app !== this.windowHistory[i - 1].app) {
        transitions++;
      }
    }

    // If more than 6 transitions in 5 minutes, user is probably stuck/thrashing
    if (transitions >= 6) {
      log.info('Thrashing detected! Triggering intervention.');
      this.lastAlertTime = Date.now();
      
      // Emit an event that the Electron main process can pick up to show a notification
      this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
        action: 'THRASHING_DETECTED',
        message: "Looks like you're bouncing between your IDE and browser a lot. Need AI assistance on this bug?"
      });
    }
  }

  private checkDistraction(): void {
    if (!this.distractionStartTime) return;
    
    // 30 min cooldown
    if (Date.now() - this.lastDistractionAlert < 30 * 60 * 1000) return;

    // 10 minute threshold
    if (Date.now() - this.distractionStartTime >= 10 * 60 * 1000) {
      log.info('Distraction threshold reached, sending nudge');
      this.lastDistractionAlert = Date.now();
      
      this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
        action: 'DISTRACTION_NUDGE',
        message: "You've been on a distraction app for a while. Need help getting back to focus?"
      });
    }
  }
}
