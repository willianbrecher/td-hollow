import { W, H, WAVES_PER_LEVEL, ACCENT } from './constants';
import { TOWERS, ORDER, MAX_LEVEL, TowerType, TowerSpec, upCost } from '../data/towers';
import { KINDS, MonsterType } from '../data/monsters';
import { genPath, buildSegments, distToPath, nearestOnPath, posAt, Point, Segment, RoadStyle } from './path';
import { buildTerrain, Terrain } from './terrain';
import { waveComp } from './economy';
import { Ranking } from './ranking';

export type Phase = 'name' | 'intro' | 'playing' | 'paused' | 'levelup' | 'over';

export interface Tower {
  type: TowerType;
  level: number;
  cd: number;
  angle: number;
  kills: number;
  spent: number;
  face: 1 | -1;
}

export interface Plot { x: number; y: number; tower: Tower | null; }

export interface Enemy {
  kind: MonsterType;
  d: number; x: number; y: number;
  hp: number; max: number;
  slow: number; hitFlash: number;
  dead?: boolean; leaked?: boolean;
}

export interface Shot {
  x: number; y: number; tx: number; ty: number;
  target: Enemy | null;
  t: number; life: number;
  kind: string; seed: number; color: string;
  dmg: number; splash: number; slow: number;
  tower: Tower;
  hit?: boolean;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

export interface MenuOption {
  key: string; label: string; sub?: string; desc?: string;
  stats?: TowerSpec; cost: number; color: string; ang: number;
}

export interface GameStateOptions { startingGold?: number; startingLives?: number; }

/**
 * Framework-agnostic simulation core, ported from the Hollow Line prototype.
 * Owns economy, wave spawning, tower targeting/combat and the build/upgrade
 * menu state machine. Rendering (Phaser) and chrome (DOM HUD) both just read
 * this object and call its methods — nothing here touches the DOM or canvas.
 */
export class GameState {
  startingGold: number;
  startingLives: number;

  phase: Phase = 'name';
  gold = 0;
  lives = 0;
  level = 1;
  waveInLevel = 0;
  wave = 0;
  speed: 1 | 2 = 1;
  best = 0;

  runSeed = 0;
  pts: Point[] = [];
  segs: Segment[] = [];
  pathLen = 0;
  roadStyle: RoadStyle = 'sharp';
  terrain: Terrain = { patches: [], decor: [], blobs: [] };

  plots: Plot[] = [];
  menu: Plot | null = null;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  parts: Particle[] = [];
  spawnQueue: { kind: MonsterType; gap: number }[] = [];
  spawnTimer = 0;
  prep = 0;
  time = 0;
  scale = 1;

  ranking = new Ranking();

  /** Set by the render layer; fires whenever buildMap() produces a new path/terrain so it can redraw its static layer. */
  onMapRebuilt?: () => void;

  constructor(opts: GameStateOptions = {}) {
    this.startingGold = opts.startingGold ?? 300;
    this.startingLives = opts.startingLives ?? 20;
    this.ranking.load();
    this.best = this.ranking.bestOf(this.ranking.player);
  }

  get player(): string { return this.ranking.player; }

  setPlayer(name: string): void {
    this.ranking.setPlayer(name);
    this.best = this.ranking.bestOf(this.ranking.player);
  }

  reset(): void {
    this.gold = this.startingGold;
    this.lives = this.startingLives;
    this.level = 1; this.waveInLevel = 0; this.wave = 0; this.speed = 1;
    this.runSeed = Math.floor(Math.random() * 100000);
    this.buildMap(this.runSeed + 7919);
    this.plots = [];
    this.menu = null;
    this.enemies = []; this.shots = []; this.parts = []; this.spawnQueue = [];
    this.spawnTimer = 0; this.prep = 12; this.time = 0;
    this.phase = 'name';
  }

  buildMap(seed: number): void {
    const { pts, roadStyle } = genPath(seed, this.level, W, H);
    this.pts = pts;
    this.roadStyle = roadStyle;
    const { segs, pathLen } = buildSegments(pts);
    this.segs = segs; this.pathLen = pathLen;
    this.terrain = buildTerrain(seed, segs, W, H);
    this.onMapRebuilt?.();
  }

  gWave(): number { return (this.level - 1) * WAVES_PER_LEVEL + this.waveInLevel; }

