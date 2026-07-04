import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface ConfidenceEntry {
  prediction: string;
  predictedConfidence: number;
  actualOutcome: 'correct' | 'incorrect' | 'partial';
  timestamp: string;
  adjustedConfidence: number;
}

export class ConfidenceEvolution {
  private predictions: Map<string, ConfidenceEntry[]> = new Map();

  constructor(private db: Database) {
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS confidence_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prediction_type TEXT NOT NULL,
        prediction TEXT NOT NULL,
        predicted_confidence REAL NOT NULL,
        actual_outcome TEXT,
        adjusted_confidence REAL,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS confidence_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_type TEXT NOT NULL UNIQUE,
        base_confidence REAL DEFAULT 0.5,
        accuracy REAL DEFAULT 0.5,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_conf_type ON confidence_history(prediction_type);
    `);
  }

  async recordPrediction(type: string, prediction: string, confidence: number): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO confidence_history (prediction_type, prediction, predicted_confidence)
      VALUES (?, ?, ?)
    `).run(type, prediction, confidence);

    const entry: ConfidenceEntry = {
      prediction,
      predictedConfidence: confidence,
      actualOutcome: 'correct',
      timestamp: new Date().toISOString(),
      adjustedConfidence: confidence,
    };

    const entries = this.predictions.get(type) || [];
    entries.push(entry);
    this.predictions.set(type, entries.slice(-100));

    return result.lastInsertRowid as number;
  }

  async recordOutcome(id: number, outcome: 'correct' | 'incorrect' | 'partial'): Promise<void> {
    const prediction = this.db.prepare(
      'SELECT * FROM confidence_history WHERE id = ?'
    ).get(id) as { prediction_type: string; predicted_confidence: number } | undefined;

    if (!prediction) return;

    let adjustedConfidence = prediction.predicted_confidence;

    switch (outcome) {
      case 'correct':
        adjustedConfidence = Math.min(1, prediction.predicted_confidence + 0.05);
        break;
      case 'incorrect':
        adjustedConfidence = Math.max(0, prediction.predicted_confidence - 0.15);
        break;
      case 'partial':
        adjustedConfidence = prediction.predicted_confidence;
        break;
    }

    this.db.prepare(`
      UPDATE confidence_history SET actual_outcome = ?, adjusted_confidence = ? WHERE id = ?
    `).run(outcome, adjustedConfidence, id);

    this.updateModel(prediction.prediction_type, outcome);
  }

  private async updateModel(type: string, outcome: string): Promise<void> {
    const existing = this.db.prepare(
      'SELECT * FROM confidence_models WHERE model_type = ?'
    ).get(type) as { total_predictions: number; correct_predictions: number } | undefined;

    if (existing) {
      const newTotal = existing.total_predictions + 1;
      const newCorrect = existing.correct_predictions + (outcome === 'correct' ? 1 : 0);
      const newAccuracy = newCorrect / newTotal;

      this.db.prepare(`
        UPDATE confidence_models SET 
          total_predictions = ?, correct_predictions = ?, accuracy = ?, last_updated = datetime('now')
        WHERE model_type = ?
      `).run(newTotal, newCorrect, newAccuracy, type);
    } else {
      this.db.prepare(`
        INSERT INTO confidence_models (model_type, total_predictions, correct_predictions, accuracy)
        VALUES (?, 1, ?, ?)
      `).run(type, outcome === 'correct' ? 1 : 0, outcome === 'correct' ? 1 : 0);
    }
  }

  async getAdjustedConfidence(type: string, baseConfidence: number): Promise<number> {
    const model = this.db.prepare(
      'SELECT accuracy FROM confidence_models WHERE model_type = ?'
    ).get(type) as { accuracy: number } | undefined;

    if (!model) return baseConfidence;

    return (baseConfidence * 0.7) + (model.accuracy * 0.3);
  }

  async getModelStats(): Promise<Array<{
    type: string;
    accuracy: number;
    totalPredictions: number;
    correctPredictions: number;
  }>> {
    const models = this.db.prepare(`
      SELECT model_type as type, accuracy, total_predictions as totalPredictions, correct_predictions as correctPredictions
      FROM confidence_models
      ORDER BY accuracy DESC
    `).all() as any[];

    return models;
  }

  async getRecentPredictions(limit = 20): Promise<ConfidenceEntry[]> {
    const predictions = this.db.prepare(`
      SELECT * FROM confidence_history ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return predictions.map(p => ({
      prediction: p.prediction,
      predictedConfidence: p.predicted_confidence,
      actualOutcome: p.actual_outcome,
      timestamp: p.timestamp,
      adjustedConfidence: p.adjusted_confidence,
    }));
  }
}
