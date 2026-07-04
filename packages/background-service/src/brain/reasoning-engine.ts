import { Database, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';

const log = getLogger();

interface ReasoningResult {
  answer: string;
  reasoning: string[];
  confidence: number;
  evidence: string[];
  sources: string[];
}

export class ReasoningEngine {
  constructor(
    private db: Database,
    private ollama: OllamaClient
  ) {}

  async reason(question: string): Promise<ReasoningResult> {
    const evidence = await this.gatherEvidence(question);
    const reasoning = this.buildReasoningChain(question, evidence);

    let answer: string;
    try {
      const isAvailable = await this.ollama.isAvailable();
      if (isAvailable) {
        answer = await this.generateAnswer(question, evidence, reasoning);
      } else {
        answer = this.generateBasicAnswer(question, evidence);
      }
    } catch {
      answer = this.generateBasicAnswer(question, evidence);
    }

    const confidence = this.calculateConfidence(evidence);

    return {
      answer,
      reasoning,
      confidence,
      evidence: evidence.map(e => e.summary),
      sources: evidence.map(e => e.source),
    };
  }

  private async gatherEvidence(question: string): Promise<Array<{
    type: string;
    summary: string;
    source: string;
    relevance: number;
  }>> {
    const evidence: Array<{
      type: string;
      summary: string;
      source: string;
      relevance: number;
    }> = [];

    const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    for (const word of words) {
      const activities = this.db.prepare(`
        SELECT app_name, window_title, timestamp FROM activities
        WHERE window_title LIKE ? OR app_name LIKE ?
        ORDER BY timestamp DESC LIMIT 5
      `).all(`%${word}%`, `%${word}%`) as any[];

      for (const a of activities) {
        evidence.push({
          type: 'activity',
          summary: `${a.app_name}: ${a.window_title}`,
          source: 'activities',
          relevance: 0.7,
        });
      }

      const screenshots = this.db.prepare(`
        SELECT ai_app, ai_task, ai_description, timestamp FROM screenshots
        WHERE ai_description LIKE ? OR ai_task LIKE ?
        ORDER BY timestamp DESC LIMIT 3
      `).all(`%${word}%`, `%${word}%`) as any[];

      for (const s of screenshots) {
        evidence.push({
          type: 'screenshot',
          summary: `${s.ai_app}: ${s.ai_task}`,
          source: 'screenshots',
          relevance: 0.8,
        });
      }

      const commits = this.db.prepare(`
        SELECT commit_message, repo_path, timestamp FROM git_events
        WHERE commit_message LIKE ?
        ORDER BY timestamp DESC LIMIT 3
      `).all(`%${word}%`) as any[];

      for (const c of commits) {
        evidence.push({
          type: 'commit',
          summary: `${c.repo_path}: ${c.commit_message}`,
          source: 'git_events',
          relevance: 0.9,
        });
      }
    }

    return evidence.sort((a, b) => b.relevance - a.relevance).slice(0, 20);
  }

  private buildReasoningChain(question: string, evidence: Array<{ type: string; summary: string }>): string[] {
    const chain: string[] = [];

    chain.push(`Question: ${question}`);
    chain.push(`Found ${evidence.length} pieces of evidence`);

    const types = new Set(evidence.map(e => e.type));
    chain.push(`Evidence types: ${Array.from(types).join(', ')}`);

    if (evidence.length > 0) {
      chain.push(`Most relevant: ${evidence[0].summary}`);
    }

    return chain;
  }

  private async generateAnswer(question: string, evidence: Array<{ summary: string }>, reasoning: string[]): Promise<string> {
    const prompt = `Based on this evidence, answer the question:

Evidence:
${evidence.map(e => `- ${e.summary}`).join('\n')}

Reasoning: ${reasoning.join(' → ')}

Question: ${question}

Answer:`;

    return await this.ollama.generate({
      model: 'qwen2.5-coder:3b',
      prompt,
    });
  }

  private generateBasicAnswer(question: string, evidence: Array<{ summary: string }>): string {
    if (evidence.length === 0) {
      return 'I could not find relevant information to answer this question.';
    }

    return `Based on ${evidence.length} pieces of evidence: ${evidence[0].summary}`;
  }

  private calculateConfidence(evidence: Array<{ relevance: number }>): number {
    if (evidence.length === 0) return 0.1;

    const avgRelevance = evidence.reduce((sum, e) => sum + e.relevance, 0) / evidence.length;
    const quantityFactor = Math.min(1, evidence.length / 10);

    return Math.round((avgRelevance * 0.7 + quantityFactor * 0.3) * 100) / 100;
  }

  async answerWithReasoning(question: string): Promise<ReasoningResult> {
    return this.reason(question);
  }
}
