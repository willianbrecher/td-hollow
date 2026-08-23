# Hollow Line

A lane-defense tower game — free tower placement, per-level randomized paths,
8-level tower upgrades, a local commander ranking. Ported from a Claude
Design HTML/JS prototype into a real Phaser 3 + TypeScript + Vite project.

## Branches

- `develop` — main integration branch for ongoing work.

## Stack

- **Phaser 3** for the game world (terrain, path, towers, enemies, projectiles).
- **TypeScript**, strict mode.
- **Vite** for dev server + bundling.
- Plain DOM (no framework) for the HUD chrome layered over the canvas — chips,
  phase overlays, the radial build/upgrade menu, and the hover tooltip. This
  mirrors the source prototype's approach (real HTML over a `<canvas>`) and
  keeps text crisp regardless of canvas scale.

## Run it

```
npm install
npm run dev       # dev server with HMR
npm run build     # type-checks then builds to dist/
npm run preview   # serve the production build locally
```

## Project layout

```
src/
  core/          Framework-agnostic simulation — no Phaser or DOM imports here.
    rng.ts         Seeded PRNG (deterministic maps per level seed).
    path.ts        Grid-walk path generation, path-distance helpers.
    terrain.ts      Grass texture dressing (patches, trees, rocks, flowers).
    economy.ts      Wave composition (monster mix per wave/level).
    ranking.ts      localStorage-backed local leaderboard.
    GameState.ts    The simulation: economy, waves, targeting/combat, the
                     build/upgrade menu state machine. `update(dt)` drives
                     one tick; everything else (Phaser, DOM) just reads this.
  data/
    towers.ts, monsters.ts   Stat tables ported from the prototype.
  scenes/
    GameScene.ts    Phaser scene: preloads sprites, draws terrain/path once
                     per map, redraws shots/HP bars/particles each frame,
                     syncs tower/enemy Image objects from GameState, forwards
                     pointer/keyboard input into GameState.
  ui/
    hud.ts          DOM controller for the HUD chips, phase overlay, ranking
                     list, and the build/upgrade radial menu + tooltip.
  main.ts           Bootstraps GameState, Hud, and the Phaser.Game.
public/
  sprites/          Tower (4 types × 8 levels) and monster (17 types) PNGs.
```

## Notes for whoever picks this up next

- The renderer is forced to `Phaser.CANVAS` (see `main.ts`) rather than
  `Phaser.AUTO`/WebGL — this was hit in a headless/software-GPU sandbox during
  testing where WebGL was unstable. Worth trying `Phaser.AUTO` again on a real
  target machine/browser if you want the WebGL path (better perf at scale),
  but Canvas is fine for this game's draw volume.
- `GameState` has zero framework dependencies on purpose — it's the piece
  worth unit-testing (wave composition, economy, path validity) if this
  grows. `npm run typecheck` is wired up; a test runner (Vitest) isn't yet.
- Not yet ported from the original prototype: the four towers' higher-tier
  per-level special mechanics (chain lightning, burning ground, time-stop,
  gold aura) beyond stat scaling — the source design doc flagged these as
  still open too.
- Sprite loading is a flat `this.load.image()` per file (49 files). Worth
  packing into a texture atlas (TexturePacker/Aseprite export) before adding
  much more content.
