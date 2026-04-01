import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_PATH = join(homedir(), '.claude-pets.json');

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n');
}

export function configPath() {
  return CONFIG_PATH;
}
