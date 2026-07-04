import path from 'path';
import os from 'os';
import fs from 'fs';
import type { AppConfig } from './types/config.js';
import { DEFAULT_CONFIG } from './types/config.js';

const CONFIG_FILE = 'config.json';

function getAppDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'AIWorkMemory');
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export class Config {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    const dataDir = getAppDataDir();
    this.configPath = path.join(dataDir, CONFIG_FILE);

    const dirs = {
      dataDir,
      dbPath: path.join(dataDir, 'db', 'workmemory.db'),
      screenshotsDir: path.join(dataDir, 'screenshots'),
      logsDir: path.join(dataDir, 'logs'),
    };

    this.config = { ...DEFAULT_CONFIG, ...dirs };

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(raw);
        this.config = deepMerge(this.config, saved) as AppConfig;
      }
    } catch (err) {
      console.warn('Failed to load config, using defaults:', err);
    }
    this.save();
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  get(): AppConfig {
    return this.config;
  }

  update(partial: Partial<AppConfig>): void {
    this.config = deepMerge(this.config, partial as Record<string, any>) as AppConfig;
    this.save();
  }

  getOllamaUrl(): string {
    return `http://${this.config.ai.ollamaHost}:${this.config.ai.ollamaPort}`;
  }
}

let instance: Config | null;

export function getConfig(): Config {
  if (!instance) {
    instance = new Config();
  }
  return instance;
}
