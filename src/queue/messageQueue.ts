import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../config/config';

export interface QueueMessage {
  id: number;
  direction: 'to_telegram' | 'from_telegram';
  content: string;
  timestamp: number;
  processed: number;
}

type MessageDirection = 'to_telegram' | 'from_telegram';

const DEFAULT_QUEUE_DB_PATH = path.join(os.homedir(), '.claude-telegram-mcp-queue.db');

export class MessageQueue {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private readonly getNextUnprocessedStmt: Database.Statement;
  private readonly markProcessedStmt: Database.Statement;
  private readonly getUnprocessedCountStmt: Database.Statement;

  constructor(dbPath?: string) {
    const finalDbPath = dbPath ?? this.getDefaultDbPath();
    this.db = new Database(finalDbPath);
    this.initSchema();
    this.insertStmt = this.prepareInsert();
    this.getNextUnprocessedStmt = this.prepareGetNextUnprocessed();
    this.markProcessedStmt = this.prepareMarkProcessed();
    this.getUnprocessedCountStmt = this.prepareGetUnprocessedCount();
  }

  private getDefaultDbPath(): string {
    try {
      const configManager = new ConfigManager();
      return configManager.getQueueDbPath();
    } catch {
      return DEFAULT_QUEUE_DB_PATH;
    }
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL CHECK(direction IN ('to_telegram', 'from_telegram')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        processed INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_processed ON messages(processed, timestamp);
    `);
  }

  private prepareInsert(): Database.Statement {
    return this.db.prepare(`
      INSERT INTO messages (direction, content, timestamp, processed)
      VALUES (?, ?, ?, 0)
    `);
  }

  private prepareGetNextUnprocessed(): Database.Statement {
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE processed = 0
      ORDER BY timestamp ASC, id ASC
      LIMIT 1
    `);
  }

  private prepareMarkProcessed(): Database.Statement {
    return this.db.prepare(`
      UPDATE messages
      SET processed = 1
      WHERE id = ?
    `);
  }

  private prepareGetUnprocessedCount(): Database.Statement {
    return this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE processed = 0
    `);
  }

  enqueue(direction: MessageDirection, content: string): number {
    const timestamp = Date.now();
    const result = this.insertStmt.run(direction, content, timestamp);
    return Number(result.lastInsertRowid);
  }

  dequeue(): QueueMessage | null {
    const transaction = this.db.transaction(() => {
      const message = this.getNextUnprocessedStmt.get() as QueueMessage | undefined;
      if (!message) {
        return null;
      }
      this.markProcessedStmt.run(message.id);
      return message;
    });
    return transaction();
  }

  peek(): QueueMessage | null {
    const message = this.getNextUnprocessedStmt.get() as QueueMessage | undefined;
    return message ?? null;
  }

  getUnprocessedCount(): number {
    const result = this.getUnprocessedCountStmt.get() as { count: number };
    return result.count;
  }

  close(): void {
    this.db.close();
  }
}

