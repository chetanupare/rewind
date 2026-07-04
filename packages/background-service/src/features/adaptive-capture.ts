import { EventBus, Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface CaptureState {
  currentApp: string;
  isIdle: boolean;
  isMeeting: boolean;
  isGaming: boolean;
  isVideo: boolean;
  isPresentation: boolean;
  lastActivityTime: Date;
  codeChangeRate: number;
}

export class AdaptiveCapture {
  private state: CaptureState;
  private baseIntervalMs: number;
  private currentIntervalMs: number;
  private captureTimer: ReturnType<typeof setInterval> | null = null;
  private lastCaptureTime: Date = new Date();
  private readonly IDLE_THRESHOLD_MS = 60000;
  private readonly MEETING_APPS = ['zoom', 'teams', 'meet', 'webex', 'skype', 'slack'];
  private readonly GAMING_APPS = ['steam', 'epic', 'gog', 'battle.net', 'origin', 'uplay'];
  private readonly VIDEO_APPS = ['netflix', 'youtube', 'vlc', 'mpv', 'plex', 'prime video'];
  private readonly PRESENTATION_APPS = ['powerpoint', 'keynote', 'slides', 'figma', 'canva'];
  private readonly CODE_APPS = ['code', 'cursor', 'visual studio', 'intellij', 'webstorm', 'android studio'];

  constructor(
    private bus: EventBus,
    private db: Database,
    config: { intervalMs: number }
  ) {
    this.baseIntervalMs = config.intervalMs;
    this.currentIntervalMs = config.intervalMs;
    this.state = {
      currentApp: '',
      isIdle: false,
      isMeeting: false,
      isGaming: false,
      isVideo: false,
      isPresentation: false,
      lastActivityTime: new Date(),
      codeChangeRate: 0,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName } = event.payload as any;
      this.onAppChange(appName);
    });

    this.bus.on('KEYSTROKE_BATCH', (event) => {
      const { keystrokeCount } = event.payload as any;
      this.onKeystroke(keystrokeCount);
    });

    this.bus.on('MOUSE_CLICKED', () => {
      this.onActivity();
    });

    this.bus.on('SYSTEM_RESOURCE_UPDATE', (event) => {
      const { cpu } = event.payload as any;
      if (cpu > 80) {
        this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, 300000);
      }
    });
  }

  private onAppChange(appName: string): void {
    const lower = appName.toLowerCase();
    this.state.currentApp = appName;
    this.state.lastActivityTime = new Date();
    this.state.isIdle = false;

    this.state.isMeeting = this.MEETING_APPS.some(a => lower.includes(a));
    this.state.isGaming = this.GAMING_APPS.some(a => lower.includes(a));
    this.state.isVideo = this.VIDEO_APPS.some(a => lower.includes(a));
    this.state.isPresentation = this.PRESENTATION_APPS.some(a => lower.includes(a));

    this.adjustCaptureRate();
  }

  private onKeystroke(count: number): void {
    this.state.lastActivityTime = new Date();
    this.state.isIdle = false;
    this.state.codeChangeRate = count;

    if (this.CODE_APPS.some(a => this.state.currentApp.toLowerCase().includes(a))) {
      if (count > 50) {
        this.currentIntervalMs = Math.max(20000, this.baseIntervalMs / 6);
      } else if (count > 20) {
        this.currentIntervalMs = Math.max(30000, this.baseIntervalMs / 4);
      }
    }
  }

  private onActivity(): void {
    this.state.lastActivityTime = new Date();
    this.state.isIdle = false;
  }

  private adjustCaptureRate(): void {
    if (this.state.isGaming || this.state.isVideo) {
      this.currentIntervalMs = 0;
      log.info('Capture paused: gaming/video detected');
      return;
    }

    if (this.state.isMeeting) {
      this.currentIntervalMs = 60000;
      log.info('Capture rate: meeting mode (1 min)');
      return;
    }

    if (this.state.isPresentation) {
      this.currentIntervalMs = 5000;
      log.info('Capture rate: presentation mode (5 sec)');
      return;
    }

    if (this.state.isIdle) {
      this.currentIntervalMs = 0;
      log.info('Capture paused: idle');
      return;
    }

    if (this.CODE_APPS.some(a => this.state.currentApp.toLowerCase().includes(a))) {
      this.currentIntervalMs = Math.max(20000, this.baseIntervalMs / 6);
      log.info('Capture rate: coding mode (20 sec)');
      return;
    }

    this.currentIntervalMs = this.baseIntervalMs;
    log.info('Capture rate: normal');
  }

  checkIdle(): void {
    const idleMs = Date.now() - this.state.lastActivityTime.getTime();
    const wasIdle = this.state.isIdle;
    this.state.isIdle = idleMs > this.IDLE_THRESHOLD_MS;

    if (this.state.isIdle && !wasIdle) {
      this.adjustCaptureRate();
    } else if (!this.state.isIdle && wasIdle) {
      this.adjustCaptureRate();
    }
  }

  shouldCapture(): boolean {
    if (this.currentIntervalMs === 0) return false;

    const elapsed = Date.now() - this.lastCaptureTime.getTime();
    if (elapsed >= this.currentIntervalMs) {
      this.lastCaptureTime = new Date();
      return true;
    }

    return false;
  }

  getCurrentInterval(): number {
    return this.currentIntervalMs;
  }

  getState(): CaptureState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
    }
  }
}
