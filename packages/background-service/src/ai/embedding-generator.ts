import { getConfig, getLogger, upsertVectorsBatch } from '@ai-work-memory/shared';
import { OllamaClient } from './ollama-client.js';
import { v4 as uuidv4 } from 'uuid';

const log = getLogger();

export class EmbeddingGenerator {
  private ollama: OllamaClient;

  constructor() {
    this.ollama = new OllamaClient();
  }

  async start(): Promise<void> {
    log.info('Embedding generator started');
  }

  async generateForText(params: {
    sourceType: string;
    sourceId: number;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const config = getConfig().get();
      const embedding = await this.ollama.embed({
        model: config.ai.embeddingModel,
        input: params.text,
      });

      await upsertVectorsBatch([
        {
          id: uuidv4(),
          vector: embedding,
          payload: {
            source_type: params.sourceType,
            source_id: params.sourceId,
            text: params.text,
            ...params.metadata,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      log.debug({ err }, 'Failed to generate embedding');
    }
  }

  async generateBatch(items: Array<{
    sourceType: string;
    sourceId: number;
    text: string;
    metadata?: Record<string, unknown>;
  }>): Promise<void> {
    if (items.length === 0) return;

    try {
      const config = getConfig().get();
      const points = [];

      for (const item of items) {
        try {
          const embedding = await this.ollama.embed({
            model: config.ai.embeddingModel,
            input: item.text,
          });

          points.push({
            id: uuidv4(),
            vector: embedding,
            payload: {
              source_type: item.sourceType,
              source_id: item.sourceId,
              text: item.text,
              ...item.metadata,
              timestamp: new Date().toISOString(),
            },
          });
        } catch {
          // Skip failed items
        }
      }

      if (points.length > 0) {
        await upsertVectorsBatch(points);
      }
    } catch (err) {
      log.warn({ err }, 'Failed to generate batch embeddings');
    }
  }
}