  startWave(): void {
    this.waveInLevel++; this.wave++;
    const boss = this.waveInLevel === WAVES_PER_LEVEL;
    this.spawnQueue = waveComp(this.gWave(), boss, this.level);
    this.spawnTimer = 0; this.prep = 0;
    this.scale = Math.pow(1.1, this.gWave() - 1);
    this.phase = 'playing';
  }

  startLevel(n: number): void {
    this.level = n; this.waveInLevel = 0;
    this.buildMap(this.runSeed + n * 7919);
    this.enemies = []; this.shots = []; this.parts = []; this.spawnQueue = [];
    this.spawnTimer = 0; this.prep = 0; this.menu = null;
    this.startWave();
  }

  update(dt: number): void {
    this.time += dt;

    if (this.prep > 0) {
      this.prep -= dt;
      if (this.prep <= 0) { this.startWave(); return; }
    } else if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const e = this.spawnQueue.shift()!;
        const k = KINDS[e.kind], hp = k.hp * this.scale;
        this.enemies.push({ kind: e.kind, d: 0, x: this.pts[0].x, y: this.pts[0].y, hp, max: hp, slow: 0, hitFlash: 0 });
        this.spawnTimer = e.gap;
      }
    }

    for (const e of this.enemies) {
      const k = KINDS[e.kind];
      e.slow = Math.max(0, e.slow - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.d += k.speed * (e.slow > 0 ? .5 : 1) * dt;
      const p = posAt(this.segs, this.pts, e.d); e.x = p.x; e.y = p.y;
      if (e.d >= this.pathLen) e.leaked = true;
    }
    let leaked = 0;
    this.enemies = this.enemies.filter(e => { if (e.leaked) { leaked++; return false; } return true; });
    if (leaked) { const l = this.pts[this.pts.length - 1]; this.lives -= leaked; this.spark(l.x - 40, l.y, '#d98f9c', 16); }

    for (const p of this.plots) {
      const t = p.tower; if (!t) continue;
      const spec = TOWERS[t.type];
      t.cd -= dt;
      const range = spec.range * (1 + (t.level - 1) * .06);
      const dmg = spec.damage * (1 + (t.level - 1) * .48);
      if (t.cd <= 0) {
        let target: Enemy | null = null, bestD = -1;
        for (const e of this.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) <= range && e.d > bestD) { bestD = e.d; target = e; }
        if (target) {
          t.cd = 1 / (spec.rate * (1 + (t.level - 1) * .11));
          t.angle = Math.atan2(target.y - p.y, target.x - p.x);
          this.shots.push({
            x: p.x, y: p.y - 10, tx: target.x, ty: target.y, target, t: 0,
            life: spec.art === 'cannon' ? .3 : spec.art === 'poison' ? .26 : .18,
            kind: spec.art, seed: Math.random() * 6.283, color: spec.color,
            dmg, splash: spec.splash, slow: spec.slow, tower: t
          });
        }
      }
    }

    for (const s of this.shots) {
      s.t += dt;
      if (s.target && !s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      if (s.t >= s.life && !s.hit) {
        s.hit = true;
        if (s.splash) { this.spark(s.tx, s.ty, s.color, 9); for (const e of this.enemies) if (Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash) this.hurt(e, s.dmg, s); }
        else if (s.target && !s.target.dead) this.hurt(s.target, s.dmg, s);
      }
    }
    this.shots = this.shots.filter(s => s.t < s.life + .06);
    this.enemies = this.enemies.filter(e => !e.dead);

    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt; }
    this.parts = this.parts.filter(p => p.life > 0);

