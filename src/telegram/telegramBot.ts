import TelegramBot from 'node-telegram-bot-api';
import { ConfigManager } from '../config/config';
import { MessageQueue } from '../queue/messageQueue';
import { EventEmitter } from 'events';
import { Config } from '../config/config';

const POLLING_TIMEOUT = 10;
const POLLING_LIMIT = 100;
const POLLING_INTERVAL = 1000;
const MAX_PROCESSED_IDS = 200;
const CLEANUP_THRESHOLD = 100;

export class TelegramBotService extends EventEmitter {
  private readonly bot: TelegramBot;
  private readonly queue: MessageQueue;
  private readonly config: Config;
  private polling: boolean = false;
  private lastUpdateId: number = 0;
  private readonly processedUpdateIds: Set<number> = new Set();
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(queue: MessageQueue) {
    super();
    const configManager = new ConfigManager();
    this.config = configManager.load();
    this.queue = queue;
    this.bot = new TelegramBot(this.config.botToken, { polling: false });
  }

  async startPolling(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;
    await this.pollUpdates();
  }

  private async pollUpdates(): Promise<void> {
    if (!this.polling) {
      return;
    }

    try {
      const updates = await this.bot.getUpdates({
        offset: this.lastUpdateId + 1,
        timeout: POLLING_TIMEOUT,
        limit: POLLING_LIMIT,
      });

      for (const update of updates) {
        if (this.processedUpdateIds.has(update.update_id)) {
          continue;
        }

        this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

        const message = update.message;
        if (this.shouldProcessMessage(message)) {
          const content = message.text || '';
          this.processedUpdateIds.add(update.update_id);
          this.cleanupProcessedIds();
          this.queue.enqueue('from_telegram', content);
          this.emit('message', content);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }

    if (this.polling) {
      this.pollingTimeout = setTimeout(() => this.pollUpdates(), POLLING_INTERVAL);
    }
  }

  private shouldProcessMessage(message: TelegramBot.Message | undefined): message is TelegramBot.Message {
    return (
      message !== undefined &&
      message.from?.id === this.config.userId &&
      Boolean(message.text)
    );
  }

  private cleanupProcessedIds(): void {
    if (this.processedUpdateIds.size <= MAX_PROCESSED_IDS) {
      return;
    }

    const minId = this.lastUpdateId - CLEANUP_THRESHOLD;
    for (const id of this.processedUpdateIds) {
      if (id < minId) {
        this.processedUpdateIds.delete(id);
      }
    }
  }

  async stopPolling(): Promise<void> {
    this.polling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  async sendMessage(content: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.config.userId, content);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.bot.getMe();
      return true;
    } catch {
      return false;
    }
  }

  getBotInfo(): Promise<TelegramBot.User> {
    return this.bot.getMe();
  }
}

