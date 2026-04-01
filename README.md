# claude-pets

> Pick your own Claude Code companion. Any species. Any rarity. Your rules.

```bash
npx claude-pets
```

Pure Node.js. No Bun. No native addons. Just Node 18+.

---

## Why

Claude Code gives you a random companion pet locked to your account ID. You can't change it. claude-pets fixes that — pick exactly what you want, apply it in seconds.

## Get Started

```bash
npx claude-pets            # run directly, no install
npm install -g claude-pets  # or install globally
```

## One-Liners

Skip the wizard. Grab your pet in one shot:

```bash
claude-pets -s dragon -r legendary -e ✦ -t wizard -y
```

```
  Searching (estimated ~8640 attempts)...
  Found in 4231 attempts (892ms)

  DRAGON ★★★★★

    Eye: ✦   Hat: wizard

  Stats:
    DEBUGGING  ████████████████████ 98
    PATIENCE   ██████████████░░░░░░ 72
    CHAOS      ████████████░░░░░░░░ 61
    WISDOM     ███████████████░░░░░ 77
    SNARK      ██████████████████░░ 89

  Patched 3 occurrences
  Done! Launch Claude Code to see your new companion.
```

More combos ready to paste:

```bash
claude-pets -s cat -r epic -e ◉ -t halo -y           # Epic cat with halo
claude-pets -s ghost -r rare -e · -t crown -y         # Rare ghost with crown
claude-pets -s axolotl -r legendary -e ° -t tinyduck -y  # Legendary axolotl
claude-pets -s octopus -r legendary --shiny -y        # Shiny legendary octopus (~30s)
claude-pets -s duck -r common -e · -y                 # Common duck (instant)
```

---

## All 18 Species

```
  duck        goose       blob        cat         dragon      octopus
    __           (·>       .----.      /\_/\      /^\  /^\     .----.
  <(· )___       ||      ( ·  · )   ( ·   ·)   <  ·  ·  >   ( ·  · )
   (  ._>      _(__)_    (      )   (  ω  )    (   ~~   )   (______)
    `--´        ^^^^      `----´    (")_(")     `-vvvv-´    /\/\/\/\

  owl         penguin     turtle      snail       ghost       axolotl
   /\  /\    .---.       _,--._    ·    .--.     .----.   }~(______)~{
  ((·)(·))   (·>·)      ( ·  · )    \  ( @ )   / ·  · \  }~(· .. ·)~{
  (  ><  )  /(   )\    /[______]\    \_`--´    |      |    ( .--. )
   `----´    `---´      ``    ``    ~~~~~~~    `~``~`~    (_/  \_)

  capybara    cactus      robot       rabbit      mushroom    chonk
  n______n   n  ____  n    .[||].     (\__/)    .-o-OO-o-.   /\    /\
 ( ·    · )  | |·  ·| |  [ ·  · ]   ( ·  · )  (__________)  ( ·    · )
 (   oo   )  |_|    |_|  [ ==== ]  =(  ..  )=    |·  ·|     (   ..   )
  `------´     |    |     `------´   (")__(")     |____|      `------´
```

---

## Rarities

| Rarity | Stars | Chance | Stat Floor |
|--------|-------|--------|------------|
| Common | ★ | 60% | 5 |
| Uncommon | ★★ | 25% | 15 |
| Rare | ★★★ | 10% | 25 |
| Epic | ★★★★ | 4% | 35 |
| Legendary | ★★★★★ | 1% | 50 |

Common pets get no hat. All others roll one.

## Eyes

| Style | Character |
|-------|-----------|
| Dot | `·` |
| Sparkle | `✦` |
| Cross | `×` |
| Circle | `◉` |
| At | `@` |
| Degree | `°` |

## Hats

Seven hat styles (uncommon+ only):

```
  crown       tophat      propeller   halo        wizard      beanie      tinyduck
   \^^^/       [___]        -+-       (   )        /^\        (___)         ,>
```

## Stats

Five stats per pet: **DEBUGGING**, **PATIENCE**, **CHAOS**, **WISDOM**, **SNARK**

Each pet has a peak (best) and dump (worst) stat. Higher rarity = higher stat floor. Control them with `--peak` and `--dump`:

```bash
claude-pets -s robot -r epic -e × --peak DEBUGGING --dump CHAOS -y
```

## Shiny

1% chance per seed. Add `--shiny` to require one. Takes ~30-60 seconds instead of <1 second since only 1 in 100 seeds qualify.

```bash
claude-pets -s dragon -r legendary -e ✦ -t wizard --shiny -y
```

---

## Commands

```
claude-pets              Interactive pet picker
claude-pets current      Show your default + active pet
claude-pets preview      Browse pets without applying
claude-pets apply        Re-apply after Claude Code updates
claude-pets restore      Undo everything, back to original
claude-pets rehatch      Delete companion for fresh /buddy
```

## All Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--species <name>` | `-s` | Pick species |
| `--rarity <level>` | `-r` | Pick rarity |
| `--eye <char>` | `-e` | Pick eye style |
| `--hat <name>` | `-t` | Pick hat |
| `--name <name>` | `-n` | Rename companion |
| `--personality <desc>` | `-p` | Set personality description |
| `--shiny` | | Require shiny variant |
| `--peak <stat>` | | Choose best stat |
| `--dump <stat>` | | Choose worst stat |
| `--yes` | `-y` | Skip all prompts |
| `--no-hook` | | Skip auto-patch hook offer |
| `--silent` | | No output (for hooks) |

Any flag you don't provide will be prompted interactively.

---

## Auto-Patch Hook

Claude Code updates overwrite the binary. claude-pets can install a `SessionStart` hook that re-patches automatically (~50ms, you won't notice):

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "claude-pets apply --silent" }]
    }]
  }
}
```

You're asked during setup. Remove it anytime with `claude-pets restore`.

## How It Works

1. Hashes `userId + salt` with **wyhash** (same algorithm as Claude Code)
2. Feeds the hash into **Mulberry32 PRNG** to roll traits
3. **Brute-forces** random salts until one produces your desired combo
4. **Patches** the binary — replaces the salt at all occurrences (same length, no offset shifts)
5. **Re-signs** on macOS with `codesign --force --sign -`

The wyhash is pure JavaScript (BigInt arithmetic), verified against 25 Bun.hash() fixtures for bit-exact output. Search runs on `worker_threads` for parallel speed.

## Safety

- Backs up the binary before first patch (`<binary>.claude-pets-bak`)
- Atomic writes — temp file + rename, never half-written
- Verifies patch by re-reading the binary after write
- `claude-pets restore` always works
- Backup is never auto-deleted

## Files

| File | Purpose |
|------|---------|
| `~/.claude.json` | Read-only — user ID is read from here |
| `~/.claude-pets.json` | Your saved salt and pet config |
| `~/.claude/settings.json` | Auto-patch hook (optional) |
| `<binary>.claude-pets-bak` | Backup of original binary |

## Requirements

- **Node.js 18+**
- **Claude Code** installed

No Bun. No native dependencies. No build step.

## License

MIT
