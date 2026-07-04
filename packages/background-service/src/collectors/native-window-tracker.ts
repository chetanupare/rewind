import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import koffi from 'koffi';

const log = getLogger();

// Define Windows API types
const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

// Window functions
const GetForegroundWindow = user32.func('intptr_t GetForegroundWindow()');
const GetWindowTextA = user32.func('int GetWindowTextA(intptr_t hWnd, str lpString, int nMaxCount)');
const GetWindowThreadProcessId = user32.func('uint GetWindowThreadProcessId(intptr_t hWnd, uint* lpdwProcessId)');
const GetWindowRect = user32.func('bool GetWindowRect(intptr_t hWnd, long* lpRect)');
const GetCursorPos = user32.func('bool GetCursorPos(long* lpPoint)');

// Keyboard functions
const GetAsyncKeyState = user32.func('short GetAsyncKeyState(int vKey)');

// Process functions
const OpenProcess = kernel32.func('intptr_t OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId)');
const CloseHandle = kernel32.func('bool CloseHandle(intptr_t hObject)');
const GetModuleFileNameExA = kernel32.func('uint GetModuleFileNameExA(intptr_t hProcess, intptr_t hModule, str lpFilename, uint nSize)');

interface WinInfo {
  title: string;
  appName: string;
  processId: number;
  processPath: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export class NativeWindowTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastWindow: WinInfo | null = null;
  private lastChangeTime: Date = new Date();

  constructor(
    private bus: EventBus,
    private db: Database
  ) {}

  async start(): Promise<void> {
    this.interval = setInterval(() => this.poll(), 1000);
    log.info('Native window tracker started');
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private poll(): void {
    try {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return;

      // Get window title
      const titleBuffer = Buffer.alloc(512);
      GetWindowTextA(hwnd, titleBuffer, 512);
      const title = titleBuffer.toString('utf8').replace(/\0/g, '');

      if (!title) return;

      // Get process ID
      const processIdBuffer = Buffer.alloc(4);
      GetWindowThreadProcessId(hwnd, processIdBuffer);
      const processId = processIdBuffer.readUInt32LE(0);

      // Get window rect
      const rectBuffer = Buffer.alloc(16);
      GetWindowRect(hwnd, rectBuffer);
      const x = rectBuffer.readInt32LE(0);
      const y = rectBuffer.readInt32LE(4);
      const width = rectBuffer.readInt32LE(8) - x;
      const height = rectBuffer.readInt32LE(12) - y;

      // Get process name
      const processName = this.getProcessName(processId);

      const currentWindow: WinInfo = {
        title,
        appName: processName,
        processId,
        processPath: '',
        bounds: { x, y, width, height },
      };

      const now = new Date();
      const changed =
        !this.lastWindow ||
        currentWindow.processId !== this.lastWindow.processId ||
        currentWindow.title !== this.lastWindow.title;

      if (changed) {
        const durationMs = now.getTime() - this.lastChangeTime.getTime();
        const durationSeconds = Math.round(durationMs / 1000);

        if (this.lastWindow && durationSeconds > 1) {
          this.recordWindowDuration(this.lastWindow, durationSeconds);
        }

        this.bus.emit('WINDOW_CHANGED', 'window-tracker', {
          appName: currentWindow.appName,
          executable: currentWindow.processPath.split('\\').pop() || 'unknown.exe',
          pid: currentWindow.processId,
          windowTitle: currentWindow.title,
          windowBounds: currentWindow.bounds,
          monitor: { index: 0, name: 'Primary', width: 1920, height: 1080, isPrimary: true },
          monitorCount: 1,
        });

        this.storeActivity({
          timestamp: now.toISOString(),
          appName: currentWindow.appName,
          appExecutable: currentWindow.processPath.split('\\').pop() || 'unknown.exe',
          windowTitle: currentWindow.title,
          durationSeconds,
        });

        this.lastWindow = currentWindow;
        this.lastChangeTime = now;
      }
    } catch (err) {
      // Silently handle errors
    }
  }

  private getProcessName(processId: number): string {
    try {
      const PROCESS_QUERY_INFORMATION = 0x0400;
      const PROCESS_VM_READ = 0x0010;
      const handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, processId);
      
      if (!handle) return 'Unknown';

      const buffer = Buffer.alloc(512);
      GetModuleFileNameExA(handle, 0, buffer, 512);
      CloseHandle(handle);

      const fullPath = buffer.toString('utf8').replace(/\0/g, '');
      return fullPath.split('\\').pop()?.replace('.exe', '') || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private recordWindowDuration(window: WinInfo, durationSeconds: number): void {
    try {
      this.db.prepare(
        `UPDATE activities SET duration_seconds = ?
         WHERE id = (SELECT id FROM activities WHERE app_name = ? AND window_title = ? AND duration_seconds IS NULL ORDER BY id DESC LIMIT 1)`
      ).run(durationSeconds, window.appName, window.title);
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
      this.db.prepare(
        `INSERT INTO activities (timestamp, app_name, app_executable, window_title, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`
      ).run(data.timestamp, data.appName, data.appExecutable, data.windowTitle, data.durationSeconds);
    } catch (err) {
      log.warn({ err }, 'Failed to store activity');
    }
  }
}
