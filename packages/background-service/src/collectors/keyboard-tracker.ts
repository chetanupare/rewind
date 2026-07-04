import { EventBus, getLogger } from '@ai-work-memory/shared';
import { execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

const KEYBOARD_HOOK_SCRIPT = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KeyboardHook {
    private static IntPtr hookId = IntPtr.Zero;
    private static int keyCount = 0;
    private static string lastShortcut = "";
    private static DateTime lastShortcutTime = DateTime.MinValue;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    public static void Start() {
        hookId = SetHook(HookCallback);
    }

    public static void Stop() {
        UnhookWindowsHookEx(hookId);
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN)) {
            int vkCode = Marshal.ReadInt32(lParam);
            keyCount++;

            bool ctrl = (Control.ModifierKeys & Keys.Control) == Keys.Control;
            bool alt = (Control.ModifierKeys & Keys.Alt) == Keys.Alt;
            bool shift = (Control.ModifierKeys & Keys.Shift) == Keys.Shift;

            if (ctrl || alt) {
                string shortcut = "";
                if (ctrl) shortcut += "Ctrl+";
                if (alt) shortcut += "Alt+";
                if (shift) shortcut += "Shift+";
                shortcut += ((Keys)vkCode).ToString();

                if (shortcut != lastShortcut || (DateTime.Now - lastShortcutTime).TotalMilliseconds > 500) {
                    lastShortcut = shortcut;
                    lastShortcutTime = DateTime.Now;
                    Console.WriteLine("SHORTCUT:" + shortcut);
                }
            }
        }
        return CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@

[KeyboardHook]::Start()

$lastReport = Get-Date
while ($true) {
    Start-Sleep -Milliseconds 5000
    $now = Get-Date
    if ($keyCount -gt 0) {
        Write-Output "KEYS:$keyCount"
        $keyCount = 0
    }
    $idleMs = [int]((Get-Date) - $now).TotalMilliseconds
    if ($idleMs -gt 30000) {
        Write-Output "IDLE:$idleMs"
    }
}

[KeyboardHook]::Stop()
`;

export class KeyboardTracker {
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private hookProcess: ChildProcess | null = null;
  private keystrokeCount = 0;
  private shortcuts: string[] = [];
  private lastActivityTime = Date.now();
  private isIdle = false;
  private scriptPath: string;

  constructor(private bus: EventBus) {
    this.scriptPath = path.join(os.tmpdir(), `awm-keyboard-hook-${process.pid}.ps1`);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, KEYBOARD_HOOK_SCRIPT, 'utf-8');

      this.hookProcess = execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
        { windowsHide: true },
        (err) => {
          if (err) {
            log.warn({ err }, 'Keyboard hook process exited with error');
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
        if (this.keystrokeCount > 0 || this.shortcuts.length > 0) {
          this.bus.emit('KEYSTROKE_BATCH', 'keyboard-tracker', {
            keystrokeCount: this.keystrokeCount,
            shortcuts: [...this.shortcuts],
            typingSpeed: this.calculateTypingSpeed(),
            idleDurationMs: Date.now() - this.lastActivityTime,
          });
          this.keystrokeCount = 0;
          this.shortcuts = [];
        }

        const idleMs = Date.now() - this.lastActivityTime;
        if (!this.isIdle && idleMs > 30_000) {
          this.isIdle = true;
          this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', {
            idleDurationMs: idleMs,
          });
        }
      }, 5_000);

      log.info('Keyboard tracker started with native hook');
    } catch (err) {
      log.warn({ err }, 'Failed to start keyboard hook, falling back to batch mode');
      this.startFallbackMode();
    }
  }

  private processHookOutput(line: string): void {
    if (line.startsWith('KEYS:')) {
      const count = parseInt(line.substring(5), 10);
      if (!isNaN(count) && count > 0) {
        this.keystrokeCount += count;
        this.lastActivityTime = Date.now();
        this.isIdle = false;
      }
    } else if (line.startsWith('SHORTCUT:')) {
      const shortcut = line.substring(9);
      this.shortcuts.push(shortcut);
      this.lastActivityTime = Date.now();
      this.isIdle = false;

      this.bus.emit('SHORTCUT_PRESSED', 'keyboard-tracker', {
        shortcut,
      });
    } else if (line.startsWith('IDLE:')) {
      const idleMs = parseInt(line.substring(5), 10);
      if (!isNaN(idleMs) && idleMs > 30_000) {
        this.isIdle = true;
        this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', {
          idleDurationMs: idleMs,
        });
      }
    }
  }

  private startFallbackMode(): void {
    this.batchInterval = setInterval(() => {
      if (this.keystrokeCount > 0 || this.shortcuts.length > 0) {
        this.bus.emit('KEYSTROKE_BATCH', 'keyboard-tracker', {
          keystrokeCount: this.keystrokeCount,
          shortcuts: [...this.shortcuts],
          typingSpeed: this.calculateTypingSpeed(),
          idleDurationMs: Date.now() - this.lastActivityTime,
        });
        this.keystrokeCount = 0;
        this.shortcuts = [];
      }
    }, 5_000);

    log.info('Keyboard tracker started in fallback batch mode');
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

  recordKeystroke(): void {
    this.keystrokeCount++;
    this.lastActivityTime = Date.now();
    this.isIdle = false;
  }

  recordShortcut(shortcut: string): void {
    this.shortcuts.push(shortcut);
    this.lastActivityTime = Date.now();
    this.isIdle = false;
    this.bus.emit('SHORTCUT_PRESSED', 'keyboard-tracker', {
      shortcut,
    });
  }

  private calculateTypingSpeed(): number {
    return this.keystrokeCount * 12;
  }
}
