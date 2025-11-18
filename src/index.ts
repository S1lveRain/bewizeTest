import { MessageQueue } from './queue/messageQueue';
import { TelegramBotService } from './telegram/telegramBot';
import { MCPServer } from './mcp/mcpServer';

function createTelegramBot(queue: MessageQueue): TelegramBotService {
  try {
    return new TelegramBotService(queue);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to initialize Telegram bot:', errorMessage);
    throw error;
  }
}

function createMcpServer(queue: MessageQueue, telegramBot: TelegramBotService): MCPServer {
  return new MCPServer(queue, telegramBot);
}

function setupErrorHandlers(mcpServer: MCPServer, telegramBot: TelegramBotService): void {
  mcpServer.on('error', (error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('MCP Server error:', errorMessage);
  });

  telegramBot.on('error', (error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Telegram Bot error:', errorMessage);
  });
}

export async function startServer(): Promise<void> {
  const queue = new MessageQueue();
  const telegramBot = createTelegramBot(queue);
  const mcpServer = createMcpServer(queue, telegramBot);
  
  setupErrorHandlers(mcpServer, telegramBot);
  
  try {
    await mcpServer.start();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to start MCP server:', errorMessage);
    throw error;
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to start server:', errorMessage);
    process.exit(1);
  });
}

