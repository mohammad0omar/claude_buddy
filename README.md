# claude-buddy

Choose your own Claude Code companion pet. Pick your species, rarity, eyes, hat, and stats — then apply it instantly.

```
npx claude-buddy
```

No Bun required. No native addons. Just Node 18+.

## What it does

Claude Code assigns you a random companion pet based on your account ID. You can't change it through normal means. claude-buddy lets you pick exactly the pet you want by finding a salt that produces your desired combination, then patching the Claude Code binary to use it.

```
$ claude-buddy current

  Your default pet (original salt)

  GOOSE ★

    Eye: ×   Hat: none

  Stats:
    DEBUGGING  ███████░░░░░░░░░░░░░ 35
    PATIENCE   ░░░░░░░░░░░░░░░░░░░░ 1
    CHAOS      ███░░░░░░░░░░░░░░░░░ 14
    WISDOM     ████████████░░░░░░░░ 59
    SNARK      ███░░░░░░░░░░░░░░░░░ 15

$ claude-buddy -s dragon -r legendary -e ✦ -t wizard -y

  Searching (estimated ~8640 attempts)...
  Found in 4231 attempts (892ms)

  DRAGON ★★★★★

    Eye: ✦   Hat: wizard

  Stats:
    DEBUGGING  ████████████████████ 98
    ...

  Patched 3 occurrences
  Done! Launch Claude Code to see your new companion.
```

## Install

```bash
npx claude-buddy          # run directly
npm install -g claude-buddy  # or install globally
```

Requires **Node.js 18+**. That's it.

## Commands

| Command | What it does |
|---------|-------------|
| `claude-buddy` | Interactive pet picker (default) |
| `claude-buddy preview` | Browse pets without applying |
| `claude-buddy current` | Show your default + patched pet |
| `claude-buddy apply` | Re-apply saved pet after Claude Code updates |
| `claude-buddy restore` | Restore your original pet + remove hook |
| `claude-buddy rehatch` | Delete companion for a fresh `/buddy` hatch |

## Options

```
-s, --species <name>     duck, goose, blob, cat, dragon, octopus, owl,
                         penguin, turtle, snail, ghost, axolotl, capybara,
                         cactus, robot, rabbit, mushroom, chonk

-r, --rarity <level>     common (60%), uncommon (25%), rare (10%),
                         epic (4%), legendary (1%)

-e, --eye <char>         · ✦ × ◉ @ °

-t, --hat <name>         crown, tophat, propeller, halo, wizard,
                         beanie, tinyduck (common rarity always gets none)

-n, --name <name>        Rename your companion
-p, --personality <desc> Set companion personality description

--shiny                  Require shiny variant (~100x longer search)
--peak <stat>            Best stat (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK)
--dump <stat>            Worst stat

-y, --yes                Skip all confirmation prompts
--no-hook                Don't offer to install the auto-patch hook
--silent                 Suppress output (for apply command in hooks)
```

## Examples

```bash
# Interactive — walks you through everything
claude-buddy

# Fully scripted — no prompts
claude-buddy -s dragon -r legendary -e ✦ -t wizard -y

# Preview without applying
claude-buddy preview -s cat -r epic

# See what you have now
claude-buddy current

# After a Claude Code update
claude-buddy apply

# Go back to your original pet
claude-buddy restore
```

## Auto-patch hook

Claude Code updates can reset your pet. During setup, claude-buddy offers to install a `SessionStart` hook that re-applies your pet automatically (~50ms overhead). You can also install it manually:

```bash
claude-buddy apply --silent  # what the hook runs
```

To remove the hook:

```bash
claude-buddy restore
```

## How it works

1. **Generates your pet** using the same algorithm as Claude Code — wyhash + Mulberry32 PRNG seeded from `userId + salt`
2. **Brute-forces a salt** that produces your desired species/rarity/eye/hat combination using `worker_threads`
3. **Patches the Claude Code binary** by replacing the salt string at all occurrences (same length, no offset shifts)
4. **Re-signs the binary** on macOS with `codesign --force --sign -`
5. **Backs up** the original binary before the first patch

The wyhash implementation is pure JavaScript (BigInt arithmetic), tested against Bun.hash() with 25 fixture pairs for bit-exact parity. No Bun dependency needed.

## Safety

- Creates a backup of the Claude Code binary before patching (`<binary>.claude-buddy-bak`)
- Uses atomic file writes (temp file + rename) so the binary is never in a half-written state
- Verification step confirms the new salt is present at all expected offsets
- `claude-buddy restore` always works — patches back to the original salt
- The backup file is never deleted automatically

## License

MIT
