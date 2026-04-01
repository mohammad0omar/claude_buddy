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
