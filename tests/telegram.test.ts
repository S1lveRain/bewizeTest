import { TelegramBotService } from '../src/telegram/telegramBot';
import { MessageQueue } from '../src/queue/messageQueue';
import { ConfigManager } from '../src/config/config';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

jest.mock('node-telegram-bot-api');
jest.mock('../src/config/config');

describe('TelegramBotService', () => {
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

    (ConfigManager as jest.Mock).mockImplementation(() => ({
      load: jest.fn().mockReturnValue(mockConfig),
    }));
  });

  afterEach(() => {
    queue.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    jest.clearAllMocks();
  });

  test('should enqueue messages from authorized user via polling', async () => {
    const service = new TelegramBotService(queue);
    
    mockBot.getUpdates.mockResolvedValueOnce([
      {
        update_id: 1,
        message: {
          from: { id: 12345 },
          text: 'Test message',
        },
      },
    ]);

    await service.startPolling();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(queue.getUnprocessedCount()).toBe(1);
    const msg = queue.dequeue();
    expect(msg?.content).toBe('Test message');
    expect(msg?.direction).toBe('from_telegram');
    
    await service.stopPolling();
  });

  test('should ignore messages from unauthorized users', async () => {
    const service = new TelegramBotService(queue);
    
    expect(queue.getUnprocessedCount()).toBe(0);
    
    mockBot.getUpdates.mockResolvedValueOnce([
      {
        update_id: 1,
        message: {
          from: { id: 99999 },
          text: 'Unauthorized',
        },
      },
    ]);

    await service.startPolling();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(queue.getUnprocessedCount()).toBe(0);
    expect(mockBot.getUpdates).toHaveBeenCalled();
    
    await service.stopPolling();
  }, 10000);

  test('should send messages', async () => {
    const service = new TelegramBotService(queue);
    await service.sendMessage('Test message');

    expect(mockBot.sendMessage).toHaveBeenCalledWith(12345, 'Test message');
  });

  test('should test connection', async () => {
    const service = new TelegramBotService(queue);
    const result = await service.testConnection();

    expect(result).toBe(true);
    expect(mockBot.getMe).toHaveBeenCalled();
  });

  test('should skip duplicate update IDs', async () => {
    const service = new TelegramBotService(queue);
    
    mockBot.getUpdates
      .mockResolvedValueOnce([
        {
          update_id: 1,
          message: {
            from: { id: 12345 },
            text: 'First message',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          update_id: 1,
          message: {
            from: { id: 12345 },
            text: 'Duplicate',
          },
        },
      ]);

    await service.startPolling();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(queue.getUnprocessedCount()).toBe(1);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(queue.getUnprocessedCount()).toBe(1);
    
    await service.stopPolling();
  });
});
