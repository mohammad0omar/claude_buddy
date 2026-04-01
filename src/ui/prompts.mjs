import { select, confirm, input } from '@inquirer/prompts';
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
