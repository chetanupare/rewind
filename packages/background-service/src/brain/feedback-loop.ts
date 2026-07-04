import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface Prediction {
  id: number;
  timestamp: string;
  type: string;
  prediction: string;
  confidence: number;
  context: string;
  entities: string[];
  basedOn: string[];
}

interface Outcome {
  predictionId: number;
  timestamp: string;
  actualOutcome: string;
  wasCorrect: boolean;
  partialCredit: number;
  timeToVerify: number;
}

interface FeedbackLoop {
  id: number;
  cycleNumber: number;
  startTime: string;
  endTime: string | null;
  predictionsMade: number;
  predictionsVerified: number;
  accuracyBefore: number;
  accuracyAfter: number;
  improvements: string[];
}

interface LearningMetrics {
  totalPredictions: number;
  verifiedPredictions: number;
  overallAccuracy: number;
  accuracyByType: Record<string, number>;
  improvementRate: number;
  confidenceCalibration: number;
  lastUpdated: string;
}

export class CognitiveFeedbackLoop {
  private currentCycle: FeedbackLoop | null = null;
  private pendingPredictions: Map<number, Prediction> = new Map();
  private readonly VERIFY_WINDOW_MS = 30 * 60 * 1000;

  constructor(
    private db: Database,
    private bus: EventBus,
    private ollama: OllamaClient
  ) {
    this.ensureTables();
    this.setupEventListeners();
    this.startNewCycle();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        context TEXT,
        entities TEXT DEFAULT '[]',
        based_on TEXT DEFAULT '[]',
        verified INTEGER DEFAULT 0,
        outcome TEXT,
        was_correct INTEGER,
        partial_credit REAL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS prediction_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prediction_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        actual_outcome TEXT NOT NULL,
        was_correct INTEGER NOT NULL,
        partial_credit REAL DEFAULT 0,
        time_to_verify_ms INTEGER,
        FOREIGN KEY (prediction_id) REFERENCES predictions(id)
      );

