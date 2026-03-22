import { logger } from '../utils/Logger';
import { CONFIG } from '../config';

/**
 * Per-Room Event Queue — Concurrency Control
 *
 * Problem: Multiple players can guess correctly at nearly the same time.
 * Even though Node.js is single-threaded, async operations (broadcasts, timers)
 * can interleave event processing if handlers use `await`. This queue ensures
 * all state-mutating events for a given room are processed sequentially.
 *
 * How: For each room, we maintain a FIFO queue of handler functions.
 * When a new handler is enqueued, it only executes after all previous
 * handlers for that room have completed.
 */

type QueuedHandler = () => Promise<void>;

interface RoomQueue {
  queue: QueuedHandler[];
  processing: boolean;
}

export class EventQueue {
  private queues = new Map<string, RoomQueue>();

  /**
   * Enqueue a handler to be processed serially for the given room.
   * Returns false if the queue is at max capacity (backpressure).
   */
  enqueue(roomId: string, handler: QueuedHandler): boolean {
    let roomQueue = this.queues.get(roomId);

    if (!roomQueue) {
      roomQueue = { queue: [], processing: false };
      this.queues.set(roomId, roomQueue);
    }

    // Backpressure: drop events if queue is overloaded
    if (roomQueue.queue.length >= CONFIG.MAX_QUEUE_DEPTH) {
      logger.warn('Event queue backpressure — dropping event', { roomId, depth: roomQueue.queue.length });
      return false;
    }

    roomQueue.queue.push(handler);

    // If not currently processing, start draining
    if (!roomQueue.processing) {
      this.processQueue(roomId, roomQueue);
    }

    return true;
  }

  /**
   * Process handlers one at a time (FIFO).
   */
  private async processQueue(roomId: string, roomQueue: RoomQueue): Promise<void> {
    roomQueue.processing = true;

    while (roomQueue.queue.length > 0) {
      const handler = roomQueue.queue.shift()!;
      try {
        await handler();
      } catch (err) {
        logger.error('Error processing queued event', {
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    roomQueue.processing = false;
  }

  /**
   * Remove a room's queue (on room cleanup).
   */
  removeRoom(roomId: string): void {
    this.queues.delete(roomId);
  }
}

export const eventQueue = new EventQueue();
