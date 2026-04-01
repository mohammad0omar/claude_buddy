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
${chalk.bold('claude-buddy')} v${VERSION}
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
