import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(
  new URL('../src/main.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
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

const configBlock = sourceBlock(mainSource, 'const config = {', '\n};');
const pointerCapacityMatch = configBlock.match(
  /input\s*:\s*{\s*activePointers\s*:\s*(\d+)\s*,?\s*}/
);
assert.ok(
  pointerCapacityMatch,
  'Phaser config must declare input.activePointers for two simultaneous touch pointers'
);
assert.equal(
  Number(pointerCapacityMatch[1]),
  2,
  'input.activePointers must be exactly 2 while Phaser retains the mouse pointer'
);
assert.equal(
  mainSource.includes('this.input.addPointer(')
    || battleSceneSource.includes('this.input.addPointer('),
  false,
  'pointer capacity must be global and must not accumulate through scene-local addPointer calls'
);

const clearKaiBlock = sourceBlock(
  battleSceneSource,
  '  _clearP15KaiPrototypeState() {',
  '  _createPlayerReadabilityMarker() {'
);
const clearKaiPrototypeState = compileClassMethod(
  clearKaiBlock,
  '_clearP15KaiPrototypeState'
);

{
  const events = [];
  const destroyCounts = { bg: 0, label: 0, color: 0, form: 0 };
  let scene;
  let control;

  function makeKaiNode(name) {
    return {
      active: true,
      destroyed: false,
      destroy() {
        assert.equal(
          scene._p15KaiMobileControl,
          control,
          `${name} must be destroyed before the Kai owner reference is cleared`
        );
        destroyCounts[name] += 1;
        events.push(`${name}.destroy`);
        this.active = false;
        this.destroyed = true;
      },
    };
  }

  const colorControl = {
    bg: { destroy() { destroyCounts.color += 1; } },
    label: {},
  };
  const formControl = {
    bg: { destroy() { destroyCounts.form += 1; } },
    label: {},
  };
  control = {
    bg: makeKaiNode('bg'),
    label: makeKaiNode('label'),
    pressed: true,
  };

  const mobileControlButtons = [control, colorControl, formControl];
  const mobileControlHotspots = [
    { x: 269, y: 543, radius: 24 },
    { x: 327, y: 543, radius: 32 },
    { x: 327, y: 599, radius: 32 },
  ];
  const mobileControlTexts = {
    kai: control.label,
    color: colorControl.label,
    form: formControl.label,
  };

  scene = {
    _p15KaiBeatStepKey: null,
    _p15KaiBeatStepKeyHandler: null,
    _p15KaiPrototypeAckTimer: null,
    _p15KaiPrototypeAckText: null,
    _p15KaiBeatStepFx: null,
    _p15KaiMobileControl: control,
    _p15KaiBeatStepActive: true,
    _p15KaiBeatStepDirectionX: 1,
    _p15KaiBeatStepDirectionY: 0,
    _p15KaiBeatStepSpeed: 250,
    _p15KaiBeatStepRemainingPx: 12,
    mobileControlButtons,
    mobileControlHotspots,
    mobileControlTexts,
    _setMobileButtonPressed(receivedControl, pressed) {
      if (!receivedControl) return;
      assert.equal(receivedControl, control, 'pressed reset must use the retained Kai control');
      assert.equal(pressed, false, 'cleanup must release the Kai pressed state');
      assert.equal(destroyCounts.bg, 0, 'pressed reset must happen before bg destruction');
      assert.equal(destroyCounts.label, 0, 'pressed reset must happen before label destruction');
      events.push('pressed.reset');
      receivedControl.pressed = false;
    },
  };

  clearKaiPrototypeState.call(scene);

  assert.deepEqual(
    events,
    ['pressed.reset', 'bg.destroy', 'label.destroy'],
    'cleanup order must be pressed reset, bg destroy, then label destroy'
  );
  assert.deepEqual(destroyCounts, { bg: 1, label: 1, color: 0, form: 0 });
  assert.equal(scene._p15KaiMobileControl, null, 'owner reference must clear after node destruction');
  assert.equal(scene._p15KaiBeatStepActive, false);
  assert.equal(scene._p15KaiBeatStepRemainingPx, 0);

  assert.equal(scene.mobileControlButtons, mobileControlButtons, 'shared button array must not be rewritten');
  assert.deepEqual(scene.mobileControlButtons, [control, colorControl, formControl]);
  assert.equal(scene.mobileControlHotspots, mobileControlHotspots, 'shared hotspot array must not be rewritten');
  assert.equal(scene.mobileControlTexts, mobileControlTexts, 'shared text map must not be rewritten');
  assert.equal(scene.mobileControlTexts.color, colorControl.label, 'color control must remain untouched');
  assert.equal(scene.mobileControlTexts.form, formControl.label, 'form control must remain untouched');

  clearKaiPrototypeState.call(scene);
  assert.deepEqual(
    destroyCounts,
    { bg: 1, label: 1, color: 0, form: 0 },
    'a second cleanup call must not destroy any node again'
  );
}

[
  'mobileControlButtons =',
  'mobileControlButtons.filter',
  'mobileControlButtons.splice',
  'mobileControlHotspots =',
  'mobileControlHotspots.filter',
  'mobileControlHotspots.splice',
  'mobileControlTexts =',
  'delete this.mobileControlTexts',
].forEach((forbiddenMutation) => {
  assert.equal(
    clearKaiBlock.includes(forbiddenMutation),
    false,
    `Kai cleanup must not rewrite shared mobile-control state: ${forbiddenMutation}`
  );
});

{
  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown', () => {",
    '    });'
  );
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const resultActionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  // ====================='
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearP15KaiPrototypeState()'));
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-title')"));
}

console.log('p15231a Kai two-pointer capacity and result cleanup: all assertions passed');
