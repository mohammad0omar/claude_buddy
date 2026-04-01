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
