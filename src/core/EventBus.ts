import type { EventName, EventPayloads } from '../types/events';

type Handler<E extends EventName> = (payload: EventPayloads[E]) => void;

class EventBus {
  private listeners: Map<EventName, Set<Handler<EventName>>> = new Map();

  on<E extends EventName>(event: E, handler: Handler<E>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<EventName>);
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.listeners.get(event)?.delete(handler as Handler<EventName>);
  }

  emit<E extends EventName>(event: E, payload: EventPayloads[E]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}

export const bus = new EventBus();
