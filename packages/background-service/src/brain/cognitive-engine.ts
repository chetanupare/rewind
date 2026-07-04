import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import { OllamaClient } from '../ai/ollama-client.js';
import { KnowledgeGraph } from './knowledge-graph.js';
import { LongTermMemory } from './long-term-memory.js';
import { ConceptLearner } from './concept-learner.js';
import { IntentEngine } from './intent-engine.js';
import { PatternLearner } from './pattern-learner.js';
import { PredictionEngine } from './prediction-engine.js';
import { MemoryCompressor } from './memory-compressor.js';
import { ConfidenceSystem } from './confidence-system.js';
import { CuriosityEngine } from './curiosity-engine.js';

const log = getLogger();

interface CognitiveEvent {
  id: string;
  timestamp: string;
  type: string;
  raw: Record<string, unknown>;
  understanding: EventUnderstanding;
  importance: number;
  confidence: number;
  entities: Entity[];
  relationships: Relationship[];
}

interface EventUnderstanding {
  intent: string;
  context: string;
  summary: string;
  concepts: string[];
  isNewKnowledge: boolean;
}

interface Entity {
  type: string;
  name: string;
  properties: Record<string, unknown>;
  confidence: number;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
  strength: number;
}

export class CognitiveEngine {
  private ollama: OllamaClient;
  private knowledgeGraph: KnowledgeGraph;
  private longTermMemory: LongTermMemory;
  private conceptLearner: ConceptLearner;
  private intentEngine: IntentEngine;
  private patternLearner: PatternLearner;
  private predictionEngine: PredictionEngine;
  private memoryCompressor: MemoryCompressor;
  private confidenceSystem: ConfidenceSystem;
  private curiosityEngine: CuriosityEngine;

  private processingQueue: CognitiveEvent[] = [];
  private isProcessing = false;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ollama = new OllamaClient();
    this.knowledgeGraph = new KnowledgeGraph(db);
    this.longTermMemory = new LongTermMemory(db);
    this.conceptLearner = new ConceptLearner(db, this.ollama);
    this.intentEngine = new IntentEngine(db, this.ollama);
    this.patternLearner = new PatternLearner(db);
    this.predictionEngine = new PredictionEngine(db);
    this.memoryCompressor = new MemoryCompressor(db, this.ollama);
    this.confidenceSystem = new ConfidenceSystem(db);
    this.curiosityEngine = new CuriosityEngine(db, this.ollama);

    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cognitive_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        raw TEXT NOT NULL,
        understanding TEXT,
        importance REAL DEFAULT 0.5,
        confidence REAL DEFAULT 0.5,
        entities TEXT DEFAULT '[]',
        relationships TEXT DEFAULT '[]',
        processed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS knowledge_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        source TEXT,
        learned_at TEXT DEFAULT (datetime('now')),
        last_confirmed TEXT,
        times_confirmed INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        summary TEXT,
        intent TEXT,
        entities TEXT DEFAULT '[]',
        events TEXT DEFAULT '[]',
        importance REAL DEFAULT 0.5,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cog_events_time ON cognitive_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cog_events_type ON cognitive_events(type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_subject ON knowledge_facts(subject);
      CREATE INDEX IF NOT EXISTS idx_knowledge_object ON knowledge_facts(object);
      CREATE INDEX IF NOT EXISTS idx_episodes_time ON episodes(start_time);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('*', (event) => {
      this.processEvent(event.type, event.payload, event.timestamp);
    });
  }

  async processEvent(type: string, payload: Record<string, unknown>, timestamp: string): Promise<void> {
    const cognitiveEvent: CognitiveEvent = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type,
      raw: payload,
      understanding: {
        intent: 'unknown',
        context: '',
        summary: '',
        concepts: [],
        isNewKnowledge: false,
      },
      importance: 0.5,
      confidence: 0.5,
      entities: [],
      relationships: [],
    };

    this.processingQueue.push(cognitiveEvent);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const event = this.processingQueue.shift()!;
      