      CREATE TABLE IF NOT EXISTS feedback_cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_number INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        predictions_made INTEGER DEFAULT 0,
        predictions_verified INTEGER DEFAULT 0,
        accuracy_before REAL DEFAULT 0,
        accuracy_after REAL DEFAULT 0,
        improvements TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS model_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        bias REAL DEFAULT 0,
        accuracy REAL DEFAULT 0.5,
        samples INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT (datetime('now')),
        UNIQUE(model_type)
      );

      CREATE TABLE IF NOT EXISTS learning_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        insight TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        applied INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_predictions_time ON predictions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_predictions_type ON predictions(type);
      CREATE INDEX IF NOT EXISTS idx_predictions_verified ON predictions(verified);
      CREATE INDEX IF NOT EXISTS idx_outcomes_pred ON prediction_outcomes(prediction_id);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      this.observeAndPredict('app_switch', event.payload);
    });

    this.bus.on('GIT_COMMIT', (event) => {
      this.verifyRecentPredictions('commit', event.payload);
    });

    this.bus.on('TERMINAL_COMMAND', (event) => {
      this.verifyRecentPredictions('terminal', event.payload);
    });

    this.bus.on('FOCUS_COMPLETED', (event) => {
      this.verifyRecentPredictions('focus', event.payload);
    });

    this.bus.on('MEETING_STARTED', (event) => {
      this.verifyRecentPredictions('meeting', event.payload);
    });

    setInterval(() => {
      this.cleanupExpiredPredictions();
    }, 60000);
  }

  private async observeAndPredict(type: string, data: Record<string, unknown>): Promise<void> {
    const prediction = await this.generatePrediction(type, data);
    if (!prediction) return;

    const result = this.db.prepare(`
      INSERT INTO predictions (timestamp, type, prediction, confidence, context, entities, based_on)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      prediction.type,
      prediction.prediction,
      prediction.confidence,
      prediction.context,
      JSON.stringify(prediction.entities),
      JSON.stringify(prediction.basedOn)
    );

    const predictionId = result.lastInsertRowid as number;
    this.pendingPredictions.set(predictionId, {
      ...prediction,
      id: predictionId,
      timestamp: new Date().toISOString(),
    });

    this.bus.emit('PREDICTION_MADE', 'feedback-loop', {
      predictionId,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
    });

    log.debug({ predictionId, prediction: prediction.prediction }, 'Prediction made');
  }

  private async generatePrediction(type: string, data: Record<string, unknown>): Promise<Omit<Prediction, 'id' | 'timestamp'> | null> {
    const patterns = this.db.prepare(`
      SELECT * FROM learned_patterns ORDER BY confidence DESC LIMIT 10
    `).all() as any[];

    const recentPredictions = this.db.prepare(`
      SELECT * FROM predictions WHERE verified = 1 AND was_correct = 1
      ORDER BY timestamp DESC LIMIT 10
    `).all() as any[];

    const appName = (data.appName || data.app || '') as string;
    const windowTitle = (data.windowTitle || data.title || '') as string;

    if (type === 'app_switch') {
      const lower = appName.toLowerCase();

      if (lower.includes('terminal') || lower.includes('powershell')) {
        return {
          type: 'action',
          prediction: 'User will run a command or deploy',
          confidence: 0.7,
          context: `Switched to ${appName}`,
          entities: [appName],
          basedOn: ['terminal usage pattern'],
        };
      }

      if (lower.includes('code') || lower.includes('cursor')) {
        return {
          type: 'action',
          prediction: 'User will code or debug',
          confidence: 0.8,
          context: `Switched to ${appName}`,
          entities: [appName],
          basedOn: ['coding pattern'],
        };
      }

      if (lower.includes('chrome') || lower.includes('edge')) {
        return {
          type: 'action',
          prediction: 'User will research or browse',
          confidence: 0.6,
          context: `Switched to ${appName}`,
          entities: [appName],
          basedOn: ['browsing pattern'],
        };
      }
    }

    return null;
  }

  private async verifyRecentPredictions(eventType: string, data: Record<string, unknown>): Promise<void> {
    const now = Date.now();

    for (const [predictionId, prediction] of this.pendingPredictions) {
      const timeSince = now - new Date(prediction.timestamp).getTime();
      if (timeSince > this.VERIFY_WINDOW_MS) {
        this.pendingPredictions.delete(predictionId);
        continue;
      }

      const wasCorrect = this.checkPrediction(prediction, eventType, data);
      const partialCredit = wasCorrect ? 1.0 : this.calculatePartialCredit(prediction, eventType, data);

      await this.recordOutcome(predictionId, {
        predictionId,
        timestamp: new Date().toISOString(),
        actualOutcome: `${eventType}: ${JSON.stringify(data).substring(0, 200)}`,
        wasCorrect,
        partialCredit,
        timeToVerify: timeSince,
      });

      this.pendingPredictions.delete(predictionId);
    }
  }

  private checkPrediction(prediction: Prediction, eventType: string, data: Record<string, unknown>): boolean {
    const predLower = prediction.prediction.toLowerCase();
    const appName = ((data.appName || data.app || '') as string).toLowerCase();

    if (predLower.includes('command') && eventType === 'terminal') return true;
    if (predLower.includes('code') && (appName.includes('code') || appName.includes('cursor'))) return true;
    if (predLower.includes('research') && (appName.includes('chrome') || appName.includes('edge'))) return true;
    if (predLower.includes('commit') && eventType === 'commit') return true;
    if (predLower.includes('meeting') && eventType === 'meeting') return true;

    return false;
  }

  private calculatePartialCredit(prediction: Prediction, eventType: string, data: Record<string, unknown>): number {
    const predLower = prediction.prediction.toLowerCase();

    if (predLower.includes('work') && eventType !== 'idle') return 0.3;
    if (predLower.includes('app') && eventType === 'app_switch') return 0.5;

    return 0;
  }

  private async recordOutcome(predictionId: number, outcome: Outcome): Promise<void> {
    try {
      this.db.prepare(`
        INSERT INTO prediction_outcomes (prediction_id, timestamp, actual_outcome, was_correct, partial_credit, time_to_verify_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        outcome.predictionId,
        outcome.timestamp,
        outcome.actualOutcome,
        outcome.wasCorrect ? 1 : 0,
        outcome.partialCredit,
        outcome.timeToVerify
      );

      this.db.prepare(`
        UPDATE predictions SET verified = 1, outcome = ?, was_correct = ?, partial_credit = ?
        WHERE id = ?
      `).run(
        outcome.actualOutcome,
        outcome.wasCorrect ? 1 : 0,
        outcome.partialCredit,
        predictionId
      );

      await this.updateModelWeights(outcome);
      await this.generateLearningInsight(outcome);

      if (this.currentCycle) {
        this.currentCycle.predictionsVerified++;
      }

      this.bus.emit('PREDICTION_VERIFIED', 'feedback-loop', {
        predictionId,
        wasCorrect: outcome.wasCorrect,
        confidence: outcome.partialCredit,
      });

      log.debug({
        predictionId,
        wasCorrect: outcome.wasCorrect,
        partialCredit: outcome.partialCredit,
      }, 'Prediction outcome recorded');
    } catch (err) {
      log.warn({ err }, 'Failed to record outcome');
    }
  }

  private async updateModelWeights(outcome: Outcome): Promise<void> {
    const prediction = this.db.prepare(
      'SELECT type, confidence FROM predictions WHERE id = ?'
    ).get(outcome.predictionId) as { type: string; confidence: number } | undefined;

    if (!prediction) return;

    const existing = this.db.prepare(
      'SELECT * FROM model_weights WHERE model_type = ?'
    ).get(prediction.type) as { weight: number; bias: number; accuracy: number; samples: number } | undefined;

    if (existing) {
      const newSamples = existing.samples + 1;
      const newAccuracy = ((existing.accuracy * existing.samples) + (outcome.wasCorrect ? 1 : 0)) / newSamples;

      let newWeight = existing.weight;
      let newBias = existing.bias;

      if (outcome.wasCorrect) {
        newWeight = Math.min(2, existing.weight * 1.05);
      } else {
        newWeight = Math.max(0.5, existing.weight * 0.95);
        newBias = existing.bias + (outcome.partialCredit - prediction.confidence) * 0.1;
      }

      this.db.prepare(`
        UPDATE model_weights SET weight = ?, bias = ?, accuracy = ?, samples = ?, last_updated = datetime('now')
        WHERE model_type = ?
      `).run(newWeight, newBias, newAccuracy, newSamples, prediction.type);
    } else {
      this.db.prepare(`
        INSERT INTO model_weights (model_type, weight, bias, accuracy, samples)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        prediction.type,
        1.0,
        0,
        outcome.wasCorrect ? 1 : 0,
        1
      );
    }
  }

  private async generateLearningInsight(outcome: Outcome): Promise<void> {
    if (outcome.wasCorrect) return;

    const prediction = this.db.prepare(
      'SELECT prediction, confidence, context FROM predictions WHERE id = ?'
    ).get(outcome.predictionId) as { prediction: string; confidence: number; context: string } | undefined;

    if (!prediction) return;

    if (prediction.confidence > 0.8 && !outcome.wasCorrect) {
      this.db.prepare(`
        INSERT INTO learning_insights (timestamp, type, insight, confidence)
        VALUES (?, 'overconfident', ?, ?)
      `).run(
        new Date().toISOString(),
        `Was ${Math.round(prediction.confidence * 100)}% confident about "${prediction.prediction}" but was wrong. Need to recalibrate.`,
        0.8
      );
    }

    if (outcome.partialCredit > 0.5) {
      this.db.prepare(`
        INSERT INTO learning_insights (timestamp, type, insight, confidence)
        VALUES (?, 'partial_match', ?, ?)
      `).run(
        new Date().toISOString(),
        `Prediction "${prediction.prediction}" was partially correct. Learning from this pattern.`,
        0.6
      );
    }
  }

  private cleanupExpiredPredictions(): void {
    const now = Date.now();
    for (const [id, prediction] of this.pendingPredictions) {
      if (now - new Date(prediction.timestamp).getTime() > this.VERIFY_WINDOW_MS) {
        this.db.prepare(`
          UPDATE predictions SET verified = -1 WHERE id = ?
        `).run(id);
        this.pendingPredictions.delete(id);
      }
    }
  }

  private startNewCycle(): void {
    const accuracy = this.getCurrentAccuracy();

    this.currentCycle = {
      id: 0,
      cycleNumber: this.getNextCycleNumber(),
      startTime: new Date().toISOString(),
      endTime: null,
      predictionsMade: 0,
      predictionsVerified: 0,
      accuracyBefore: accuracy,
      accuracyAfter: accuracy,
      improvements: [],
    };

    log.info({ cycleNumber: this.currentCycle.cycleNumber }, 'New feedback cycle started');
  }

  async endCycle(): Promise<void> {
    if (!this.currentCycle) return;

    this.currentCycle.endTime = new Date().toISOString();
    this.currentCycle.accuracyAfter = this.getCurrentAccuracy();

    const improvements = await this.analyzeImprovements();
    this.currentCycle.improvements = improvements;

    this.db.prepare(`
      INSERT INTO feedback_cycles (cycle_number, start_time, end_time, predictions_made, predictions_verified, accuracy_before, accuracy_after, improvements)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.currentCycle.cycleNumber,
      this.currentCycle.startTime,
      this.currentCycle.endTime,
      this.currentCycle.predictionsMade,
      this.currentCycle.predictionsVerified,
      this.currentCycle.accuracyBefore,
      this.currentCycle.accuracyAfter,
      JSON.stringify(improvements)
    );

    log.info({
      cycle: this.currentCycle.cycleNumber,
      accuracyBefore: this.currentCycle.accuracyBefore,
      accuracyAfter: this.currentCycle.accuracyAfter,
      improvements: improvements.length,
    }, 'Feedback cycle completed');

    this.startNewCycle();
  }

  private getCurrentAccuracy(): number {
    const result = this.db.prepare(`
      SELECT AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions WHERE verified = 1
    `).get() as { accuracy: number } | undefined;

    return result?.accuracy || 0.5;
  }

  private getNextCycleNumber(): number {
    const result = this.db.prepare(
      'SELECT MAX(cycle_number) as max FROM feedback_cycles'
    ).get() as { max: number } | undefined;

    return (result?.max || 0) + 1;
  }

  private async analyzeImprovements(): Promise<string[]> {
    const improvements: string[] = [];

    const recentAccuracy = this.db.prepare(`
      SELECT AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions
      WHERE verified = 1 AND timestamp > datetime('now', '-1 day')
    `).get() as { accuracy: number } | undefined;

    const olderAccuracy = this.db.prepare(`
      SELECT AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions
      WHERE verified = 1 AND timestamp BETWEEN datetime('now', '-7 days') AND datetime('now', '-1 day')
    `).get() as { accuracy: number } | undefined;

    if (recentAccuracy && olderAccuracy) {
      const improvement = recentAccuracy.accuracy - olderAccuracy.accuracy;
      if (improvement > 0.05) {
        improvements.push(`Accuracy improved by ${Math.round(improvement * 100)}%`);
      } else if (improvement < -0.05) {
        improvements.push(`Accuracy decreased by ${Math.round(Math.abs(improvement) * 100)}%`);
      }
    }

    const insights = this.db.prepare(`
      SELECT COUNT(*) as count FROM learning_insights
      WHERE timestamp > datetime('now', '-1 day') AND applied = 0
    `).get() as { count: number };

    if (insights.count > 0) {
      improvements.push(`${insights.count} new learning insights to apply`);
    }

    return improvements;
  }

  async getMetrics(): Promise<LearningMetrics> {
    const totalPredictions = (this.db.prepare(
      'SELECT COUNT(*) as count FROM predictions'
    ).get() as { count: number }).count;

    const verifiedPredictions = (this.db.prepare(
      'SELECT COUNT(*) as count FROM predictions WHERE verified = 1'
    ).get() as { count: number }).count;

    const overallAccuracy = this.getCurrentAccuracy();

    const byType = this.db.prepare(`
      SELECT type, AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions WHERE verified = 1
      GROUP BY type
    `).all() as Array<{ type: string; accuracy: number }>;

    const accuracyByType: Record<string, number> = {};
    for (const row of byType) {
      accuracyByType[row.type] = Math.round(row.accuracy * 100) / 100;
    }

    const recentAccuracy = this.db.prepare(`
      SELECT AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions
      WHERE verified = 1 AND timestamp > datetime('now', '-1 day')
    `).get() as { accuracy: number } | undefined;

    const olderAccuracy = this.db.prepare(`
      SELECT AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM predictions
      WHERE verified = 1 AND timestamp BETWEEN datetime('now', '-7 days') AND datetime('now', '-1 day')
    `).get() as { accuracy: number } | undefined;

    const improvementRate = (recentAccuracy?.accuracy || 0) - (olderAccuracy?.accuracy || 0);

    const calibrationResult = this.db.prepare(`
      SELECT AVG(ABS(confidence - CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END)) as calibration
      FROM predictions WHERE verified = 1
    `).get() as { calibration: number } | undefined;

    return {
      totalPredictions,
      verifiedPredictions,
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      accuracyByType,
      improvementRate: Math.round(improvementRate * 100) / 100,
      confidenceCalibration: Math.round((1 - (calibrationResult?.calibration || 0)) * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCycles(limit = 10): Promise<FeedbackLoop[]> {
    return this.db.prepare(`
      SELECT * FROM feedback_cycles ORDER BY cycle_number DESC LIMIT ?
    `).all(limit).map((r: any) => ({
      ...r,
      improvements: JSON.parse(r.improvements || '[]'),
    })) as FeedbackLoop[];
  }

  async getInsights(limit = 20): Promise<Array<{
    id: number;
    type: string;
    insight: string;
    confidence: number;
    applied: boolean;
    timestamp: string;
  }>> {
    return this.db.prepare(`
      SELECT * FROM learning_insights ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];
  }

  async applyInsight(id: number): Promise<void> {
    this.db.prepare('UPDATE learning_insights SET applied = 1 WHERE id = ?').run(id);
  }

  async getConfidenceCalibration(): Promise<Array<{
    bucket: string;
    predicted: number;
    actual: number;
    count: number;
  }>> {
    const buckets = [
      { min: 0, max: 0.2, label: '0-20%' },
      { min: 0.2, max: 0.4, label: '20-40%' },
      { min: 0.4, max: 0.6, label: '40-60%' },
      { min: 0.6, max: 0.8, label: '60-80%' },
      { min: 0.8, max: 1.0, label: '80-100%' },
    ];

    const results = [];

    for (const bucket of buckets) {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as count,
          AVG(confidence) as predicted,
          AVG(CASE WHEN was_correct = 1 THEN 1.0 ELSE 0.0 END) as actual
        FROM predictions
        WHERE verified = 1 AND confidence BETWEEN ? AND ?
      `).get(bucket.min, bucket.max) as { count: number; predicted: number; actual: number };

      results.push({
        bucket: bucket.label,
        predicted: Math.round((stats.predicted || 0) * 100) / 100,
        actual: Math.round((stats.actual || 0) * 100) / 100,
        count: stats.count,
      });
    }

    return results;
  }
}
