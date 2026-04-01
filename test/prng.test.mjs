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
