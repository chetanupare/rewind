import { EventBus, getLogger } from '@ai-work-memory/shared';
import koffi from 'koffi';

const log = getLogger();

const user32 = koffi.load('user32.dll');
const GetAsyncKeyState = user32.func('short GetAsyncKeyState(int vKey)');

interface InputState {
  keystrokeCount: number;
  clickCount: number;
  scrollCount: number;
  shortcuts: string[];
  lastActivityTime: Date;
}

export class NativeInputTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private state: InputState = {
    keystrokeCount: 0,
    clickCount: 0,
    scrollCount: 0,
    shortcuts: [],
    lastActivityTime: new Date(),
  };
  private isIdle = false;

  constructor(private bus: EventBus) {}

  async start(): Promise<void> {
    this.interval = setInterval(() => this.poll(), 100);
    log.info('Native input tracker started');
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private poll(): void {
    try {
      let hasActivity = false;

      // Check keyboard
      for (let vk = 8; vk <= 254; vk++) {
        const state = GetAsyncKeyState(vk);
        if (state & 0x0001) {
          this.state.keystrokeCount++;
          hasActivity = true;

          // Check for shortcuts
          const ctrl = GetAsyncKeyState(0x11) & 0x8000;
          const alt = GetAsyncKeyState(0x12) & 0x8000;
          const shift = GetAsyncKeyState(0x10) & 0x8000;

          if (ctrl || alt) {
            const key = this.getKeyName(vk);
            if (key) {
              let shortcut = '';
              if (ctrl) shortcut += 'Ctrl+';
              if (alt) shortcut += 'Alt+';
              if (shift) shortcut += 'Shift+';
              shortcut += key;
              
              if (!this.state.shortcuts.includes(shortcut)) {
                this.state.shortcuts.push(shortcut);
                this.bus.emit('SHORTCUT_PRESSED', 'keyboard-tracker', { shortcut });
              }
            }
          }
        }
      }

      // Check mouse buttons
      for (let btn = 1; btn <= 3; btn++) {
        const state = GetAsyncKeyState(btn);
        if (state & 0x0001) {
          this.state.clickCount++;
          hasActivity = true;
        }
      }

      if (hasActivity) {
        this.state.lastActivityTime = new Date();
        if (this.isIdle) {
          this.isIdle = false;
          this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', { idleDurationMs: 0 });
        }
      }

      // Check idle
      const idleMs = Date.now() - this.state.lastActivityTime.getTime();
      if (!this.isIdle && idleMs > 30000) {
        this.isIdle = true;
        this.bus.emit('MOUSE_IDLE', 'keyboard-tracker', { idleDurationMs: idleMs });
      }

      // Emit batch every 5 seconds
      if (this.state.keystrokeCount > 0 || this.state.shortcuts.length > 0) {
        this.bus.emit('KEYSTROKE_BATCH', 'keyboard-tracker', {
          keystrokeCount: this.state.keystrokeCount,
          shortcuts: [...this.state.shortcuts],
          typingSpeed: this.state.keystrokeCount * 12,
          idleDurationMs: idleMs,
        });
        this.state.keystrokeCount = 0;
        this.state.shortcuts = [];
      }

      if (this.state.clickCount > 0) {
        this.bus.emit('MOUSE_CLICKED', 'mouse-tracker', {
          clickCount: this.state.clickCount,
          batchDurationMs: 100,
        });
        this.state.clickCount = 0;
      }
    } catch (err) {
      // Silently handle errors
    }
  }

  private getKeyName(vk: number): string | null {
    const keyMap: Record<number, string> = {
      65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G',
      72: 'H', 73: 'I', 74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N',
      79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U',
      86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
      48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5',
      54: '6', 55: '7', 56: '8', 57: '9',
      13: 'Enter', 27: 'Esc', 32: 'Space', 9: 'Tab',
      37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down',
      112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4',
      116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8',
      120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
    };
    return keyMap[vk] || null;
  }
}
