# claude-pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure Node.js CLI that lets users customize their Claude Code companion pet via salt brute-forcing and binary patching.

**Architecture:** Three-layer design — `core/` (pure functions, no I/O), `system/` (file/process side effects), `commands/` (thin orchestrators). CLI entry in `bin/cli.mjs`, interactive UI in `ui/`.

**Tech Stack:** Node.js 18+ ESM, BigInt for wyhash, worker_threads for parallel search, @inquirer/prompts for TUI, chalk for colors.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `bin/cli.mjs`
- Create: `src/core/constants.mjs`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "claude-pet",
  "version": "0.1.0",
  "description": "Customize your Claude Code companion pet",
  "type": "module",
  "bin": {
    "claude-pet": "./bin/cli.mjs"
  },
  "files": ["bin/", "src/"],
  "engines": { "node": ">=18" },
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "chalk": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create constants**

Create `src/core/constants.mjs`:

```javascript
export const ORIGINAL_SALT = 'friend-2026-401';
export const SALT_LENGTH = 15;
export const SALT_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

export const SPECIES = [
  'duck', 'goose', 'blob', 'cat', 'dragon', 'octopus', 'owl', 'penguin',
  'turtle', 'snail', 'ghost', 'axolotl', 'capybara', 'cactus', 'robot',
  'rabbit', 'mushroom', 'chonk',
];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

export const RARITY_FLOOR = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
};

export const RARITY_STARS = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
};

export const EYES = ['·', '✦', '×', '◉', '@', '°'];

export const HATS = ['none', 'crown', 'tophat', 'propeller', 'halo', 'wizard', 'beanie', 'tinyduck'];

export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'];
```

- [ ] **Step 3: Create CLI entry stub**

Create `bin/cli.mjs`:

```javascript
#!/usr/bin/env node

import { SPECIES, RARITIES, EYES, HATS } from '../src/core/constants.mjs';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('-')) ?? 'interactive';

console.log(`claude-pet v0.1.0`);
console.log(`Command: ${command}`);
console.log(`Species: ${SPECIES.length}, Rarities: ${RARITIES.length}, Eyes: ${EYES.length}, Hats: ${HATS.length}`);
```

- [ ] **Step 4: Install dependencies and verify**

Run: `cd /Users/mohammad/Desktop/claude-pet && npm install`
Then: `node bin/cli.mjs`
Expected: Prints version, command, and counts (18 species, 5 rarities, 6 eyes, 8 hats)

- [ ] **Step 5: Commit**

```bash
git add package.json bin/cli.mjs src/core/constants.mjs
git commit -m "feat: project scaffolding with constants and CLI stub"
```

---

### Task 2: wyhash Implementation (Bun-compatible)

**Files:**
- Create: `src/core/wyhash.mjs`
- Create: `test/wyhash.test.mjs`

This is the most critical piece. Bun uses Zig's Wyhash (v0.11.0-dev variant): 32-byte rounds, 5 primes, `mix0`/`mix1` pattern, remainder switch for inputs < 32 bytes.

- [ ] **Step 1: Write the test with known Bun.hash() outputs**

Before writing the implementation, we need test fixtures. Generate them by running Bun:

```bash
# If bun is available, generate fixtures:
bun -e "
const pairs = [
  '', 'hello', 'friend-2026-401', 'test-user-id-1234friend-2026-401',
  'a', 'ab', 'abc', 'abcdefghijklmnop', 'abcdefghijklmnopqrstuvwxyz012345',
  'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
];
for (const s of pairs) {
  console.log(JSON.stringify(s) + ': ' + Bun.hash(s) + 'n,');
}
"
```

Create `test/wyhash.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wyhash } from '../src/core/wyhash.mjs';

// Fixtures: input string → expected Bun.hash() output (BigInt)
// IMPORTANT: These must be generated from actual Bun.hash() calls.
// Run: bun -e "console.log(Bun.hash('hello'))" to get each value.
// Placeholder values below MUST be replaced with real outputs before tests pass.
const FIXTURES = [
  // [input, expected_bigint]
  // Short keys (0-3 bytes)
  ['', 0n],        // REPLACE with actual Bun.hash('') output
  ['a', 0n],       // REPLACE
  ['ab', 0n],      // REPLACE
  ['abc', 0n],     // REPLACE
  // Medium keys (4-16 bytes)
  ['hello', 0n],   // REPLACE
  ['friend-2026-401', 0n], // REPLACE — the original salt
  // Long keys (17-32 bytes)
  ['abcdefghijklmnopqrstuvwxyz012345', 0n], // REPLACE — exactly 32 bytes
  // Keys > 32 bytes
  ['test-user-id-1234friend-2026-401', 0n], // REPLACE — typical userId+salt
  ['abcdefghijklmnopqrstuvwxyz0123456789ABCDEF', 0n], // REPLACE — 42 bytes
];

describe('wyhash', () => {
  for (const [input, expected] of FIXTURES) {
    it(`hashes "${input.length > 20 ? input.slice(0, 20) + '...' : input}" (${input.length} bytes)`, () => {
      const result = wyhash(input);
      assert.equal(typeof result, 'bigint', 'should return bigint');
      assert.equal(result, expected, `wyhash("${input}") = ${result}, expected ${expected}`);
    });
  }

  it('returns consistent results for same input', () => {
    const a = wyhash('determinism-test');
    const b = wyhash('determinism-test');
    assert.equal(a, b);
  });

  it('returns different results for different inputs', () => {
    const a = wyhash('input-a');
    const b = wyhash('input-b');
    assert.notEqual(a, b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wyhash.test.mjs`
Expected: FAIL — module `../src/core/wyhash.mjs` not found

- [ ] **Step 3: Implement wyhash**

Create `src/core/wyhash.mjs`:

