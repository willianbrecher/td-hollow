import Phaser from 'phaser';
import { W, H } from '../core/constants';
import { GameState, Enemy, Plot, Shot } from '../core/GameState';
import { TOWERS, MAX_LEVEL, towerScale } from '../data/towers';
import { KINDS } from '../data/monsters';
import type { Hud } from '../ui/hud';

interface TowerVisual { img: Phaser.GameObjects.Image; badgeBg?: Phaser.GameObjects.Graphics; badgeText?: Phaser.GameObjects.Text; }

export class GameScene extends Phaser.Scene {
  state: GameState;
  hud: Hud;

  private terrainGfx!: Phaser.GameObjects.Graphics;
  private dynamicGfx!: Phaser.GameObjects.Graphics;
  private towerSprites = new Map<Plot, TowerVisual>();
  private enemySprites = new Map<Enemy, Phaser.GameObjects.Image>();
  private pointer = { x: -1, y: -1, active: false };

  constructor(state: GameState, hud: Hud) {
    super('game');
    this.state = state;
    this.hud = hud;
  }

  preload() {
    for (const spec of Object.values(TOWERS)) {
      for (let lv = 1; lv <= MAX_LEVEL; lv++) this.load.image(spec.art + '-' + lv, `sprites/${spec.art}-${lv}.png`);
    }
    for (const kind of Object.values(KINDS)) this.load.image(kind.art, `sprites/${kind.art}.png`);
  }

