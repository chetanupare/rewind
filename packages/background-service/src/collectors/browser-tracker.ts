import { EventBus, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';

const log = getLogger();

interface TabInfo {
  id: number;
  url: string;
  title: string;
}

interface BrowserWindow {
  pid: number;
  title: string;
  browser: 'chrome' | 'edge' | 'firefox';
}

const BROWSER_PROCESSES: Record<string, 'chrome' | 'edge' | 'firefox'> = {
  chrome: 'chrome',
  msedge: 'edge',
  firefox: 'firefox',
  'google chrome': 'chrome',
  'microsoft edge': 'edge',
};

const PS_GET_BROWSER_WINDOWS = `
$browsers = @('chrome', 'msedge', 'firefox')
$windows = @()

foreach ($proc in $browsers) {
  try {
    $procs = Get-Process -Name $proc -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      if ($p.MainWindowTitle) {
        $windows += "$($p.Id)|$proc|$($p.MainWindowTitle)"
      }
    }
  } catch {}
}

$windows | ForEach-Object { Write-Output $_ }
`;

export class BrowserTracker {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private knownTabs: Map<string, TabInfo[]> = new Map();
  private lastBrowserTitles: Map<number, string> = new Map();
  private pollMs = 3000;
  private polling = false;

  constructor(private bus: EventBus) {}

  async start(): Promise<void> {
    this.pollInterval = setInterval(() => this.poll(), this.pollMs);
    log.info('Browser tracker started');
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private poll(): void {
    if (this.polling) return;
    this.polling = true;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_GET_BROWSER_WINDOWS],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        try {
          if (err) return;

          const lines = (stdout || '').trim().split('\n').filter(l => l.trim());
          const currentWindows: BrowserWindow[] = [];

          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 3) continue;

            const pid = parseInt(parts[0], 10);
            const procName = parts[1].toLowerCase();
            const title = parts[2];

            let browser: 'chrome' | 'edge' | 'firefox' | null = null;
            for (const [key, value] of Object.entries(BROWSER_PROCESSES)) {
              if (procName.includes(key)) {
                browser = value;
                break;
              }
            }

            if (browser) {
              currentWindows.push({ pid, title, browser });
            }
          }

          this.processBrowserWindows(currentWindows);
        } finally {
          this.polling = false;
        }
      }
    );
  }

  private processBrowserWindows(windows: BrowserWindow[]): void {
    const currentPids = new Set(windows.map(w => w.pid));

    for (const [pid] of this.lastBrowserTitles) {
      if (!currentPids.has(pid)) {
        this.lastBrowserTitles.delete(pid);
      }
    }

    for (const win of windows) {
      const lastTitle = this.lastBrowserTitles.get(win.pid);

      if (lastTitle !== win.title) {
        this.lastBrowserTitles.set(win.pid, win.title);
        this.onBrowserTitleChange(win);
      }
    }
  }

  private onBrowserTitleChange(win: BrowserWindow): void {
    const url = this.extractUrlFromTitle(win.title);
    const tabId = win.pid;

    const browserTabs = this.knownTabs.get(win.browser) ?? [];
    const existing = browserTabs.find(t => t.id === tabId);

    if (existing) {
      if (existing.url !== url || existing.title !== win.title) {
        existing.url = url;
        existing.title = win.title;

        this.bus.emit('BROWSER_URL_CHANGED', 'browser-tracker', {
          browser: win.browser,
          tabId,
          url,
          pageTitle: win.title,
        });
      }
    } else {
      browserTabs.push({ id: tabId, url, title: win.title });
      this.knownTabs.set(win.browser, browserTabs);

      this.bus.emit('BROWSER_TAB_CHANGED', 'browser-tracker', {
        browser: win.browser,
        tabId,
        url,
        pageTitle: win.title,
        type: 'new_tab',
      });
    }
  }

  private extractUrlFromTitle(title: string): string {
    const urlMatch = title.match(/(https?:\/\/[^\s\-]+)/);
    return urlMatch ? urlMatch[1] : '';
  }

  trackTabChange(browser: string, tab: TabInfo): void {
    const tabs = this.knownTabs.get(browser) ?? [];
    const existing = tabs.find((t) => t.id === tab.id);

    if (existing) {
      if (existing.url !== tab.url) {
        this.bus.emit('BROWSER_URL_CHANGED', 'browser-tracker', {
          browser,
          tabId: tab.id,
          url: tab.url,
          pageTitle: tab.title,
        });
      }
    } else {
      this.bus.emit('BROWSER_TAB_CHANGED', 'browser-tracker', {
        browser,
        tabId: tab.id,
        url: tab.url,
        pageTitle: tab.title,
        type: 'new_tab',
      });
    }

    const idx = tabs.findIndex((t) => t.id === tab.id);
    if (idx >= 0) {
      tabs[idx] = tab;
    } else {
      tabs.push(tab);
    }
    this.knownTabs.set(browser, tabs);
  }

  trackTabClosed(browser: string, tabId: number): void {
    const tabs = this.knownTabs.get(browser) ?? [];
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx >= 0) {
      tabs.splice(idx, 1);
      this.knownTabs.set(browser, tabs);
      this.bus.emit('BROWSER_TAB_CHANGED', 'browser-tracker', {
        browser,
        tabId,
        type: 'closed_tab',
      });
    }
  }
}