```javascript
// Bun-compatible wyhash (Zig stdlib v0.11.0-dev variant)
// 32-byte rounds, 5 primes, mix0/mix1 pattern
// Default seed = 0 (matches Bun.hash(string) with no seed arg)

const MASK64 = (1n << 64n) - 1n;

const PRIMES = [
  0xa0761d6478bd642fn,
  0xe7037ed1a0b428dbn,
  0x8ebc6af09c88c6e3n,
  0x589965cc75374cc3n,
  0x1d8e4e27c47d124fn,
];

function mum(a, b) {
  const full = (a & MASK64) * (b & MASK64);
  return ((full >> 64n) ^ full) & MASK64;
}

function mix0(a, b, seed) {
  return mum(
    (a ^ seed ^ PRIMES[0]) & MASK64,
    (b ^ seed ^ PRIMES[1]) & MASK64,
  );
}

function mix1(a, b, seed) {
  return mum(
    (a ^ seed ^ PRIMES[2]) & MASK64,
    (b ^ seed ^ PRIMES[3]) & MASK64,
  );
}

function read64(buf, offset) {
  // Little-endian 8-byte read
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  return v;
}

function read32(buf, offset) {
  return BigInt(buf[offset])
    | (BigInt(buf[offset + 1]) << 8n)
    | (BigInt(buf[offset + 2]) << 16n)
    | (BigInt(buf[offset + 3]) << 24n);
}

function readSmall(buf, len) {
  // For keys 1-3 bytes: combine into a single u64
  if (len === 0) return 0n;
  const a = BigInt(buf[0]);
  const b = BigInt(buf[len >> 1]);
  const c = BigInt(buf[len - 1]);
  return (a << 16n) | (b << 8n) | c;
}

/**
 * Bun-compatible wyhash. Returns a BigInt.
 * @param {string} input - The string to hash (UTF-8 encoded)
 * @param {bigint} [seed=0n] - Optional seed (Bun default is 0)
 * @returns {bigint} 64-bit hash as BigInt
 */
export function wyhash(input, seed = 0n) {
  const buf = new TextEncoder().encode(input);
  const len = buf.length;
  let s = seed & MASK64;
  let offset = 0;

  if (len <= 16) {
    if (len >= 4) {
      // 4-16 bytes
      const a = (read32(buf, 0) << 32n) | read32(buf, ((len >>> 3) << 2));
      const b = (read32(buf, len - 4) << 32n) | read32(buf, len - 4 - ((len >>> 3) << 2));
      return mum(
        (a ^ PRIMES[0] ^ s) & MASK64,
        (b ^ PRIMES[1] ^ s) & MASK64,
      ) ^ ((mum((a ^ PRIMES[0] ^ s) & MASK64, (b ^ PRIMES[1] ^ s) & MASK64) ^ s ^ PRIMES[4]) & MASK64);
    } else {
      // 0-3 bytes
      const v = readSmall(buf, len);
      return mum(
        (v ^ PRIMES[0] ^ s) & MASK64,
        (PRIMES[1] ^ s) & MASK64,
      ) ^ ((mum((v ^ PRIMES[0] ^ s) & MASK64, (PRIMES[1] ^ s) & MASK64) ^ s ^ PRIMES[4]) & MASK64);
    }
  }

  // For 17-32 byte keys
  if (len <= 32) {
    const a = read64(buf, 0);
    const b = read64(buf, 8);
    const c = read64(buf, len - 16);
    const d = read64(buf, len - 8);
    s = (mix0(a, b, s) ^ mix1(c, d, s)) & MASK64;
    return mum((s ^ BigInt(len) ^ PRIMES[4]) & MASK64, PRIMES[4]) & MASK64;
  }

  // For > 32 byte keys: process 32-byte rounds
  let remaining = len;
  while (remaining > 32) {
    const a = read64(buf, offset);
    const b = read64(buf, offset + 8);
    const c = read64(buf, offset + 16);
    const d = read64(buf, offset + 24);
    s = (mix0(a, b, s) ^ mix1(c, d, s)) & MASK64;
    offset += 32;
    remaining -= 32;
  }

  // Process remaining 1-32 bytes
  const a = read64(buf, offset);
  const b = read64(buf, offset + 8);
  const c = read64(buf, len - 16);
  const d = read64(buf, len - 8);
  s = (mix0(a, b, s) ^ mix1(c, d, s)) & MASK64;

  return mum((s ^ BigInt(len) ^ PRIMES[4]) & MASK64, PRIMES[4]) & MASK64;
}
```

**IMPORTANT:** This implementation is a best-effort port. The short-key handling (0-16 bytes) follows Bun's Zig source pattern but the exact XOR/read patterns may need adjustment during testing. The test fixtures from Step 1 (generated from actual Bun.hash calls) are the source of truth — iterate on this implementation until all fixtures pass.

- [ ] **Step 4: Generate real Bun.hash() fixtures and update tests**

Run the Bun fixture generator from Step 1. If Bun is not installed, install it:
```bash
curl -fsSL https://bun.sh/install | bash
```

Then generate fixtures and replace the placeholder `0n` values in `test/wyhash.test.mjs`.

- [ ] **Step 5: Run tests and iterate until all pass**

Run: `node --test test/wyhash.test.mjs`

If any fixture fails, compare the expected vs actual output and debug the specific code path (short key vs medium vs long). The most likely issues:
- Byte read order (must be little-endian)
- Short key combining logic (the 0-3 byte and 4-16 byte paths)
- Finalization step

Iterate until all fixtures pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/wyhash.mjs test/wyhash.test.mjs
git commit -m "feat: pure JS wyhash implementation matching Bun.hash()"
```

---

### Task 3: Mulberry32 PRNG

**Files:**
- Create: `src/core/prng.mjs`
- Create: `test/prng.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/prng.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, pick, rollWeighted } from '../src/core/prng.mjs';

describe('mulberry32', () => {
  it('produces deterministic sequence from same seed', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) allSame = false;
    }
    assert.ok(!allSame);
  });
});

describe('pick', () => {
  it('returns an element from the array', () => {
    const rng = mulberry32(99);
    const items = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) {
      assert.ok(items.includes(pick(rng, items)));
    }
  });

  it('is deterministic', () => {
    const items = ['x', 'y', 'z'];
    assert.equal(pick(mulberry32(42), items), pick(mulberry32(42), items));
  });
});

