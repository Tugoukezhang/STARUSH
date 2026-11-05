import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';
import { OldStreetState } from '../src/utils/oldStreetMap.mjs';
import { NEON_STREET_CONFIG } from '../src/utils/neonStreetMap.mjs';
import { HARBOR_STAGE_CONFIG } from '../src/utils/harborStageMap.mjs';

const Phaser = { Scene: class {}, Math: { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)) } };
const BattleScene = loadBattleScene({ Phaser });
function graphics() {
  return {
    setDepth() { return this; }, setPosition() { return this; },
    lineStyle() { return this; }, lineBetween() { return this; },
  };
}
function sceneFor(config, x, y, scrollX = x - 187.5) {
  const street = Object.assign(Object.create(OldStreetScene.prototype), { config });
  return Object.assign(Object.create(BattleScene.prototype), {
    oldStreet: street, player: { active: true, x, y }, time: { now: 0 },
    publicStage1Finale: { snapshot: () => ({ active: true, phase: 'weak-point' }) },
    cameras: { main: { scrollX, scrollY: Math.max(0, y - 430) } },
    physics: { add: { sprite(x, y) { return {
      x, y, active: true, body: {}, setAlpha() { return this; }, setDepth() { return this; },
    }; } } },
    add: { graphics }, enemies: { add() {} },
    _configureCenteredArcadeCircle() {}, _drawPublicStage1ColorCue() {},
    _drawPublicStage1FinaleBossGfx() {},
  });
}

test('neon authors its finale in the open listening plaza', () => {
  assert.deepEqual(NEON_STREET_CONFIG.finaleOrigin, { x: 500, y: 310 });
});

test('neon left-entry weak point is not buried inside north-listening shop', () => {
  const scene = sceneFor(NEON_STREET_CONFIG, 350, 470);
  const state = new OldStreetState(NEON_STREET_CONFIG.props);
  scene._spawnPublicStage1FinaleBoss();
  const weak = scene._spawnPublicStage1FinaleWeakPoint(0);
  assert(state.clearLine(weak, weak, 12), `buried weak point at ${weak.x},${weak.y}`);
});

for (const [chapter, config, origin] of [
  ['opening', null, { x: 500, y: 310 }],
  ['neon', NEON_STREET_CONFIG, { x: 500, y: 310 }],
  ['encore', HARBOR_STAGE_CONFIG, { x: 500, y: 300 }],
]) {
  for (const x of [350, 500, 650]) for (const y of [360, 430, 480]) {
    test(`${chapter}: side entry ${x},${y} cannot put boss or weak points in scenery`, () => {
      const scene = sceneFor(config, x, y);
      const state = new OldStreetState(config?.props, config?.terrain);
      const boss = scene._spawnPublicStage1FinaleBoss();
      assert.deepEqual({ x: boss.x, y: boss.y }, origin);
      assert(state.clearLine(boss, boss, 20), 'boss clearance');
      assert.equal(scene._spawnPublicStage1FinaleBoss(), boss, 'one boss per finale');
      for (let index = 0; index < 3; index++) {
        scene._publicStage1FinaleWeakPoint = null;
        const weak = scene._spawnPublicStage1FinaleWeakPoint(index);
        assert(state.clearLine(weak, weak, 12), `weak point ${index} clearance`);
        assert(state.clearLine({ x: 500, y: 430 }, weak, 4), `weak point ${index} approach`);
      }
    });
  }
  test(`${chapter}: camera lag does not move an authored world-space arena`, () => {
    for (const scrollX of [0, 625]) {
      const scene = sceneFor(config, 500, 430, scrollX);
      const boss = scene._spawnPublicStage1FinaleBoss();
      assert.deepEqual({ x: boss.x, y: boss.y }, origin);
    }
  });
}

test('non-street fallback retains viewport clamping and ended-battle guards', () => {
  const scene = sceneFor(null, 500, 430);
  scene.oldStreet = null;
  const boss = scene._spawnPublicStage1FinaleBoss();
  assert.deepEqual({ x: boss.x, y: boss.y }, { x: 500, y: 250 });
  scene._battleEnded = true;
  assert.equal(scene._spawnPublicStage1FinaleBoss(), null);
});
