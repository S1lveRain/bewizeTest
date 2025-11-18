import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { MessageQueue } from '../queue/messageQueue';
import { TelegramBotService } from '../telegram/telegramBot';
import { EventEmitter } from 'events';

const SERVER_NAME = 'claude-telegram-mcp';
const SERVER_VERSION = '1.0.6';
const QUEUE_PROCESSING_INTERVAL = 500;
const DEFAULT_MESSAGE_COUNT = 10;
const MESSAGE_PREVIEW_LENGTH = 50;

interface ToolArgs {
  message?: string;
  count?: number;
}

export class MCPServer extends EventEmitter {
  private readonly server: Server;
  private readonly queue: MessageQueue;
  private readonly telegramBot: TelegramBotService;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(queue: MessageQueue, telegramBot: TelegramBotService) {
    super();
    this.queue = queue;
    this.telegramBot = telegramBot;
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
    this.startProcessingQueue();
    this.setupTelegramListener();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_telegram_message',
            description: 'Send a message to the user via Telegram',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The message content to send',
                },
              },
              required: ['message'],
            },
          },
          {
            name: 'get_telegram_messages',
            description: 'Get pending messages from Telegram user',
            inputSchema: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                  description: 'Maximum number of messages to retrieve (default: 10)',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      const parsedArgs = this.parseToolArgs(args);

      switch (name) {
        case 'send_telegram_message':
          return this.handleSendMessage(parsedArgs);
        case 'get_telegram_messages':
          return this.handleGetMessages(parsedArgs);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [],
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async () => {
      throw new Error('No prompts available');
    });
  }

  private parseToolArgs(args: unknown): ToolArgs {
    if (typeof args === 'string') {
      try {
        return JSON.parse(args) as ToolArgs;
      } catch {
        return {};
      }
    }
    return (args as ToolArgs) ?? {};
  }

  private async handleSendMessage(args: ToolArgs) {
    const message = args.message;
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }

    try {
      this.queue.enqueue('to_telegram', message);
      return {
        content: [
          {
            type: 'text',
            text: `Message queued successfully: ${message}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Failed to queue message: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private handleGetMessages(args: ToolArgs) {
    const count = args.count ? Number(args.count) : DEFAULT_MESSAGE_COUNT;
    const messages: string[] = [];

    for (let i = 0; i < count; i++) {
      const msg = this.queue.peek();
      if (!msg || msg.direction !== 'from_telegram') {
        break;
      }
      const dequeued = this.queue.dequeue();
      if (dequeued) {
        messages.push(dequeued.content);
      }
    }

    const responseText = messages.length > 0
      ? `Received messages:\n${messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : 'No new messages';

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private startProcessingQueue(): void {
    console.error('[MCP] Starting queue processing');
    this.processingInterval = setInterval(async () => {
      try {
        const message = this.queue.peek();
        if (message?.direction === 'to_telegram') {
          const dequeued = this.queue.dequeue();
          if (dequeued) {
            await this.processOutgoingMessage(dequeued);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[MCP] Queue processing error:', errorMessage);
        this.emit('error', error);
      }
    }, QUEUE_PROCESSING_INTERVAL);
  }

  private async processOutgoingMessage(message: { content: string }): Promise<void> {
    const preview = message.content.substring(0, MESSAGE_PREVIEW_LENGTH);
    console.error(`[MCP] Processing message: ${preview}...`);

    try {
      await this.telegramBot.sendMessage(message.content);
      console.error('[MCP] Message sent successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MCP] Failed to send message:', errorMessage);
      this.emit('error', error);
    }
  }

  private setupTelegramListener(): void {
    this.telegramBot.on('message', (content: string) => {
      this.emit('telegram_message', content);
    });
  }

  async start(): Promise<void> {
    console.error('[MCP] Starting MCP server');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP] Server connected, starting Telegram polling');
    await this.telegramBot.startPolling();
    console.error('[MCP] MCP server started successfully');
  }

  async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    await this.telegramBot.stopPolling();
    this.server.close();
  }
}

