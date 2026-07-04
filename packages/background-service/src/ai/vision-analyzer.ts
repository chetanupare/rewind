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

export class VisionAnalyzer {
  private ollama: OllamaClient;
  private processing = false;
  private queue: Array<{ screenshotId: number; filePath: string; timestamp?: string }> = [];
  private readonly MAX_QUEUE_SIZE = 20;
  private lastProcessTime = 0;
  private readonly MIN_INTERVAL_MS = 5000;
  private requestCount = 0;
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private requestTimestamps: number[] = [];

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.ollama = new OllamaClient();

    this.bus.on('SCREENSHOT_PROCESSED', (event) => {
      log.info({ payload: event.payload }, 'Received SCREENSHOT_PROCESSED in VisionAnalyzer');
      if (event.payload.needsVision) {
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
          log.warn('Vision analysis queue is full, dropping oldest frame');
          this.queue.shift();
        }
        log.info('Queueing screenshot for vision analysis: ' + event.payload.screenshotId);
        this.queue.push({
          screenshotId: event.payload.screenshotId as number,
          filePath: event.payload.filePath as string,
          timestamp: event.payload.timestamp as string | undefined,
        });
        this.processQueue();
      } else {
        log.info('needsVision is false, ignoring');
      }
    });
  }

  async start(): Promise<void> {
    log.info('Vision analyzer started');
  }

  async stop(): Promise<void> {
    this.queue = [];
  }

  private async processQueue(): Promise<void> {
    log.info('processQueue called, processing=' + this.processing + ', queueLen=' + this.queue.length);
    if (this.processing || this.queue.length === 0) return;
    
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      log.warn('Rate limit reached, delaying next vision analysis');
      const oldestRequest = this.requestTimestamps[0];
      const delayMs = 60000 - (now - oldestRequest) + 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    const timeSinceLastProcess = now - this.lastProcessTime;
    if (timeSinceLastProcess < this.MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLastProcess));
    }
    
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      log.info('Analyzing screenshot ' + item.screenshotId);
      this.requestTimestamps.push(Date.now());
      await this.analyzeScreenshot(item.screenshotId, item.filePath, item.timestamp);
      log.info('Done analyzing screenshot ' + item.screenshotId);
      this.lastProcessTime = Date.now();
    }

    this.processing = false;
  }

  private async analyzeScreenshot(screenshotId: number, filePath: string, timestamp?: string): Promise<void> {
    try {
      log.info('Checking if file exists: ' + filePath);
      try { await fsPromises.access(filePath); } catch { 
        log.warn('File does not exist: ' + filePath);
        return; 
      }

      log.info('Checking if Ollama is available...');
      if (!(await this.ollama.isAvailable())) {
        log.error('Ollama is completely unreachable (isAvailable returned false). Check if it is running!');
        this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?').run(screenshotId);
        return;
      }
      log.info('Ollama is available. Reading image...');

      const webpBuf = await fsPromises.readFile(filePath);
      const jpegBuf = await sharp(webpBuf).jpeg({ quality: 80 }).toBuffer();
      const base64Image = jpegBuf.toString('base64');
      log.info('Calling ollama.generate...');

      const config = getConfig().get();
      const prompt = `You are an expert visual analyst examining a user's computer screen. Perform a HIGHLY DETAILED analysis of EVERYTHING visible in the screenshot. Do not just list the app name; read the text, describe the open tabs, code snippets, visible UI elements, open windows, and precise context of what the user is doing.

Provide a JSON response with the following fields:
{
  "app": "name of the primary application shown",
  "task": "detailed description of the exact task being performed",
  "project": "likely project or document name if visible",
  "language": "programming language or natural language being typed",
  "framework": "any frameworks, libraries, or tools visible in code or UI",
  "state": "one of: coding, debugging, reading, browsing, designing, meeting, email, terminal, testing, deploying, documenting, communicating, idle, other",
  "tags": ["specific", "tags", "extracted", "from", "the", "image"],
  "description": "A VERY LONG AND COMPREHENSIVE paragraph detailing everything on the screen. Include visible tab names, URLs, window titles, specific code being edited, variables, file names, people in meetings, chat messages, or anything else you can read. Be exhaustive."
}

Respond ONLY with valid JSON, no markdown or extra text.`;

      const response = await this.ollama.generate({
        model: config.ai.visionModel,
        prompt,
        images: [base64Image],
        format: 'json',
      });

      let analysis: VisionAnalysis;
      try {
        let responseText = response.trim();
        if (responseText.includes('```')) {
          const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            responseText = match[1];
          }
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

      this.db.prepare(
        `UPDATE screenshots SET
          ai_description = ?, ai_app = ?, ai_task = ?, ai_project = ?,
          ai_language = ?, ai_framework = ?, ai_state = ?, ai_processed = 1
         WHERE id = ?`
      ).run(
        analysis.description,
        analysis.app,
        analysis.task,
        analysis.project,
        analysis.language,
        analysis.framework,
        analysis.state,
        screenshotId
      );

      await this.generateEmbedding(screenshotId, analysis, timestamp);

      this.bus.emit('AI_ANALYSIS_COMPLETE', 'ai-pipeline', {
        screenshotId,
        analysis,
      });

      log.debug({ screenshotId, app: analysis.app, task: analysis.task }, 'Vision analysis completed');
    } catch (err: any) {
      log.error({ err: err.message || err, screenshotId }, 'Vision analysis FAILED due to an error');
      this.db.prepare('UPDATE screenshots SET ai_processed = 1 WHERE id = ?').run(screenshotId);
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
