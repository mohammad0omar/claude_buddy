import chalk from 'chalk';
import { loadConfig } from '../system/config.mjs';
import { findClaudeBinary, findSaltInBinary, patchBinary } from '../system/binary.mjs';

export function runApply(flags) {
  const config = loadConfig();
  if (!config?.salt) {
    if (!flags.silent) console.log(chalk.yellow('No saved pet config. Run claude-pets first.'));
    return;
  }

  const binaryPath = findClaudeBinary();
  const knownSalts = [config.salt, config.previousSalt];
  const { salt: currentSalt } = findSaltInBinary(binaryPath, knownSalts);

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
