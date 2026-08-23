import { rng } from './rng';

export interface Point { x: number; y: number; }
export interface Segment { a: Point; b: Point; len: number; start: number; }

export type RoadStyle = 'sharp' | 'flowing' | 'mixed';

export interface PathResult {
  pts: Point[];
  roadStyle: RoadStyle;
}

/**
 * Generates a lane path on a grid walk, tuned to grow shorter and straighter
 * as `level` increases (level 1 wanders for a long shot window, ~level 10 is
 * a near-straight sprint). Ported from the Hollow Line prototype's genPath.
 */
export function genPath(seed: number, level: number, W: number, H: number): PathResult {
  const cols = 7, rows = 4;
  const cellX = (c: number) => 96 + c * ((W - 200) / (cols - 1));
  const cellY = (r: number) => 104 + r * ((H - 208) / (rows - 1));
  const diff = Math.min(1, (level - 1) / 9);
  const minCells = Math.round(15 - diff * 8);
  const eastW = 2.6 + diff * 8, turnW = 4.4 - diff * 2.9, backW = 2.2 - diff * 2.2;

  const walk = (rand: () => number): [number, number][] | null => {
    let c = 0, r = Math.floor(rand() * rows);
    const cells: [number, number][] = [[c, r]];
    const used = new Set([c + ',' + r]);
    let dir: [number, number] = [1, 0], guard = 0;
    while (guard++ < 70) {
      if (c === cols - 1 && cells.length >= minCells) return cells;
      const cand = ([[1, 0], [0, 1], [0, -1], [-1, 0]] as [number, number][])
        .filter(d => !(d[0] === -dir[0] && d[1] === -dir[1]))
        .filter(d => { const nc = c + d[0], nr = r + d[1]; return nc >= 0 && nc < cols && nr >= 0 && nr < rows && !used.has(nc + ',' + nr); });
      const weights = cand.map(d => d[0] === 1 ? eastW : d[0] === -1 ? (c > 1 && cells.length < minCells ? Math.max(0, backW) : 0) : turnW);
      const total = weights.reduce((x, y) => x + y, 0);
      if (total <= 0) return null;
      let t = rand() * total, pick = 0;
      for (let i = 0; i < cand.length; i++) { t -= weights[i]; if (t <= 0) { pick = i; break; } }
      dir = cand[pick]; c += dir[0]; r += dir[1];
      cells.push([c, r]); used.add(c + ',' + r);
    }
    return c === cols - 1 ? cells : null;
  };

  const bad = (p: Point[]): boolean => {
    for (let i = 0; i < p.length - 1; i++) for (let j = i + 2; j < p.length - 1; j++) {
      const a1 = p[i], a2 = p[i + 1], b1 = p[j], b2 = p[j + 1];
      const rx = a2.x - a1.x, ry = a2.y - a1.y, qx = b2.x - b1.x, qy = b2.y - b1.y;
      const den = rx * qy - ry * qx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((b1.x - a1.x) * qy - (b1.y - a1.y) * qx) / den;
      const u = ((b1.x - a1.x) * ry - (b1.y - a1.y) * rx) / den;
      if (t > 0 && t < 1 && u > 0 && u < 1) return true;
    }
    for (let i = 0; i < p.length; i++) {
      let arc = 0;
      for (let j = i + 1; j < p.length; j++) {
        arc += Math.hypot(p[j].x - p[j - 1].x, p[j].y - p[j - 1].y);
        if (arc > 150 && Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) < 72) return true;
      }
    }
    return false;
  };

  const build = (rand: () => number): Point[] | null => {
    const cells = walk(rand);
    if (!cells) return null;
    const turns: [number, number][] = [cells[0]];
    for (let i = 1; i < cells.length - 1; i++) {
      const a2 = cells[i - 1], b2 = cells[i], d2 = cells[i + 1];
      if ((b2[0] - a2[0]) !== (d2[0] - b2[0]) || (b2[1] - a2[1]) !== (d2[1] - b2[1])) turns.push(b2);
    }
    turns.push(cells[cells.length - 1]);
    const pts = turns.map(([cc, rr]) => ({ x: cellX(cc) + (rand() - .5) * 30, y: cellY(rr) + (rand() - .5) * 26 }));
    pts.unshift({ x: -50, y: pts[0].y });
    pts.push({ x: W + 50, y: pts[pts.length - 1].y });
    return bad(pts) ? null : pts;
  };

  let pts: Point[] | null = null;
  for (let attempt = 0; attempt < 40 && !pts; attempt++) { const rand = rng(seed + attempt * 1013); pts = build(rand); }
  if (!pts) {
    const row = [1, 2, 1, 2];
    pts = [];
    for (let cc = 0; cc < cols; cc++) pts.push({ x: cellX(cc), y: cellY(row[cc % 4]) });
    pts.unshift({ x: -50, y: pts[0].y });
    pts.push({ x: W + 50, y: pts[pts.length - 1].y });
  }

  const roadStyle: RoadStyle = 'flowing';

  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a2 = pts[i - 1], b2 = pts[i], c2 = pts[i + 1];
    const la = Math.hypot(b2.x - a2.x, b2.y - a2.y), lc = Math.hypot(c2.x - b2.x, c2.y - b2.y);
    const r1 = Math.min(66, la * .42), r2 = Math.min(66, lc * .42);
    const p0 = { x: b2.x + (a2.x - b2.x) / (la || 1) * r1, y: b2.y + (a2.y - b2.y) / (la || 1) * r1 };
    const p2 = { x: b2.x + (c2.x - b2.x) / (lc || 1) * r2, y: b2.y + (c2.y - b2.y) / (lc || 1) * r2 };
    const steps = 7;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, it = 1 - t;
      out.push({ x: it * it * p0.x + 2 * it * t * b2.x + t * t * p2.x, y: it * it * p0.y + 2 * it * t * b2.y + t * t * p2.y });
    }
  }
  out.push(pts[pts.length - 1]);
  return { pts: out, roadStyle };
}

export function buildSegments(pts: Point[]): { segs: Segment[]; pathLen: number } {
  const segs: Segment[] = [];
  let pathLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: pathLen });
    pathLen += len;
  }
  return { segs, pathLen };
}

export function distToPath(segs: Segment[], px: number, py: number): number {
  let d = Infinity;
  for (const s of segs) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const t = Math.max(0, Math.min(1, ((px - s.a.x) * dx + (py - s.a.y) * dy) / (s.len * s.len || 1)));
    d = Math.min(d, Math.hypot(px - (s.a.x + dx * t), py - (s.a.y + dy * t)));
  }
  return d;
}

export function nearestOnPath(segs: Segment[], px: number, py: number): Point {
  let best: Point | null = null, bd = Infinity;
  for (const s of segs) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const t = Math.max(0, Math.min(1, ((px - s.a.x) * dx + (py - s.a.y) * dy) / (s.len * s.len || 1)));
    const qx = s.a.x + dx * t, qy = s.a.y + dy * t, d = Math.hypot(px - qx, py - qy);
    if (d < bd) { bd = d; best = { x: qx, y: qy }; }
  }
  return best || { x: px, y: py };
}

export function posAt(segs: Segment[], pts: Point[], d: number): Point {
  for (const s of segs) if (d <= s.start + s.len) { const t = Math.max(0, (d - s.start) / s.len); return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }; }
  const l = pts[pts.length - 1];
  return { x: l.x, y: l.y };
}
