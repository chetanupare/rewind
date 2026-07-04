import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface Prediction {
  action: string;
  confidence: number;
  context: string;
  basedOn: string[];
}

interface PredictionInput {
  currentEvent: string;
  intent: string;
  entities: Array<{ type: string; name: string }>;
}

export class PredictionEngine {
  constructor(private db: Database) {}

  async predict(input: PredictionInput): Promise<Prediction | null> {
    const recentPatterns = this.db.prepare(`
      SELECT * FROM learned_patterns
      WHERE description LIKE ?
      ORDER BY confidence DESC
      LIMIT 5
    `).all(`%${input.intent}%`) as any[];

    for (const pattern of recentPatterns) {
      const sequence = JSON.parse(pattern.sequence || '[]');
      const lastIndex = sequence.lastIndexOf(input.intent);

      if (lastIndex >= 0 && lastIndex < sequence.length - 1) {
        return {
          action: sequence[lastIndex + 1],
          confidence: pattern.confidence,
          context: `Based on pattern: ${pattern.description}`,
          basedOn: sequence.slice(0, lastIndex + 1),
        };
      }
    }

    const entityPredictions = this.predictFromEntities(input.entities);
    if (entityPredictions) {
      return entityPredictions;
    }

    return null;
  }

  private predictFromEntities(entities: Array<{ type: string; name: string }>): Prediction | null {
    for (const entity of entities) {
      if (entity.type === 'application') {
        const app = entity.name.toLowerCase();

        if (app.includes('terminal') || app.includes('powershell')) {
          return {
            action: 'deploying',
            confidence: 0.6,
            context: 'Terminal usually followed by deployment',
            basedOn: ['terminal'],
          };
        }

        if (app.includes('chrome') || app.includes('edge')) {
          return {
            action: 'research',
            confidence: 0.5,
            context: 'Browser usually for research',
            basedOn: ['browser'],
          };
        }
      }
    }

    return null;
  }

  async getRecentPredictions(limit: number = 10): Promise<Prediction[]> {
    return this.db.prepare(`
      SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?
    `).all(limit) as Prediction[];
  }
}
