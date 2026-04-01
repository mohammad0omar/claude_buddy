# claude-pets

> Pick your own Claude Code companion. Any species. Any rarity. Your rules.

```bash
npx claude-pets
```

Pure Node.js. No Bun. No native addons. Just Node 18+.

---

## Why

Claude Code gives you a random companion pet tied to your account ID. You can't change it. Maybe you got a common duck when you wanted a legendary dragon. Now you don't have to settle.

## Get Started

```bash
# One command, no install
npx claude-pets

# Or install globally
npm install -g claude-pets
```

The interactive mode walks you through everything — species, rarity, eyes, hat, stats, name, personality.

## One-Liners

Don't want the wizard? Grab your pet in one shot:

```bash
# Legendary dragon, wizard hat, star eyes
claude-pets -s dragon -r legendary -e ✦ -t wizard -y

# Epic cat with halo
claude-pets -s cat -r epic -e ◉ -t halo -y

# Rare ghost with crown
claude-pets -s ghost -r rare -e · -t crown -y

# Shiny legendary octopus (takes ~30-60s)
claude-pets -s octopus -r legendary -e ✦ -t propeller --shiny -y

# Common duck (instant)
claude-pets -s duck -r common -e · -y
```

## What You Can Pick

**18 Species**
`duck` `goose` `blob` `cat` `dragon` `octopus` `owl` `penguin` `turtle` `snail` `ghost` `axolotl` `capybara` `cactus` `robot` `rabbit` `mushroom` `chonk`

**5 Rarities**

| Rarity | Chance | Stat Floor |
|--------|--------|------------|
| Common | 60% | 5 |
| Uncommon | 25% | 15 |
| Rare | 10% | 25 |
| Epic | 4% | 35 |
| Legendary | 1% | 50 |

**6 Eyes** &mdash; `·` `✦` `×` `◉` `@` `°`

**8 Hats** &mdash; `crown` `tophat` `propeller` `halo` `wizard` `beanie` `tinyduck` `none`

**5 Stats** &mdash; DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

**Shiny variants** &mdash; 1% chance per roll. Add `--shiny` to require one.

## Commands

```
claude-pets              Interactive pet picker (default)
claude-pets preview      Browse pets without applying
claude-pets current      Show your default + active pet
claude-pets apply        Re-apply after Claude Code updates
claude-pets restore      Undo everything, back to original
claude-pets rehatch      Delete companion for a fresh /buddy
```

## All Flags

```
-s, --species <name>     Pick species
-r, --rarity <level>     Pick rarity
-e, --eye <char>         Pick eye style
-t, --hat <name>         Pick hat
-n, --name <name>        Rename companion
-p, --personality <desc> Set personality (fixes species mismatch)
--shiny                  Require shiny (~100x longer search)
--peak <stat>            Choose best stat
--dump <stat>            Choose worst stat
-y, --yes                Skip all prompts
--no-hook                Skip auto-patch hook offer
--silent                 No output (for hooks)
```

## Survives Updates

Claude Code updates overwrite the binary. claude-pets can install a `SessionStart` hook that re-patches automatically (~50ms, you won't notice):

```bash
# The hook runs this on every session start
claude-pets apply --silent
```

Remove it anytime with `claude-pets restore`.

## How It Works

1. Hashes `userId + salt` with wyhash (same algorithm as Claude Code)
2. Feeds the hash into Mulberry32 PRNG to roll species/rarity/eye/hat/stats
3. Brute-forces random salts until one produces your desired combo
4. Patches the Claude Code binary — replaces the salt at all occurrences
5. Re-signs on macOS, backs up the original first

The wyhash is implemented in pure JavaScript using BigInt, verified against 25 Bun.hash() fixtures for bit-exact output. Search runs on `worker_threads` for parallel speed.

## Safety

- Backs up the binary before first patch (`<binary>.claude-pets-bak`)
- Atomic writes — temp file + rename, never half-written
- Verifies patch by re-reading the binary after write
- `claude-pets restore` always works
- Backup is never auto-deleted

## Requirements

- Node.js 18+
- Claude Code installed

That's it. No Bun, no native dependencies, no build step.

## License

MIT
