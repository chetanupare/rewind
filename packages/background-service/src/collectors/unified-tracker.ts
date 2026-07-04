import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

const UNIFIED_SCRIPT = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

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
    
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$lastWindowTitle = ""
$lastActivity = Get-Date
$keyCount = 0
$clickCount = 0

while ($true) {
    Start-Sleep -Milliseconds 200
    
    try {
        $hwnd = [WinAPI]::GetForegroundWindow()
        $sb = New-Object System.Text.StringBuilder 512
        [WinAPI]::GetWindowText($hwnd, $sb, 512) | Out-Null
        $title = $sb.ToString()
        
        $procId = 0
        [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
        
        $rect = New-Object WinAPI+RECT
        [WinAPI]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
        
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "Unknown" }
        $procPath = if ($proc -and $proc.Path) { $proc.Path } else { "" }
        
        $w = $rect.Right - $rect.Left
        $h = $rect.Bottom - $rect.Top
        
        if ($title -ne $lastWindowTitle) {
            Write-Output "WIN:$procId|$name|$procPath|$title|$($rect.Left)|$($rect.Top)|$w|$h"
            $lastWindowTitle = $title
            $lastActivity = Get-Date
        }
    } catch {}
    
    for ($vk = 1; $vk -le 254; $vk++) {
        $state = [WinAPI]::GetAsyncKeyState($vk)
        if ($state -band 0x0001) {
            $keyCount++
            $lastActivity = Get-Date
            
            $ctrl = [WinAPI]::GetAsyncKeyState(0x11) -band 0x8000
            $alt = [WinAPI]::GetAsyncKeyState(0x12) -band 0x8000
            
            if ($ctrl -or $alt) {
                $key = [System.Enum]::GetName([System.Windows.Forms.Keys], $vk)
                if ($key) {
                    $mod = ""
                    if ($ctrl) { $mod += "Ctrl+" }
                    if ($alt) { $mod += "Alt+" }
                    Write-Output "SHORTCUT:$mod$key"
                }
            }
        }
    }
    
    for ($btn = 1; $btn -le 3; $btn++) {
        $state = [WinAPI]::GetAsyncKeyState($btn)
        if ($state -band 0x0001) {
            $clickCount++
            $lastActivity = Get-Date
        }
    }
    
    if ($keyCount -ge 5 -or $clickCount -ge 3) {
        Write-Output "INPUT:$keyCount|$clickCount"
        $keyCount = 0
        $clickCount = 0
    }
    
    $idleSeconds = [int]((Get-Date) - $lastActivity).TotalSeconds
    if ($idleSeconds -gt 30 -and $idleSeconds -lt 35) {
        Write-Output "IDLE:$idleSeconds"
    }
}
`;

export class UnifiedTracker {
  private psProcess: ChildProcess | null = null;
  private scriptPath: string;
  private lastWindow: any = null;
  private lastChangeTime: Date = new Date();
  private keystrokeCount = 0;
  private shortcuts: string[] = [];
  private lastActivityTime = Date.now();
  private isIdle = false;
  private batchInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-unified-${process.pid}.ps1`);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, UNIFIED_SCRIPT, 'utf-8');

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

      this.batchInterval = setInterval(() => {
        if (this.keystrokeCount > 0 || this.shortcuts.length > 0) {
          this.bus.emit('KEYSTROKE_BATCH', 'keyboard-tracker', {
            keystrokeCount: this.keystrokeCount,
            shortcuts: [...this.shortcuts],
            typingSpeed: this.keystrokeCount * 12,
            idleDurationMs: Date.now() - this.lastActivityTime,
          });
          this.keystrokeCount = 0;
          this.shortcuts = [];
        }

        const idleMs = Date.now() - this.lastActivityTime;
        if (!this.isIdle && idleMs > 30_000) {
          this.isIdle = true;
          this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', { idleDurationMs: idleMs });
        }
      }, 5_000);

      log.info('Unified tracker started (single PowerShell process)');
    } catch (err) {
      log.warn({ err }, 'Failed to start unified tracker');
    }
  }

  private processOutput(line: string): void {
    try {
      if (line.startsWith('WIN:')) {
        this.processWindowChange(line.substring(4));
      } else if (line.startsWith('INPUT:')) {
        const parts = line.substring(6).split('|');
        const keys = parseInt(parts[0], 10) || 0;
        const clicks = parseInt(parts[1], 10) || 0;
        
        if (keys > 0) {
          this.keystrokeCount += keys;
          this.lastActivityTime = Date.now();
          this.isIdle = false;
        }
        
        if (clicks > 0) {
          this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
            clickCount: clicks,
            batchDurationMs: 5000,
          });
        }
      } else if (line.startsWith('SHORTCUT:')) {
        const shortcut = line.substring(9);
        this.shortcuts.push(shortcut);
        this.lastActivityTime = Date.now();
        this.isIdle = false;
        this.bus.emit('SHORTCUT_PRESSED', 'keyboard-tracker', { shortcut });
      } else if (line.startsWith('IDLE:')) {
        const idleSeconds = parseInt(line.substring(5), 10);
        if (!isNaN(idleSeconds) && idleSeconds > 30) {
          this.isIdle = true;
          this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', { idleDurationMs: idleSeconds * 1000 });
        }
      }
    } catch (err) {
      // Silently handle parse errors
    }
  }

  private processWindowChange(data: string): void {
    const parts = data.split('|');
    if (parts.length < 8) return;

    const [pidStr, name, procPath, title, xStr, yStr, wStr, hStr] = parts;
    const pid = parseInt(pidStr, 10) || 0;
    const x = parseInt(xStr, 10) || 0;
    const y = parseInt(yStr, 10) || 0;
    const width = parseInt(wStr, 10) || 0;
    const height = parseInt(hStr, 10) || 0;

    const currentWindow = {
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
        monitor: { index: 0, name: 'Primary', width: 1920, height: 1080, isPrimary: true },
        monitorCount: 1,
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
  }

  private recordWindowDuration(window: any, durationSeconds: number): void {
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