describe('rollWeighted', () => {
  it('returns a key from the weights object', () => {
    const rng = mulberry32(7);
    const weights = { common: 60, rare: 10, legendary: 1 };
    const keys = Object.keys(weights);
    for (let i = 0; i < 50; i++) {
      assert.ok(keys.includes(rollWeighted(rng, weights)));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/prng.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PRNG**

Create `src/core/prng.mjs`:

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

export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

export function rollWeighted(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/prng.test.mjs`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/core/prng.mjs test/prng.test.mjs
git commit -m "feat: Mulberry32 PRNG with pick and rollWeighted helpers"
```

---

### Task 4: Pet Generation

**Files:**
- Create: `src/core/pet.mjs`
- Create: `test/pet.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/pet.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rollPet, rollPetFromSeed } from '../src/core/pet.mjs';
import { SPECIES, RARITIES, EYES, HATS, STAT_NAMES } from '../src/core/constants.mjs';

describe('rollPetFromSeed', () => {
  it('returns a valid pet structure', () => {
    const pet = rollPetFromSeed(12345);
    assert.ok(RARITIES.includes(pet.rarity));
    assert.ok(SPECIES.includes(pet.species));
    assert.ok(EYES.includes(pet.eye));
    assert.ok(HATS.includes(pet.hat));
    assert.equal(typeof pet.shiny, 'boolean');
    assert.equal(typeof pet.inspirationSeed, 'number');
    for (const stat of STAT_NAMES) {
      assert.ok(pet.stats[stat] >= 1 && pet.stats[stat] <= 100, `${stat} = ${pet.stats[stat]}`);
    }
  });

  it('is deterministic', () => {
    const a = rollPetFromSeed(42);
    const b = rollPetFromSeed(42);
    assert.deepStrictEqual(a, b);
  });

  it('common rarity always has hat = none', () => {
    // Find a seed that produces common rarity
    for (let seed = 0; seed < 10000; seed++) {
      const pet = rollPetFromSeed(seed);
      if (pet.rarity === 'common') {
        assert.equal(pet.hat, 'none');
        return;
      }
    }
    assert.fail('Could not find a common pet in 10000 seeds');
  });

  it('stats have correct peak/dump structure', () => {
    const pet = rollPetFromSeed(99);
    const values = Object.values(pet.stats);
    const max = Math.max(...values);
    const min = Math.min(...values);
    assert.ok(max > min, 'peak should be higher than dump');
  });
});

describe('rollPet', () => {
  it('generates pet from userId + salt via wyhash', () => {
    const pet = rollPet('test-user-id', 'friend-2026-401');
    assert.ok(SPECIES.includes(pet.species));
    assert.ok(RARITIES.includes(pet.rarity));
  });

  it('is deterministic for same userId + salt', () => {
    const a = rollPet('user-123', 'abcdefghijklmno');
    const b = rollPet('user-123', 'abcdefghijklmno');
    assert.deepStrictEqual(a, b);
  });

  it('differs for different salts', () => {
    const a = rollPet('user-123', 'salt-aaaaaaaaa01');
    const b = rollPet('user-123', 'salt-bbbbbbbbb02');
    // Very unlikely to be identical across all fields
    const same = a.species === b.species && a.rarity === b.rarity
      && a.eye === b.eye && a.hat === b.hat;
    assert.ok(!same, 'different salts should produce different pets');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pet.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pet generation**

Create `src/core/pet.mjs`:

```javascript
import { wyhash } from './wyhash.mjs';
import { mulberry32, pick, rollWeighted } from './prng.mjs';
import {
  SPECIES, RARITIES, RARITY_WEIGHTS, RARITY_FLOOR,
  EYES, HATS, STAT_NAMES,
} from './constants.mjs';

export function rollPetFromSeed(seed) {
  const rng = mulberry32(seed);
  return rollFromRng(rng);
}

export function rollPet(userId, salt) {
  const key = userId + salt;
  const hash = wyhash(key);
  const seed = Number(hash & 0xFFFFFFFFn);
  return rollPetFromSeed(seed);
}

function rollFromRng(rng) {
  const rarity = rollWeighted(rng, RARITY_WEIGHTS);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const hat = rarity === 'common' ? 'none' : pick(rng, HATS);
  const shiny = rng() < 0.01;
  const stats = rollStats(rng, rarity);
  const inspirationSeed = Math.floor(rng() * 1e9);

  return { rarity, species, eye, hat, shiny, stats, inspirationSeed };
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);

  const stats = {};
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[name] = floor + Math.floor(rng() * 40);
    }
  }
  return stats;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/pet.test.mjs`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/core/pet.mjs test/pet.test.mjs
git commit -m "feat: pet generation pipeline (wyhash → PRNG → traits)"
```

---

### Task 5: Salt Generation & Matching Logic

**Files:**
- Create: `src/core/salt.mjs`
- Create: `test/salt.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/salt.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomSalt, matchesCriteria, estimateAttempts } from '../src/core/salt.mjs';
import { SALT_LENGTH, SALT_CHARSET } from '../src/core/constants.mjs';

describe('randomSalt', () => {
  it('returns a string of SALT_LENGTH characters', () => {
    const salt = randomSalt();
    assert.equal(salt.length, SALT_LENGTH);
  });

  it('uses only valid charset characters', () => {
    for (let i = 0; i < 100; i++) {
      const salt = randomSalt();
      for (const ch of salt) {
        assert.ok(SALT_CHARSET.includes(ch), `invalid char: ${ch}`);
      }
    }
  });

  it('produces different salts on consecutive calls', () => {
    const salts = new Set();
    for (let i = 0; i < 100; i++) salts.add(randomSalt());
    assert.ok(salts.size > 90, `only ${salts.size} unique salts out of 100`);
  });
});

describe('matchesCriteria', () => {
  it('returns true when all fields match', () => {
    const pet = { species: 'duck', rarity: 'common', eye: '·', hat: 'none', shiny: false };
    const criteria = { species: 'duck', rarity: 'common', eye: '·', hat: 'none' };
    assert.ok(matchesCriteria(pet, criteria));
  });

  it('returns false when species differs', () => {
    const pet = { species: 'cat', rarity: 'common', eye: '·', hat: 'none', shiny: false };
    const criteria = { species: 'duck', rarity: 'common', eye: '·', hat: 'none' };
    assert.ok(!matchesCriteria(pet, criteria));
  });

  it('checks shiny when required', () => {
    const pet = { species: 'duck', rarity: 'rare', eye: '·', hat: 'crown', shiny: false };
    const criteria = { species: 'duck', rarity: 'rare', eye: '·', hat: 'crown', shiny: true };
    assert.ok(!matchesCriteria(pet, criteria));
  });

  it('ignores shiny when not required', () => {
    const pet = { species: 'duck', rarity: 'rare', eye: '·', hat: 'crown', shiny: true };
    const criteria = { species: 'duck', rarity: 'rare', eye: '·', hat: 'crown' };
    assert.ok(matchesCriteria(pet, criteria));
  });
});

describe('estimateAttempts', () => {
  it('returns reasonable estimate for basic combo', () => {
    const est = estimateAttempts({ species: 'duck', rarity: 'common', eye: '·', hat: 'none' });
    // 18 species * (100/60 rarity) * 6 eyes ≈ 180
    assert.ok(est > 50 && est < 500, `estimate ${est} out of range`);
  });

  it('shiny multiplies by ~100', () => {
    const base = estimateAttempts({ species: 'duck', rarity: 'common', eye: '·', hat: 'none' });
    const shiny = estimateAttempts({ species: 'duck', rarity: 'common', eye: '·', hat: 'none', shiny: true });
    assert.ok(shiny > base * 50, `shiny ${shiny} should be >> base ${base}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/salt.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement salt module**

Create `src/core/salt.mjs`:

```javascript
import { SALT_LENGTH, SALT_CHARSET, RARITY_WEIGHTS } from './constants.mjs';

export function randomSalt() {
  let s = '';
  for (let i = 0; i < SALT_LENGTH; i++) {
    s += SALT_CHARSET[(Math.random() * SALT_CHARSET.length) | 0];
  }
  return s;
}

export function matchesCriteria(pet, criteria) {
  if (pet.species !== criteria.species) return false;
  if (pet.rarity !== criteria.rarity) return false;
  if (pet.eye !== criteria.eye) return false;
  if (pet.hat !== criteria.hat) return false;
  if (criteria.shiny && !pet.shiny) return false;
  if (criteria.peak && getPeakStat(pet.stats) !== criteria.peak) return false;
  if (criteria.dump && getDumpStat(pet.stats) !== criteria.dump) return false;
  return true;
}

function getPeakStat(stats) {
  let best = null;
  let max = -1;
  for (const [name, value] of Object.entries(stats)) {
    if (value > max) { max = value; best = name; }
  }
  return best;
}

function getDumpStat(stats) {
  let worst = null;
  let min = Infinity;
  for (const [name, value] of Object.entries(stats)) {
    if (value < min) { min = value; worst = name; }
  }
  return worst;
}

export function estimateAttempts(criteria) {
  let p = 1;
  p *= 1 / 18; // species
  p *= RARITY_WEIGHTS[criteria.rarity] / 100; // rarity
  p *= 1 / 6; // eye
  if (criteria.rarity !== 'common') p *= 1 / 8; // hat
  if (criteria.shiny) p *= 0.01;
  if (criteria.peak) p *= 1 / 5;
  if (criteria.dump) p *= 1 / 4;
  return Math.round(1 / p);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/salt.test.mjs`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/core/salt.mjs test/salt.test.mjs
git commit -m "feat: salt generation, matching criteria, and attempt estimation"
```

---

### Task 6: Salt Search Worker

**Files:**
- Create: `src/worker-entry.mjs`
- Create: `src/system/worker.mjs`

- [ ] **Step 1: Create the worker thread entry point**

Create `src/worker-entry.mjs`:

```javascript
import { parentPort, workerData } from 'node:worker_threads';
import { rollPet } from './core/pet.mjs';
import { randomSalt, matchesCriteria } from './core/salt.mjs';

const { userId, criteria } = workerData;
let attempts = 0;
const start = Date.now();

while (true) {
  attempts++;
  const salt = randomSalt();
  const pet = rollPet(userId, salt);

  if (matchesCriteria(pet, criteria)) {
    parentPort.postMessage({
      type: 'found',
      salt,
      attempts,
      elapsed: Date.now() - start,
    });
    process.exit(0);
  }

  if (attempts % 25000 === 0) {
    parentPort.postMessage({
      type: 'progress',
      attempts,
      elapsed: Date.now() - start,
    });
  }
}
```

- [ ] **Step 2: Create the worker coordinator**

Create `src/system/worker.mjs`:

```javascript
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { availableParallelism } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '..', 'worker-entry.mjs');

export function findSalt(userId, criteria, { onProgress, parallel = false } = {}) {
  const numWorkers = parallel ? Math.max(1, availableParallelism() - 1) : 1;

  return new Promise((resolve, reject) => {
    const workers = [];
    let totalAttempts = 0;
    let resolved = false;

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(WORKER_PATH, {
        workerData: { userId, criteria },
      });

      worker.on('message', (msg) => {
        if (resolved) return;

        if (msg.type === 'found') {
          resolved = true;
          // Terminate all other workers
          for (const w of workers) {
            if (w !== worker) w.terminate();
          }
          resolve({ salt: msg.salt, attempts: msg.attempts, elapsed: msg.elapsed });
        }

        if (msg.type === 'progress' && onProgress) {
          totalAttempts += 25000;
          onProgress({ attempts: totalAttempts, elapsed: msg.elapsed });
        }
      });

      worker.on('error', (err) => {
        if (!resolved) reject(err);
      });

      workers.push(worker);
    }
  });
}
```

- [ ] **Step 3: Smoke test the worker**

Create a quick manual test (not committed):

```bash
node -e "
import { findSalt } from './src/system/worker.mjs';
const result = await findSalt('test-user', {
  species: 'duck', rarity: 'common', eye: '·', hat: 'none'
}, {
  onProgress: (p) => process.stderr.write('Attempts: ' + p.attempts + '\r')
});
console.log('Found:', result);
" --input-type=module
```

Expected: Finds a salt within a few hundred attempts, prints `Found: { salt: '...', attempts: N, elapsed: M }`

- [ ] **Step 4: Commit**

```bash
git add src/worker-entry.mjs src/system/worker.mjs
git commit -m "feat: worker_threads salt search with parallel support"
```

---

### Task 7: Claude Config Reader

**Files:**
- Create: `src/system/claude-config.mjs`

- [ ] **Step 1: Implement Claude config reader**

Create `src/system/claude-config.mjs`:

```javascript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function getClaudeUserId() {
  const paths = [
    join(homedir(), '.claude.json'),
    join(homedir(), '.claude', '.config.json'),
  ];

  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const config = JSON.parse(readFileSync(p, 'utf-8'));
      const id = config.oauthAccount?.accountUuid ?? config.userID;
      if (id) return id;
    } catch {
      continue;
    }
  }
  return 'anon';
}

