export const MAX_LEVEL = 8;

export interface TowerSpec {
  name: string;
  cost: number;
  color: string;
  range: number;
  damage: number;
  rate: number;
  splash: number;
  slow: number;
  art: string;
  desc: string;
  levels: string[];
}

export type TowerType = 'archer' | 'arcane' | 'cannon' | 'poison';

export const TOWERS: Record<TowerType, TowerSpec> = {
  archer: {
    name: 'Archery Tower', cost: 50, color: '#c9a06e', range: 122, damage: 12, rate: 1.9, splash: 0, slow: 0, art: 'archer',
    desc: 'Rapid single-target arrows. Cheap early damage against light ground waves.',
    levels: ['Watch Post', 'Reinforced Tower', 'Stone Platform', 'Elite Crossbowmen', 'Composite Bow', 'Double Garrison', 'Flaming Arrows', 'Legendary Bastion']
  },
  arcane: {
    name: 'Magic Tower', cost: 115, color: '#8fb6e8', range: 165, damage: 38, rate: 0.6, splash: 0, slow: 0, art: 'magic',
    desc: 'Slow, heavy arcane bolts with the longest reach. Best against armored targets.',
    levels: ['Crystal Altar', 'Apprentice Tower', 'Arcane Tower', 'Rune Tower', 'Sorcerer Tower', 'Energy Orb', 'Lightning Tower', 'Void Bastion']
  },
  cannon: {
    name: 'Cannon Tower', cost: 90, color: '#c8a25e', range: 148, damage: 30, rate: 0.65, splash: 54, slow: 0, art: 'cannon',
    desc: 'Explosive shells that damage everything in the blast. Made for packed crowds.',
    levels: ['Wooden Cannon', 'Reinforced Cannon', 'Stone Cannon', 'Twin Cannons', 'Repeating Cannon', 'Armored Battery', 'Long-Range Mortar', 'Artillery Devastator']
  },
  poison: {
    name: 'Poison Tower', cost: 70, color: '#8fc46a', range: 112, damage: 7, rate: 1.5, splash: 34, slow: .55, art: 'poison',
    desc: 'Toxic clouds that chill a small area. Low damage, keeps waves slow for other towers.',
    levels: ['Alchemist Cauldron', 'Apothecary Garden', 'Elixir Tower', 'Toxic Mist', 'Botanical Fortress', 'Toxin Master', 'Garden of Death', 'Biochemical Titan']
  }
};

export const ORDER: TowerType[] = ['archer', 'poison', 'cannon', 'arcane'];

export const towerScale = (lv: number) => 0.92 + (lv - 1) * 0.055;
export const upCost = (spec: TowerSpec, lv: number) => Math.round(spec.cost * 0.42 * Math.pow(lv, 1.22));
