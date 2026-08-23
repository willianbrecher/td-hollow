export interface MonsterKind {
  hp: number;
  speed: number;
  gold: number;
  r: number;
  size: number;
  gap: number;
  art: string;
  color: string;
  flyer?: boolean;
}

export type MonsterType =
  | 'slime' | 'goblin' | 'rat' | 'skeleton' | 'harpy' | 'wolf' | 'golem' | 'hobgoblin'
  | 'wraith' | 'ghost' | 'troll' | 'ogre' | 'wyvern' | 'demon'
  | 'deathKnight' | 'ironGolem' | 'lich';

export const KINDS: Record<MonsterType, MonsterKind> = {
  slime: { hp: 26, speed: 40, gold: 6, r: 14, size: 38, gap: .55, art: 'mob-slime', color: '#8fc46a' },
  goblin: { hp: 40, speed: 58, gold: 8, r: 14, size: 42, gap: .55, art: 'mob-goblin', color: '#8aa05a' },
  rat: { hp: 58, speed: 80, gold: 10, r: 13, size: 36, gap: .42, art: 'mob-rat', color: '#a3907e' },
  skeleton: { hp: 95, speed: 52, gold: 13, r: 15, size: 46, gap: .6, art: 'mob-skeleton', color: '#cfcab4' },
  harpy: { hp: 115, speed: 98, gold: 16, r: 14, size: 46, gap: .45, art: 'mob-harpy', color: '#c09a63', flyer: true },
  wolf: { hp: 175, speed: 84, gold: 20, r: 16, size: 44, gap: .55, art: 'mob-wolf', color: '#9aa0b0' },
  golem: { hp: 300, speed: 34, gold: 28, r: 18, size: 50, gap: .9, art: 'mob-golem', color: '#b0b3ae' },
  hobgoblin: { hp: 390, speed: 50, gold: 34, r: 18, size: 52, gap: .85, art: 'mob-hobgoblin', color: '#7f9a52' },
  wraith: { hp: 470, speed: 64, gold: 40, r: 17, size: 50, gap: .8, art: 'mob-wraith', color: '#8fd0e8', flyer: true },
  ghost: { hp: 470, speed: 74, gold: 42, r: 16, size: 48, gap: .8, art: 'mob-ghost', color: '#d7dcf2', flyer: true },
  troll: { hp: 740, speed: 38, gold: 55, r: 20, size: 58, gap: 1.1, art: 'mob-troll', color: '#c6bfa4' },
  ogre: { hp: 920, speed: 44, gold: 66, r: 21, size: 58, gap: 1.1, art: 'mob-ogre', color: '#6fb6d9' },
  wyvern: { hp: 1250, speed: 66, gold: 88, r: 22, size: 62, gap: 1.2, art: 'mob-wyvern', color: '#8fc46a', flyer: true },
  demon: { hp: 1850, speed: 46, gold: 115, r: 23, size: 66, gap: 1.4, art: 'mob-demon', color: '#d08a7a', flyer: true },
  deathKnight: { hp: 2600, speed: 46, gold: 170, r: 24, size: 74, gap: 2, art: 'mob-death-knight', color: '#8fd0e8' },
  ironGolem: { hp: 3300, speed: 30, gold: 200, r: 25, size: 72, gap: 2, art: 'mob-iron-golem', color: '#b9bccb' },
  lich: { hp: 5000, speed: 40, gold: 280, r: 26, size: 80, gap: 2.4, art: 'mob-lich', color: '#b07fe0' }
};

export const LADDER: [MonsterType, number][] = [
  ['slime', 1], ['goblin', 1], ['rat', 2], ['skeleton', 3], ['harpy', 4], ['wolf', 5],
  ['golem', 7], ['hobgoblin', 9], ['wraith', 11], ['ghost', 12], ['troll', 14],
  ['ogre', 16], ['wyvern', 18], ['demon', 21]
];

export const BOSSES: MonsterType[] = ['deathKnight', 'ironGolem', 'lich'];
