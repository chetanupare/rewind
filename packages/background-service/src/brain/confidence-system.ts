import { Database, getLogger } from '@ai-work-memory/shared';

const log = getLogger();

interface ConfidenceScore {
  value: number;
  factors: {
    sourceReliability: number;
    consistency: number;
    recency: number;
    corroboration: number;
  };
  explanation: string;
}

export class ConfidenceSystem {
  constructor(private db: Database) {}

  assess(query: string, knowledge: any[], memories: any[]): number {
    let confidence = 0.5;

    if (knowledge.length > 0) {
      const avgConfidence = knowledge.reduce((sum, k) => sum + (k.confidence || 0.5), 0) / knowledge.length;
      confidence = Math.max(confidence, avgConfidence);
    }

    if (memories.length > 0) {
      const avgImportance = memories.reduce((sum, m) => sum + (m.importance || 0.5), 0) / memories.length;
      confidence = Math.max(confidence, avgImportance * 0.8);
    }

    const recentCount = memories.filter(m => {
      const age = Date.now() - new Date(m.last_seen || m.lastSeen).getTime();
      return age < 7 * 24 * 60 * 60 * 1000;
    }).length;

    if (recentCount > 3) {
      confidence = Math.min(1, confidence + 0.1);
    }

    return Math.round(confidence * 100) / 100;
  }

  assessMemory(memory: { type: string; name: string; lastSeen: string; timesAccessed: number }): ConfidenceScore {
    const factors = {
      sourceReliability: this.getSourceReliability(memory.type),
      consistency: this.getConsistency(memory.name),
      recency: this.getRecency(memory.lastSeen),
      corroboration: this.getCorroboration(memory.name),
    };

    const value = (
      factors.sourceReliability * 0.3 +
      factors.consistency * 0.3 +
      factors.recency * 0.2 +
      factors.corroboration * 0.2
    );

    return {
      value: Math.round(value * 100) / 100,
      factors,
      explanation: this.generateExplanation(factors),
    };
  }

  private getSourceReliability(type: string): number {
    const reliability: Record<string, number> = {
      'git_commit': 0.95,
      'activity': 0.8,
      'screenshot': 0.7,
      'clipboard': 0.6,
      'browser': 0.7,
      'meeting': 0.8,
    };

    return reliability[type] || 0.5;
  }

  private getConsistency(name: string): number {
    const count = (this.db.prepare(
      'SELECT COUNT(*) as count FROM cognitive_events WHERE raw LIKE ?'
    ).get(`%${name}%`) as { count: number }).count;

    return Math.min(1, count / 10);
  }

  private getRecency(lastSeen: string): number {
    const age = Date.now() - new Date(lastSeen).getTime();
    const days = age / (24 * 60 * 60 * 1000);

    if (days < 1) return 1;
    if (days < 7) return 0.8;
    if (days < 30) return 0.5;
    return 0.3;
  }

  private getCorroboration(name: string): number {
    const sources = new Set<string>();

    const activities = this.db.prepare(
      'SELECT DISTINCT app_name FROM activities WHERE window_title LIKE ?'
    ).all(`%${name}%`) as Array<{ app_name: string }>;
    activities.forEach(a => sources.add(a.app_name));

    const screenshots = this.db.prepare(
      'SELECT DISTINCT ai_app FROM screenshots WHERE ai_description LIKE ?'
    ).all(`%${name}%`) as Array<{ ai_app: string }>;
    screenshots.forEach(s => sources.add(s.ai_app));

    return Math.min(1, sources.size / 3);
  }

  private generateExplanation(factors: ConfidenceScore['factors']): string {
    const parts: string[] = [];

    if (factors.sourceReliability > 0.8) parts.push('reliable source');
    if (factors.consistency > 0.7) parts.push('consistent data');
    if (factors.recency > 0.8) parts.push('recent information');
    if (factors.corroboration > 0.7) parts.push('multiple sources agree');

    return parts.length > 0 ? `Confidence based on: ${parts.join(', ')}` : 'Limited confidence';
  }
}
