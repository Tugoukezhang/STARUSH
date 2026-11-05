import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGE1_AMBIENT_PROP_COUNT,
  STAGE1_PAINT_DEVICES,
  STAGE1_PAINT_FINALE_LAYER_ALPHA,
  STAGE1_PAINT_TILE_LAYER_ALPHA,
  STAGE1_REQUIRED_OBJECTIVE_COUNT,
} from '../src/utils/stage1PaintRound.mjs';

assert.equal(STAGE1_REQUIRED_OBJECTIVE_COUNT, 10);
assert.equal(STAGE1_AMBIENT_PROP_COUNT, 18,
  'ambient interaction density must no longer preserve the rejected 86-object layout');
assert.equal(STAGE1_PAINT_DEVICES.length, 28);
assert.equal(STAGE1_PAINT_DEVICES.filter((device) => device.zone === 0).length, 15);
assert.equal(STAGE1_PAINT_DEVICES.filter((device) => device.zone === 1).length, 13);
assert.ok(STAGE1_PAINT_TILE_LAYER_ALPHA >= 0.28 && STAGE1_PAINT_TILE_LAYER_ALPHA <= 0.38,
  'paint must remain readable without becoming an opaque screen wash');
assert.ok(STAGE1_PAINT_FINALE_LAYER_ALPHA <= 0.22,
  'completed paint must recede further when the finale becomes the decision surface');

const paintSystemSource = readFileSync(
  new URL('../src/systems/PaintZoneSystem.js', import.meta.url),
  'utf8',
);
const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8',
);

assert.ok(paintSystemSource.includes('.setAlpha(STAGE1_PAINT_TILE_LAYER_ALPHA)'),
  'the accumulated render texture needs a stable global readability cap');
assert.ok(paintSystemSource.includes('enterFinaleMode()'),
  'the completed objective layer needs an explicit finale readability transition');
assert.ok(paintSystemSource.includes('STAGE1_PAINT_FINALE_LAYER_ALPHA'),
  'the finale transition must lower the accumulated paint wash');
assert.ok(paintSystemSource.includes('device.gfx?.setVisible(false)'),
  'completed objective props must leave the combat decision surface');
assert.ok(paintSystemSource.includes('this.finaleMode = true'),
  'the finale transition must close the old objective targeting contract');
assert.ok(paintSystemSource.includes('if (this.finaleMode) return null'),
  'hidden objective props must not intercept finale aim or projectiles');
assert.ok(battleSource.includes('getStage1RequiredObjectiveCount()'),
  'pre-round HUD fallback must show the authored objective count');
assert.equal(battleSource.includes('getStage1PaintDeviceCount()'), false,
  'public HUD must never fall back to total ambient interaction count');
assert.ok(battleSource.includes('this.paintZone.enterFinaleMode()'),
  'the finale transition must activate the reduced-noise arena state');
assert.ok(battleSource.includes('P16_027_FINALE_BOSS_VERTICAL_OFFSET'),
  'the finale boss must use a player-relative, shootable spawn contract');
assert.ok(battleSource.includes('this.player.y - P16_027_FINALE_BOSS_VERTICAL_OFFSET'),
  'the boss must enter inside the natural auto-fire decision range');
const finaleSpawnBlock = battleSource.slice(
  battleSource.indexOf('  _spawnPublicStage1FinaleBoss() {'),
  battleSource.indexOf('  _resolvePublicStage1FinaleWeakPoint('),
);
assert.equal(/Number\.isFinite|fallback|setPosition\([^)]*\|\|/.test(finaleSpawnBlock), false,
  'the finale spawn must expose invalid player coordinates instead of masking them with a fallback');
assert.ok(battleSource.includes('P16_027_FINALE_AUTO_AIM_RANGE = 420'),
  'one correct dodge must not move an on-screen finale target outside engagement range');
assert.ok(battleSource.includes('_getPublicStage1PaintTargetRange(enemy)'),
  'finale range extension must be role-scoped rather than changing the global shot range');
assert.ok(battleSource.includes('_syncPublicStage1FinaleHud('),
  'the finale HUD must have a dedicated source of truth');
assert.ok(battleSource.includes('const finaleHudActive = this._syncPublicStage1FinaleHud()'),
  'the generic HUD pass must preserve finale labels instead of overwriting them');

console.log('p16027 public Stage 1 runtime readability blocker fix: all assertions passed');
