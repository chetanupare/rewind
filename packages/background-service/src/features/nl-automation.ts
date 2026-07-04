import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface AutomationRule {
  id: number;
  trigger: string;
  condition: string;
  action: string;
  params: string;
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

interface Reminder {
  id: number;
  title: string;
  description: string;
  remindAt: string;
  context: string;
  completed: boolean;
  createdAt: string;
}

export class NaturalLanguageAutomation {
  private ollama: OllamaClient;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ollama = new OllamaClient();
    this.ensureTables();
    this.startChecking();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_type TEXT NOT NULL,
        condition_expr TEXT,
        action_type TEXT NOT NULL,
        params TEXT DEFAULT '{}',
        enabled INTEGER DEFAULT 1,
        last_triggered TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        remind_at TEXT NOT NULL,
        context TEXT,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS nl_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input TEXT NOT NULL,
        parsed_intent TEXT,
        parsed_params TEXT,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at);
      CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(completed);
    `);
  }

  private startChecking(): void {
    this.checkInterval = setInterval(() => {
      this.checkReminders();
      this.checkRules();
    }, 60000);
  }

  private setupEventListeners(): void {
    this.bus.on('PROJECT_DETECTED', (event) => {
      this.evaluateRules('project_detected', event.payload);
    });

    this.bus.on('MEETING_STARTED', (event) => {
      this.evaluateRules('meeting_started', event.payload);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      this.evaluateRules('git_commit', event.payload);
    });
  }

  async processCommand(input: string): Promise<{
    success: boolean;
    message: string;
    action?: string;
  }> {
    const lower = input.toLowerCase();

    if (lower.startsWith('remind me') || lower.startsWith('set reminder')) {
      return this.createReminderFromNL(input);
    }

    if (lower.startsWith('when i') || lower.startsWith('if i')) {
      return this.createRuleFromNL(input);
    }

    if (lower.startsWith('show reminders') || lower.startsWith('list reminders')) {
      return this.listReminders();
    }

    if (lower.startsWith('what was i') || lower.startsWith('what did i')) {
      return this.queryActivity(input);
    }

    return {
      success: false,
      message: 'I didn\'t understand that command. Try "Remind me tomorrow about..." or "When I open VS Code, ..."',
    };
  }

  private async createReminderFromNL(input: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const prompt = `Parse this reminder request into JSON:
"${input}"

Extract:
- title: what to remind about
- when: when to remind (relative like "tomorrow at 3pm" or absolute)
- context: any additional context

Return JSON: {"title": "...", "when": "...", "context": "..."}`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
        format: 'json',
      });

      const parsed = JSON.parse(response);
      const remindAt = this.parseRelativeTime(parsed.when);

      this.db.prepare(`
        INSERT INTO reminders (title, description, remind_at, context)
        VALUES (?, ?, ?, ?)
      `).run(parsed.title, parsed.context || '', remindAt, input);

      return {
        success: true,
        message: `Reminder set: "${parsed.title}" at ${new Date(remindAt).toLocaleString()}`,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Failed to create reminder. Please try again.',
      };
    }
  }

  private async createRuleFromNL(input: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const prompt = `Parse this automation rule into JSON:
"${input}"

Extract:
- trigger: what event triggers this (app_open, git_commit, meeting_start, time, etc.)
- condition: optional condition (app name, project, etc.)
- action: what to do (remind, notify, log, etc.)
- params: additional parameters

Return JSON: {"trigger": "...", "condition": "...", "action": "...", "params": {...}}`;

      const response = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt,
        format: 'json',
      });

      const parsed = JSON.parse(response);

      this.db.prepare(`
        INSERT INTO automation_rules (trigger_type, condition_expr, action_type, params)
        VALUES (?, ?, ?, ?)
      `).run(parsed.trigger, parsed.condition || '', parsed.action, JSON.stringify(parsed.params || {}));

      return {
        success: true,
        message: `Rule created: When ${parsed.trigger}, ${parsed.action}`,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Failed to create rule. Please try again.',
      };
    }
  }

  private async listReminders(): Promise<{
    success: boolean;
    message: string;
  }> {
    const reminders = this.db.prepare(`
      SELECT * FROM reminders WHERE completed = 0 ORDER BY remind_at ASC LIMIT 10
    `).all() as Reminder[];

    if (reminders.length === 0) {
      return { success: true, message: 'No pending reminders.' };
    }

    const list = reminders
      .map(r => `- ${r.title} (${new Date(r.remindAt).toLocaleString()})`)
      .join('\n');

    return { success: true, message: `Pending reminders:\n${list}` };
  }

  private async queryActivity(input: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return {
      success: true,
      message: 'Activity query processed. Check your timeline for details.',
    };
  }

  private parseRelativeTime(input: string): string {
    const now = new Date();
    const lower = input.toLowerCase();

    if (lower.includes('tomorrow')) {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    } else if (lower.includes('next hour')) {
      now.setHours(now.getHours() + 1);
    } else if (lower.includes('in 30 minutes') || lower.includes('in half hour')) {
      now.setMinutes(now.getMinutes() + 30);
    } else if (lower.includes('in 15 minutes')) {
      now.setMinutes(now.getMinutes() + 15);
    }

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3];

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      now.setHours(hours, minutes, 0, 0);
    }

    return now.toISOString();
  }

  private checkReminders(): void {
    const now = new Date().toISOString();
    const dueReminders = this.db.prepare(`
      SELECT * FROM reminders WHERE remind_at <= ? AND completed = 0
    `).all(now) as Reminder[];

    for (const reminder of dueReminders) {
      this.bus.emit('REMINDER_DUE', 'nl-automation', {
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        context: reminder.context,
      });

      this.db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id);
    }
  }

  private async checkRules(): Promise<void> {
    try {
      const rules = this.db.prepare(`
        SELECT * FROM automation_rules WHERE enabled = 1
      `).all() as AutomationRule[];

      for (const rule of rules) {
        try {
          const params = JSON.parse(rule.params || '{}');
          
          if (rule.last_triggered) {
            const lastTriggered = new Date(rule.last_triggered).getTime();
            const now = Date.now();
            const cooldownMs = 60 * 60 * 1000;
            if (now - lastTriggered < cooldownMs) continue;
          }

        } catch (err) {
          log.debug({ err, ruleId: rule.id }, 'Failed to check rule');
        }
      }
    } catch (err) {
      log.debug({ err }, 'Failed to check rules');
    }
  }

  private async evaluateRules(trigger: string, data: Record<string, unknown>): Promise<void> {
    const rules = this.db.prepare(`
      SELECT * FROM automation_rules WHERE trigger_type = ? AND enabled = 1
    `).all(trigger) as AutomationRule[];

    for (const rule of rules) {
      try {
        const params = JSON.parse(rule.params || '{}');
        
        if (rule.condition) {
          const conditionMet = this.evaluateCondition(rule.condition, data);
          if (!conditionMet) continue;
        }

        this.executeAction(rule.action, params, data);

        this.db.prepare('UPDATE automation_rules SET last_triggered = ? WHERE id = ?')
          .run(new Date().toISOString(), rule.id);
      } catch (err) {
        log.warn({ err, ruleId: rule.id }, 'Failed to evaluate rule');
      }
    }
  }

  private evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
    const lower = condition.toLowerCase();
    
    for (const [key, value] of Object.entries(data)) {
      if (lower.includes(String(value).toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private executeAction(action: string, params: Record<string, unknown>, context: Record<string, unknown>): void {
    switch (action) {
      case 'notify':
        this.bus.emit('NOTIFICATION', 'nl-automation', {
          title: params.title || 'Automation Rule',
          body: params.body || 'Rule triggered',
        });
        break;
      case 'log':
        log.info({ params, context }, 'Automation rule triggered');
        break;
      case 'bookmark':
        this.bus.emit('CREATE_BOOKMARK', 'nl-automation', {
          ...context,
          ...params,
        });
        break;
    }
  }

  async getReminders(includeCompleted = false): Promise<Reminder[]> {
    const query = includeCompleted
      ? 'SELECT * FROM reminders ORDER BY remind_at DESC'
      : 'SELECT * FROM reminders WHERE completed = 0 ORDER BY remind_at ASC';
    return this.db.prepare(query).all() as Reminder[];
  }

  async getRules(): Promise<AutomationRule[]> {
    return this.db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all() as AutomationRule[];
  }

  async completeReminder(id: number): Promise<void> {
    this.db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(id);
  }

  async deleteRule(id: number): Promise<void> {
    this.db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
