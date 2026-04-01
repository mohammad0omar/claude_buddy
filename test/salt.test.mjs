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
    assert.ok(est > 50 && est < 500, `estimate ${est} out of range`);
  });

  it('shiny multiplies by ~100', () => {
    const base = estimateAttempts({ species: 'duck', rarity: 'common', eye: '·', hat: 'none' });
    const shiny = estimateAttempts({ species: 'duck', rarity: 'common', eye: '·', hat: 'none', shiny: true });
    assert.ok(shiny > base * 50, `shiny ${shiny} should be >> base ${base}`);
  });
});
