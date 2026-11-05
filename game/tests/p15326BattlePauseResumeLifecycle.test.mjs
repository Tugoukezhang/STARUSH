import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName) {
  return Function(
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )();
}

const setPauseBlock = sourceBlock(
  '  _setBattlePaused(paused) {',
  '  _showBattlePauseOverlay() {'
);
const setBattlePaused = compileClassMethod(setPauseBlock, '_setBattlePaused');

function makePauseHarness() {
  const calls = {
    clearInput: 0,
    showOverlay: 0,
    clearOverlay: 0,
    physicsPause: 0,
    physicsResume: 0,
    tweensPause: 0,
    tweensResume: 0,
    velocities: [],
  };
  const preserved = {
    hp: 4,
    support: { value: 67 },
    waveSystem: { currentWave: 1, pendingWaveAction: { id: 'pressure' } },
    enemies: { children: ['enemy-a'] },
    enemyBullets: { children: ['pulse-a'] },
  };
  const scene = {
    ...preserved,
    _battleEnded: false,
    _battlePaused: false,
    player: {
      active: true,
      body: {
        setVelocity(x, y) {
          calls.velocities.push([x, y]);
        },
      },
    },
    time: { paused: false },
    physics: {
      pause() { calls.physicsPause += 1; },
      resume() { calls.physicsResume += 1; },
    },
    tweens: {
      pauseAll() { calls.tweensPause += 1; },
      resumeAll() { calls.tweensResume += 1; },
    },
    _clearMobileInputState() { calls.clearInput += 1; },
    _showBattlePauseOverlay() { calls.showOverlay += 1; },
    _clearBattlePauseOverlay() { calls.clearOverlay += 1; },
  };
  return { scene, calls, preserved };
}

{
  const { scene, calls, preserved } = makePauseHarness();
  assert.equal(setBattlePaused.call(scene, true), true, 'first pause should enter paused state');
  assert.equal(scene._battlePaused, true);
  assert.equal(scene.time.paused, true);
  assert.deepEqual(calls.velocities, [[0, 0]], 'pause must zero player velocity once');
  assert.equal(calls.clearInput, 1);
  assert.equal(calls.showOverlay, 1);
  assert.equal(calls.physicsPause, 1);
  assert.equal(calls.tweensPause, 1);

  assert.equal(setBattlePaused.call(scene, true), false, 'repeated pause must be idempotent');
  assert.equal(calls.showOverlay, 1);
  assert.equal(calls.physicsPause, 1);
  assert.equal(calls.tweensPause, 1);

  assert.equal(scene.support, preserved.support, 'support state must retain object identity');
  assert.equal(scene.waveSystem, preserved.waveSystem, 'wave state must retain object identity');
  assert.equal(scene.enemies, preserved.enemies, 'enemy group must not reset');
  assert.equal(scene.enemyBullets, preserved.enemyBullets, 'projectile group must not reset');

  assert.equal(setBattlePaused.call(scene, false), true, 'first resume should release paused state');
  assert.equal(scene._battlePaused, false);
  assert.equal(scene.time.paused, false);
  assert.equal(calls.clearOverlay, 1);
  assert.equal(calls.physicsResume, 1);
  assert.equal(calls.tweensResume, 1);

  assert.equal(setBattlePaused.call(scene, false), false, 'repeated resume must be idempotent');
  assert.equal(calls.clearOverlay, 1);
  assert.equal(calls.physicsResume, 1);
  assert.equal(calls.tweensResume, 1);
}

{
  const { scene, calls } = makePauseHarness();
  scene._battleEnded = true;
  assert.equal(setBattlePaused.call(scene, true), false, 'ended battles must reject pause');
  assert.deepEqual(calls.velocities, []);
}

const setupInputBlock = sourceBlock(
  '  _setupInput() {',
  '  _setupMobileControls() {'
);
assert.ok(setupInputBlock.includes("addKey('ESC')"), 'Escape must toggle pause');
assert.ok(setupInputBlock.includes("addKey('P')"), 'P must toggle pause');
assert.ok(setupInputBlock.includes('event?.repeat === true'), 'pause keys must suppress repeats');
assert.ok(setupInputBlock.includes('this._toggleBattlePause()'));
assert.ok(setupInputBlock.includes('if (this._battleEnded || this._battlePaused) return;'));

