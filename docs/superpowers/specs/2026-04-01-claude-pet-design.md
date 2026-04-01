# claude-pet Design Spec

## Overview

claude-pet is a pure Node.js CLI tool that lets users customize their Claude Code companion pet. It works via `npx claude-pet` on any machine with Node 18+ — no Bun, no native addons.

## Goals

1. **Zero dependencies beyond Node 18+** — wyhash implemented in pure JS
2. **Zero-flag interactive mode** — just run `claude-pet` for a guided TUI
3. **One-command install** — `npx claude-pet` works immediately
4. **Built-in safety** — automatic backup, easy restore, clear warnings
5. **Live preview** — see pet rendered in terminal before committing
6. **Power-user CLI flags** — fully non-interactive mode for scripting

## Architecture

The project is organized into three layers: **CLI surface**, **domain logic**, and **system operations**. Each layer depends only on the one below it.

```
claude-pet/
├── bin/
│   └── cli.mjs                — Entry point: arg parsing, command routing
│
├── src/
│   ├── commands/              — One file per command, thin wrappers
│   │   ├── interactive.mjs    — Default TUI flow
│   │   ├── preview.mjs        — Browse pets without applying
│   │   ├── current.mjs        — Show current pet(s)
│   │   ├── apply.mjs          — Re-apply saved config
│   │   ├── restore.mjs        — Restore original pet
│   │   └── rehatch.mjs        — Reset companion
│   │
│   ├── core/                  — Pure domain logic (no I/O, no side effects)
│   │   ├── wyhash.mjs         — Pure JS wyhash64 (BigInt)
│   │   ├── prng.mjs           — Mulberry32 PRNG
│   │   ├── pet.mjs            — Trait generation pipeline
│   │   ├── salt.mjs           — Salt generation + matching logic
│   │   └── constants.mjs      — Species, rarities, eyes, hats, stats
│   │
│   ├── system/                — Side-effectful operations
│   │   ├── binary.mjs         — Binary discovery, patching, codesign
│   │   ├── config.mjs         — Config read/write (~/.claude-pet.json)
│   │   ├── claude-config.mjs  — Read Claude's own config (userId, companion)
│   │   ├── hooks.mjs          — SessionStart hook install/remove
│   │   └── worker.mjs         — worker_threads coordinator for salt search
│   │
│   ├── ui/                    — Terminal UI components
│   │   ├── prompts.mjs        — Interactive selection flows
│   │   ├── sprites.mjs        — ASCII art rendering
│   │   └── progress.mjs       — Progress bar for salt search
│   │
│   └── worker-entry.mjs       — Worker thread entry point
│
├── test/
│   ├── wyhash.test.mjs        — Verify wyhash parity with known outputs
│   ├── prng.test.mjs          — Mulberry32 determinism tests
│   ├── pet.test.mjs           — Trait generation tests
│   └── salt.test.mjs          — Salt format + matching tests
│
└── package.json
```

### Layer Rules

