# SOLMAR — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/anirhfx-agent/gta6-rebuild-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/anirhfx-agent/gta6-rebuild-v2/reward.svg)](https://make.fun/bounty/gta6-01)

**SOLMAR** is a complete open-world crime game in the spirit of GTA 6, built
from scratch for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
It plays offline in a desktop browser from static files — no network, no
build step, no library.

## The game

Sun, sea and bad decisions. You are **Leo Marín**, a driver for hire in
**Solmar**, a sun-soaked coastal city. You owe the fixer **Cassie Vane**, and
she pays in jobs: five story missions, then the whole city is yours.

- **A city on foot and by car** — a fixed-seed grid city (11×11 blocks) with
  roads, crosswalks, parks, parking lots, a beach and a pier. Drive with
  arcade handling, drift, skid marks and crashes.
- **Traffic and pedestrians** — cars follow the road grid and slow for the car
  ahead; pedestrians stroll the sidewalks and flee from trouble.
- **Steal cars** — take a parked car with E, or carjack a driven one (the law
  notices).
- **Wanted system and police** — 1–5 stars for crimes; PD units chase, ram
  and send officers out to arrest you on foot. Break line of sight to cool
  the heat. Busted costs you a fine and a night in the precinct.
- **Missions and a story** — 5 jobs from Cassie: steal wheels, a timed
  courier run, losing a 2-star heat, collecting cash drops, and the Big Score
  at Solmar Pier. Then repeatable fare runs.
- **Combat** — fists (Space) and a pistol (click to shoot, R to buy ammo).
- **HUD with a minimap** — health, cash, wanted stars, mission objective,
  speed, clock, and a live minimap with the player, police and objective.
- **Start and save** — title screen with New Game / Continue; progress
  autosaves to localStorage.
- **Sound** — every effect is synthesised with WebAudio (engine, sirens,
  gunshots, pickups). No audio files.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Controls: **WASD / Arrows** move & drive · **Shift** run · **E** enter / steal
car · **Space** punch · **Click** shoot · **R** buy ammo ($30) · **T** fare
run · **H** horn · **M** mute · **Esc** pause.

## How it is built

- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the kit's
  `vendor/makefun-game.ts`.
- `game/` is plain static files: `index.html` plus ES modules under
  `game/src/`, one clear job each — `city` (map), `player` (walk/drive),
  `traffic` (cars and pedestrians), `police` (wanted + PD), `missions`
  (story), `combat` (fists and pistol), `render` (canvas), `hud` (readouts
  and minimap), `audio` (synth), `save`, `input`, `shots` (screenshot
  scenes), `rng` (seeded random).
- Everything in the game is original: the city, characters, vehicles, names,
  story, art and sound. Nothing from any commercial game.

## Screenshots

Four captures of the game running in a desktop browser, under
`screenshots/` — driving Ocean Drive, a three-star police chase, on foot
with the PD closing in, and a mission in progress.
