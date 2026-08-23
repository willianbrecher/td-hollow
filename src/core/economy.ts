import { KINDS, LADDER, BOSSES, MonsterType } from '../data/monsters';

export interface SpawnEntry { kind: MonsterType; gap: number; }

/** Builds a wave's spawn list: every unlocked monster type scaled by how long it's been in rotation, plus a boss on the 6th wave of a level. */
export function waveComp(n: number, boss: boolean, level: number): SpawnEntry[] {
  const list: SpawnEntry[] = [];
  const push = (kind: MonsterType, count: number) => { for (let i = 0; i < count; i++) list.push({ kind, gap: KINDS[kind].gap }); };
  for (const [kind, from] of LADDER) {
    if (n < from) continue;
    const age = n - from;
    const count = Math.max(0, Math.min(9, 2 + Math.round(age * .7) - Math.max(0, Math.round((age - 7) * 1.1))));
    push(kind, count);
  }
  if (boss) push(BOSSES[Math.min(BOSSES.length - 1, Math.floor((level - 1) / 2))], 1 + Math.floor((level - 1) / 4));
  for (let i = list.length - 1; i > 0; i--) { const j = (i * 7 + n * 13) % (i + 1); const t = list[i]; list[i] = list[j]; list[j] = t; }
  return list;
}
