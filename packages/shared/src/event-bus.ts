import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { EventPayload, EventType, CollectorSource } from './types/events.js';

export type EventHandler = (event: EventPayload) => void | Promise<void>;

export class EventBus {
  private emitter = new EventEmitter();
  private history: EventPayload[] = [];
  private maxHistory: number;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(maxHistory = 10_000) {
    this.maxHistory = maxHistory;
    this.emitter.setMaxListeners(100);
  }

  emit(type: EventType, source: CollectorSource, payload: Record<string, unknown> = {}): EventPayload {
    const event: EventPayload = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type,
      source,
      payload,
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emitter.emit(type, event);
    this.emitter.emit('*', event);

    return event;
  }

  on(type: EventType | '*', handler: EventHandler): () => void {
    this.emitter.on(type, handler);

    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.emitter.off(type, handler);
      this.handlers.get(type)?.delete(handler);
    };
  }

  once(type: EventType | '*', handler: EventHandler): () => void {
    const wrapper = (event: EventPayload) => {
      handler(event);
      this.handlers.get(type)?.delete(wrapper);
    };

    this.emitter.once(type, wrapper);

    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(wrapper);

    return () => {
      this.emitter.off(type, wrapper);
      this.handlers.get(type)?.delete(wrapper);
    };
  }

  getHistory(type?: EventType, limit = 100): EventPayload[] {
    const events = type
      ? this.history.filter((e) => e.type === type)
      : this.history;
    return events.slice(-limit);
  }

  getHandlerCount(type: EventType | '*'): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  removeAllListeners(type?: EventType | '*'): void {
    if (type) {
      this.emitter.removeAllListeners(type);
      this.handlers.delete(type);
    } else {
      this.emitter.removeAllListeners();
      this.handlers.clear();
    }
  }

  async replay(events: EventPayload[]): Promise<void> {
    for (const event of events) {
      this.emitter.emit(event.type, event);
      this.emitter.emit('*', event);
    }
  }
}

export const eventBus = new EventBus();
