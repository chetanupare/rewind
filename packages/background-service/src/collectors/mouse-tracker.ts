import { EventBus, getLogger } from '@ai-work-memory/shared';
import { execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

const MOUSE_HOOK_SCRIPT = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class MouseHook {
    private static IntPtr hookId = IntPtr.Zero;
    private static int clickCount = 0;
    private static int scrollCount = 0;
    private static int moveCount = 0;
    private static string lastButton = "left";
    private static bool wasDoubleClick = false;
    private static DateTime lastClickTime = DateTime.MinValue;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    private const int WH_MOUSE_LL = 14;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_RBUTTONUP = 0x0205;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_MBUTTONUP = 0x0208;
    private const int WM_MOUSEWHEEL = 0x020A;
    private const int WM_MOUSEMOVE = 0x0200;
    private const int WM_LBUTTONDBLCLK = 0x0203;

    public static void Start() {
        hookId = SetHook(HookCallback);
    }

    public static void Stop() {
        UnhookWindowsHookEx(hookId);
    }

    private static IntPtr SetHook(LowLevelMouseProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int msg = (int)wParam;

            if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN) {
                clickCount++;

                if (msg == WM_LBUTTONDOWN) lastButton = "left";
                else if (msg == WM_RBUTTONDOWN) lastButton = "right";
                else if (msg == WM_MBUTTONDOWN) lastButton = "middle";

                TimeSpan timeSinceLastClick = DateTime.Now - lastClickTime;
                wasDoubleClick = timeSinceLastClick.TotalMilliseconds < 500;
                lastClickTime = DateTime.Now;

                POINT p;
                GetCursorPos(out p);
                string dblClick = wasDoubleClick ? ",double" : "";
                Console.WriteLine("CLICK:" + lastButton + dblClick + "," + p.X + "," + p.Y);
            }
            else if (msg == WM_MOUSEWHEEL) {
                scrollCount++;
                Console.WriteLine("SCROLL:1");
            }
            else if (msg == WM_MOUSEMOVE) {
                moveCount++;
                if (moveCount % 50 == 0) {
                    POINT p;
                    GetCursorPos(out p);
                    Console.WriteLine("MOVE:" + p.X + "," + p.Y);
                }
            }
        }
        return CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@

[MouseHook]::Start()

while ($true) {
    Start-Sleep -Milliseconds 1
}

[MouseHook]::Stop()
`;

export class MouseTracker {
  private hookProcess: ChildProcess | null = null;
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private clickCount = 0;
  private scrollCount = 0;
  private lastClickTime = 0;
  private scriptPath: string;
  private recentClicks: Array<{ button: string; double: boolean; x: number; y: number }> = [];

  constructor(private bus: EventBus) {
    this.scriptPath = path.join(os.tmpdir(), `awm-mouse-hook-${process.pid}.ps1`);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, MOUSE_HOOK_SCRIPT, 'utf-8');

      this.hookProcess = execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
        { windowsHide: true },
        (err) => {
          if (err) {
            log.warn({ err }, 'Mouse hook process exited with error');
          }
        }
      );

      if (this.hookProcess.stdout) {
        this.hookProcess.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(l => l.trim());
          for (const line of lines) {
            this.processHookOutput(line.trim());
          }
        });
      }

      this.batchInterval = setInterval(() => {
        if (this.clickCount > 0 || this.scrollCount > 0) {
          this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
            clickCount: this.clickCount,
            scrollCount: this.scrollCount,
            batchDurationMs: 5000,
            recentClicks: [...this.recentClicks],
          });
          this.clickCount = 0;
          this.scrollCount = 0;
          this.recentClicks = [];
        }
      }, 5_000);

      log.info('Mouse tracker started with native hook');
    } catch (err) {
      log.warn({ err }, 'Failed to start mouse hook, falling back to batch mode');
      this.startFallbackMode();
    }
  }

  private processHookOutput(line: string): void {
    if (line.startsWith('CLICK:')) {
      const parts = line.substring(6).split(',');
      if (parts.length >= 4) {
        const button = parts[0];
        const isDoubleClick = parts[1] === 'double';
        const x = parseInt(parts[2], 10);
        const y = parseInt(parts[3], 10);

        this.clickCount++;
        this.lastClickTime = Date.now();

        this.recentClicks.push({ button, double: isDoubleClick, x, y });
        if (this.recentClicks.length > 20) {
          this.recentClicks.shift();
        }

        this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
          type: 'click',
          button,
          doubleClick: isDoubleClick,
          position: { x, y },
        });
      }
    } else if (line.startsWith('SCROLL:')) {
      const delta = parseInt(line.substring(7), 10);
      if (!isNaN(delta)) {
        this.scrollCount += delta;
        this.bus.emit('MOUSE_SCROLLED', 'mouse-tracker', {
          scrollDelta: { x: 0, y: delta },
        });
      }
    } else if (line.startsWith('MOVE:')) {
      const parts = line.substring(5).split(',');
      if (parts.length >= 2) {
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        this.bus.emit('MOUSE_MOVED', 'mouse-tracker', {
          position: { x, y },
        });
      }
    }
  }

  private startFallbackMode(): void {
    this.batchInterval = setInterval(() => {
      if (this.clickCount > 0) {
        this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
          clickCount: this.clickCount,
          batchDurationMs: 5000,
        });
        this.clickCount = 0;
      }
    }, 5_000);

    log.info('Mouse tracker started in fallback batch mode');
  }

  async stop(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    if (this.hookProcess) {
      this.hookProcess.kill();
      this.hookProcess = null;
    }

    try {
      await fs.promises.unlink(this.scriptPath);
    } catch {}
  }

  recordClick(button: 'left' | 'right' | 'middle' = 'left'): void {
    this.clickCount++;
    this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
      type: 'click',
      button,
      position: { x: 0, y: 0 },
    });
  }

  recordScroll(deltaX: number, deltaY: number): void {
    this.bus.emit('MOUSE_SCROLLED', 'mouse-tracker', {
      scrollDelta: { x: deltaX, y: deltaY },
    });
  }
}
