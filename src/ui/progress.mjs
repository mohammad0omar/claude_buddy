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
