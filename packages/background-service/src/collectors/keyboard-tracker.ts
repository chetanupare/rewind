import { EventBus, getLogger } from '@ai-work-memory/shared';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

const KEYBOARD_SCRIPT = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class KeyboardMonitor {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
"@

$lastCount = 0
$lastShortcut = ""
$lastActivity = Get-Date

while ($true) {
    Start-Sleep -Milliseconds 500
    
    $keyCount = 0
    $ctrlPressed = [KeyboardMonitor]::GetAsyncKeyState(0x11) -band 0x8000
    $altPressed = [KeyboardMonitor]::GetAsyncKeyState(0x12) -band 0x8000
    $shiftPressed = [KeyboardMonitor]::GetAsyncKeyState(0x10) -band 0x8000
    
    for ($vk = 8; $vk -le 190; $vk++) {
        $state = [KeyboardMonitor]::GetAsyncKeyState($vk)
        if ($state -band 0x0001) {
            $keyCount++
            $lastActivity = Get-Date
            
            if ($ctrlPressed -or $altPressed) {
                $shortcut = ""
                if ($ctrlPressed) { $shortcut += "Ctrl+" }
                if ($altPressed) { $shortcut += "Alt+" }
                if ($shiftPressed) { $shortcut += "Shift+" }
                
                $key = [System.Enum]::GetName([System.Windows.Forms.Keys], $vk)
                if ($key) { $shortcut += $key }
                
                if ($shortcut -ne $lastShortcut) {
                    Write-Output "SHORTCUT:$shortcut"
                    $lastShortcut = $shortcut
                }
            }
        }
    }
    
    if ($keyCount -gt 0) {
        Write-Output "KEYS:$keyCount"
    }
    
    $idleSeconds = [int]((Get-Date) - $lastActivity).TotalSeconds
    if ($idleSeconds -gt 30) {
        Write-Output "IDLE:$idleSeconds"
    }
}
`;

export class KeyboardTracker {
  private hookProcess: ChildProcess | null = null;
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private keystrokeCount = 0;
  private shortcuts: string[] = [];
  private lastActivityTime = Date.now();
  private isIdle = false;
  private scriptPath: string;

  constructor(private bus: EventBus) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-keyboard-${process.pid}.ps1`);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, KEYBOARD_SCRIPT, 'utf-8');

      this.hookProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath,
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (this.hookProcess.stdout) {
        this.hookProcess.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(l => l.trim());
          for (const line of lines) {
            this.processOutput(line.trim());
          }
        });
      }

      this.hookProcess.on('error', (err) => {
        log.warn({ err }, 'Keyboard tracker process error');
      });

      this.hookProcess.on('exit', (code) => {
        log.warn({ code }, 'Keyboard tracker process exited, restarting...');
        setTimeout(() => this.start(), 1000);
      });

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

      log.info('Keyboard tracker started with PowerShell hook');
    } catch (err) {
      log.warn({ err }, 'Failed to start keyboard tracker');
    }
  }

  private processOutput(line: string): void {
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
      const idleSeconds = parseInt(line.substring(5), 10);
      if (!isNaN(idleSeconds) && idleSeconds > 30) {
        this.isIdle = true;
        this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', {
          idleDurationMs: idleSeconds * 1000,
        });
      }
    }
  }

  private calculateTypingSpeed(): number {
    return this.keystrokeCount * 12;
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
}
