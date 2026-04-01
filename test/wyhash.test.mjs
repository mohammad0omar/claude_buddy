import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wyhash } from '../src/core/wyhash.mjs';

/**
 * Test fixtures generated from real Bun.hash() output.
 * Each entry: [input_string, expected_hash_bigint]
 */
const FIXTURES = [
  // 0 bytes
  ['', 290873116282709081n],
  // 1 byte
  ['a', 2941419223392617777n],
  ['x', 4738888789374899184n],
  // 2 bytes
  ['ab', 13590985366118106092n],
  ['xy', 3447210929618902431n],
  // 3 bytes
  ['abc', 190542993387777138n],
  ['xyz', 3526483651403036390n],
  // 4 bytes
  ['abcd', 5251164938674970899n],
  ['1234', 7172030625187072400n],
  // 5 bytes
  ['hello', 1019145960556548909n],
  // 8 bytes
  ['12345678', 5277784449735718889n],
  // 15 bytes
  ['friend-2026-401', 13861612982587048974n],
  // 16 bytes
  ['abcdefghijklmnop', 14973346930013163285n],
  ['1234567890123456', 1333946232150625147n],
  // 17 bytes (crosses into >16 path)
  ['abcdefghijklmnopq', 13488925526316360347n],
  // 24 bytes
  ['abcdefghijklmnopqrstuvwx', 4134070838712725020n],
  // 32 bytes
  ['abcdefghijklmnopqrstuvwxyz012345', 288605012390058684n],
  ['12345678901234561234567890123456', 3334496771468100934n],
  ['test-user-id-1234friend-2026-401', 4048842646890336880n],
  // 42 bytes
  ['abcdefghijklmnopqrstuvwxyz0123456789ABCDEF', 16008968756149356813n],
  // 78 bytes
  ['abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop', 2495129231059923825n],
];

describe('wyhash', () => {
  for (const [input, expected] of FIXTURES) {
    it(`hash("${input.length > 30 ? input.slice(0, 27) + '...' : input}") [${input.length} bytes]`, () => {
      const result = wyhash(input);
      assert.equal(result, expected,
        `Input: "${input}" (${input.length} bytes)\n` +
        `Expected: ${expected}\n` +
        `Got:      ${result}\n` +
        `Diff:     ${result - expected}`
      );
    });
  }

  it('accepts numeric seed', () => {
    const result = wyhash('hello', 42);
    assert.equal(result, 1063083450050639729n);
  });

  it('seed=0 matches default', () => {
    const withSeed = wyhash('hello', 0n);
    const withoutSeed = wyhash('hello');
    assert.equal(withSeed, withoutSeed);
  });

  it('returns a BigInt', () => {
    assert.equal(typeof wyhash('test'), 'bigint');
  });

  it('returns unsigned 64-bit values', () => {
    for (const [input, expected] of FIXTURES) {
      const result = wyhash(input);
      assert.ok(result >= 0n, `Hash for "${input}" is negative`);
      assert.ok(result < (1n << 64n), `Hash for "${input}" exceeds u64`);
    }
  });
});
