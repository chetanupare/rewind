import { getConfig, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

export class OllamaClient {
  private baseUrl: string;

  constructor() {
    const config = getConfig().get();
    this.baseUrl = `http://${config.ai.ollamaHost}:${config.ai.ollamaPort}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  async generate(params: {
    model: string;
    prompt: string;
    images?: string[];
    format?: 'json' | 'text';
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
      stream: false,
    };

    if (params.images) {
      body.images = params.images;
    }

    if (params.format) {
      body.format = params.format;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      return data.response;
    } catch (err) {
      log.error({ err, model: params.model }, 'Ollama generation failed');
      throw err;
    }
  }

  async embed(params: {
    model: string;
    input: string;
  }): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: params.model,
          input: params.input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embed error: ${response.status}`);
      }

      const data = await response.json() as { embeddings: number[][] };
      return data.embeddings[0];
    } catch (err) {
      log.error({ err, model: params.model }, 'Ollama embedding failed');
      throw err;
    }
  }
}
