import { rng } from './rng';
import { distToPath, Segment } from './path';

export interface Patch { x: number; y: number; rx: number; ry: number; a: number; dark: boolean; }
export type DecorKind = 'tree' | 'rock' | 'flower' | 'tuft';
export interface Decor { x: number; y: number; kind: DecorKind; s: number; a: number; t: number; }
export interface Blob { x: number; y: number; r: number; a: number; }

export interface Terrain { patches: Patch[]; decor: Decor[]; blobs: Blob[]; }

/** Grass texture dressing scattered off the path — ground patches, trees/rocks/flowers/tufts, ambient light blobs. */
export function buildTerrain(seed: number, segs: Segment[], W: number, H: number): Terrain {
  const rand = rng(seed + 101);

  const patches: Patch[] = [];
  for (let i = 0; i < 46; i++) {
    const x = rand() * W, y = rand() * H;
    if (distToPath(segs, x, y) < 40) continue;
    patches.push({ x, y, rx: 40 + rand() * 90, ry: 22 + rand() * 45, a: rand() * 6.3, dark: rand() > .55 });
  }

  const decor: Decor[] = [];
  for (let i = 0; i < 430; i++) {
    const x = rand() * W, y = rand() * H;
    if (distToPath(segs, x, y) < 38) continue;
    const roll = rand();
    const kind: DecorKind = roll > .955 ? 'tree' : roll > .9 ? 'rock' : roll > .84 ? 'flower' : 'tuft';
    decor.push({ x, y, kind, s: .6 + rand() * .8, a: rand() * 6.3, t: rand() });
  }
  decor.sort((a, b) => a.y - b.y);

  const blobs: Blob[] = [];
  for (let i = 0; i < 16; i++) blobs.push({ x: rand() * W, y: rand() * H, r: 90 + rand() * 190, a: .02 + rand() * .03 });

  return { patches, decor, blobs };
}
