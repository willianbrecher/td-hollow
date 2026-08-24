/**
 * Fullscreen handling for mobile.
 *
 * `requestFullscreen()` only works while the page holds a *user activation*.
 * An `orientationchange` is not a gesture, so asking for fullscreen straight
 * from the rotation is always rejected by the browser — that is why the first
 * rotation used to keep the browser bars on screen until the player tapped.
 *
 * Instead of reacting to the rotation we arm the *first* tap/key the player
 * makes anywhere on the page (the "Begin" button, the rotate prompt, the
 * canvas) and enter fullscreen there, then lock the screen to landscape so the
 * player does not even have to rotate the device. The old orientation retry is
 * kept as a fallback for players who rotate before touching anything.
 *
 * iPhone Safari has no `Element.requestFullscreen` at all: there we mark the
 * document as pseudo-fullscreen (the layout already fills 100dvh with safe-area
 * padding) and rely on the web app manifest (`display: fullscreen`) for players
 * who add the game to the home screen.
 */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

const fsDoc = document as FsDocument;
const fsRoot = () => document.documentElement as FsElement;

/** The player closed fullscreen on purpose — do not fight them for it. */
let optedOut = false;

export function fullscreenSupported(): boolean {
  const el = fsRoot();
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  return !!(fsDoc.fullscreenElement || fsDoc.webkitFullscreenElement);
}

/** Touch devices only — a mouse user keeps the manual fullscreen button. */
function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function markPseudoFullscreen(): void {
  document.documentElement.classList.add('pseudo-fullscreen');
}

function lockLandscape(): void {
  if (!isTouchDevice()) return;
  const orientation = screen.orientation as LockableOrientation | undefined;
  orientation?.lock?.('landscape').catch(() => {});
}

/** Enters fullscreen (and locks landscape on phones). Must run inside a gesture. */
export async function enterFullscreen(): Promise<boolean> {
  optedOut = false;
  if (!isFullscreen()) {
    const el = fsRoot();
    const request = el.requestFullscreen
      ? () => el.requestFullscreen({ navigationUI: 'hide' })
      : el.webkitRequestFullscreen
        ? () => el.webkitRequestFullscreen!()
        : null;
    if (!request) { markPseudoFullscreen(); return false; }
    try { await request(); } catch { return false; }
  }
  lockLandscape();
  return true;
}

export function exitFullscreen(): void {
  optedOut = true;
  (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  if (fsDoc.exitFullscreen) fsDoc.exitFullscreen().catch(() => {});
  else fsDoc.webkitExitFullscreen?.();
}

export function toggleFullscreen(): void {
  if (isFullscreen()) exitFullscreen();
  else void enterFullscreen();
}

export function onFullscreenChange(handler: (active: boolean) => void): void {
  const fire = () => handler(isFullscreen());
  document.addEventListener('fullscreenchange', fire);
  document.addEventListener('webkitfullscreenchange', fire);
  fire();
}

/**
 * Enters fullscreen at the earliest moment the browser allows: the player's
 * first interaction with the page, whichever it is.
 */
export function installAutoFullscreen(): void {
  if (!isTouchDevice()) return;
  if (!fullscreenSupported()) { markPseudoFullscreen(); return; }

  // `pointerup`/`touchend`/`click`/`keydown` all grant user activation;
  // `pointerdown` does not on touch, so it is deliberately not in the list.
  const gestures = ['pointerup', 'touchend', 'click', 'keydown'] as const;
  let armed = false;

  const onGesture = () => {
    if (optedOut || isFullscreen()) { disarm(); return; }
    void enterFullscreen().then(ok => { if (ok) disarm(); });
  };
  const arm = () => {
    if (armed || optedOut) return;
    armed = true;
    for (const type of gestures) document.addEventListener(type, onGesture, { capture: true, passive: true });
  };
  function disarm() {
    if (!armed) return;
    armed = false;
    for (const type of gestures) document.removeEventListener(type, onGesture, { capture: true });
  }

  arm();

  // Fallback: someone rotates before touching anything. The request is rejected
  // without a gesture, so re-arm and take the next tap instead.
  const onOrientation = () => {
    if (optedOut || isFullscreen()) return;
    void enterFullscreen().then(ok => { if (!ok) arm(); });
  };
  window.addEventListener('orientationchange', () => setTimeout(onOrientation, 250));
  window.matchMedia('(orientation: landscape)').addEventListener('change', onOrientation);

  // Leaving fullscreen by a system gesture (not the HUD button) re-arms.
  onFullscreenChange(active => { if (!active) arm(); });
}
