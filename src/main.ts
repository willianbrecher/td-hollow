import Phaser from 'phaser';
import './style.css';
import { W, H } from './core/constants';
import { GameState } from './core/GameState';
import { Hud } from './ui/hud';
import { GameScene } from './scenes/GameScene';
import { installAutoFullscreen } from './ui/fullscreen';

// Grabs the player's first tap to enter fullscreen — a rotation alone cannot.
installAutoFullscreen();

const state = new GameState({ startingGold: 300, startingLives: 20 });
const hud = new Hud(state);

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game-root',
  width: W,
  height: H,
  backgroundColor: '#12141f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new GameScene(state, hud)
});
