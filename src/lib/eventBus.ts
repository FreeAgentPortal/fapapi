// src/lib/eventBus.ts
type EventHandler<T> = (payload: T) => void | Promise<void>;

class EventBus {
  private handlers: Record<string, EventHandler<any>[]> = {};

  public subscribe<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  public async publish<T>(event: string, payload: T): Promise<void> {
    const handlers = this.handlers[event] || [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const eventBus = new EventBus();
