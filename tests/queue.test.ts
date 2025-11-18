import { MessageQueue } from '../src/queue/messageQueue';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('MessageQueue', () => {
  let queue: MessageQueue;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `test-queue-${Date.now()}.db`);
    queue = new MessageQueue(testDbPath);
  });

  afterEach(() => {
    queue.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should enqueue messages', () => {
    const id1 = queue.enqueue('to_telegram', 'Message 1');
    const id2 = queue.enqueue('from_telegram', 'Message 2');

    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(id1);
  });

  test('should dequeue messages in FIFO order', () => {
    queue.enqueue('to_telegram', 'First');
    queue.enqueue('to_telegram', 'Second');
    queue.enqueue('to_telegram', 'Third');

    const msg1 = queue.dequeue();
    const msg2 = queue.dequeue();
    const msg3 = queue.dequeue();

    expect(msg1?.content).toBe('First');
    expect(msg2?.content).toBe('Second');
    expect(msg3?.content).toBe('Third');
  });

  test('should return null when queue is empty', () => {
    expect(queue.dequeue()).toBeNull();
  });

  test('should peek without removing', () => {
    queue.enqueue('to_telegram', 'Test');
    
    const peek1 = queue.peek();
    const peek2 = queue.peek();
    const dequeue = queue.dequeue();

    expect(peek1?.content).toBe('Test');
    expect(peek2?.content).toBe('Test');
    expect(dequeue?.content).toBe('Test');
    expect(queue.peek()).toBeNull();
  });

  test('should count unprocessed messages', () => {
    expect(queue.getUnprocessedCount()).toBe(0);
    
    queue.enqueue('to_telegram', 'Msg1');
    queue.enqueue('to_telegram', 'Msg2');
    expect(queue.getUnprocessedCount()).toBe(2);

    queue.dequeue();
    expect(queue.getUnprocessedCount()).toBe(1);

    queue.dequeue();
    expect(queue.getUnprocessedCount()).toBe(0);
  });

  test('should persist messages across instances', () => {
    queue.enqueue('to_telegram', 'Persistent');
    queue.close();

    const newQueue = new MessageQueue(testDbPath);
    const msg = newQueue.dequeue();
    expect(msg?.content).toBe('Persistent');
    newQueue.close();
  });
});