- **commands/** — Orchestrate UI + system calls. No business logic.
- **core/** — Pure functions, zero imports from `system/` or `ui/`. Fully testable without mocks.
- **system/** — All file I/O, process spawning, config writes. Injected into commands.
- **ui/** — All terminal rendering. Can be swapped for a different frontend.

## Core Algorithm: wyhash in Pure JS

Claude Code uses Bun.hash() which is Zig's Wyhash (from Zig v0.11.0-dev, as bundled in Bun). This is NOT the reference wyhash v4 — it uses 32-byte rounds (not 48), 5 primes (not 4), and a different finalization. We implement it in pure JavaScript using BigInt arithmetic to produce bit-exact identical outputs. Reference: Bun's `src/wyhash.zig`.

### Generation Pipeline

```
key = userId + salt
  → wyhash64(key)             // Pure JS BigInt implementation
  → seed = hash & 0xFFFFFFFF  // Mask to 32-bit
  → rng = mulberry32(seed)    // Deterministic PRNG
  → roll traits in order:     // Exact same order as Claude Code
     1. rarity (weighted: 60/25/10/4/1)
     2. species (uniform, 18 options)
     3. eye (uniform, 6 options)
     4. hat (uniform 8 options, or 'none' if common)
     5. shiny (1% chance)
     6. peak stat (uniform, 5 options)
     7. dump stat (uniform, 4 remaining)
     8. stat values (per-stat rolls)
     9. inspirationSeed
```

### Mulberry32 PRNG (in `src/core/prng.mjs`)

```javascript
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### Validation Strategy

Test our wyhash against known input/output pairs (captured from Bun.hash) to confirm bit-exact parity before shipping. These pairs are committed as test fixtures.

## Constants (in `src/core/constants.mjs`)

### Species (18)

duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

### Rarities (5, weighted)

| Rarity    | Weight | Floor |
|-----------|--------|-------|
| common    | 60%    | 5     |
| uncommon  | 25%    | 15    |
| rare      | 10%    | 25    |
| epic      | 4%     | 35    |
| legendary | 1%     | 50    |

### Eyes (6)

`·` `✦` `×` `◉` `@` `°`

### Hats (8)

none, crown, tophat, propeller, halo, wizard, beanie, tinyduck

Common rarity always gets hat = 'none'.

### Stats (5)

DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

- **Peak stat:** floor + 50 + random(0, 30), capped at 100
- **Dump stat:** floor - 10 + random(0, 15), clamped to [1, 100]
- **Normal stat:** floor + random(0, 40)

## Salt Search (in `src/core/salt.mjs` + `src/system/worker.mjs`)

### Format

- Exactly 15 characters
- Charset: `a-zA-Z0-9-_` (64 characters)
- Must be same length as original salt `'friend-2026-401'`

### Search Strategy

The matching logic lives in `core/salt.mjs` (pure, testable). The parallelism lives in `system/worker.mjs`:

1. Main thread sends desired traits + userId to worker(s) via `worker_threads`
2. Each worker imports `core/salt.mjs` and loops: generate random salt → hash → check match
3. Progress reported via `parentPort.postMessage()` every 25k attempts
4. First match wins — all workers terminated via `worker.terminate()`

Single worker by default. For shiny variants (~100x slower), spawn one worker per CPU core.

### Expected Attempts

```
Base: species(1/18) x rarity(weight/100) x eye(1/6) x hat(1/8 if non-common)
Shiny: x100
Peak stat: x5
Dump stat: x4
```

Typical: 50-400 attempts for basic, 5k-40k for shiny.

## Binary Patching (in `src/system/binary.mjs`)

### Discovery

Find Claude Code binary via:
1. `CLAUDE_BINARY` env var
2. `which claude` on PATH (verify >1MB, not a shim)
3. Platform-specific known locations:
   - macOS: `~/.local/bin/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`
   - Linux: `~/.local/bin/claude`, `/usr/local/bin/claude`
   - Windows: `%LOCALAPPDATA%\Programs\claude\claude.exe`

### Patching Flow

1. Read binary into buffer
2. Find all occurrences of current salt (expect 3+ for original)
3. Create backup at `<binary>.claude-pet-bak` (first time only)
4. Replace all occurrences with new salt (same 15-byte length — no offset shift)
5. Write to temp file, atomic rename to original path
6. macOS: re-sign with `codesign --force --sign -`
7. Verify by re-reading binary and checking new salt present at all offsets

### Restore

`claude-pet restore`:
- Patches back to original salt `'friend-2026-401'`
- Removes SessionStart hook from `~/.claude/settings.json`
- Does NOT delete backup file (safety net)

## CLI Interface (in `bin/cli.mjs` + `src/commands/`)

### Commands

| Command | Description |
|---------|-------------|
| `claude-pet` | Interactive pet picker (default) |
| `claude-pet preview` | Browse pets without applying |
| `claude-pet current` | Show default + patched pet |
| `claude-pet apply` | Re-apply saved pet (after Claude update) |
| `claude-pet restore` | Restore original pet + remove hook |
| `claude-pet rehatch` | Delete companion for fresh `/buddy` generation |

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--species <name>` | `-s` | Species |
| `--rarity <level>` | `-r` | Rarity |
| `--eye <char>` | `-e` | Eye style |
| `--hat <name>` | `-t` | Hat |
| `--name <name>` | `-n` | Rename companion |
| `--personality <desc>` | `-p` | Set personality |
| `--shiny` | | Require shiny (~100x longer) |
| `--peak <stat>` | | Best stat |
| `--dump <stat>` | | Worst stat |
| `--yes` | `-y` | Skip confirmations |
| `--no-hook` | | Don't offer auto-patch hook |
| `--silent` | | Suppress output (for apply) |

### Examples

```bash
# Interactive (most users)
npx claude-pet

# Fully scripted
npx claude-pet -s dragon -r legendary -e ✦ -t wizard -y

# Preview only
npx claude-pet preview -s duck -r common

# After Claude Code update
npx claude-pet apply

# Undo everything
npx claude-pet restore
```

## Config & Hook Management

### Pet Config: `~/.claude-pet.json` (in `src/system/config.mjs`)

```json
{
  "salt": "abcdefghijklmno",
  "previousSalt": "friend-2026-401",
  "species": "dragon",
  "rarity": "legendary",
  "eye": "✦",
  "hat": "wizard",
  "appliedTo": "/path/to/claude",
  "appliedAt": "2026-04-01T12:34:56.789Z"
}
```

### Claude User ID (in `src/system/claude-config.mjs`)

Read from `~/.claude.json` or `~/.claude/.config.json`:
- `oauthAccount.accountUuid` (preferred)
- `userID` (fallback)
- `'anon'` (last resort)

### Auto-Patch Hook (in `src/system/hooks.mjs`)

Optional SessionStart hook in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "claude-pet apply --silent" }]
    }]
  }
}
```

Runs on each Claude Code session start (~50ms). Ensures pet persists across updates.

## Dependencies

```json
{
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "chalk": "^5.3.0"
  }
}
```

No Bun. No native addons. Node 18+ only.

## Interactive TUI Flow (in `src/commands/interactive.mjs` + `src/ui/`)

1. Preflight checks (binary exists, userId found)
2. Show current default pet (original salt)
3. Show patched pet if one exists
4. Select species (with ASCII preview)
5. Select eye style
6. Select rarity
7. Select hat (skipped for common)
8. Ask about shiny
9. Optional stat customization (peak/dump)
10. Preview final selection
11. Confirm and search for matching salt (progress bar)
12. Apply binary patch
13. Save config
14. Offer auto-patch hook installation
15. Optional companion name/personality customization
