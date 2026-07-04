import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import os from 'os';

const log = getLogger();

interface BatteryState {
  level: number;
  isCharging: boolean;
  timeRemaining: number | null;
  powerSource: 'battery' | 'ac' | 'unknown';
}

interface PowerProfile {
  name: string;
  screenshotIntervalMs: number;
  aiProcessingEnabled: boolean;
  collectIntervalMs: number;
  batchProcessing: boolean;
}

export class BatteryAwareness {
  private currentState: BatteryState = {
    level: 100,
    isCharging: true,
    timeRemaining: null,
    powerSource: 'ac',
  };

  private profiles: Record<string, PowerProfile> = {
    charging: {
      name: 'Full Performance',
      screenshotIntervalMs: 120000,
      aiProcessingEnabled: true,
      collectIntervalMs: 2000,
      batchProcessing: false,
    },
    battery_high: {
      name: 'Balanced',
      screenshotIntervalMs: 300000,
      aiProcessingEnabled: true,
      collectIntervalMs: 5000,
      batchProcessing: false,
    },
    battery_medium: {
      name: 'Power Saver',
      screenshotIntervalMs: 600000,
      aiProcessingEnabled: false,
      collectIntervalMs: 10000,
      batchProcessing: true,
    },
    battery_low: {
      name: 'Ultra Saver',
      screenshotIntervalMs: 0,
      aiProcessingEnabled: false,
      collectIntervalMs: 30000,
      batchProcessing: true,
    },
  };

  private currentProfile: PowerProfile;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.currentProfile = this.profiles.charging;
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS battery_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level INTEGER,
        is_charging INTEGER,
        power_source TEXT,
        profile_active TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_battery_time ON battery_events(timestamp);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('SYSTEM_RESOURCE_UPDATE', (event) => {
      const { battery } = event.payload as any;
      if (battery !== undefined && battery !== null) {
        this.updateBatteryState(battery);
      }
    });
  }

  async start(): Promise<void> {
    this.checkInterval = setInterval(() => {
      this.checkBattery();
    }, 60000);

    this.checkBattery();
    log.info('Battery awareness started');
  }

  private async checkBattery(): Promise<void> {
    try {
      const batteryInfo = await this.getBatteryInfo();
      if (batteryInfo) {
        this.updateBatteryState(batteryInfo.level);
      }
    } catch (err) {
      log.debug({ err }, 'Failed to check battery');
    }
  }

  private async getBatteryInfo(): Promise<{ level: number; isCharging: boolean } | null> {
    return new Promise((resolve) => {
      const { execFile } = require('child_process');
      execFile(
        'powershell.exe',
        ['-NoProfile', '-Command', `
          $battery = Get-WmiObject -Class Win32_Battery -ErrorAction SilentlyContinue
          if ($battery) {
            Write-Output "$($battery.EstimatedChargeRemaining)|$($battery.BatteryStatus -eq 2)"
          }
        `],
        { timeout: 5000, windowsHide: true },
        (err: any, stdout: string) => {
          if (err || !stdout.trim()) {
            resolve(null);
            return;
          }

          const parts = stdout.trim().split('|');
          if (parts.length >= 2) {
            resolve({
              level: parseInt(parts[0], 10) || 100,
              isCharging: parts[1] === 'True',
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private updateBatteryState(level: number): void {
    const wasCharging = this.currentState.isCharging;
    const previousLevel = this.currentState.level;

    this.currentState.level = level;
    this.currentState.isCharging = this.detectCharging();
    this.currentState.powerSource = this.currentState.isCharging ? 'ac' : 'battery';

    const profile = this.selectProfile();
    if (profile.name !== this.currentProfile.name) {
      this.currentProfile = profile;
      this.bus.emit('POWER_PROFILE_CHANGED', 'battery-awareness', {
        profile: profile.name,
        level,
        isCharging: this.currentState.isCharging,
      });
      log.info({ profile: profile.name, level }, 'Power profile changed');
    }

    if (wasCharging && !this.currentState.isCharging) {
      this.bus.emit('BATTERY_UNPLUGGED', 'battery-awareness', { level });
      this.recordEvent('unplugged', level);
    } else if (!wasCharging && this.currentState.isCharging) {
      this.bus.emit('BATTERY_PLUGGED', 'battery-awareness', { level });
      this.recordEvent('plugged', level);
    }

    if (level <= 20 && previousLevel > 20) {
      this.bus.emit('BATTERY_LOW', 'battery-awareness', { level });
      this.recordEvent('low', level);
    }

    if (level <= 10 && previousLevel > 10) {
      this.bus.emit('BATTERY_CRITICAL', 'battery-awareness', { level });
      this.recordEvent('critical', level);
    }
  }

  private detectCharging(): boolean {
    try {
      const cpus = os.cpus();
      return true;
    } catch {
      return this.currentState.isCharging;
    }
  }

  private selectProfile(): PowerProfile {
    if (this.currentState.isCharging) {
      return this.profiles.charging;
    }

    const level = this.currentState.level;
    if (level > 50) return this.profiles.battery_high;
    if (level > 20) return this.profiles.battery_medium;
    return this.profiles.battery_low;
  }

  private recordEvent(type: string, level: number): void {
    try {
      this.db.prepare(`
        INSERT INTO battery_events (timestamp, level, is_charging, power_source, profile_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        new Date().toISOString(),
        level,
        this.currentState.isCharging ? 1 : 0,
        this.currentState.powerSource,
        this.currentProfile.name
      );
    } catch (err) {
      log.warn({ err }, 'Failed to record battery event');
    }
  }

  getCurrentState(): BatteryState {
    return { ...this.currentState };
  }

  getCurrentProfile(): PowerProfile {
    return { ...this.currentProfile };
  }

  shouldCaptureScreenshots(): boolean {
    return this.currentProfile.screenshotIntervalMs > 0;
  }

  getScreenshotInterval(): number {
    return this.currentProfile.screenshotIntervalMs;
  }

  shouldBatchProcess(): boolean {
    return this.currentProfile.batchProcessing;
  }

  isAiEnabled(): boolean {
    return this.currentProfile.aiProcessingEnabled;
  }

  async getBatteryHistory(date?: string): Promise<Array<{
    timestamp: string;
    level: number;
    isCharging: boolean;
    profile: string;
  }>> {
    let query = 'SELECT timestamp, level, is_charging, profile_active FROM battery_events';
    const params: unknown[] = [];

    if (date) {
      query += ' WHERE date(timestamp) = ?';
      params.push(date);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    return this.db.prepare(query).all(...params).map((r: any) => ({
      timestamp: r.timestamp,
      level: r.level,
      isCharging: r.is_charging === 1,
      profile: r.profile_active,
    }));
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
