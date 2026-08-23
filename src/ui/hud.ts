import { W, H, WAVES_PER_LEVEL } from '../core/constants';
import { GameState, MenuOption } from '../core/GameState';
import { TOWERS } from '../data/towers';

function $(id: string): HTMLElement { const el = document.getElementById(id); if (!el) throw new Error('missing #' + id); return el; }

/**
 * Owns every DOM element layered over the Phaser canvas: the HUD chips,
 * the phase overlay (name entry / intro / pause / level cleared / game over),
 * the local ranking list, and the build/upgrade radial menu + hover tooltip.
 * Reads GameState each frame (sync) and writes back to it via button/menu
 * click handlers — it never touches Phaser directly.
 */
export class Hud {
  private els = {
    lives: $('hud-lives'), gold: $('hud-gold'), level: $('hud-level'), wave: $('hud-wave'),
    speedBtn: $('btn-speed') as HTMLButtonElement, pauseBtn: $('btn-pause') as HTMLButtonElement,
    nextWaveBtn: $('btn-next-wave') as HTMLButtonElement, callLabel: $('call-label'),
    overlay: $('overlay'), kicker: $('overlay-kicker'), title: $('overlay-title'), body: $('overlay-body'),
    nameRow: $('name-row'), nameInput: $('name-input') as HTMLInputElement,
    rankRow: $('rank-row'), primaryBtn: $('btn-primary') as HTMLButtonElement,
    restartBtn: $('btn-restart') as HTMLButtonElement, changePlayerBtn: $('btn-change-player') as HTMLButtonElement,
    buildMenu: $('build-menu'), buildTip: $('build-tip'),
    statusLine: $('status-line'), playerLine: $('player-line')
  };

  private lastPhase: string | null = null;
  private lastMenuSig = '';