    if (this.lives <= 0) {
      this.lives = 0;
      this.ranking.record(this.level);
      this.best = this.ranking.bestOf(this.player);
      this.phase = 'over';
      return;
    }
    if (this.prep <= 0 && !this.spawnQueue.length && !this.enemies.length) {
      this.gold += 55 + this.gWave() * 10;
      if (this.waveInLevel >= WAVES_PER_LEVEL) {
        this.gold += 90 + this.level * 40;
        this.lives = Math.min(this.startingLives, this.lives + 3);
        this.ranking.record(this.level);
        this.best = this.ranking.bestOf(this.player);
        this.phase = 'levelup';
      } else {
        this.prep = 14;
      }
    }
  }

  hurt(e: Enemy, dmg: number, s?: Shot): void {
    e.hp -= dmg; e.hitFlash = .12;
    if (s && s.slow) e.slow = 1.6;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.gold += Math.round(KINDS[e.kind].gold * 1.35 * (1 + this.gWave() * .04));
      if (s) s.tower.kills = (s.tower.kills || 0) + 1;
      this.spark(e.x, e.y, KINDS[e.kind].color, 11);
    }
  }

  spark(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 30 + Math.random() * 110;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .35 + Math.random() * .3, color });
    }
  }

  canPlace(x: number, y: number): boolean {
    if (x < 34 || y < 34 || x > W - 34 || y > H - 34) return false;
    if (distToPath(this.segs, x, y) < 44) return false;
    return this.plots.every(p => Math.hypot(p.x - x, p.y - y) > 46);
  }

  menuOptions(plot: Plot): MenuOption[] {
    const t = plot.tower;
    if (!t) return ORDER.map((k, i) => ({
      key: k, label: TOWERS[k].name, sub: TOWERS[k].levels[0] + ' · Level 1', desc: TOWERS[k].desc,
      stats: TOWERS[k], cost: TOWERS[k].cost, color: TOWERS[k].color, ang: -Math.PI * (11 / 12) + i * (Math.PI * 5 / 6) / 3
    }));
    const spec = TOWERS[t.type];
    const out: MenuOption[] = [{ key: 'sell', label: 'Sell', desc: 'Remove this tower and refund 80% of what you spent.', cost: -Math.round(t.spent * .8), color: '#b9bccb', ang: -Math.PI * (2 / 3) }];
    if (t.level < MAX_LEVEL) out.push({ key: 'up', label: spec.levels[t.level], sub: 'Level ' + (t.level + 1) + ' · ' + spec.name, desc: 'Damage +48%, fire rate +11%, range +6%.', cost: upCost(spec, t.level), color: ACCENT, ang: -Math.PI / 3 });
    return out;
  }

  /** True if a click landed on this menu's option `key` given world coords, and applies it. Returns whether the menu should close. */
  applyMenuOption(plot: Plot, key: string, cost: number): void {
    const isNew = !plot.tower;
    if (key === 'sell') { this.gold += -cost; plot.tower = null; }
    else if (key === 'up') { if (this.gold >= cost) { this.gold -= cost; plot.tower!.spent += cost; plot.tower!.level++; } }
    else if (this.gold >= cost) {
      this.gold -= cost;
      const np = nearestOnPath(this.segs, plot.x, plot.y);
      plot.tower = { type: key as TowerType, level: 1, cd: 0, angle: -Math.PI / 2, kills: 0, spent: cost, face: np.x < plot.x ? -1 : 1 };
      if (isNew) this.plots.push(plot);
    }
    if (plot.tower === null && !isNew) this.plots = this.plots.filter(p => p !== plot);
    this.menu = null;
  }

  /** Handles a click in world coordinates: menu hit-testing, opening a build/upgrade menu, or closing it. */
  handleClick(mx: number, my: number): void {
    if (this.phase !== 'playing') return;
    if (this.menu) {
      const plot = this.menu;
      for (const o of this.menuOptions(plot)) {
        const ox = plot.x + Math.cos(o.ang) * 62, oy = plot.y + Math.sin(o.ang) * 62;
        if (Math.hypot(mx - ox, my - oy) < 24) { this.applyMenuOption(plot, o.key, o.cost); return; }
      }
      this.menu = null;
      return;
    }
    for (const p of this.plots) if (Math.hypot(mx - p.x, my - p.y) < 28) { this.menu = p; return; }
    if (this.canPlace(mx, my)) this.menu = { x: mx, y: my, tower: null };
  }

  /** DOM menu buttons call this directly with the option key they represent, instead of re-deriving it from a click position. */
  selectMenuOption(key: string): void {
    if (!this.menu) return;
    const o = this.menuOptions(this.menu).find(o => o.key === key);
    if (!o) return;
    this.applyMenuOption(this.menu, o.key, o.cost);
  }

  togglePause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }

  setSpeed(n: 1 | 2): void { this.speed = n; }

  callWaveEarly(): void {
    if (this.prep > 0 && this.phase === 'playing') { this.gold += Math.ceil(this.prep) * 5; this.startWave(); }
  }
}
