# Claude Telegram MCP

NPM package for integrating Telegram with Claude Code via MCP (Model Context Protocol). Allows sending and receiving messages through a Telegram bot using an asynchronous message queue.

## Features

- ✅ Two-way communication between Claude Code and Telegram
- ✅ Asynchronous message queue (FIFO)
- ✅ Persistent message storage (SQLite)
- ✅ Long polling without need for public IP
- ✅ Authorization by Telegram User ID
- ✅ Automatic MCP server registration
- ✅ CLI installer for setup

## Installation

### 1. Install Package

```bash
npm install -g @s1lverain/claude-telegram-mcp
```

Or locally:

```bash
npm install @s1lverain/claude-telegram-mcp
```

### 2. Get Telegram Bot Token

1. Open [@BotFather](https://t.me/botfather) in Telegram
2. Send command `/newbot`
3. Follow instructions to create a bot
4. Save the received token (e.g.: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. Get Telegram User ID

1. Open [@userinfobot](https://t.me/userinfobot) in Telegram
2. Bot will automatically show your User ID
3. Save the numeric ID (e.g.: `123456789`)

### 4. Setup

Run the installer:

```bash
npx @s1lverain/claude-telegram-mcp install
```

Installer will request:
- Telegram Bot Token
- Telegram User ID

After successful setup, configuration will be saved in `~/.claude-telegram-mcp.json`, and MCP server will be registered in Claude Code.

### 5. Test Connection

Check that everything works:

```bash
npx @s1lverain/claude-telegram-mcp test
```

This command will send a test message to your Telegram.

### 6. Restart Claude Code

Restart Claude Code to load the new MCP server.

## Usage

After installation and restarting Claude Code, you can use the following tools:

### Send Message to Telegram

```
Use the send_telegram_message tool with the message parameter
```

Claude Code will automatically send the message to your Telegram.

### Get Messages from Telegram

```
Use the get_telegram_messages tool to get new messages
```

Claude Code will retrieve all unread messages from the queue.

## Architecture

```
┌─────────────┐
│ Claude Code │
└──────┬──────┘
       │ MCP Protocol
       ▼
┌─────────────┐
│  MCP Server │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│   Queue     │◄────┤  Telegram    │
│  (SQLite)   │     │     Bot      │
└─────────────┘     └──────────────┘
```

### Components

- **MCP Server** (`src/mcp/mcpServer.ts`) - Model Context Protocol server
- **Telegram Bot** (`src/telegram/telegramBot.ts`) - Telegram Bot API client with polling
- **Message Queue** (`src/queue/messageQueue.ts`) - SQLite message queue
- **Config Manager** (`src/config/config.ts`) - Configuration management

## Project Structure

```
.
├── src/
│   ├── config/       # Configuration
│   ├── mcp/          # MCP server
│   ├── telegram/     # Telegram bot
│   ├── queue/        # Message queue
│   └── index.ts      # Entry point
├── bin/
│   └── cli.js        # CLI installer
├── tests/            # Tests
└── README.md         # Documentation
```

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

### Run in Development Mode

```bash
npm run build
node dist/index.js
```

## Troubleshooting

### Installation Error: "gyp ERR! configure error" or better-sqlite3 Issues

If you get a compilation error for `better-sqlite3` during dependency installation, this usually means issues with development tools.

**Solution for Windows:**

1. **Install Windows Build Tools** (recommended):
   ```powershell
   npm install --global windows-build-tools
   ```
   Or install manually:
   - Download and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - During installation, select "Desktop development with C++" workload
   - Restart your computer after installation

2. **Or use a Node.js version with precompiled binaries:**
   ```powershell
   nvm install 20
   nvm use 20
   npm install
   ```
   Node.js 18 or 20 usually have precompiled binaries available for `better-sqlite3`.

3. **Try installing with prebuilt binaries:**
   ```powershell
   npm install --prefer-offline --no-audit
   ```

4. **After installing build tools, reinstall dependencies:**
   ```powershell
   Remove-Item -Recurse -Force node_modules, package-lock.json
   npm install
   ```

**Solution for macOS:**

1. **Install full Xcode from App Store** (recommended):
   - Open App Store
   - Find and install Xcode
   - After installation, launch Xcode and accept the license
   - Install additional components when prompted

2. **Or update Command Line Tools:**
   ```bash
   sudo xcode-select --reset
   xcode-select --install
   ```

3. **After installation, reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

**If problem persists:**

Try using Node.js version 18 or 20 (instead of 22), which have precompiled binaries available:
```bash
nvm install 20
nvm use 20
npm install
```

### Error: "Config file not found"

Run the installer:
```bash
npx @s1lverain/claude-telegram-mcp install
```

### Error: "Invalid config file"

Delete the configuration file and run the installer again:
```bash
rm ~/.claude-telegram-mcp.json
npx @s1lverain/claude-telegram-mcp install
```

### Bot Not Responding

1. Make sure you sent `/start` to the bot in Telegram
2. Check User ID correctness:
   ```bash
   npx @s1lverain/claude-telegram-mcp test
   ```
3. Check bot token in [@BotFather](https://t.me/botfather)

### MCP Server Not Appearing in Claude Code

1. Check MCP configuration file:
   ```bash
   cat ~/.cursor/mcp.json
   ```
2. Make sure server is registered:
   ```json
   {
     "mcpServers": {
       "claude-telegram-mcp": {
         "command": "node",
         "args": ["/path/to/dist/index.js"]
       }
     }
   }
   ```
3. Restart Claude Code

### Messages Not Delivered

1. Check error logs
2. Make sure bot is running and polling is active
3. Check message queue:
   - Database file: `~/.claude-telegram-mcp-queue.db`
   - Can use SQLite client to view

### Permission Issues

Make sure the application has write permissions to home directory:
```bash
ls -la ~/.claude-telegram-mcp.json
ls -la ~/.claude-telegram-mcp-queue.db
```

## License

MIT

## Support

If you encounter issues, create an issue in the project repository.