  constructor(private state: GameState) {
    this.els.speedBtn.addEventListener('click', () => state.setSpeed(state.speed === 2 ? 1 : 2));
    this.els.pauseBtn.addEventListener('click', () => state.togglePause());
    this.els.nextWaveBtn.addEventListener('click', () => state.callWaveEarly());
    this.els.restartBtn.addEventListener('click', () => state.reset());
    this.els.changePlayerBtn.addEventListener('click', () => { state.phase = 'name'; });
    this.els.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { state.setPlayer(this.els.nameInput.value); state.phase = 'intro'; }
    });
    this.els.primaryBtn.addEventListener('click', () => this.onPrimary());
  }

  private onPrimary() {
    const st = this.state;
    if (st.phase === 'name') { st.setPlayer(this.els.nameInput.value); st.phase = 'intro'; }
    else if (st.phase === 'intro') { st.prep = 0; st.startWave(); }
    else if (st.phase === 'paused') { st.phase = 'playing'; }
    else if (st.phase === 'levelup') { st.plots = []; st.startLevel(st.level + 1); }
    else { st.reset(); st.prep = 0; st.startWave(); }
  }

  sync(state: GameState): void {
    this.els.lives.textContent = String(state.lives);
    this.els.gold.textContent = String(state.gold);
    this.els.level.textContent = String(state.level);
    this.els.wave.textContent = Math.max(1, state.waveInLevel) + '/' + WAVES_PER_LEVEL;

    this.els.speedBtn.textContent = '×' + (state.speed === 2 ? '2' : '1');
    this.els.speedBtn.style.color = state.speed === 2 ? 'var(--color-accent)' : 'var(--color-neutral-400)';

    const prep = state.prep;
    const ready = prep > 0;
    this.els.nextWaveBtn.classList.toggle('ready', ready);
    this.els.callLabel.textContent = ready
      ? 'Call wave ' + (state.waveInLevel + 1) + ' — ' + Math.ceil(prep) + 's'
      : (state.waveInLevel === WAVES_PER_LEVEL ? 'Boss wave incoming' : 'Wave ' + state.waveInLevel + ' incoming');

    this.syncOverlay(state);
    this.syncMenu(state);

    this.els.statusLine.textContent = state.phase === 'over'
      ? 'Line broken on level ' + state.level + ' — best ' + (state.best || 0)
      : state.phase === 'levelup' ? 'Level ' + state.level + ' cleared'
      : (prep > 0 ? 'Building phase' : state.enemies.length + ' hostiles on the field');
    this.els.playerLine.textContent = (state.player || 'No commander') + ' · best level ' + (state.best || 0) + ' · Space pauses';
  }

  private syncOverlay(state: GameState) {
    const phase = state.phase;
    this.els.overlay.hidden = phase === 'playing';
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;

    const lvl = state.level, wl = state.waveInLevel;
    let kicker = 'Level ' + lvl, title = '', body = '', action = 'Begin';
    if (phase === 'name') { kicker = 'Hollow Line'; title = 'Who holds the line?'; body = 'Each name keeps its own record — the highest level you reach is stored on this device and listed in the local ranking. Keep the name below or type another commander.'; action = 'Continue'; }
    if (phase === 'intro') { kicker = 'The breach'; title = 'Hollow Line'; body = 'Click anywhere off the path to raise a tower — hover an option to read what it does. Click a built tower to upgrade it, eight levels deep. Every level runs five waves and a sixth boss wave, then the road is redrawn.'; action = 'Start level 1'; }
    if (phase === 'paused') { kicker = 'Paused'; title = 'Level ' + lvl + ' · wave ' + wl; body = 'Space resumes.'; action = 'Resume'; }
    if (phase === 'levelup') { kicker = 'Level ' + lvl + ' cleared'; title = 'Boss down'; body = 'A new road is being cut for level ' + (lvl + 1) + ' — each level runs straighter and shorter than the last, so there is less road to shoot along. Towers do not travel: you rebuild on fresh ground with the gold you kept, and three lives come back.'; action = 'Enter level ' + (lvl + 1); }
    if (phase === 'over') { kicker = 'Line broken'; title = 'Level ' + lvl + ' · wave ' + wl; body = 'Best run so far: level ' + state.best + '.'; action = 'Try again'; }

    this.els.kicker.textContent = kicker;
    this.els.title.textContent = title;
    this.els.body.textContent = body;
    this.els.primaryBtn.textContent = action;

    this.els.nameRow.classList.toggle('show', phase === 'name');
    if (phase === 'name') this.els.nameInput.value = state.player || '';

    const showRank = (phase === 'name' || phase === 'over') && state.ranking.rows.length > 0;
    this.els.rankRow.classList.toggle('show', showRank);
    if (showRank) {
      this.els.rankRow.innerHTML = '<div class="rank-title">Local ranking</div>' + state.ranking.rows.slice(0, 5).map((r, i) => {
        const mine = r.name.toLowerCase() === (state.player || '').toLowerCase();
        return `<div class="rank-item${mine ? ' me' : ''}"><span>${i + 1}. ${escapeHtml(r.name)}</span><span class="lvl">Level ${r.level}</span></div>`;
      }).join('');
    }

    this.els.restartBtn.hidden = phase !== 'paused';
    this.els.changePlayerBtn.hidden = !(phase === 'intro' || phase === 'over');
  }

  private syncMenu(state: GameState) {
    const menu = state.menu;
    if (!menu) {
      if (this.lastMenuSig) { this.els.buildMenu.innerHTML = ''; this.els.buildMenu.hidden = true; this.els.buildTip.hidden = true; this.lastMenuSig = ''; }
      return;
    }
    const opts = state.menuOptions(menu);
    const sig = menu.x + ',' + menu.y + ',' + (menu.tower ? menu.tower.type + menu.tower.level : 'new') + ',' + state.gold;
    if (sig === this.lastMenuSig) return;
    this.lastMenuSig = sig;

    this.els.buildMenu.hidden = false;
    this.els.buildMenu.innerHTML = opts.map(o => this.optionHtml(menu.x, menu.y, o, state.gold)).join('');
    this.els.buildMenu.querySelectorAll<HTMLElement>('.build-menu-option').forEach(el => {
      const key = el.dataset.key!;
      el.addEventListener('click', (e) => { e.stopPropagation(); state.selectMenuOption(key); this.lastMenuSig = ''; this.els.buildMenu.innerHTML = ''; this.els.buildMenu.hidden = true; this.els.buildTip.hidden = true; });
      el.addEventListener('mouseenter', () => this.showTip(menu.x, menu.y, opts.find(o => o.key === key)!));
      el.addEventListener('mouseleave', () => { this.els.buildTip.hidden = true; });
    });
  }

  private optionHtml(px: number, py: number, o: MenuOption, gold: number): string {
    const ox = px + Math.cos(o.ang) * 62, oy = py + Math.sin(o.ang) * 62;
    const leftPct = (ox / W) * 100, topPct = (oy / H) * 100;
    const afford = o.cost <= 0 || gold >= o.cost;
    const art = TOWERS[o.key as keyof typeof TOWERS]?.art;
    const inner = o.key === 'sell'
      ? sellIcon()
      : o.key === 'up'
        ? upIcon()
        : `<img src="sprites/${art}-1.png" alt="${o.label}">`;
    const costHtml = o.cost !== 0
      ? `<div class="build-menu-cost${o.cost < 0 ? ' refund' : ''}" style="left:${leftPct}%;top:${topPct}%">${o.cost < 0 ? '+' : ''}${Math.abs(o.cost)}</div>`
      : '';
    return `<div class="build-menu-option${afford ? '' : ' disallow'}" data-key="${o.key}" style="left:${leftPct}%;top:${topPct}%">${inner}</div>${costHtml}`;
  }

  private showTip(px: number, py: number, o: MenuOption) {
    const leftPct = (px / W) * 100;
    const anchorRight = leftPct > 55;
    const tip = this.els.buildTip;
    tip.style.top = ((py / H) * 100) + '%';
    tip.style.transform = 'translateY(-50%)';
    if (anchorRight) { tip.style.right = (100 - leftPct + 6) + '%'; tip.style.left = 'auto'; }
    else { tip.style.left = (leftPct + 6) + '%'; tip.style.right = 'auto'; }

    let statsHtml = '';
    if (o.stats) {
      const s = o.stats;
      statsHtml = `<div class="stats">DMG ${s.damage} · RATE ${s.rate.toFixed(2)}/s · RANGE ${s.range}${s.splash ? ' · SPLASH ' + s.splash : ''}${s.slow ? ' · SLOW' : ''}</div>`;
    }
    tip.innerHTML = `<div class="name">${escapeHtml(o.label)}</div>${o.sub ? `<div class="sub">${escapeHtml(o.sub)}</div>` : ''}${o.desc ? `<div class="desc">${escapeHtml(o.desc)}</div>` : ''}${statsHtml}`;
    tip.hidden = false;
  }
}

function sellIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b9bccb" stroke-width="1.8"><circle cx="12" cy="11" r="7"/><line x1="8" y1="11" x2="16" y2="11"/></svg>`;
}
function upIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="#9184d9"><path d="M12 3l7 9h-4v9H9v-9H5z"/></svg>`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
