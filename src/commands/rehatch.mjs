import chalk from 'chalk';
import { getClaudeConfigPath } from '../system/claude-config.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

export function runRehatch() {
  const configPath = getClaudeConfigPath();
  if (!configPath) {
    console.log(chalk.yellow('Claude config not found.'));
    return;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.companion) {
      console.log(chalk.dim('No companion to rehatch.'));
      return;
    }
    const { companion, ...rest } = config;
    writeFileSync(configPath, JSON.stringify(rest, null, 2) + '\n', { mode: 0o600 });
    console.log(chalk.green('Companion removed. Run /buddy in Claude Code to hatch a new one.'));
  } catch (err) {
    console.error(chalk.red(`Rehatch failed: ${err.message}`));
  }
}
