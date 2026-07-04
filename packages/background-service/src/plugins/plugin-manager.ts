import { Database, EventBus, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

export interface Plugin {
  name: string;
  version: string;
  description: string;
  type: 'collector' | 'feature' | 'ai' | 'integration';
  enabled: boolean;
  
  initialize(context: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  onEvent?(type: string, payload: Record<string, unknown>): void;
  
  getStats?(): Record<string, unknown>;
  getStatus?(): 'running' | 'stopped' | 'error';
}

export interface PluginContext {
  db: Database;
  bus: EventBus;
  config: Record<string, unknown>;
  logger: ReturnType<typeof getLogger>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext;

  constructor(
    private db: Database,
    private bus: EventBus,
    private config: Record<string, unknown>
  ) {
    this.context = {
      db: this.db,
      bus: this.bus,
      config: this.config,
      logger: getLogger(),
    };
  }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      log.warn({ name: plugin.name }, 'Plugin already registered');
      return;
    }

    try {
      await plugin.initialize(this.context);
      this.plugins.set(plugin.name, plugin);
      log.info({ name: plugin.name, version: plugin.version }, 'Plugin registered');
    } catch (err) {
      log.error({ err, name: plugin.name }, 'Failed to register plugin');
    }
  }

  async start(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      log.warn({ name }, 'Plugin not found');
      return;
    }

    try {
      await plugin.start();
      plugin.enabled = true;
      log.info({ name }, 'Plugin started');
    } catch (err) {
      log.error({ err, name }, 'Failed to start plugin');
    }
  }

  async stop(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    try {
      await plugin.stop();
      plugin.enabled = false;
      log.info({ name }, 'Plugin stopped');
    } catch (err) {
      log.error({ err, name }, 'Failed to stop plugin');
    }
  }

  async startAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.enabled) {
        await this.start(name);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const [name] of this.plugins) {
      await this.stop(name);
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByType(type: Plugin['type']): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.type === type);
  }

  getRunningPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      total: this.plugins.size,
      running: this.getRunningPlugins().length,
      byType: {
        collectors: this.getPluginsByType('collector').length,
        features: this.getPluginsByType('feature').length,
        ai: this.getPluginsByType('ai').length,
        integrations: this.getPluginsByType('integration').length,
      },
      plugins: Array.from(this.plugins.values()).map(p => ({
        name: p.name,
        type: p.type,
        enabled: p.enabled,
        status: p.getStatus?.() || (p.enabled ? 'running' : 'stopped'),
      })),
    };

    return stats;
  }
}
