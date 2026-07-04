import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

interface WinInfo {
  title: string;
  owner?: {
    name: string;
    processId: number;
    path: string;
  };
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const PS_SCRIPT = `
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
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$lastTitle = ""
$lastPid = 0

while ($true) {
    Start-Sleep -Milliseconds 500
    
    try {
        $hwnd = [WinAPI]::GetForegroundWindow()
        
        if ($hwnd -eq [IntPtr]::Zero) {
            continue
        }
        
        $sb = New-Object System.Text.StringBuilder 512
        [WinAPI]::GetWindowText($hwnd, $sb, 512) | Out-Null
        $title = $sb.ToString()
        
        $procId = 0
        [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
        
        if ($title -ne $lastTitle -or $procId -ne $lastPid) {
            $lastTitle = $title
            $lastPid = $procId
            
            $rect = New-Object WinAPI+RECT
            [WinAPI]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
            
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            $name = if ($proc) { $proc.ProcessName } else { "Unknown" }
            $procPath = if ($proc -and $proc.Path) { $proc.Path } else { "" }
            
            $w = $rect.Right - $rect.Left
            $h = $rect.Bottom - $rect.Top
            
            $output = "$procId|$name|$procPath|$title|$($rect.Left)|$($rect.Top)|$w|$h"
            Write-Output $output
        }
    } catch {
        # Silently handle errors
    }
}
`;

export class WindowTracker {
  private psProcess: ChildProcess | null = null;
  private lastWindow: WinInfo | null = null;
  private lastChangeTime: Date = new Date();
  private scriptPath: string;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-window-${process.pid}.ps1`);
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
        log.warn({ err }, 'Window tracker process error');
      });

      this.psProcess.on('exit', (code) => {
        log.warn({ code }, 'Window tracker exited, restarting...');
        setTimeout(() => this.start(), 2000);
      });

      log.info('Window tracker started');
    } catch (err) {
      log.warn({ err }, 'Failed to start window tracker');
    }
  }

  private processOutput(line: string): void {
    try {
      const parts = line.split('|');
      if (parts.length < 8) return;

      const [pidStr, name, procPath, title, xStr, yStr, wStr, hStr] = parts;
      const pid = parseInt(pidStr, 10) || 0;
      const x = parseInt(xStr, 10) || 0;
      const y = parseInt(yStr, 10) || 0;
      const width = parseInt(wStr, 10) || 0;
      const height = parseInt(hStr, 10) || 0;

      if (!name || name === 'Unknown' || !title) return;

      const currentWindow: WinInfo = {
        title: title || '',
        owner: {
          name: name || 'Unknown',
          processId: pid,
          path: procPath || '',
        },
        bounds: { x, y, width, height },
      };

      const now = new Date();
      const changed =
        !this.lastWindow ||
        currentWindow.owner?.processId !== this.lastWindow.owner?.processId ||
        currentWindow.title !== this.lastWindow.title;

      if (changed) {
        const durationMs = now.getTime() - this.lastChangeTime.getTime();
        const durationSeconds = Math.round(durationMs / 1000);

        if (this.lastWindow && durationSeconds > 1) {
          this.recordWindowDuration(this.lastWindow, durationSeconds);
        }

        const appName = currentWindow.owner?.name ?? 'Unknown';
        const executable = currentWindow.owner?.path?.split('\\').pop() ?? 'unknown.exe';

        this.bus.emit('WINDOW_CHANGED', 'window-tracker', {
          appName,
          executable,
          pid: currentWindow.owner?.processId ?? 0,
          windowTitle: currentWindow.title ?? '',
          windowBounds: currentWindow.bounds || { x: 0, y: 0, width: 0, height: 0 },
        });

        this.storeActivity({
          timestamp: now.toISOString(),
          appName,
          appExecutable: executable,
          windowTitle: currentWindow.title ?? '',
          durationSeconds,
        });

        this.lastWindow = currentWindow;
        this.lastChangeTime = now;
      }
    } catch (err) {
      // Silently handle parse errors
    }
  }

  private recordWindowDuration(window: WinInfo, durationSeconds: number): void {
    try {
      const stmt = this.db.prepare(
        `UPDATE activities SET duration_seconds = ?
         WHERE id = (SELECT id FROM activities WHERE app_name = ? AND window_title = ? AND duration_seconds IS NULL ORDER BY id DESC LIMIT 1)`
      );
      stmt.run(durationSeconds, window.owner?.name ?? 'Unknown', window.title ?? '');
    } catch {
      // Ignore
    }
  }

  private storeActivity(data: {
    timestamp: string;
    appName: string;
    appExecutable: string;
    windowTitle: string;
    durationSeconds: number;
  }): void {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO activities (timestamp, app_name, app_executable, window_title, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(data.timestamp, data.appName, data.appExecutable, data.windowTitle, data.durationSeconds);
    } catch (err) {
      log.warn({ err }, 'Failed to store activity');
    }
  }

  async stop(): Promise<void> {
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }
    try {
      await fs.promises.unlink(this.scriptPath);
    } catch {}
  }
}
