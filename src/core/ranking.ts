const RANK_KEY = 'hollowline.ranking.v1';
const RANK_PLAYER_KEY = 'hollowline.player.v1';

export interface RankRow { name: string; level: number; at: number; }

/** Local leaderboard — best level per commander name, persisted to localStorage (see README's storage note). */
export class Ranking {
  rows: RankRow[] = [];
  player = '';

  load(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
      this.rows = Array.isArray(raw)
        ? raw.filter((r: any) => r && typeof r.name === 'string').map((r: any) => ({ name: r.name, level: r.level | 0, at: r.at || 0 }))
        : [];
    } catch { this.rows = []; }
    try { this.player = localStorage.getItem(RANK_PLAYER_KEY) || ''; } catch { this.player = ''; }
  }

  bestOf(name: string): number {
    const row = this.rows.find(r => r.name.toLowerCase() === (name || '').toLowerCase());
    return row ? row.level : 0;
  }

  setPlayer(name: string): string {
    this.player = (name || '').trim().slice(0, 18) || 'Commander';
    try { localStorage.setItem(RANK_PLAYER_KEY, this.player); } catch { /* ignore */ }
    return this.player;
  }

  record(level: number): void {
    if (!this.player) return;
    const key = this.player.toLowerCase();
    const row = this.rows.find(r => r.name.toLowerCase() === key);
    if (row) { if (level <= row.level) return; row.level = level; row.at = Date.now(); }
    else this.rows.push({ name: this.player, level, at: Date.now() });
    this.rows.sort((a, b) => b.level - a.level || a.at - b.at);
    this.rows = this.rows.slice(0, 25);
    try { localStorage.setItem(RANK_KEY, JSON.stringify(this.rows)); } catch { /* ignore */ }
  }
}
