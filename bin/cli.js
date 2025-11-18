#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

program
  .name('claude-telegram-mcp')
  .description('Telegram integration for Claude Code via MCP')
  .version('1.0.2');

program
  .command('install')
  .description('Install and configure the MCP server')
  .action(async () => {
    try {
      const inquirer = (await import('inquirer')).default;
      const configPath = path.join(os.homedir(), '.claude-telegram-mcp.json');

      if (fs.existsSync(configPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Configuration already exists. Overwrite?',
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log('Installation cancelled.');
          return;
        }
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'botToken',
          message: 'Enter your Telegram Bot Token:',
          validate: (input) => input.length > 0 || 'Bot token is required',
        },
        {
          type: 'input',
          name: 'userId',
          message: 'Enter your Telegram User ID:',
          validate: (input) => {
            const num = parseInt(input, 10);
            return !isNaN(num) && num > 0 || 'Valid user ID is required';
          },
        },
      ]);

      const config = {
        botToken: answers.botToken,
        userId: parseInt(answers.userId, 10),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`Configuration saved to ${configPath}`);

      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(config.botToken, { polling: false });

      try {
        const me = await bot.getMe();
        console.log(`✓ Connected to Telegram bot: @${me.username}`);
      } catch (error) {
        console.error('✗ Failed to connect to Telegram:', error.message);
        process.exit(1);
      }

      const mcpConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');
      const mcpConfigDir = path.dirname(mcpConfigPath);

      if (!fs.existsSync(mcpConfigDir)) {
        fs.mkdirSync(mcpConfigDir, { recursive: true });
      }

      let mcpConfig = {};
      if (fs.existsSync(mcpConfigPath)) {
        try {
          mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        } catch (error) {
          console.warn('Warning: Could not read existing MCP config');
        }
      }

      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }

      const projectRoot = path.resolve(__dirname, '..');
      const wrapperScript = path.join(projectRoot, 'bin', 'start-mcp-server.sh');
      mcpConfig.mcpServers['claude-telegram-mcp'] = {
        command: '/bin/bash',
        args: [wrapperScript],
        cwd: projectRoot,
      };

      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
      console.log(`✓ MCP server registered in ${mcpConfigPath}`);
      console.log('\nInstallation complete! Restart Claude Code to use the integration.');
    } catch (error) {
      console.error('Installation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test the Telegram connection')
  .action(async () => {
    try {
      const configPath = path.join(os.homedir(), '.claude-telegram-mcp.json');

      if (!fs.existsSync(configPath)) {
        console.error('Configuration not found. Please run "install" first.');
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      if (!config.botToken) {
        console.error('✗ Bot token is missing in configuration');
        console.error('  Please run "claude-telegram-mcp install" again');
        process.exit(1);
      }

      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(config.botToken, { polling: false });

      try {
        const me = await bot.getMe();
        console.log(`✓ Bot connected: @${me.username} (${me.first_name})`);
      } catch (error) {
        if (error.response?.statusCode === 404 || error.message.includes('404')) {
          console.error('✗ Bot not found (404 Not Found)');
          console.error('  Possible reasons:');
          console.error('  1. Bot token is incorrect or invalid');
          console.error('  2. Bot was deleted or deactivated');
          console.error('  3. Token format is wrong');
          console.error('\n  Solution:');
          console.error('  - Get a new bot token from @BotFather');
          console.error('  - Run "claude-telegram-mcp install" again');
        } else {
          console.error('✗ Failed to connect to Telegram:', error.message);
        }
        process.exit(1);
      }

      if (!config.userId) {
        console.error('✗ User ID is missing in configuration');
        process.exit(1);
      }

      try {
        await bot.sendMessage(config.userId, 'Test message from Claude Telegram MCP');
        console.log('✓ Test message sent successfully');
      } catch (error) {
        if (error.response?.statusCode === 400 && error.message.includes('chat not found')) {
          console.error('✗ Failed to send test message: Chat not found');
          console.error('\n  This usually means:');
          console.error('  1. You haven\'t started a conversation with the bot');
          console.error('  2. The User ID is incorrect');
          console.error('  3. The bot is blocked by the user');
          console.error('\n  Solution:');
          console.error('  1. Open your bot in Telegram: https://t.me/' + me.username);
          console.error('  2. Send /start command to the bot');
          console.error('  3. Verify your User ID is correct (use @userinfobot)');
          console.error('  4. Run "claude-telegram-mcp test" again');
        } else if (error.response?.statusCode === 403) {
          console.error('✗ Failed to send test message: Bot blocked or user not found');
          console.error('  Make sure you have:');
          console.error('  1. Started a conversation with the bot (send /start)');
          console.error('  2. User ID is correct');
        } else {
          console.error('✗ Failed to send test message:', error.message);
          console.error('  Make sure you have started a conversation with the bot first.');
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('send <message>')
  .description('Send a message to yourself via Telegram')
  .action(async (message) => {
    try {
      const configPath = path.join(os.homedir(), '.claude-telegram-mcp.json');

      if (!fs.existsSync(configPath)) {
        console.error('Configuration not found. Please run "install" first.');
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      if (!config.botToken || !config.userId) {
        console.error('✗ Configuration is incomplete');
        console.error('  Please run "claude-telegram-mcp install" again');
        process.exit(1);
      }

      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(config.botToken, { polling: false });

      try {
        await bot.sendMessage(config.userId, message);
        console.log('✓ Message sent:', message);
      } catch (error) {
        if (error.response?.statusCode === 400 && error.message.includes('chat not found')) {
          console.error('✗ Chat not found');
          console.error('  Make sure you have sent /start to the bot first');
        } else {
          console.error('✗ Failed to send message:', error.message);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('Send failed:', error.message);
      process.exit(1);
    }
  });

program.parse();