  create() {
    this.terrainGfx = this.add.graphics().setDepth(0);
    this.dynamicGfx = this.add.graphics().setDepth(5);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.pointer.x = p.worldX; this.pointer.y = p.worldY; this.pointer.active = true; });
    this.input.on('pointerout', () => { this.pointer.active = false; });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state.phase !== 'playing') return;
      this.state.handleClick(p.worldX, p.worldY);
    });
    this.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => { e.preventDefault(); this.state.togglePause(); });
    this.input.keyboard?.on('keydown-ESC', () => { this.state.menu = null; });

    this.state.onMapRebuilt = () => this.redrawTerrain();
    this.state.reset();
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    if (this.state.phase === 'playing') {
      for (let i = 0; i < this.state.speed; i++) this.state.update(dt);
    }
    this.syncTowers();
    this.syncEnemies();
    this.drawDynamic();
    this.hud.sync(this.state);
  }

  // --- Static terrain (redrawn only when the map/path is rebuilt) ---
  private redrawTerrain() {
    const g = this.terrainGfx;
    g.clear();
    g.fillGradientStyle(0x1d2a25, 0x1d2a25, 0x141e1a, 0x141e1a, 1);
    g.fillRect(0, 0, W, H);

    for (const b of this.state.terrain.blobs) {
      g.fillStyle(0x7eba8c, b.a * 1.4);
      g.fillCircle(b.x, b.y, b.r);
    }
    for (const p of this.state.terrain.patches) {
      g.fillStyle(p.dark ? 0x0c1612 : 0x78b484, p.dark ? .22 : .05);
      g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
    }

    g.lineStyle(66, 0x0b120e, .92);
    for (const s of this.state.segs) g.lineBetween(s.a.x, s.a.y, s.b.x, s.b.y);
    g.lineStyle(56, 0x39352c, 1);
    for (const s of this.state.segs) g.lineBetween(s.a.x, s.a.y, s.b.x, s.b.y);
    g.lineStyle(46, 0x453f33, 1);
    for (const s of this.state.segs) g.lineBetween(s.a.x, s.a.y, s.b.x, s.b.y);

    for (const d of this.state.terrain.decor) this.drawDecor(g, d);
  }

  private drawDecor(g: Phaser.GameObjects.Graphics, d: { x: number; y: number; kind: string; s: number; t: number }) {
    const s = d.s;
    if (d.kind === 'tree') {
      g.fillStyle(0x06120a, .4);
      g.fillEllipse(d.x, d.y + 9 * s, 22 * s, 8 * s);
      g.fillStyle(0x1f3529, 1);
      g.fillTriangle(d.x, d.y - 30 * s, d.x + 10 * s, d.y + 6 * s, d.x - 10 * s, d.y + 6 * s);
      g.fillStyle(0x1a2019, 1);
      g.fillRect(d.x - 2 * s, d.y + 6 * s, 4 * s, 5 * s);
    } else if (d.kind === 'rock') {
      g.fillStyle(0x2b3138, 1);
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, rr = (7 + ((i * 37 + d.t * 100) % 4)) * s; pts.push(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr * .78); }
      g.fillPoints(toPointArray(pts), true);
    } else if (d.kind === 'flower') {
      g.fillStyle(d.t > .5 ? 0xd6c478 : 0xc4a8d6, .5);
      for (let i = 0; i < 3; i++) g.fillCircle(d.x - 3 * s + i * 3 * s, d.y + ((i % 2) * 3 - 1) * s, 1.5 * s);
    } else {
      g.lineStyle(1.5 * s, d.t > .6 ? 0x7eb48a : 0x5c8c6a, .26);
      g.lineBetween(d.x - 4 * s, d.y + 4 * s, d.x - 2 * s, d.y - 6 * s);
      g.lineBetween(d.x, d.y + 5 * s, d.x + 1 * s, d.y - 8 * s);
      g.lineBetween(d.x + 4 * s, d.y + 4 * s, d.x + 3 * s, d.y - 6 * s);
    }
  }

  // --- Everything that changes frame to frame ---
  private drawDynamic() {
    const g = this.dynamicGfx;
    const st = this.state;
    g.clear();

    for (const p of st.plots) { g.fillStyle(0x0a0b12, .55); g.fillEllipse(p.x, p.y + 8, 42, 18); }

    // moving direction ticks along the road
    g.fillStyle(0x9184d9, .32);
    const dashLen = 5, gapLen = 16, period = dashLen + gapLen;
    const offset = ((st.time * 30) % period + period) % period;
    for (let d = -offset; d < st.pathLen; d += period) {
      const a = Math.max(0, d), b = Math.min(st.pathLen, d + dashLen);
      if (b <= a) continue;
      const pa = posAtSafe(st, a), pb = posAtSafe(st, b);
      g.lineStyle(2, 0x9184d9, .32);
      g.lineBetween(pa.x, pa.y, pb.x, pb.y);
    }

    if (st.phase === 'playing' && this.pointer.active && !st.menu) {
      const near = st.plots.some(p => Math.hypot(this.pointer.x - p.x, this.pointer.y - p.y) < 28);
      if (!near) {
        const ok = st.canPlace(this.pointer.x, this.pointer.y);
        const color = ok ? 0x9184d9 : 0xd98f9c;
        g.fillStyle(color, .13); g.fillCircle(this.pointer.x, this.pointer.y, 19);
        g.lineStyle(1.4, color, .85); g.strokeCircle(this.pointer.x, this.pointer.y, 19);
        g.lineStyle(2, color, .95);
        g.lineBetween(this.pointer.x - 6, this.pointer.y, this.pointer.x + 6, this.pointer.y);
        g.lineBetween(this.pointer.x, this.pointer.y - 6, this.pointer.x, this.pointer.y + 6);
      }
    }

    for (const p of st.plots) {
      const t = p.tower; if (!t) continue;
      const spec = TOWERS[t.type];
      const showRange = st.menu === p || (this.pointer.active && Math.hypot(this.pointer.x - p.x, this.pointer.y - p.y) < 28);
      if (showRange) {
        const range = spec.range * (1 + (t.level - 1) * .06);
        g.fillStyle(0x9184d9, .06); g.fillCircle(p.x, p.y, range);
        g.lineStyle(1, 0x9184d9, .4); g.strokeCircle(p.x, p.y, range);
      }
    }

    for (const s of st.shots) this.drawShot(g, s, st.time);

    for (const e of st.enemies) {
      const k = KINDS[e.kind];
      g.fillStyle(0x08090f, .45);
      g.fillEllipse(e.x, e.y + k.r * .78, k.r * 1.6, k.r * .6);
      const hpk = Math.max(0, e.hp / e.max);
      if (hpk < 1) {
        const w = k.r * 2.1;
        g.fillStyle(0x000000, .55); g.fillRect(e.x - w / 2, e.y - k.r - 9, w, 3.5);
        g.fillStyle(hpk > .5 ? 0x8fc79a : 0xd98f9c, 1); g.fillRect(e.x - w / 2, e.y - k.r - 9, w * hpk, 3.5);
      }
    }

    for (const pt of st.parts) { g.fillStyle(Phaser.Display.Color.HexStringToColor(pt.color).color, Math.max(0, pt.life * 2)); g.fillRect(pt.x - 1.6, pt.y - 1.6, 3.2, 3.2); }

    if (st.prep > 0 && st.phase === 'playing') {
      // handled by DOM HUD banner instead of canvas text for crisper type
    }
  }

  private drawShot(g: Phaser.GameObjects.Graphics, s: Shot, time: number) {
    const k = Math.min(1, s.t / s.life);
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const dist = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
    const lift = s.kind === 'cannon' ? Math.sin(k * Math.PI) * Math.min(46, dist * .22) : 0;
    const x = s.x + dx * k, y = s.y + dy * k - lift;

    if (s.kind === 'archer') {
      const bx = x - Math.cos(ang) * 9, by = y - Math.sin(ang) * 9;
      g.lineStyle(1, 0xe6d9bd, .3); g.lineBetween(x - Math.cos(ang) * 26, y - Math.sin(ang) * 26, bx, by);
      g.lineStyle(2, 0xcdb185, 1); g.lineBetween(bx, by, x + Math.cos(ang) * 6, y + Math.sin(ang) * 6);
      const tipX = x + Math.cos(ang) * 11, tipY = y + Math.sin(ang) * 11;
      const perp = ang + Math.PI / 2;
      g.fillStyle(0xe9e9ed, 1);
      g.fillTriangle(tipX, tipY, x + Math.cos(ang) * 4 + Math.cos(perp) * 2.6, y + Math.sin(ang) * 4 + Math.sin(perp) * 2.6, x + Math.cos(ang) * 4 - Math.cos(perp) * 2.6, y + Math.sin(ang) * 4 - Math.sin(perp) * 2.6);
    } else if (s.kind === 'cannon') {
      g.fillStyle(0x2c2b2a, 1); g.fillCircle(x, y, 5.4);
      g.fillStyle(0xe9e9ed, .4); g.fillCircle(x - 1.7, y - 1.7, 1.7);
    } else if (s.kind === 'poison') {
      const wob = Math.sin(s.seed + k * 9) * 3.2;
      const ox = x + Math.cos(ang + 1.57) * wob, oy = y + Math.sin(ang + 1.57) * wob;
      g.fillStyle(Phaser.Display.Color.HexStringToColor(s.color).color, .3); g.fillCircle(ox, oy, 7.5 + Math.sin(s.seed + k * 12) * 1.2);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(s.color).color, .85); g.fillCircle(ox, oy, 3.8);
      g.fillStyle(0xe4f3cf, .5); g.fillCircle(ox - 1.2, oy - 1.2, 1.4);
    } else {
      const pulse = 1 + Math.sin(s.seed + time * 22) * .16;
      const color = Phaser.Display.Color.HexStringToColor(s.color).color;
      g.fillStyle(color, .25); g.fillCircle(x, y, 9 * pulse);
      g.fillStyle(color, .95); g.fillCircle(x, y, 4.2 * pulse);
      g.fillStyle(0xf2f0ff, 1); g.fillCircle(x, y, 1.9);
      g.lineStyle(1.6, color, .35);
      g.beginPath(); g.arc(x, y, 8 * pulse, s.seed + time * 8, s.seed + time * 8 + 2.2); g.strokePath();
    }
  }

  // --- Sprites (towers/enemies) synced from GameState each frame ---
  private syncTowers() {
    const live = new Set(this.state.plots.filter(p => p.tower));
    for (const [plot, vis] of this.towerSprites) {
      if (!live.has(plot)) { vis.img.destroy(); vis.badgeBg?.destroy(); vis.badgeText?.destroy(); this.towerSprites.delete(plot); }
    }
    for (const plot of this.state.plots) {
      const t = plot.tower; if (!t) continue;
      const spec = TOWERS[t.type];
      const lv = Math.min(MAX_LEVEL, t.level);
      let vis = this.towerSprites.get(plot);
      if (!vis) { vis = { img: this.add.image(plot.x, plot.y, spec.art + '-' + lv).setDepth(10) }; this.towerSprites.set(plot, vis); }
      const key = spec.art + '-' + lv;
      if (vis.img.texture.key !== key) vis.img.setTexture(key);
      const target = 64 * towerScale(lv);
      const s = target / Math.max(vis.img.width, vis.img.height);
      vis.img.setScale(s * t.face, s);
      vis.img.setOrigin(0.5, 1);
      vis.img.setPosition(plot.x, plot.y + 16);
      if (lv > 1) {
        if (!vis.badgeBg) {
          vis.badgeBg = this.add.graphics().setDepth(11);
          vis.badgeText = this.add.text(0, 0, '', { fontFamily: 'Inter, sans-serif', fontSize: '9px', color: '#e9e9ed' }).setOrigin(0.5).setDepth(12);
        }
        vis.badgeBg.clear();
        vis.badgeBg.fillStyle(0x0e0f18, .82);
        vis.badgeBg.fillRoundedRect(plot.x - 8.5, plot.y + 15, 17, 12, 6);
        vis.badgeBg.lineStyle(1, 0x9184d9, .55);
        vis.badgeBg.strokeRoundedRect(plot.x - 8.5, plot.y + 15, 17, 12, 6);
        vis.badgeText!.setText('nv' + lv).setPosition(plot.x, plot.y + 21);
      } else if (vis.badgeBg) { vis.badgeBg.destroy(); vis.badgeText?.destroy(); vis.badgeBg = undefined; vis.badgeText = undefined; }
    }
  }

  private syncEnemies() {
    const live = new Set(this.state.enemies);
    for (const [e, img] of this.enemySprites) if (!live.has(e)) { img.destroy(); this.enemySprites.delete(e); }
    for (const e of this.state.enemies) {
      const k = KINDS[e.kind];
      let img = this.enemySprites.get(e);
      if (!img) { img = this.add.image(e.x, e.y, k.art).setDepth(8); this.enemySprites.set(e, img); }
      const h = k.size, w = (img.width / img.height) * h;
      img.setDisplaySize(w, h);
      const bob = Math.sin(this.state.time * (k.flyer ? 4.2 : 7) + e.d * .05) * (k.flyer ? 3.2 : 1.2);
      img.setPosition(e.x, e.y - h * .12 + bob);
      if (e.hitFlash > 0) img.setTintFill(0xffffff);
      else if (e.slow > 0) img.setTint(0xa8d97a);
      else img.clearTint();
    }
  }
}

function posAtSafe(st: GameState, d: number) {
  for (const s of st.segs) if (d <= s.start + s.len) { const t = Math.max(0, (d - s.start) / s.len); return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }; }
  const l = st.pts[st.pts.length - 1]; return { x: l.x, y: l.y };
}

function toPointArray(flat: number[]): Phaser.Geom.Point[] {
  const out: Phaser.Geom.Point[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
  return out;
}
