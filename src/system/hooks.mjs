import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'claude-pets apply --silent';

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  const dir = join(homedir(), '.claude');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

function findHookEntry(hooks) {
  if (!Array.isArray(hooks)) return -1;
  return hooks.findIndex(entry =>
    entry?.hooks?.some(h => h.command === HOOK_COMMAND)
  );
}

export function isHookInstalled() {
  const settings = loadSettings();
  const sessionStart = settings.hooks?.SessionStart;
  return findHookEntry(sessionStart) !== -1;
}

export function installHook() {
  const settings = loadSettings();
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  if (findHookEntry(settings.hooks.SessionStart) === -1) {
    settings.hooks.SessionStart.push({
      matcher: '',
      hooks: [{ type: 'command', command: HOOK_COMMAND }],
    });
  }

  saveSettings(settings);
}

export function removeHook() {
  const settings = loadSettings();
  const sessionStart = settings.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) return;

  const idx = findHookEntry(sessionStart);
  if (idx !== -1) {
    sessionStart.splice(idx, 1);
    saveSettings(settings);
  }
}