export function getClaudeConfigPath() {
  const paths = [
    join(homedir(), '.claude.json'),
    join(homedir(), '.claude', '.config.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function getCompanionInfo() {
  const configPath = getClaudeConfigPath();
  if (!configPath) return null;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.companion ?? null;
  } catch {
    return null;
  }
}

export function setCompanionField(field, value) {
  const configPath = getClaudeConfigPath();
  if (!configPath) throw new Error('Claude config not found');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.companion) config.companion = {};
  const updated = { ...config, companion: { ...config.companion, [field]: value } };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
}
```

**Note:** `setCompanionField` uses dynamic import for writeFileSync — this is intentional to keep the read-only functions synchronous and simple. However, this won't work in a non-async context. Fix: move `writeFileSync` to the top-level import since this module already does I/O.

Corrected version — replace the `setCompanionField` function:

```javascript
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

// ... (keep getClaudeUserId, getClaudeConfigPath, getCompanionInfo as above)

export function setCompanionField(field, value) {
  const configPath = getClaudeConfigPath();
  if (!configPath) throw new Error('Claude config not found');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.companion) config.companion = {};
  const updated = { ...config, companion: { ...config.companion, [field]: value } };
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/system/claude-config.mjs
git commit -m "feat: Claude config reader (userId, companion info)"
```

---

### Task 8: Pet Config Manager

**Files:**
- Create: `src/system/config.mjs`

- [ ] **Step 1: Implement config manager**

Create `src/system/config.mjs`:

```javascript
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_PATH = join(homedir(), '.claude-pet.json');

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
```

- [ ] **Step 2: Commit**

```bash
git add src/system/config.mjs
git commit -m "feat: pet config manager (~/.claude-pet.json)"
```

---

### Task 9: Binary Discovery & Patching

**Files:**
- Create: `src/system/binary.mjs`

- [ ] **Step 1: Implement binary discovery and patching**

Create `src/system/binary.mjs`:

```javascript
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
    // Real binary is > 1MB; shims are small scripts
    if (size >= 1_000_000) return path;
    // Try to follow the shim to the real binary
    const content = readFileSync(path, 'utf-8');
    const match = content.match(/["']([^"']+claude[^"']*)['"]/);
    if (match && existsSync(match[1])) return match[1];
    return null;
  } catch {
    return null;
  }
}