      try {
        await this.understand(event);
        await this.extractEntities(event);
        await this.findRelationships(event);
        await this.assessImportance(event);
        await this.store(event);
        await this.learn(event);
        await this.predict(event);
      } catch (err) {
        log.debug({ err, type: event.type }, 'Failed to process cognitive event');
      }
    }

    this.isProcessing = false;
  }

  private async understand(event: CognitiveEvent): Promise<void> {
    const intent = await this.intentEngine.detect(event.type, event.raw);
    event.understanding.intent = intent.type;
    event.understanding.context = intent.context;
    event.understanding.summary = intent.summary;
    event.understanding.concepts = intent.concepts;
  }

  private async extractEntities(event: CognitiveEvent): Promise<void> {
    const entities: Entity[] = [];

    if (event.raw.appName) {
      entities.push({
        type: 'application',
        name: event.raw.appName as string,
        properties: { executable: event.raw.executable },
        confidence: 0.95,
      });
    }

    if (event.raw.windowTitle) {
      const projectMatch = (event.raw.windowTitle as string).match(/([A-Z][a-zA-Z]+(?:CRM|API|App|Web|UI|Service))/);
      if (projectMatch) {
        entities.push({
          type: 'project',
          name: projectMatch[1],
          properties: {},
          confidence: 0.7,
        });
      }
    }

    if (event.raw.repoPath) {
      entities.push({
        type: 'repository',
        name: (event.raw.repoPath as string).split(/[/\\]/).pop() || '',
        properties: { path: event.raw.repoPath, branch: event.raw.branch },
        confidence: 0.9,
      });
    }

    if (event.raw.commitMessage) {
      entities.push({
        type: 'commit',
        name: (event.raw.commitMessage as string).substring(0, 50),
        properties: { hash: event.raw.commitHash, message: event.raw.commitMessage },
        confidence: 0.95,
      });
    }

    event.entities = entities;
  }

  private async findRelationships(event: CognitiveEvent): Promise<void> {
    const relationships: Relationship[] = [];

    for (let i = 0; i < event.entities.length; i++) {
      for (let j = i + 1; j < event.entities.length; j++) {
        const source = event.entities[i];
        const target = event.entities[j];

        relationships.push({
          source: source.name,
          target: target.name,
          type: this.inferRelationshipType(source.type, target.type),
          strength: 0.7,
        });
      }
    }

    event.relationships = relationships;
  }

  private inferRelationshipType(sourceType: string, targetType: string): string {
    const typeMap: Record<string, string> = {
      'application:project': 'works_on',
      'project:repository': 'stored_in',
      'repository:commit': 'contains',
      'application:commit': 'created',
      'project:commit': 'part_of',
    };

    return typeMap[`${sourceType}:${targetType}`] || 'related_to';
  }

  private async assessImportance(event: CognitiveEvent): Promise<void> {
    let importance = 0.5;

    const highImportanceEvents = ['GIT_COMMIT', 'MEETING_STARTED', 'FOCUS_COMPLETED'];
    const lowImportanceEvents = ['MOUSE_CLICKED', 'MOUSE_MOVED', 'SYSTEM_RESOURCE_UPDATE'];

    if (highImportanceEvents.includes(event.type)) {
      importance += 0.3;
    } else if (lowImportanceEvents.includes(event.type)) {
      importance -= 0.3;
    }

    if (event.entities.length > 2) {
      importance += 0.1;
    }

    if (event.understanding.concepts.length > 0) {
      importance += 0.1;
    }

    event.importance = Math.max(0, Math.min(1, importance));
  }

  private async store(event: CognitiveEvent): Promise<void> {
    try {
      this.db.prepare(`
        INSERT INTO cognitive_events (id, timestamp, type, raw, understanding, importance, confidence, entities, relationships, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        event.id,
        event.timestamp,
        event.type,
        JSON.stringify(event.raw),
        JSON.stringify(event.understanding),
        event.importance,
        event.confidence,
        JSON.stringify(event.entities),
        JSON.stringify(event.relationships)
      );

      for (const relationship of event.relationships) {
        this.knowledgeGraph.addRelationship(
          relationship.source,
          relationship.target,
          relationship.type,
          relationship.strength
        );
      }

      for (const entity of event.entities) {
        await this.longTermMemory.remember({
          type: entity.type,
          name: entity.name,
          properties: entity.properties,
          importance: event.importance,
          source: event.type,
        });
      }
    } catch (err) {
      log.debug({ err }, 'Failed to store cognitive event');
    }
  }

  private async learn(event: CognitiveEvent): Promise<void> {
    for (const concept of event.understanding.concepts) {
      await this.conceptLearner.learn(concept, {
        source: event.type,
        context: event.understanding.context,
        entities: event.entities.map(e => e.name),
      });
    }

    this.patternLearner.observe({
      type: event.type,
      intent: event.understanding.intent,
      entities: event.entities.map(e => ({ type: e.type, name: e.name })),
      timestamp: event.timestamp,
    });

    if (event.importance > 0.7) {
      this.db.prepare(`
        INSERT INTO knowledge_facts (subject, predicate, object, confidence, source)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        event.entities[0]?.name || 'unknown',
        event.understanding.intent,
        event.understanding.summary,
        event.confidence,
        event.type
      );
    }
  }

  private async predict(event: CognitiveEvent): Promise<void> {
    const prediction = await this.predictionEngine.predict({
      currentEvent: event.type,
      intent: event.understanding.intent,
      entities: event.entities,
    });

    if (prediction && prediction.confidence > 0.6) {
      this.bus.emit('PREDICTION', 'cognitive-engine', {
        prediction: prediction.action,
        confidence: prediction.confidence,
        context: prediction.context,
      });
    }

    await this.curiosityEngine.observe({
      type: event.type,
      entities: event.entities,
      intent: event.understanding.intent,
    });
  }

  async query(question: string): Promise<{
    answer: string;
    confidence: number;
    sources: string[];
    relatedMemories: any[];
  }> {
    const relevantKnowledge = await this.knowledgeGraph.query(question);
    const relevantMemories = await this.longTermMemory.search(question);
    const concepts = await this.conceptLearner.findRelated(question);
    const confidence = this.confidenceSystem.assess(question, relevantKnowledge, relevantMemories);

    const context = this.buildContext(relevantKnowledge, relevantMemories, concepts);

    let answer: string;
    try {
      answer = await this.ollama.generate({
        model: 'qwen2.5-coder:3b',
        prompt: `Based on the following knowledge and memories, answer the question. Be specific and reference actual data.

Knowledge: ${JSON.stringify(relevantKnowledge.slice(0, 10))}
Memories: ${JSON.stringify(relevantMemories.slice(0, 5))}
Concepts: ${concepts.join(', ')}

Question: ${question}

Answer based ONLY on the provided data:`,
      });
    } catch {
      answer = 'I could not generate an answer at this time.';
    }

    return {
      answer,
      confidence,
      sources: relevantKnowledge.map(k => k.source).filter(Boolean),
      relatedMemories: relevantMemories.slice(0, 5),
    };
  }

  private buildContext(knowledge: any[], memories: any[], concepts: string[]): string {
    let context = '';

    if (knowledge.length > 0) {
      context += 'Known facts:\n';
      for (const k of knowledge.slice(0, 5)) {
        context += `- ${k.subject} ${k.predicate} ${k.object}\n`;
      }
    }

    if (memories.length > 0) {
      context += '\nRelevant memories:\n';
      for (const m of memories.slice(0, 3)) {
        context += `- ${m.name}: ${m.summary || 'No summary'}\n`;
      }
    }

    if (concepts.length > 0) {
      context += `\nRelated concepts: ${concepts.join(', ')}`;
    }

    return context;
  }

  async getInsights(): Promise<string[]> {
    const insights: string[] = [];

    const patterns = this.patternLearner.getTopPatterns(5);
    for (const pattern of patterns) {
      insights.push(`Pattern detected: ${pattern.description}`);
    }

    const predictions = await this.predictionEngine.getRecentPredictions(3);
    for (const pred of predictions) {
      insights.push(`Prediction: ${pred.action} (${Math.round(pred.confidence * 100)}% confidence)`);
    }

    const questions = this.curiosityEngine.getQuestions();
    for (const q of questions.slice(0, 2)) {
      insights.push(`Curious about: ${q}`);
    }

    return insights;
  }

  async reflect(): Promise<void> {
    log.info('Starting cognitive reflection...');

    await this.memoryCompressor.compress();
    await this.knowledgeGraph.cleanup();
    await this.patternLearner.consolidate();
    await this.curiosityEngine.update();

    log.info('Cognitive reflection complete');
  }

  getGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }

  getMemory(): LongTermMemory {
    return this.longTermMemory;
  }

  getConfidence(): ConfidenceSystem {
    return this.confidenceSystem;
  }

  getCuriosity(): CuriosityEngine {
    return this.curiosityEngine;
  }
}
