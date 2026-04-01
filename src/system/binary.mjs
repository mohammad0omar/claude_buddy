import {
  readFileSync, writeFileSync, existsSync, copyFileSync,
  renameSync, unlinkSync, statSync, chmodSync,
} from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ORIGINAL_SALT } from '../core/constants.mjs';

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

export function findClaudeBinary() {
  // 1. Env var override
  if (process.env.CLAUDE_BINARY) {
    const p = process.env.CLAUDE_BINARY;
    if (!existsSync(p)) throw new Error(`CLAUDE_BINARY="${p}" does not exist`);
    return p;
  }

  // 2. which claude
  try {
    const onPath = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim();
    if (onPath && existsSync(onPath)) {
      const resolved = resolveRealBinary(onPath);
      if (resolved) return resolved;
    }
  } catch { /* not on PATH */ }

  // 3. Platform-specific paths
  const home = homedir();
  const candidates = IS_WIN
    ? [join(process.env.LOCALAPPDATA ?? '', 'Programs', 'claude', 'claude.exe')]
    : [
        join(home, '.local', 'bin', 'claude'),
        join(home, '.claude', 'local', 'claude'),
        '/usr/local/bin/claude',
        ...(IS_MAC ? ['/opt/homebrew/bin/claude'] : []),
      ];

  for (const p of candidates) {
    if (existsSync(p)) {
      const resolved = resolveRealBinary(p);
      if (resolved) return resolved;
    }
  }

  throw new Error(
    'Could not find Claude Code binary. Set CLAUDE_BINARY env var to the path.'
  );
}

function resolveRealBinary(path) {
  try {
    const size = statSync(path).size;
    if (size >= 1_000_000) return path;
    const content = readFileSync(path, 'utf-8');
    const match = content.match(/["']([^"']+claude[^"']*)['"]/);
    if (match && existsSync(match[1])) return match[1];
    return null;
  } catch {
    return null;
  }
}

export function findSaltInBinary(binaryPath, knownSalts = []) {
  const buf = readFileSync(binaryPath);

  // Check original salt first
  const origOffsets = findAllOccurrences(buf, ORIGINAL_SALT);
  if (origOffsets.length >= 3) {
    return { salt: ORIGINAL_SALT, patched: false, offsets: origOffsets };
  }

  // Check known salts from saved configs
  for (const salt of knownSalts) {
    if (!salt || salt === ORIGINAL_SALT) continue;
    const offsets = findAllOccurrences(buf, salt);
    if (offsets.length >= 3) {
      return { salt, patched: true, offsets };
    }
  }

  return { salt: null, patched: true, offsets: origOffsets };
}

export function patchBinary(binaryPath, oldSalt, newSalt) {
  if (oldSalt.length !== newSalt.length) {
    throw new Error(`Salt length mismatch: old=${oldSalt.length}, new=${newSalt.length}`);
  }

  const buf = readFileSync(binaryPath);
  const offsets = findAllOccurrences(buf, oldSalt);

  if (offsets.length === 0) {
    throw new Error(`Could not find salt "${oldSalt}" in binary at ${binaryPath}`);
  }

  const backupPath = binaryPath + '.claude-pets-bak';
  if (!existsSync(backupPath)) {
    copyFileSync(binaryPath, backupPath);
  }

  const replacement = Buffer.from(newSalt, 'utf-8');
  for (const offset of offsets) {
    replacement.copy(buf, offset);
  }

  const tmpPath = binaryPath + '.claude-pets-tmp';
  try {
    writeFileSync(tmpPath, buf);
    if (!IS_WIN) chmodSync(tmpPath, statSync(binaryPath).mode);
    try {
      renameSync(tmpPath, binaryPath);
    } catch {
      try { unlinkSync(binaryPath); } catch { /* ignore */ }
      renameSync(tmpPath, binaryPath);
    }
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    if (IS_WIN && err.code === 'EPERM') {
      throw new Error('Binary locked — close all Claude Code sessions and retry');
    }
    throw err;
  }

  const verifyBuf = readFileSync(binaryPath);
  const verified = findAllOccurrences(verifyBuf, newSalt).length === offsets.length;

  const codesigned = codesignBinary(binaryPath);

  return {
    replacements: offsets.length,
    verified,
    backupPath,
    codesigned: codesigned.signed,
    codesignError: codesigned.error,
  };
}

function findAllOccurrences(buffer, searchStr) {
  const searchBuf = Buffer.from(searchStr, 'utf-8');
  const offsets = [];
  let pos = 0;
  while (pos < buffer.length) {
    const idx = buffer.indexOf(searchBuf, pos);
    if (idx === -1) break;
    offsets.push(idx);
    pos = idx + 1;
  }
  return offsets;
}

function codesignBinary(binaryPath) {
  if (!IS_MAC) return { signed: false, error: null };
  try {
    execSync(`codesign --force --sign - "${binaryPath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { signed: true, error: null };
  } catch (err) {
    return { signed: false, error: err.message };
  }
}
