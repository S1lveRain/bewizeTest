import { ConfigManager, Config } from '../src/config/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  const testConfigPath = path.join(os.tmpdir(), 'test-claude-telegram-mcp.json');
  let originalConfigPath: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    configManager = new ConfigManager();
    originalConfigPath = (configManager as any).CONFIG_FILE;
    (configManager as any).CONFIG_FILE = testConfigPath;
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test('should save and load config', () => {
    const config: Config = {
      botToken: 'test-token',
      userId: 12345,
    };

    configManager.save(config);
    const loaded = configManager.load();

    expect(loaded.botToken).toBe('test-token');
    expect(loaded.userId).toBe(12345);
  });

  test('should throw error when config does not exist', () => {
    expect(() => configManager.load()).toThrow('Config file not found');
  });

  test('should throw error when config is invalid', () => {
    fs.writeFileSync(testConfigPath, '{}', 'utf-8');
    expect(() => configManager.load()).toThrow('Invalid config file');
  });

  test('should check if config exists', () => {
    expect(configManager.exists()).toBe(false);
    configManager.save({ botToken: 'test', userId: 123 });
    expect(configManager.exists()).toBe(true);
  });

  test('should return queue db path', () => {
    const config: Config = {
      botToken: 'test-token',
      userId: 12345,
      queueDbPath: '/custom/path.db',
    };
    configManager.save(config);
    expect(configManager.getQueueDbPath()).toBe('/custom/path.db');
  });
});

