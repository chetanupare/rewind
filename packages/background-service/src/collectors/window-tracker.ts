import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';

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
  monitor?: {
    index: number;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
  };
}

const PS_SCRIPT = `Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class WinAPI {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
    
    [DllImport("user32.dll", SetLastError = true)]
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

$handle = [WinAPI]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[WinAPI]::GetWindowText($handle, $sb, 512) | Out-Null
$procId = 0
[WinAPI]::GetWindowThreadProcessId($handle, [ref]$procId) | Out-Null

$rect = New-Object WinAPI+RECT
[WinAPI]::GetWindowRect($handle, [ref]$rect) | Out-Null

try {
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { "Unknown" }
  $p = if ($proc) { $proc.Path } else { "" }
} catch {
  $name = "Unknown"
  $p = ""
}

$screens = [System.Windows.Forms.Screen]::AllScreens
$monitorCount = $screens.Length
$primaryScreen = [System.Windows.Forms.Screen]::PrimaryScreen
$currentScreen = [System.Windows.Forms.Screen]::FromHandle($handle)
$monitorIndex = -1
for ($i = 0; $i -lt $screens.Length; $i++) {
  if ($screens[$i].DeviceName -eq $currentScreen.DeviceName) {
    $monitorIndex = $i
    break
  }
}

$windowWidth = $rect.Right - $rect.Left
$windowHeight = $rect.Bottom - $rect.Top

$title = $sb.ToString()
Write-Output "$procId|$name|$p|$title|$($rect.Left)|$($rect.Top)|$windowWidth|$windowHeight|$monitorCount|$monitorIndex|$($currentScreen.DeviceName)|$($currentScreen.Bounds.Width)|$($currentScreen.Bounds.Height)|$($currentScreen.Primary)"`;

const encodedScript = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');

export class WindowTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastWindow: WinInfo | null = null;
  private lastChangeTime: Date = new Date();
  private pollMs: number;
  private polling = false;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.pollMs = 2000;
  }

  async start(): Promise<void> {
    this.interval = setInterval(() => this.poll(), this.pollMs);
    log.info('Window tracker started');
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private poll(): void {
    if (this.polling) return;
    this.polling = true;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        try {
          if (err) return;

          const output = (stdout || '').trim();
          if (!output) return;

          const parts = output.split('|');
          if (parts.length < 14) return;

          const [pidStr, name, procPath, title, xStr, yStr, wStr, hStr, monitorCountStr, monitorIndexStr, monitorName, monitorWStr, monitorHStr, isPrimaryStr] = parts;
          const pid = parseInt(pidStr, 10) || 0;
          const x = parseInt(xStr, 10) || 0;
          const y = parseInt(yStr, 10) || 0;
          const width = parseInt(wStr, 10) || 0;
          const height = parseInt(hStr, 10) || 0;
          const monitorCount = parseInt(monitorCountStr, 10) || 1;
          const monitorIndex = parseInt(monitorIndexStr, 10) || 0;
          const monitorWidth = parseInt(monitorWStr, 10) || 1920;
          const monitorHeight = parseInt(monitorHStr, 10) || 1080;
          const isPrimary = isPrimaryStr === 'True';

          const currentWindow: WinInfo = {
            title: title || '',
            owner: {
              name: name || 'Unknown',
              processId: pid,
              path: procPath || '',
            },
            bounds: { x, y, width, height },
            monitor: {
              index: monitorIndex,
              name: monitorName || `Monitor ${monitorIndex}`,
              width: monitorWidth,
              height: monitorHeight,
              isPrimary,
            },
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
            const pidNum = currentWindow.owner?.processId ?? 0;
            const windowTitle = currentWindow.title ?? '';

            this.bus.emit('WINDOW_CHANGED', 'window-tracker', {
              appName,
              executable,
              pid: pidNum,
              windowTitle,
              windowBounds: currentWindow.bounds || { x: 0, y: 0, width: 0, height: 0 },
              monitor: currentWindow.monitor || { index: 0, name: 'Primary', width: 1920, height: 1080, isPrimary: true },
              monitorCount,
            });

            this.storeActivity({
              timestamp: now.toISOString(),
              appName,
              appExecutable: executable,
              windowTitle,
              durationSeconds,
            });

            this.lastWindow = currentWindow;
            this.lastChangeTime = now;
          }
        } finally {
          this.polling = false;
        }
      }
    );
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
}
