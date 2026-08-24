import { W, H, WAVES_PER_LEVEL } from '../core/constants';
import { GameState, MenuOption } from '../core/GameState';
import { TOWERS } from '../data/towers';
import { enterFullscreen, fullscreenSupported, onFullscreenChange, toggleFullscreen } from './fullscreen';

/** Angle between neighbouring options — mirrors the fan in GameState.menuOptions. */
const MENU_STEP = (Math.PI * 5 / 6) / 3;

function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
}

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
    mLives: $('mhdr-lives'), mGold: $('mhdr-gold'), mLevel: $('mhdr-level'), mWave: $('mhdr-wave'),
    speedBtn: $('btn-speed') as HTMLButtonElement, pauseBtn: $('btn-pause') as HTMLButtonElement,
    fullscreenBtn: $('btn-fullscreen') as HTMLButtonElement,
    iconExpand: $('icon-expand'), iconCompress: $('icon-compress'),
    nextWaveBtn: $('btn-next-wave') as HTMLButtonElement, callLabel: $('call-label'),
    headerControls: $('mhdr-controls'), stageTopRight: $('hud-top-right'), stageBottomLeft: $('hud-bottom-left'),
    overlay: $('overlay'), kicker: $('overlay-kicker'), title: $('overlay-title'), body: $('overlay-body'),
    primaryBtn: $('btn-primary') as HTMLButtonElement,
    restartBtn: $('btn-restart') as HTMLButtonElement,
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
    this.els.primaryBtn.addEventListener('click', () => this.onPrimary());
    this.els.fullscreenBtn.addEventListener('click', () => toggleFullscreen());
    onFullscreenChange(active => {
      this.els.iconExpand.hidden = active;
      this.els.iconCompress.hidden = !active;
    });

    window.addEventListener('resize', () => { this.lastMenuSig = ''; });

    const compact = window.matchMedia('(max-width: 1023px)');
    this.layoutControls(compact.matches);
    compact.addEventListener('change', e => this.layoutControls(e.matches));

    // Portrait prompt doubles as the gesture that opens fullscreen + landscape lock.
    const rotateBtn = document.getElementById('btn-rotate-fullscreen') as HTMLButtonElement | null;
    if (rotateBtn) {
      if (!fullscreenSupported()) rotateBtn.hidden = true;
      else rotateBtn.addEventListener('click', () => void enterFullscreen());
    }
  }

  /**
   * On phones the floating buttons eat into the board, so every control —
   * "call wave" included — moves into the header strip. Wider screens keep them
   * over the stage, so the nodes are re-parented whenever the layout flips.
   */
  private layoutControls(compact: boolean): void {
    const { nextWaveBtn, fullscreenBtn, speedBtn, pauseBtn } = this.els;
    if (compact) this.els.headerControls.append(nextWaveBtn, fullscreenBtn, speedBtn, pauseBtn);
    else {
      this.els.stageBottomLeft.append(nextWaveBtn);
      this.els.stageTopRight.append(fullscreenBtn, speedBtn, pauseBtn);
    }
  }

  private onPrimary() {
    const st = this.state;
    if (st.phase === 'intro') { st.prep = 0; st.startWave(); }
    else if (st.phase === 'paused') { st.phase = 'playing'; }
    else if (st.phase === 'levelup') { st.plots = []; st.startLevel(st.level + 1); }
    else { st.reset(); }
  }

  sync(state: GameState): void {
    const livesStr = String(state.lives);
    const goldStr = String(state.gold);
    const levelStr = String(state.level);
    const waveStr = Math.max(1, state.waveInLevel) + '/' + WAVES_PER_LEVEL;
    this.els.lives.textContent = livesStr;
    this.els.gold.textContent = goldStr;
    this.els.level.textContent = levelStr;
    this.els.wave.textContent = waveStr;
    this.els.mLives.textContent = livesStr;
    this.els.mGold.textContent = goldStr;
    this.els.mLevel.textContent = levelStr;
    this.els.mWave.textContent = waveStr;

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
      ? 'Line broken on level ' + state.level
      : state.phase === 'levelup' ? 'Level ' + state.level + ' cleared'
      : (prep > 0 ? 'Building phase' : state.enemies.length + ' hostiles on the field');
    this.els.playerLine.textContent = state.sessionBest > 0
      ? 'Session best: level ' + state.sessionBest + ' · Space to pause'
      : 'Space to pause';
  }

  private syncOverlay(state: GameState) {
    const phase = state.phase;
    this.els.overlay.hidden = phase === 'playing';
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;

    const lvl = state.level, wl = state.waveInLevel;
    let kicker = 'Level ' + lvl, title = '', body = '', action = 'Begin';
    if (phase === 'intro') { kicker = 'The breach'; title = 'Hollow Line'; body = 'Click anywhere off the path to raise a tower — hover an option to read what it does. Click a built tower to upgrade it, eight levels deep. Every level runs five waves and a sixth boss wave, then the road is redrawn.'; action = 'Start level 1'; }
    if (phase === 'paused') { kicker = 'Paused'; title = 'Level ' + lvl + ' · wave ' + wl; body = 'Space resumes.'; action = 'Resume'; }
    if (phase === 'levelup') { kicker = 'Level ' + lvl + ' cleared'; title = 'Boss down'; body = 'A new road is being cut for level ' + (lvl + 1) + ' — each level runs straighter and shorter than the last, so there is less road to shoot along. Towers do not travel: you rebuild on fresh ground with the gold you kept, and three lives come back.'; action = 'Enter level ' + (lvl + 1); }
    if (phase === 'over') {
      kicker = 'Line broken';
      title = 'Level ' + lvl + ' · wave ' + wl;
      body = state.newSessionRecord
        ? 'Novo recorde desta sessão! Você chegou ao level ' + state.sessionBest + '.'
        : 'Seu recorde desta sessão: level ' + state.sessionBest + '.';
      action = 'Try again';
    }

    this.els.kicker.textContent = kicker;
    this.els.title.textContent = title;
    this.els.body.textContent = body;
    this.els.primaryBtn.textContent = action;
    this.els.restartBtn.hidden = phase !== 'paused';
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

  /**
   * Where the radial menu sits, in *stage pixels*.
   *
   * The orbit used to be a fixed distance in world units, mapped to a
   * percentage of the stage — on a phone the stage is stretched relative to the
   * 1120x630 world, so the ring came out as a wide ellipse with the options far
   * apart. Deriving the radius from the button size instead keeps neighbouring
   * options a constant few pixels apart on every screen.
   */
  private menuCenter(px: number, py: number) {
    const stage = document.getElementById('stage');
    const sw = stage?.clientWidth ?? W;
    const sh = stage?.clientHeight ?? H;
    const compact = sw < 900;
    const btn = compact ? 36 : 44;          // keep in sync with .build-menu-option
    const orbit = Math.round((btn + 6) / (2 * Math.sin(MENU_STEP / 2)));
    const pad = orbit + btn / 2 + 4;
    // Options fan out above the plot, so only the top edge needs the full pad.
    const cx = clamp(px / W * sw, pad, sw - pad);
    const cy = clamp(py / H * sh, pad, sh - btn / 2);
    return { cx, cy, orbit, sw };
  }

  private optionHtml(px: number, py: number, o: MenuOption, gold: number): string {
    const { cx, cy, orbit } = this.menuCenter(px, py);
    const ox = Math.round(cx + Math.cos(o.ang) * orbit), oy = Math.round(cy + Math.sin(o.ang) * orbit);
    const afford = o.cost <= 0 || gold >= o.cost;
    const art = TOWERS[o.key as keyof typeof TOWERS]?.art;
    const inner = o.key === 'sell'
      ? sellIcon()
      : o.key === 'up'
        ? upIcon()
        : `<img src="sprites/${art}-1.png" alt="${o.label}">`;
    const costHtml = o.cost !== 0
      ? `<div class="build-menu-cost${o.cost < 0 ? ' refund' : ''}" style="left:${ox}px;top:${oy}px">${o.cost < 0 ? '+' : ''}${Math.abs(o.cost)}</div>`
      : '';
    return `<div class="build-menu-option${afford ? '' : ' disallow'}" data-key="${o.key}" style="left:${ox}px;top:${oy}px">${inner}</div>${costHtml}`;
  }

  private showTip(px: number, py: number, o: MenuOption) {
    const { cx, cy, orbit, sw } = this.menuCenter(px, py);
    const tip = this.els.buildTip;
    tip.style.top = cy + 'px';
    tip.style.transform = 'translateY(-50%)';
    if (cx > sw * 0.55) { tip.style.right = (sw - cx + orbit + 8) + 'px'; tip.style.left = 'auto'; }
    else { tip.style.left = (cx + orbit + 8) + 'px'; tip.style.right = 'auto'; }

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
