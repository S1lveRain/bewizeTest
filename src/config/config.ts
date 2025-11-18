import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  botToken: string;
  userId: number;
  queueDbPath?: string;
}

const DEFAULT_CONFIG_FILE = path.join(os.homedir(), '.claude-telegram-mcp.json');
const DEFAULT_QUEUE_DB_PATH = path.join(os.homedir(), '.claude-telegram-mcp-queue.db');

export class ConfigManager {
  private configFile: string;
  private config: Config | null = null;

  constructor(configFile?: string) {
    this.configFile = configFile ?? DEFAULT_CONFIG_FILE;
  }

  get CONFIG_FILE(): string {
    return this.configFile;
  }

  set CONFIG_FILE(value: string) {
    this.configFile = value;
    this.config = null;
  }

  load(): Config {
    if (this.config) {
      return this.config;
    }

    if (!fs.existsSync(this.configFile)) {
      throw new Error(`Config file not found: ${this.configFile}. Please run 'npx @s1lverain/claude-telegram-mcp install' first.`);
    }

    let parsedConfig: unknown;
    try {
      const content = fs.readFileSync(this.configFile, 'utf-8');
      parsedConfig = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse config file: ${message}`);
    }

    if (!this.isValidConfig(parsedConfig)) {
      throw new Error('Invalid config file. Missing botToken or userId.');
    }

    this.config = parsedConfig;
    return this.config;
  }

  save(config: Config): void {
    this.config = config;
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
  }

  exists(): boolean {
    return fs.existsSync(this.configFile);
  }

  getConfigPath(): string {
    return this.configFile;
  }

  getQueueDbPath(): string {
    const config = this.load();
    return config.queueDbPath ?? DEFAULT_QUEUE_DB_PATH;
  }

  private isValidConfig(config: unknown): config is Config {
    return (
      typeof config === 'object' &&
      config !== null &&
      'botToken' in config &&
      'userId' in config &&
      typeof (config as Config).botToken === 'string' &&
      typeof (config as Config).userId === 'number'
    );
  }
}

