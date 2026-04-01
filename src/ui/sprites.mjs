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
