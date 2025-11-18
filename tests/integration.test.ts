import { MessageQueue } from '../src/queue/messageQueue';
import { TelegramBotService } from '../src/telegram/telegramBot';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

jest.mock('node-telegram-bot-api');
jest.mock('../src/config/config');

describe('Integration Tests', () => {
  let queue: MessageQueue;
  let testDbPath: string;
  let mockConfig: any;
  let mockBot: any;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `test-queue-${Date.now()}.db`);
    queue = new MessageQueue(testDbPath);

    mockConfig = {
      botToken: 'test-token',
      userId: 12345,
    };

    mockBot = {
      getMe: jest.fn().mockResolvedValue({ id: 1, username: 'test_bot' }),
      sendMessage: jest.fn().mockResolvedValue({}),
      getUpdates: jest.fn().mockResolvedValue([]),
    };

    const TelegramBot = require('node-telegram-bot-api');
    TelegramBot.mockImplementation(() => mockBot);

    (require('../src/config/config').ConfigManager as jest.Mock).mockImplementation(() => ({
      load: jest.fn().mockReturnValue(mockConfig),
      getQueueDbPath: jest.fn().mockReturnValue(testDbPath),
    }));
  });

  afterEach(() => {
    queue.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    jest.clearAllMocks();
  });

  test('should handle full message flow: queue -> telegram', async () => {
    const telegramBot = new TelegramBotService(queue);

    queue.enqueue('to_telegram', 'Integration test message');

    await telegramBot.sendMessage('Integration test message');

    expect(mockBot.sendMessage).toHaveBeenCalledWith(12345, 'Integration test message');
  });

  test('should handle message flow: telegram -> queue', async () => {
    const telegramBot = new TelegramBotService(queue);

    mockBot.getUpdates.mockResolvedValueOnce([
      {
        update_id: 1,
        message: {
          from: { id: 12345 },
          text: 'User message',
        },
      },
    ]);

    await telegramBot.startPolling();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(queue.getUnprocessedCount()).toBe(1);
    const msg = queue.dequeue();
    expect(msg?.content).toBe('User message');
    expect(msg?.direction).toBe('from_telegram');
    
    await telegramBot.stopPolling();
  });

  test('should handle bidirectional communication', async () => {
    const telegramBot = new TelegramBotService(queue);

    mockBot.getUpdates.mockResolvedValueOnce([
      {
        update_id: 1,
        message: {
          from: { id: 12345 },
          text: 'Incoming message',
        },
      },
    ]);

    await telegramBot.startPolling();
    await new Promise(resolve => setTimeout(resolve, 100));

    const incoming = queue.dequeue();
    expect(incoming?.content).toBe('Incoming message');
    expect(incoming?.direction).toBe('from_telegram');

    await telegramBot.sendMessage('Outgoing message');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(12345, 'Outgoing message');
    
    await telegramBot.stopPolling();
  });
});