export function findSaltInBinary(binaryPath) {
  const buf = readFileSync(binaryPath);
  const origOffsets = findAllOccurrences(buf, ORIGINAL_SALT);
  if (origOffsets.length >= 3) {
    return { salt: ORIGINAL_SALT, patched: false, offsets: origOffsets };
  }
  // Binary is already patched — we don't know the current salt from the binary alone
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

  // Create backup (first time only)
  const backupPath = binaryPath + '.claude-pet-bak';
  if (!existsSync(backupPath)) {
    copyFileSync(binaryPath, backupPath);
  }

  // Replace all occurrences
  const replacement = Buffer.from(newSalt, 'utf-8');
  for (const offset of offsets) {
    replacement.copy(buf, offset);
  }

  // Atomic write: temp file → rename
  const tmpPath = binaryPath + '.claude-pet-tmp';
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

  // Verify
  const verifyBuf = readFileSync(binaryPath);
  const verified = findAllOccurrences(verifyBuf, newSalt).length === offsets.length;

  // macOS: re-sign
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
```

- [ ] **Step 2: Commit**

```bash
git add src/system/binary.mjs
git commit -m "feat: binary discovery, patching, and macOS codesigning"
```

---

### Task 10: Hook Management

**Files:**
- Create: `src/system/hooks.mjs`

- [ ] **Step 1: Implement hook management**

Create `src/system/hooks.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'claude-pet apply --silent';

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
```

- [ ] **Step 2: Commit**

```bash
git add src/system/hooks.mjs
git commit -m "feat: SessionStart hook install/remove"
```

---

### Task 11: UI Components (Sprites, Progress, Prompts)

**Files:**
- Create: `src/ui/sprites.mjs`
- Create: `src/ui/progress.mjs`
- Create: `src/ui/prompts.mjs`

- [ ] **Step 1: Create ASCII sprite renderer**

Create `src/ui/sprites.mjs`:

```javascript
import chalk from 'chalk';
import { RARITY_STARS } from '../core/constants.mjs';

const RARITY_COLORS = {
  common: chalk.gray,
  uncommon: chalk.green,
  rare: chalk.blue,
  epic: chalk.magenta,
  legendary: chalk.yellow,
};

export function renderPet(pet) {
  const color = RARITY_COLORS[pet.rarity] ?? chalk.white;
  const stars = RARITY_STARS[pet.rarity] ?? '';
  const shinyTag = pet.shiny ? chalk.yellow(' ✨ SHINY') : '';

  const lines = [
    '',
    color(`  ${pet.species.toUpperCase()} ${stars}${shinyTag}`),
    '',
    `    Eye: ${pet.eye}   Hat: ${pet.hat}`,
    '',
  ];

  if (pet.stats) {
    lines.push(chalk.dim('  Stats:'));
    for (const [name, value] of Object.entries(pet.stats)) {
      const bar = '█'.repeat(Math.round(value / 5));
      const pad = '░'.repeat(20 - Math.round(value / 5));
      lines.push(`    ${name.padEnd(10)} ${color(bar)}${chalk.dim(pad)} ${value}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function showPet(pet, label) {
  if (label) console.log(chalk.bold(`\n  ${label}`));
  console.log(renderPet(pet));
}
```

- [ ] **Step 2: Create progress bar**

Create `src/ui/progress.mjs`:

```javascript
import chalk from 'chalk';

export function renderProgress(attempts, expected, elapsed) {
  const pct = Math.min(100, (attempts / expected) * 100);
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const rate = elapsed > 0 ? Math.round(attempts / (elapsed / 1000)) : 0;
  const eta = rate > 0 ? Math.round((expected - attempts) / rate) : '?';

  return `  ${bar} ${pct.toFixed(0)}%  ${attempts} attempts  ${rate}/s  ETA: ${eta}s`;
}

export function updateProgress(attempts, expected, elapsed) {
  process.stdout.write('\r' + renderProgress(attempts, expected, elapsed));
}

export function clearProgress() {
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
}
```

- [ ] **Step 3: Create interactive prompts**

Create `src/ui/prompts.mjs`:

```javascript
import { select, confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { SPECIES, RARITIES, EYES, HATS, STAT_NAMES } from '../core/constants.mjs';

export async function selectSpecies() {
  return select({
    message: 'Choose a species:',
    choices: SPECIES.map(s => ({ name: s, value: s })),
  });
}

export async function selectRarity() {
  return select({
    message: 'Choose rarity:',
    choices: RARITIES.map(r => ({ name: r, value: r })),
  });
}

export async function selectEye() {
  return select({
    message: 'Choose eye style:',
    choices: EYES.map(e => ({ name: e, value: e })),
  });
}

export async function selectHat() {
  return select({
    message: 'Choose a hat:',
    choices: HATS.filter(h => h !== 'none').map(h => ({ name: h, value: h })),
  });
}

export async function selectStat(label, exclude) {
  const choices = STAT_NAMES
    .filter(s => s !== exclude)
    .map(s => ({ name: s, value: s }));
  return select({ message: label, choices });
}

export async function confirmAction(message, defaultValue = true) {
  return confirm({ message, default: defaultValue });
}

export async function promptInput(message) {
  return input({ message });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/sprites.mjs src/ui/progress.mjs src/ui/prompts.mjs
git commit -m "feat: UI components (sprites, progress bar, prompts)"
```

---

### Task 12: Commands — Interactive, Preview, Current

**Files:**
- Create: `src/commands/interactive.mjs`
- Create: `src/commands/preview.mjs`
- Create: `src/commands/current.mjs`

- [ ] **Step 1: Implement interactive command**

Create `src/commands/interactive.mjs`:

```javascript
import chalk from 'chalk';
import { ORIGINAL_SALT } from '../core/constants.mjs';
import { rollPet } from '../core/pet.mjs';
import { estimateAttempts } from '../core/salt.mjs';
import { getClaudeUserId } from '../system/claude-config.mjs';
import { findClaudeBinary, findSaltInBinary, patchBinary } from '../system/binary.mjs';
import { loadConfig, saveConfig } from '../system/config.mjs';
import { findSalt } from '../system/worker.mjs';
import { isHookInstalled, installHook } from '../system/hooks.mjs';
import { showPet } from '../ui/sprites.mjs';
import { updateProgress, clearProgress } from '../ui/progress.mjs';
import {
  selectSpecies, selectRarity, selectEye, selectHat,
  selectStat, confirmAction, promptInput,
} from '../ui/prompts.mjs';

export async function runInteractive(flags) {
  // 1. Preflight
  const binaryPath = findClaudeBinary();
  const userId = getClaudeUserId();
  console.log(chalk.dim(`Binary: ${binaryPath}`));
  console.log(chalk.dim(`User: ${userId === 'anon' ? 'anonymous' : userId.slice(0, 8) + '...'}`));

  // 2. Show current pet
  const defaultPet = rollPet(userId, ORIGINAL_SALT);
  showPet(defaultPet, 'Your default pet');

  const config = loadConfig();
  if (config?.salt && config.salt !== ORIGINAL_SALT) {
    const patchedPet = rollPet(userId, config.salt);
    showPet(patchedPet, 'Your active patched pet');
  }

  // 3. Selection
  const species = flags.species ?? await selectSpecies();
  const eye = flags.eye ?? await selectEye();
  const rarity = flags.rarity ?? await selectRarity();
  const hat = rarity === 'common' ? 'none' : (flags.hat ?? await selectHat());
  const shiny = flags.shiny ?? await confirmAction('Require shiny? (much longer search)', false);

  let peak = flags.peak ?? null;
  let dump = flags.dump ?? null;
  if (!peak && !dump) {
    const wantStats = await confirmAction('Customize stats (peak/dump)?', false);
    if (wantStats) {
      peak = await selectStat('Best stat:');
      dump = await selectStat('Worst stat:', peak);
    }
  }

  const criteria = { species, rarity, eye, hat, shiny, peak, dump };

  // 4. Preview
  showPet({ ...criteria, stats: null, inspirationSeed: 0 }, 'Your selection');

  const proceed = flags.yes ?? await confirmAction('Find a matching salt and apply?');
  if (!proceed) {
    console.log(chalk.dim('Cancelled.'));
    return;
  }

  // 5. Search
  const expected = estimateAttempts(criteria);
  console.log(chalk.dim(`\nSearching (estimated ~${expected} attempts)...`));

  const result = await findSalt(userId, criteria, {
    parallel: shiny,
    onProgress: (p) => updateProgress(p.attempts, expected, p.elapsed),
  });
  clearProgress();

  console.log(chalk.green(`\nFound in ${result.attempts} attempts (${result.elapsed}ms)`));

  // 6. Verify and show
  const newPet = rollPet(userId, result.salt);
  showPet(newPet, 'Your new pet');

  // 7. Patch
  const { salt: currentSalt } = findSaltInBinary(binaryPath);
  const oldSalt = currentSalt ?? config?.salt ?? ORIGINAL_SALT;
  const patchResult = patchBinary(binaryPath, oldSalt, result.salt);

  if (patchResult.verified) {
    console.log(chalk.green(`Patched ${patchResult.replacements} occurrences`));
  } else {
    console.log(chalk.red('Patch verification failed — restoring backup'));
    return;
  }

  if (patchResult.codesigned) {
    console.log(chalk.dim('Re-signed binary (macOS)'));
  } else if (patchResult.codesignError) {
    console.log(chalk.yellow(`Codesign warning: ${patchResult.codesignError}`));
  }

  // 8. Save config
  saveConfig({
    salt: result.salt,
    previousSalt: oldSalt,
    species, rarity, eye, hat,
    appliedTo: binaryPath,
    appliedAt: new Date().toISOString(),
  });

  // 9. Hook
  if (!flags.noHook && !isHookInstalled()) {
    const setupHook = await confirmAction('Install auto-patch hook? (re-applies after updates)', false);
    if (setupHook) {
      installHook();
      console.log(chalk.green('Hook installed'));
    }
  }

  // 10. Name/personality
  if (flags.name) {
    const { setCompanionField } = await import('../system/claude-config.mjs');
    setCompanionField('name', flags.name);
    console.log(chalk.dim(`Renamed companion to "${flags.name}"`));
  }

  console.log(chalk.bold.green('\nDone! Launch Claude Code to see your new companion.'));
}
```

- [ ] **Step 2: Implement preview command**

Create `src/commands/preview.mjs`:

```javascript
import { rollPet } from '../core/pet.mjs';
import { getClaudeUserId } from '../system/claude-config.mjs';
import { showPet } from '../ui/sprites.mjs';
import { selectSpecies, selectRarity, selectEye, selectHat } from '../ui/prompts.mjs';
import { ORIGINAL_SALT } from '../core/constants.mjs';

export async function runPreview(flags) {
  const userId = getClaudeUserId();

  const species = flags.species ?? await selectSpecies();
  const eye = flags.eye ?? await selectEye();
  const rarity = flags.rarity ?? await selectRarity();
  const hat = rarity === 'common' ? 'none' : (flags.hat ?? await selectHat());

  showPet(
    { species, rarity, eye, hat, shiny: false, stats: null, inspirationSeed: 0 },
    'Preview (approximate — stats determined by salt)',
  );
}
```

- [ ] **Step 3: Implement current command**

Create `src/commands/current.mjs`:

```javascript
import chalk from 'chalk';
import { ORIGINAL_SALT } from '../core/constants.mjs';
import { rollPet } from '../core/pet.mjs';
import { getClaudeUserId } from '../system/claude-config.mjs';
import { loadConfig } from '../system/config.mjs';
import { showPet } from '../ui/sprites.mjs';

export function runCurrent() {
  const userId = getClaudeUserId();

  const defaultPet = rollPet(userId, ORIGINAL_SALT);
  showPet(defaultPet, 'Your default pet (original salt)');

  const config = loadConfig();
  if (config?.salt && config.salt !== ORIGINAL_SALT) {
    const patchedPet = rollPet(userId, config.salt);
    showPet(patchedPet, 'Your active patched pet');
  } else {
    console.log(chalk.dim('  No custom pet applied.\n'));
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/interactive.mjs src/commands/preview.mjs src/commands/current.mjs
git commit -m "feat: interactive, preview, and current commands"
```

---

### Task 13: Commands — Apply, Restore, Rehatch

**Files:**
- Create: `src/commands/apply.mjs`
- Create: `src/commands/restore.mjs`
- Create: `src/commands/rehatch.mjs`

- [ ] **Step 1: Implement apply command**

Create `src/commands/apply.mjs`:

```javascript
import chalk from 'chalk';
import { loadConfig } from '../system/config.mjs';
import { findClaudeBinary, findSaltInBinary, patchBinary } from '../system/binary.mjs';

export function runApply(flags) {
  const config = loadConfig();
  if (!config?.salt) {
    if (!flags.silent) console.log(chalk.yellow('No saved pet config. Run claude-pet first.'));
    return;
  }

  const binaryPath = findClaudeBinary();
  const { salt: currentSalt } = findSaltInBinary(binaryPath);

  // Already patched with our salt?
  if (currentSalt === null) {
    // Binary is patched but we can't tell with what — try our saved salt
    // If the binary already has our salt, this is a no-op attempt
  }

  if (currentSalt === config.salt) {
    if (!flags.silent) console.log(chalk.dim('Already patched with your pet.'));
    return;
  }

  const oldSalt = currentSalt ?? config.previousSalt;
  if (!oldSalt) {
    if (!flags.silent) console.log(chalk.red('Cannot determine current salt in binary.'));
    return;
  }

  try {
    const result = patchBinary(binaryPath, oldSalt, config.salt);
    if (!flags.silent) {
      if (result.verified) {
        console.log(chalk.green(`Re-applied pet (${result.replacements} replacements)`));
      } else {
        console.log(chalk.red('Patch verification failed.'));
      }
    }
  } catch (err) {
    if (!flags.silent) console.error(chalk.red(`Apply failed: ${err.message}`));
  }
}
```

- [ ] **Step 2: Implement restore command**

Create `src/commands/restore.mjs`:

```javascript
import chalk from 'chalk';
import { ORIGINAL_SALT } from '../core/constants.mjs';
import { loadConfig } from '../system/config.mjs';
import { findClaudeBinary, findSaltInBinary, patchBinary } from '../system/binary.mjs';
import { removeHook, isHookInstalled } from '../system/hooks.mjs';

export function runRestore() {
  const binaryPath = findClaudeBinary();
  const config = loadConfig();
  const { salt: currentSalt } = findSaltInBinary(binaryPath);

  if (currentSalt === ORIGINAL_SALT) {
    console.log(chalk.dim('Binary already has the original salt.'));
  } else {
    const oldSalt = currentSalt ?? config?.salt;
    if (!oldSalt) {
      console.log(chalk.red('Cannot determine current salt. Use backup to restore manually.'));
      return;
    }

    try {
      const result = patchBinary(binaryPath, oldSalt, ORIGINAL_SALT);
      if (result.verified) {
        console.log(chalk.green(`Restored original salt (${result.replacements} replacements)`));
      } else {
        console.log(chalk.red('Restore verification failed.'));
      }
    } catch (err) {
      console.error(chalk.red(`Restore failed: ${err.message}`));
      return;
    }
  }

  if (isHookInstalled()) {
    removeHook();
    console.log(chalk.dim('Removed auto-patch hook'));
  }

  console.log(chalk.green('Done. Your original companion pet is back.'));
}
```

- [ ] **Step 3: Implement rehatch command**

Create `src/commands/rehatch.mjs`:

```javascript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/apply.mjs src/commands/restore.mjs src/commands/rehatch.mjs
git commit -m "feat: apply, restore, and rehatch commands"
```

---

### Task 14: CLI Entry Point (Full Implementation)

**Files:**
- Modify: `bin/cli.mjs`

- [ ] **Step 1: Replace CLI stub with full implementation**

Replace `bin/cli.mjs` with:

```javascript
#!/usr/bin/env node

import chalk from 'chalk';

const VERSION = '0.1.0';

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--species' || arg === '-s') flags.species = args[++i];
    else if (arg === '--rarity' || arg === '-r') flags.rarity = args[++i];
    else if (arg === '--eye' || arg === '-e') flags.eye = args[++i];
    else if (arg === '--hat' || arg === '-t') flags.hat = args[++i];
    else if (arg === '--name' || arg === '-n') flags.name = args[++i];
    else if (arg === '--personality' || arg === '-p') flags.personality = args[++i];
    else if (arg === '--shiny') flags.shiny = true;
    else if (arg === '--peak') flags.peak = args[++i];
    else if (arg === '--dump') flags.dump = args[++i];
    else if (arg === '--silent') flags.silent = true;
    else if (arg === '--no-hook') flags.noHook = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg === '--version' || arg === '-v') { console.log(VERSION); process.exit(0); }
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    else if (!arg.startsWith('-')) positional.push(arg);
    else { console.error(chalk.red(`Unknown flag: ${arg}`)); process.exit(1); }
  }

  return { command: positional[0] ?? 'interactive', flags };
}

function printHelp() {
  console.log(`
${chalk.bold('claude-pet')} v${VERSION}
Customize your Claude Code companion pet.

${chalk.bold('Commands:')}
  (default)    Interactive pet picker
  preview      Browse pets without applying
  current      Show your default + patched pet
  apply        Re-apply saved pet (after Claude update)
  restore      Restore original pet + remove hook
  rehatch      Delete companion for fresh /buddy generation

${chalk.bold('Flags:')}
  -s, --species <name>     Species
  -r, --rarity <level>     Rarity
  -e, --eye <char>         Eye style
  -t, --hat <name>         Hat
  -n, --name <name>        Rename companion
  -p, --personality <desc> Set personality
  --shiny                  Require shiny (~100x longer)
  --peak <stat>            Best stat
  --dump <stat>            Worst stat
  -y, --yes                Skip confirmations
  --no-hook                Don't offer auto-patch hook
  --silent                 Suppress output (for apply)
  -v, --version            Show version
  -h, --help               Show this help
`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'interactive': {
        const { runInteractive } = await import('../src/commands/interactive.mjs');
        await runInteractive(flags);
        break;
      }
      case 'preview': {
        const { runPreview } = await import('../src/commands/preview.mjs');
        await runPreview(flags);
        break;
      }
      case 'current': {
        const { runCurrent } = await import('../src/commands/current.mjs');
        runCurrent();
        break;
      }
      case 'apply': {
        const { runApply } = await import('../src/commands/apply.mjs');
        runApply(flags);
        break;
      }
      case 'restore': {
        const { runRestore } = await import('../src/commands/restore.mjs');
        runRestore();
        break;
      }
      case 'rehatch': {
        const { runRehatch } = await import('../src/commands/rehatch.mjs');
        runRehatch();
        break;
      }
      default:
        console.error(chalk.red(`Unknown command: ${command}`));
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red(`\nError: ${err.message}`));
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Run --help and --version to verify**

Run: `node bin/cli.mjs --help`
Expected: Prints usage info

Run: `node bin/cli.mjs --version`
Expected: `0.1.0`

- [ ] **Step 3: Commit**

```bash
git add bin/cli.mjs
git commit -m "feat: full CLI entry point with arg parsing and command routing"
```

---

### Task 15: End-to-End Smoke Test

**Files:**
- None created — manual verification

- [ ] **Step 1: Test the current command**

Run: `node bin/cli.mjs current`
Expected: Shows your default pet (or "anonymous" user if no Claude config)

- [ ] **Step 2: Test the preview command with flags**

Run: `node bin/cli.mjs preview -s dragon -r legendary -e ✦ -t wizard`
Expected: Shows a preview of the selected pet

- [ ] **Step 3: Test the full interactive flow**

Run: `node bin/cli.mjs`
Expected: Walks through species/eye/rarity/hat selection, searches for salt, patches binary

- [ ] **Step 4: Test apply --silent**

Run: `node bin/cli.mjs apply --silent`
Expected: Re-applies saved pet silently (no output if already patched)

- [ ] **Step 5: Test restore**

Run: `node bin/cli.mjs restore`
Expected: Restores original salt, removes hook

- [ ] **Step 6: Fix any issues found during testing, commit**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

---

### Task 16: Make it npx-ready

**Files:**
- Modify: `package.json`
- Modify: `bin/cli.mjs` (add executable permission)

- [ ] **Step 1: Ensure bin/cli.mjs is executable**

Run: `chmod +x bin/cli.mjs`

- [ ] **Step 2: Verify package.json is complete**

Read `package.json` and ensure `"bin"`, `"files"`, `"engines"`, and `"type": "module"` are all set correctly.

- [ ] **Step 3: Test with npx locally**

Run: `npm link && npx claude-pet --version`
Expected: `0.1.0`

- [ ] **Step 4: Commit**

```bash
git add package.json bin/cli.mjs
git commit -m "chore: make package npx-ready"
```
