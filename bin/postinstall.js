#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const packagePath = path.resolve(__dirname, '..');
const mcpConfigPath = path.join(os.homedir(), '.claude.json');
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

const serverPath = path.join(packagePath, 'dist', 'index.js');

if (!fs.existsSync(serverPath)) {
  console.warn('Warning: MCP server not built yet. Run "npm run build" first.');
  process.exit(0);
}

const existingConfig = mcpConfig.mcpServers['claude-telegram-mcp'];
const newConfig = {
  command: 'node',
  args: [serverPath],
};

if (existingConfig && JSON.stringify(existingConfig) === JSON.stringify(newConfig)) {
  console.log('✓ MCP server already registered correctly');
  process.exit(0);
}

mcpConfig.mcpServers['claude-telegram-mcp'] = newConfig;

fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
console.log('✓ MCP server registered in', mcpConfigPath);
console.log('  Restart Claude Code to use the integration.');

