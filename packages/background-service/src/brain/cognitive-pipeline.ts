import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import { CognitiveEngine } from './cognitive-engine.js';
import { EpisodicMemory } from './episodic-memory.js';
import { WorkingMemory } from './working-memory.js';
import { DecisionTracker } from './decision-tracker.js';
import { MistakeLearner } from './mistake-learner.js';
import { ConfidenceEvolution } from './confidence-evolution.js';
import { UserPersonalityModel } from './personality-model.js';
import { AIReflection } from './ai-reflection.js';
import { ReasoningEngine } from './reasoning-engine.js';
import { AIMentor } from './ai-mentor.js';
import { CognitiveFeedbackLoop } from './feedback-loop.js';

const log = getLogger();

export class CognitivePipeline {
  private cognitiveEngine: CognitiveEngine;
  private episodicMemory: EpisodicMemory;
  private workingMemory: WorkingMemory;
  private decisionTracker: DecisionTracker;
  private mistakeLearner: MistakeLearner;
  private confidenceEvolution: ConfidenceEvolution;
  private personalityModel: UserPersonalityModel;
  private aiReflection: AIReflection;
  private reasoningEngine: ReasoningEngine;
  private aiMentor: AIMentor;
  private feedbackLoop: CognitiveFeedbackLoop;

  constructor(
    private db: Database,
    private bus: EventBus,
    private ollama: OllamaClient
  ) {
    this.cognitiveEngine = new CognitiveEngine(db, bus);
    this.episodicMemory = new EpisodicMemory(db, bus, ollama);
    this.workingMemory = new WorkingMemory(db, bus);
    this.decisionTracker = new DecisionTracker(db, bus, ollama);
    this.mistakeLearner = new MistakeLearner(db, bus);
    this.confidenceEvolution = new ConfidenceEvolution(db);
    this.personalityModel = new UserPersonalityModel(db);
    this.aiReflection = new AIReflection(db, bus, ollama);
    this.reasoningEngine = new ReasoningEngine(db, ollama);
    this.aiMentor = new AIMentor(db, bus, ollama);
    this.feedbackLoop = new CognitiveFeedbackLoop(db, bus, ollama);

    this.setupEventListeners();
    log.info('Cognitive Pipeline initialized with all 11 modules');
  }

  private setupEventListeners(): void {
    this.bus.on('*', (event) => {
      this.processEvent(event.type, event.payload);
    });
  }

  private async processEvent(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.cognitiveEngine.processEvent(type, payload, new Date().toISOString());
  }

  async query(question: string): Promise<{
    answer: string;
    confidence: number;
    sources: string[];
    reasoning: string[];
    context: string;
  }> {
    const workingContext = this.workingMemory.getContextString();

    const cognitiveResult = await this.cognitiveEngine.query(question);
    const reasoningResult = await this.reasoningEngine.reason(question);

    const combinedConfidence = (cognitiveResult.confidence + reasoningResult.confidence) / 2;

    return {
      answer: reasoningResult.answer || cognitiveResult.answer,
      confidence: combinedConfidence,
      sources: [...new Set([...cognitiveResult.sources, ...reasoningResult.sources])],
      reasoning: reasoningResult.reasoning,
      context: workingContext,
    };
  }

  async getInsights(): Promise<{
    cognitive: string[];
    mentor: string[];
    learning: string[];
    predictions: any[];
  }> {
    const cognitive = await this.cognitiveEngine.getInsights();
    const mentor = await this.aiMentor.generateProactiveSuggestions();
    const learning = await this.personalityModel.getProductivityInsights();
    const predictions = [];

    return {
      cognitive,
      mentor,
      learning,
      predictions,
    };
  }

  async reflect(): Promise<void> {
    await this.cognitiveEngine.reflect();
    await this.aiReflection.dailyReflection();
    await this.feedbackLoop.endCycle();
    log.info('Full cognitive reflection completed');
  }

  getCognitiveEngine(): CognitiveEngine { return this.cognitiveEngine; }
  getEpisodicMemory(): EpisodicMemory { return this.episodicMemory; }
  getWorkingMemory(): WorkingMemory { return this.workingMemory; }
  getDecisionTracker(): DecisionTracker { return this.decisionTracker; }
  getMistakeLearner(): MistakeLearner { return this.mistakeLearner; }
  getConfidenceEvolution(): ConfidenceEvolution { return this.confidenceEvolution; }
  getPersonalityModel(): UserPersonalityModel { return this.personalityModel; }
  getAIReflection(): AIReflection { return this.aiReflection; }
  getReasoningEngine(): ReasoningEngine { return this.reasoningEngine; }
  getAIMentor(): AIMentor { return this.aiMentor; }
  getFeedbackLoop(): CognitiveFeedbackLoop { return this.feedbackLoop; }
}
