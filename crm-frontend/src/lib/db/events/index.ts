import { EventType } from '../types';

type EventHandler = (data: any) => void;

const eventHandlers: Map<EventType, EventHandler[]> = new Map();

/**
 * Subscribe to an event
 * @returns Unsubscribe function
 */
export function onEvent(event: EventType, handler: EventHandler): () => void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, []);
  }
  eventHandlers.get(event)!.push(handler);
  
  // Return unsubscribe function
  return () => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };
}

/**
 * Emit an event to all subscribers
 */
export function emitEvent(event: EventType, data: any): void {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

/**
 * Clear all event handlers (for testing)
 */
export function clearEventHandlers(): void {
  eventHandlers.clear();
}