const mobileSetupBlock = sourceBlock(
  '  _setupMobileControls() {',
  '  _createMobileButton(x, y, color, onTap, key) {'
);
assert.equal(
  mobileSetupBlock.split('this._createBattlePauseControl()').length - 1,
  1,
  'every active battle route must create exactly one pause control'
);

const pauseControlBlock = sourceBlock(
  '  _createBattlePauseControl() {',
  '  _setMobileButtonPressed(control, pressed) {'
);
assert.ok(pauseControlBlock.includes("setText('Ⅱ')"), 'touch control must use the familiar pause glyph');
assert.ok(pauseControlBlock.includes("'pause'"));
assert.ok(pauseControlBlock.includes('this._toggleBattlePause()'));

const overlayBlock = sourceBlock(
  '  _showBattlePauseOverlay() {',
  '  _clearBattlePauseOverlay() {'
);
[
  '公演暂停',
  '本次公演已暂停。',
  '继续公演',
  '重新开始',
  '返回制作台',
].forEach((copy) => assert.ok(overlayBlock.includes(copy), `missing pause copy: ${copy}`));
assert.ok(overlayBlock.includes('setInteractive()'), 'backdrop must capture input');
assert.ok(overlayBlock.includes('event?.stopPropagation'), 'overlay input must not reach battle controls');
assert.ok(overlayBlock.includes('BATTLE_RESULT_ACTIONS.RETRY'));
assert.ok(overlayBlock.includes('BATTLE_RESULT_ACTIONS.TITLE'));
assert.ok(overlayBlock.includes('_setBattlePaused(false)'));

const updateBlock = sourceBlock(
  '  update(time, delta) {',
  '  _onPlayerDeath() {'
);
assert.ok(
  updateBlock.indexOf('if (this._battleEnded || this._battlePaused) return;')
    < updateBlock.indexOf('this.player.body.setVelocity('),
  'paused update must return before movement'
);
assert.ok(
  updateBlock.indexOf('if (this._battleEnded || this._battlePaused) return;')
    < updateBlock.indexOf('this._tryShoot(time)'),
  'paused update must return before auto-shoot'
);

const switchColorBlock = sourceBlock('  _switchColor() {', '  _switchForm() {');
const switchFormBlock = sourceBlock('  _switchForm() {', '  _setForm(formType) {');
assert.ok(switchColorBlock.includes('this._battlePaused'));
assert.ok(switchFormBlock.includes('this._battlePaused'));

const kaiBlock = sourceBlock(
  '  _tryStartP15KaiBeatStep() {',
  '  _resolveP15KaiBeatStepVelocity('
);
assert.ok(kaiBlock.includes('this._battlePaused === true'));

const endBattleBlock = sourceBlock(
  '  _endBattle(type) {',
  '  _showP43ResultPreview(preview) {'
);
assert.ok(
  endBattleBlock.indexOf('this._setBattlePaused(false)')
    < endBattleBlock.indexOf('this._battleEnded = true'),
  'result must release paused clocks before ending the battle'
);
assert.ok(endBattleBlock.includes('this._hideMobileControlsForResult'));

const shutdownBlock = sourceBlock(
  "this.events.once('shutdown', () => {",
  '    });'
);
assert.ok(shutdownBlock.includes('this._clearBattlePauseLifecycle()'));

const clearLifecycleBlock = sourceBlock(
  '  _clearBattlePauseLifecycle() {',
  '  _isMobileControlPointer(pointer) {'
);
assert.ok(clearLifecycleBlock.includes('this.time.paused = false'));
assert.ok(clearLifecycleBlock.includes('this.tweens.resumeAll()'));
assert.ok(clearLifecycleBlock.includes('this.physics.resume()'));
assert.ok(clearLifecycleBlock.includes("key.off('down', this._battlePauseKeyHandler)"));
assert.ok(clearLifecycleBlock.includes('this._battlePauseControl'));

const pauseSurface = [setPauseBlock, pauseControlBlock, overlayBlock, clearLifecycleBlock]
  .join('\n')
  .toLowerCase();
[
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  '.mp3',
  '.ogg',
  'preload',
  'registry',
  'localstorage',
  'reward',
  'gacha',
  'shop',
  'stage 2',
].forEach((forbidden) => {
  assert.equal(pauseSurface.includes(forbidden), false, `pause surface must exclude: ${forbidden}`);
});

console.log('p15326 battle pause/resume lifecycle: all assertions passed');
