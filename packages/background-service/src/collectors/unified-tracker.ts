import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

const PS_SCRIPT = `
$lastTitle = ""
while ($true) {
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
        $hwnd = [WinAPI]::GetForegroundWindow()
        $sb = New-Object System.Text.StringBuilder 512
        [WinAPI]::GetWindowText($hwnd, $sb, 512) | Out-Null
        $title = $sb.ToString()
        
        $procId = 0
        [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
        
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "Unknown" }
        
        if ($title -ne $lastTitle -and $title.Length -gt 0) {
            $lastTitle = $title
            Write-Output "$procId|$name|$title"
        }
    } catch {}
    Start-Sleep -Milliseconds 500
}
`;

export class UnifiedTracker {
  private psProcess: ChildProcess | null = null;
  private scriptPath: string;
  private lastAppName: string = '';
  private lastTitle: string = '';
  private lastChangeTime: Date = new Date();
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private keystrokeCount = 0;
  private lastActivityTime = Date.now();

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-unified-${process.pid}.ps1`);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, PS_SCRIPT, 'utf-8');

      this.psProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath,
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (this.psProcess.stdout) {
        this.psProcess.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(l => l.trim());
          for (const line of lines) {
            this.processOutput(line.trim());
          }
        });
      }

      this.psProcess.on('error', (err) => {
        log.warn({ err }, 'Unified tracker error');
      });

      this.psProcess.on('exit', (code) => {
        log.warn({ code }, 'Unified tracker exited, restarting...');
        setTimeout(() => this.start(), 2000);
      });

      // Batch emit keystrokes
      this.batchInterval = setInterval(() => {
        if (this.keystrokeCount > 0) {
          this.bus.emit('KEYSTROKE_BATCH', 'keyboard-tracker', {
            keystrokeCount: this.keystrokeCount,
            shortcuts: [],
            typingSpeed: this.keystrokeCount * 12,
            idleDurationMs: Date.now() - this.lastActivityTime,
          });
          this.keystrokeCount = 0;
        }
      }, 5000);

      log.info('Unified tracker started');
    } catch (err) {
      log.warn({ err }, 'Failed to start unified tracker');
    }
  }

  private processOutput(line: string): void {
    try {
      const parts = line.split('|');
      if (parts.length < 3) return;

      const [pidStr, name, title] = parts;
      const pid = parseInt(pidStr, 10) || 0;

      if (!name || !title) return;
      if (name === this.lastAppName && title === this.lastTitle) return;

      const now = new Date();
      const durationMs = now.getTime() - this.lastChangeTime.getTime();
      const durationSeconds = Math.round(durationMs / 1000);

      if (this.lastAppName && durationSeconds > 1) {
        this.recordWindowDuration(this.lastAppName, this.lastTitle, durationSeconds);
      }

      this.bus.emit('WINDOW_CHANGED', 'window-tracker', {
        appName: name,
        executable: 'unknown.exe',
        pid,
        windowTitle: title,
        windowBounds: { x: 0, y: 0, width: 0, height: 0 },
      });

      this.storeActivity({
        timestamp: now.toISOString(),
        appName: name,
        appExecutable: 'unknown.exe',
        windowTitle: title,
        durationSeconds,
      });

      this.lastAppName = name;
      this.lastTitle = title;
      this.lastChangeTime = now;
      this.lastActivityTime = now.getTime();
    } catch (err) {
      // Silently handle parse errors
    }
  }

  private recordWindowDuration(appName: string, title: string, durationSeconds: number): void {
    try {
      this.db.prepare(
        `UPDATE activities SET duration_seconds = ?
         WHERE id = (SELECT id FROM activities WHERE app_name = ? AND window_title = ? AND duration_seconds IS NULL ORDER BY id DESC LIMIT 1)`
      ).run(durationSeconds, appName, title);
    } catch {}
  }

  private storeActivity(data: {
    timestamp: string;
    appName: string;
    appExecutable: string;
    windowTitle: string;
    durationSeconds: number;
  }): void {
    try {
      this.db.prepare(
        `INSERT INTO activities (timestamp, app_name, app_executable, window_title, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`
      ).run(data.timestamp, data.appName, data.appExecutable, data.windowTitle, data.durationSeconds);
    } catch (err) {
      log.warn({ err }, 'Failed to store activity');
    }
  }

  async stop(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }
    try {
      await fs.promises.unlink(this.scriptPath);
    } catch {}
  }
}
