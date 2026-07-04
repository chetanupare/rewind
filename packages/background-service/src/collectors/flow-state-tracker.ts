import { EventBus, getLogger } from '@ai-work-memory/shared';
import type { EventPayload } from '@ai-work-memory/shared';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const log = getLogger();

export class FlowStateTracker {
  private activeApp = '';
  private flowStart: number | null = null;
  private focusAssistEnabled = false;
  private checkInterval: NodeJS.Timeout | null = null;
  
  // Define "flow-compatible" applications
  private flowApps = ['code', 'cursor', 'devenv', 'terminal', 'powershell'];
  // Define "distraction" applications
  private distractionApps = ['slack', 'discord', 'teams', 'twitter', 'reddit'];

  private windowChangeUnsub?: () => void;

  constructor(private bus: EventBus) {}

  async start(): Promise<void> {
    this.windowChangeUnsub = this.bus.on('WINDOW_CHANGED', this.handleWindowChange.bind(this));
    
    // Check flow state every 1 minute
    this.checkInterval = setInterval(() => this.checkFlowState(), 60_000);
    log.info('Flow State Tracker started');
  }

  async stop(): Promise<void> {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.windowChangeUnsub) this.windowChangeUnsub();
    if (this.focusAssistEnabled) {
      await this.disableFocusAssist();
    }
  }

  private handleWindowChange(event: EventPayload) {
    const data = event.payload;
    const appName = (data.appName as string || '').toLowerCase();
    const executable = (data.executable as string || '').toLowerCase();
    
    this.activeApp = `${appName} ${executable}`;

    const isFlowApp = this.flowApps.some(app => this.activeApp.includes(app));
    const isDistraction = this.distractionApps.some(app => this.activeApp.includes(app));

    if (isFlowApp && !this.flowStart) {
      this.flowStart = Date.now();
      log.info('Potential flow state started');
    } else if (isDistraction) {
      // User got distracted, reset flow state
      this.resetFlowState();
    }
  }

  private async checkFlowState() {
    if (!this.flowStart) return;

    const durationMinutes = (Date.now() - this.flowStart) / 60_000;
    
    // If in flow state for > 15 minutes and focus assist isn't enabled
    if (durationMinutes >= 15 && !this.focusAssistEnabled) {
      log.info('User is in deep flow. Enabling Focus Assist.');
      await this.enableFocusAssist();
    }
  }

  private resetFlowState() {
    if (this.flowStart) {
      log.info('Flow state interrupted');
    }
    this.flowStart = null;
    if (this.focusAssistEnabled) {
      this.disableFocusAssist();
    }
  }

  private async enableFocusAssist() {
    try {
      const psCommand = `
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" -Name "NOC_GLOBAL_SETTING_TOASTS_LEVEL" -Value 1
      `;
      await execAsync(`powershell -Command "${psCommand}"`);
      this.focusAssistEnabled = true;
      
      this.bus.emit('FLOW_STATE_CHANGED', 'flow-state-tracker', {
        type: 'FLOW_STATE_ENTERED',
        app: this.activeApp
      });
    } catch (err) {
      log.warn({ err }, 'Failed to enable Focus Assist');
    }
  }

  private async disableFocusAssist() {
    try {
      const psCommand = `
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" -Name "NOC_GLOBAL_SETTING_TOASTS_LEVEL" -Value 0
      `;
      await execAsync(`powershell -Command "${psCommand}"`);
      this.focusAssistEnabled = false;
      
      this.bus.emit('FLOW_STATE_CHANGED', 'flow-state-tracker', {
        type: 'FLOW_STATE_EXITED'
      });
    } catch (err) {
      log.warn({ err }, 'Failed to disable Focus Assist');
    }
  }
}
