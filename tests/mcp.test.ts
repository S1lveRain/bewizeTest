import { MessageQueue } from '../src/queue/messageQueue';
import { TelegramBotService } from '../src/telegram/telegramBot';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

jest.mock('../src/mcp/mcpServer', () => {
  return {
    MCPServer: jest.fn().mockImplementation((queue: MessageQueue, telegramBot: TelegramBotService) => {
      return {
        queue,
        telegramBot,
        on: jest.fn(),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

jest.mock('node-telegram-bot-api');
jest.mock('../src/config/config');

describe('MCP Server Integration with Queue', () => {
  let queue: MessageQueue;
  let telegramBot: TelegramBotService;
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

  test('should enqueue messages to telegram', () => {
    expect(queue.getUnprocessedCount()).toBe(0);
    
    queue.enqueue('to_telegram', 'Test message');
    
    expect(queue.getUnprocessedCount()).toBe(1);
    
    const msg = queue.dequeue();
    expect(msg?.content).toBe('Test message');
    expect(msg?.direction).toBe('to_telegram');
  });

  test('should dequeue messages from telegram', () => {
    queue.enqueue('from_telegram', 'Message 1');
    queue.enqueue('from_telegram', 'Message 2');

    const msg1 = queue.dequeue();
    const msg2 = queue.dequeue();

    expect(msg1?.content).toBe('Message 1');
    expect(msg2?.content).toBe('Message 2');
    expect(msg1?.direction).toBe('from_telegram');
    expect(msg2?.direction).toBe('from_telegram');
  });

  test('should maintain FIFO order', () => {
    queue.enqueue('to_telegram', 'First');
    queue.enqueue('to_telegram', 'Second');
    queue.enqueue('to_telegram', 'Third');

    expect(queue.dequeue()?.content).toBe('First');
    expect(queue.dequeue()?.content).toBe('Second');
    expect(queue.dequeue()?.content).toBe('Third');
  });
});
