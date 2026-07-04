export interface AppConfig {
  dataDir: string;
  dbPath: string;
  screenshotsDir: string;
  logsDir: string;

  // Screenshot settings
  screenshot: {
    intervalMs: number;
    quality: number;
    maxWidth: number;
    format: 'jpeg' | 'png';
    retentionDays: number;
  };

  // Collector intervals
  collectors: {
    windowPollMs: number;
    mousePollMs: number;
    keyboardPollMs: number;
    clipboardPollMs: number;
    browserPollMs: number;
  };

  // AI settings
  ai: {
    ollamaHost: string;
    ollamaPort: number;
    visionModel: string;
    embeddingModel: string;
    textModel: string;
    coderModel: string;
  };

  // Qdrant settings
  qdrant: {
    url: string;
    apiKey: string;
    collectionName: string;
  };

  // Scheduler intervals
  scheduler: {
    ocrIntervalMs: number;
    summaryIntervalMs: number;
    embeddingIntervalMs: number;
    retentionCheckMs: number;
    timelineRebuildMs: number;
    knowledgeGraphUpdateMs: number;
  };

  // Privacy
  privacy: {
    blacklistApps: string[];
    storeScreenshots: boolean;
    storeClipboard: boolean;
    blurSensitiveApps: string[];
  };

  // Performance
  performance: {
    maxCpuPercent: number;
    maxRamMb: number;
    maxScreenshotsPerDay: number;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  dataDir: '',
  dbPath: '',
  screenshotsDir: '',
  logsDir: '',

  screenshot: {
    intervalMs: 120_000,
    quality: 60,
    maxWidth: 1920,
    format: 'jpeg',
    retentionDays: 7,
  },

  collectors: {
    windowPollMs: 2_000,
    mousePollMs: 100,
    keyboardPollMs: 5_000,
    clipboardPollMs: 1_000,
    browserPollMs: 2_000,
  },

  ai: {
    ollamaHost: process.env.OLLAMA_HOST || 'localhost',
    ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434', 10),
    visionModel: process.env.OLLAMA_VISION_MODEL || 'qwen2.5-vl:1.5b',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    textModel: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5-coder:3b',
    coderModel: process.env.OLLAMA_CODER_MODEL || 'qwen2.5-coder:3b',
  },

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '',
    collectionName: process.env.QDRANT_COLLECTION || 'aiworkmemory',
  },

  scheduler: {
    ocrIntervalMs: 300_000,
    summaryIntervalMs: 1_800_000,
    embeddingIntervalMs: 3_600_000,
    retentionCheckMs: 86_400_000,
    timelineRebuildMs: 3_600_000,
    knowledgeGraphUpdateMs: 3_600_000,
  },

  privacy: {
    blacklistApps: [
      '1Password',
      'Bitwarden',
      'KeePass',
      'KeePassXC',
      'LastPass',
      'Dashlane',
      'NordPass',
    ],
    storeScreenshots: true,
    storeClipboard: true,
    blurSensitiveApps: [
      'Banking',
      'Chase',
      'Wells Fargo',
      'PayPal',
      'Venmo',
      'Coinbase',
    ],
  },

  performance: {
    maxCpuPercent: 15,
    maxRamMb: 300,
    maxScreenshotsPerDay: 720,
  },
};
