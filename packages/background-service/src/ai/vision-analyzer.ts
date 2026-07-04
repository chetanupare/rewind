import { EventBus, Database, getConfig, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from './ollama-client.js';
import { upsertVector } from '@ai-work-memory/shared';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import sharp from 'sharp';

const log = getLogger();
const fsPromises = fs.promises;

interface VisionAnalysis {
  app: string;
  task: string;
  project: string;
  language: string;
  framework: string;
  state: string;
  tags: string[];
  description: string;
}

interface QueueItem {
  screenshotId: number;
  filePath: string;
  timestamp?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: number;
}

export class VisionAnalyzer {
  private ollama: OllamaClient;
  private processing = false;
  private queue: QueueItem[] = [];
  private readonly MAX_QUEUE_SIZE = 50;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.ollama = new OllamaClient();

    this.bus.on('SCREENSHOT_PROCESSED', (event) => {
      if (event.payload.needsVision) {
        const existing = this.queue.find(q => q.screenshotId === event.payload.screenshotId);
        if (existing) {
          log.info('Screenshot already in queue: ' + event.payload.screenshotId);
          return;
        }

        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
          log.warn('Vision analysis queue is full, dropping oldest');
          this.queue.shift();
        }
        
        log.info('Queueing screenshot for vision analysis: ' + event.payload.screenshotId);
        this.queue.push({
          screenshotId: event.payload.screenshotId as number,
          filePath: event.payload.filePath as string,
          timestamp: event.payload.timestamp as string | undefined,
          status: 'pending',
        });
        
        this.db.prepare('UPDATE screenshots SET ai_processed = -1 WHERE id = ?')
          .run(event.payload.screenshotId);
        
        this.processQueue();
      }
    });
  }

  async start(): Promise<void> {
    this.recoverPendingScreenshots();
    log.info('Vision analyzer started');
  }

  private async recoverPendingScreenshots(): Promise<void> {
    try {
      const pending = this.db.prepare(
        'SELECT id, file_path, timestamp FROM screenshots WHERE ai_processed IN (0, -1) ORDER BY timestamp ASC LIMIT 30'
      ).all() as Array<{ id: number; file_path: string; timestamp: string }>;

      for (const s of pending) {
        const exists = this.queue.find(q => q.screenshotId === s.id);
        if (!exists) {
          this.queue.push({
            screenshotId: s.id,
            filePath: s.file_path,
            timestamp: s.timestamp,
            status: 'pending',
          });
          
          this.db.prepare('UPDATE screenshots SET ai_processed = -1 WHERE id = ? AND ai_processed = 0')
            .run(s.id);
        }
      }

      if (pending.length > 0) {
        log.info({ count: pending.length }, 'Recovered pending screenshots for vision analysis');
        this.processQueue();
      }
    } catch (err) {
      log.warn({ err }, 'Failed to recover pending screenshots');
    }
  }

  async stop(): Promise<void> {
    for (const item of this.queue) {
      if (item.status === 'pending') {
        this.db.prepare('UPDATE screenshots SET ai_processed = 0 WHERE id = ?')
          .run(item.screenshotId);
      }
    }
    this.queue = [];
  }

  getQueueStatus(): { pending: number; processing: number; completed: number } {
    return {
      pending: this.queue.filter(q => q.status === 'pending').length,
      processing: this.queue.filter(q => q.status === 'processing').length,
      completed: this.queue.filter(q => q.status === 'completed').length,
    };
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.find(q => q.status === 'pending');
      if (!item) break;

      item.status = 'processing';
      item.startedAt = Date.now();

      log.info({ screenshotId: item.screenshotId, queueLength: this.queue.length }, 'Analyzing screenshot');

      try {
        await this.analyzeScreenshot(item.screenshotId, item.filePath, item.timestamp);
        item.status = 'completed';
        log.info({ screenshotId: item.screenshotId }, 'Vision analysis completed');
      } catch (err: any) {
        item.status = 'failed';
        log.error({ err: err.message, screenshotId: item.screenshotId }, 'Vision analysis failed');
        this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?')
          .run(item.screenshotId);
      }

      this.queue = this.queue.filter(q => q.status !== 'completed' && q.status !== 'failed');
    }

    this.processing = false;
  }

  private async analyzeScreenshot(screenshotId: number, filePath: string, timestamp?: string): Promise<void> {
    try {
      try { await fsPromises.access(filePath); } catch { 
        log.warn({ filePath }, 'Screenshot file does not exist');
        this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?').run(screenshotId);
        return;
      }

      const isAvailable = await this.ollama.isAvailable();
      if (!isAvailable) {
        log.warn('Ollama not available, marking screenshot as processed');
        this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?').run(screenshotId);
        return;
      }

      log.info({ screenshotId }, 'Reading and converting image...');
      const webpBuf = await fsPromises.readFile(filePath);
      const jpegBuf = await sharp(webpBuf).jpeg({ quality: 80 }).toBuffer();
      const base64Image = jpegBuf.toString('base64');

      const config = getConfig().get();
      const prompt = `Analyze this computer screenshot. Provide a JSON response with:
{
  "app": "name of the primary application",
  "task": "what the user is doing",
  "project": "project or document name if visible",
  "language": "programming language if coding",
  "framework": "framework or tool if visible",
  "state": "one of: coding, debugging, reading, browsing, designing, meeting, email, terminal, testing, deploying, documenting, communicating, idle, other",
  "tags": ["relevant", "tags"],
  "description": "detailed description of everything visible"
}

Respond ONLY with valid JSON.`;

      log.info({ screenshotId, model: config.ai.visionModel }, 'Calling Ollama vision model...');
      
      const response = await this.ollama.generate({
        model: config.ai.visionModel,
        prompt,
        images: [base64Image],
        format: 'json',
      });

      log.info({ screenshotId }, 'Got response from Ollama, parsing...');

      let analysis: VisionAnalysis;
      try {
        let responseText = response.trim();
        if (responseText.includes('```')) {
          const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) responseText = match[1];
        } else {
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            responseText = responseText.substring(startIdx, endIdx + 1);
          }
        }
        analysis = JSON.parse(responseText);
      } catch {
        analysis = {
          app: 'Unknown',
          task: 'Unknown',
          project: '',
          language: '',
          framework: '',
          state: 'other',
          tags: [],
          description: response.substring(0, 500),
        };
      }

      log.info({ screenshotId, app: analysis.app, task: analysis.task }, 'Saving analysis to database...');

      this.db.prepare(
        `UPDATE screenshots SET
          ai_description = ?, ai_app = ?, ai_task = ?, ai_project = ?,
          ai_language = ?, ai_framework = ?, ai_state = ?, ai_processed = 1
         WHERE id = ?`
      ).run(
        analysis.description || '',
        analysis.app || 'Unknown',
        analysis.task || 'Unknown',
        analysis.project || '',
        analysis.language || '',
        analysis.framework || '',
        analysis.state || 'other',
        screenshotId
      );

      await this.generateEmbedding(screenshotId, analysis, timestamp);

      this.bus.emit('AI_ANALYSIS_COMPLETE', 'ai-pipeline', {
        screenshotId,
        analysis,
      });

      log.info({ screenshotId }, 'Vision analysis fully completed');
    } catch (err: any) {
      log.error({ err: err.message, screenshotId }, 'Vision analysis error');
      this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?').run(screenshotId);
      throw err;
    }
  }

  private async generateEmbedding(screenshotId: number, analysis: VisionAnalysis, timestamp?: string): Promise<void> {
    try {
      const config = getConfig().get();
      const text = `${analysis.app} ${analysis.task} ${analysis.project} ${analysis.description} ${analysis.tags.join(' ')}`;

      const embedding = await this.ollama.embed({
        model: config.ai.embeddingModel,
        input: text,
      });

      await upsertVector({
        id: uuidv4(),
        vector: embedding,
        payload: {
          source_type: 'screenshot',
          source_id: screenshotId,
          text,
          app_name: analysis.app,
          project_name: analysis.project,
          task_type: analysis.state,
          tags: analysis.tags,
          timestamp: timestamp || new Date().toISOString(),
        },
      });
    } catch (err) {
      log.debug({ err }, 'Failed to generate embedding for screenshot');
    }
  }
}
