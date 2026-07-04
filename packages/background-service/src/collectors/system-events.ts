import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import { powerMonitor } from 'electron';

const log = getLogger();

const SCREEN_LOCK_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class SessionDetector {
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool LockWorkStation();
    
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int nIndex);
    
    private const int SM_CLEANBOOT = 67;
    
    public static bool IsLocked() {
        try {
            IntPtr hwnd = GetForegroundWindow();
            return hwnd == IntPtr.Zero;
        } catch {
            return false;
        }
    }
}
"@

$lastState = "unlocked"
while ($true) {
    Start-Sleep -Seconds 2
    try {
        $isLocked = [SessionDetector]::IsLocked()
        $currentState = if ($isLocked) { "locked" } else { "unlocked" }
        
        if ($currentState -ne $lastState) {
            Write-Output "STATE:$currentState"
            $lastState = $currentState
        }
    } catch {}
}
`;

export class SystemEvents {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private screenLockInterval: ReturnType<typeof setInterval> | null = null;
  private lastLockState: 'locked' | 'unlocked' = 'unlocked';
  private lastCpuUsage = 0;
  private lastMemUsage = 0;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {}

  async start(): Promise<void> {
    this.registerPowerEvents();
    this.pollInterval = setInterval(() => this.pollResources(), 30_000);
    this.startScreenLockDetection();
    this.registerSleepResumeEvents();
    log.info('System events tracker started');
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.screenLockInterval) {
      clearInterval(this.screenLockInterval);
      this.screenLockInterval = null;
    }
  }

  private registerPowerEvents(): void {
    this.recordEvent('boot');
    process.on('SIGINT', () => this.recordEvent('shutdown'));
    process.on('SIGTERM', () => this.recordEvent('shutdown'));
  }

  private registerSleepResumeEvents(): void {
    try {
      if (typeof powerMonitor !== 'undefined') {
        powerMonitor.on('suspend', () => {
          log.info('System entering sleep mode');
          this.recordEvent('sleep');
        });

        powerMonitor.on('resume', () => {
          log.info('System resuming from sleep');
          this.recordEvent('resume');
        });

        powerMonitor.on('lock-screen', () => {
          log.info('Screen locked');
          this.onScreenLock();
        });

        powerMonitor.on('unlock-screen', () => {
          log.info('Screen unlocked');
          this.onScreenUnlock();
        });

        powerMonitor.on('on-battery', () => {
          this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
            type: 'battery',
            status: 'on-battery',
          });
        });

        powerMonitor.on('on-ac', () => {
          this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
            type: 'battery',
            status: 'on-ac',
          });
        });
      }
    } catch (err) {
      log.warn({ err }, 'Failed to register power events via powerMonitor');
    }
  }

  private startScreenLockDetection(): void {
    let scriptPath: string | null = null;

    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      scriptPath = path.join(os.tmpdir(), `awm-screenlock-${process.pid}.ps1`);
      fs.writeFileSync(scriptPath, SCREEN_LOCK_SCRIPT, 'utf-8');

      const { spawn } = require('child_process');
      const lockProcess = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      if (lockProcess.stdout) {
        lockProcess.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(l => l.trim());
          for (const line of lines) {
            if (line.startsWith('STATE:')) {
              const state = line.substring(6).trim() as 'locked' | 'unlocked';
              if (state === 'locked' && this.lastLockState === 'unlocked') {
                this.onScreenLock();
              } else if (state === 'unlocked' && this.lastLockState === 'locked') {
                this.onScreenUnlock();
              }
              this.lastLockState = state;
            }
          }
        });
      }

      lockProcess.on('error', (err: Error) => {
        log.warn({ err }, 'Screen lock detection process error');
      });

      log.info('Screen lock detection started');
    } catch (err) {
      log.warn({ err }, 'Failed to start screen lock detection');
    }
  }

  private onScreenLock(): void {
    this.lastLockState = 'locked';
    this.recordEvent('lock');
  }

  private onScreenUnlock(): void {
    this.lastLockState = 'unlocked';
    this.recordEvent('unlock');
  }

  private async pollResources(): Promise<void> {
    try {
      const os = await import('os');

      const cpuUsage = os.cpus().reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total);
      }, 0) / os.cpus().length;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ramUsage = ((totalMem - freeMem) / totalMem) * 100;

      const cpuPercent = Math.round(cpuUsage * 100);
      const ramPercent = Math.round(ramUsage);

      const cpuChanged = Math.abs(cpuPercent - this.lastCpuUsage) > 5;
      const ramChanged = Math.abs(ramPercent - this.lastMemUsage) > 5;

      if (cpuChanged || ramChanged) {
        this.lastCpuUsage = cpuPercent;
        this.lastMemUsage = ramPercent;

        this.bus.emit('SYSTEM_RESOURCE_UPDATE', 'system-events', {
          cpu: cpuPercent,
          ram: ramPercent,
          battery: null,
          network: true,
        });
      }
    } catch {
      // Resource polling failed
    }
  }

  private recordEvent(type: 'boot' | 'shutdown' | 'sleep' | 'resume' | 'lock' | 'unlock'): void {
    const timestamp = new Date().toISOString();

    try {
      const stmt = this.db.prepare(
        `INSERT INTO system_events (timestamp, event_type) VALUES (?, ?)`
      );
      stmt.run(timestamp, type);
    } catch (err) {
      log.warn({ err }, 'Failed to store system event');
    }

    const eventType = 'SYSTEM_' + type.toUpperCase() as 'SYSTEM_BOOT' | 'SYSTEM_SHUTDOWN' | 'SYSTEM_SLEEP' | 'SYSTEM_RESUME' | 'SYSTEM_LOCK' | 'SYSTEM_UNLOCK';
    this.bus.emit(eventType, 'system-events', { type });
  }
}
