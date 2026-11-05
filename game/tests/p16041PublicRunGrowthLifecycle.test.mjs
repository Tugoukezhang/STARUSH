import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
import { PublicStage1RoundController } from '../src/systems/PublicStage1RoundController.mjs';
import { resolveBattlePerformerIdentityContract } from '../src/utils/battlePerformerContract.mjs';
import { getRunChoice, loadPublicProfile } from '../src/utils/publicRunProgression.mjs';
import { STAGE1_PAINT_SPLAT_RADIUS } from '../src/utils/stage1PaintRound.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { createDocument } from './helpers/publicShellHarness.mjs';

const documentStub = createDocument();
const host = documentStub.getElementById('game-container');
const build = documentStub.createElement('div');build.id='run-build';host.append(build);
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub });
after(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete globalThis.document;
});

function graphic(x = 0, y = 0) {
  const node = { x, y, active: true,
    destroy() { this.active = false; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
  };
  for (const method of ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor',
    'setInteractive', 'setStrokeStyle', 'setVisible', 'setFillStyle', 'setColor',
    'setScale', 'setText', 'on', 'once', 'clear', 'fillStyle', 'lineStyle',
    'fillCircle', 'strokeCircle', 'fillTriangle', 'fillRect', 'strokeRect', 'fillRoundedRect',
    'strokeRoundedRect', 'lineBetween']) node[method] = () => node;
  return node;
}

const Phaser = { Scene: class {}, Math: {
  Clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  Distance: { Between: (x, y, tx, ty) => Math.hypot(tx - x, ty - y) },
} };
const { BattleScene, PaintZoneSystem } = loadBattleScene({ Phaser, document: documentStub, includeOwners: true });

function clock() {
  const timers = [];
  return { now: 100, paused: false, timers,
    delayedCall(delay, callback) {
      const timer = { due: this.now + delay, callback, removed: false,
        remove(dispatch) { this.removed = true; this.removeDispatch = dispatch; } };
      timers.push(timer);
      return timer;
    },
    advance(ms) {
      if (this.paused) {
        this.now += ms;
        for (const timer of timers) if (!timer.removed && !timer.fired) timer.due += ms;
        return;
      }
      const end = this.now + ms;
      for (let count = 0; count < 50; count += 1) {
        const timer = timers.filter(item => !item.removed && !item.fired && item.due <= end)
          .sort((a, b) => a.due - b.due)[0];
        if (!timer) { this.now = end; return; }
        this.now = timer.due;
        timer.fired = true;
        timer.callback();
      }
      assert.fail('unbounded timer chain');
    },
  };
}

function enemy(x, y, extra = {}) {
  return { active: true, x, y, hp: 1000, maxHp: 1000,
    publicStage1EnemyRole: 'unlit-chaser', ...extra };
}

function device(x, y, extra = {}) {
  return { x, y, paint: 0, paintMax: 1000, complete: false, required: true,
    zone: 0, kind: 'speaker', gfx: graphic(), ...extra };
}

// All gameplay, target paint, ground paint, pause and HUD methods stay real.
// Only engine services, DOM nodes and a localStorage boundary are substituted.
function fixture(t, id = 'genya', battleOverrides = {}) {
  const scene = new BattleScene();
  scene.battleData = { stageId: 1, performerId: id, characterId: id,
    team: [{ characterId: id }], ...battleOverrides };
  scene.publicStage1Round = new PublicStage1RoundController(scene.battleData);
  scene.publicStage1Round.begin();
  scene._battlePerformerContract = resolveBattlePerformerIdentityContract(scene.battleData, { presentationId: id });
  scene._battleEnded = false;
  scene._battlePaused = false;
  scene._specialCharge = 100;
  scene._encoreCharge = 0;
  scene.currentColor = 'purple';
  scene.hpPips = [];
  scene.time = clock();
  scene.physics = { paused: false, pause() { this.paused = true; }, resume() { this.paused = false; } };
  scene.tweens = { paused: false, add: () => ({ remove() {}, stop() {} }),
    pauseAll() { this.paused = true; }, resumeAll() { this.paused = false; } };
  scene.add = Object.fromEntries(['circle', 'rectangle', 'text', 'graphics'].map(name => [name, graphic]));
  scene.player = { ...graphic(100, 200), hp: 3, maxHp: 5, invulnerable: false,
    body: { velocity: { x: 250, y: 0 },
      setVelocity(x, y) { this.velocity = { x, y }; } } };
  const enemies = [];
  scene.enemies = { getChildren: () => enemies, children: { iterate: fn => enemies.forEach(fn) } };
  scene.paintZone = new PaintZoneSystem(scene);
  const run = new PublicStage1PerformerRun(scene);
  scene.publicPerformerRun = run;
  t.after(() => { run.destroy();scene._clearBattlePauseOverlay(); });
  return { scene, run, enemies, time: scene.time, zone: scene.paintZone };
}

function chooseBuild(run, first, second) {
  assert.equal(run.growth.choose(first), true);
  if (second) assert.equal(run.growth.choose(second), true);
}

function fire(scene, target, x = target.x, y = target.y) {
  const bullet = { ...graphic(x, y), color: 'purple', paintShot: true };
  scene._detonatePaintBullet(bullet, target);
  assert.equal(bullet.active, false, 'the real impact path must consume its projectile');
}

test('relay paints one different eligible target for 8 within the 160 range', t => {
  const { run, enemies } = fixture(t);
  chooseBuild(run, 'relay');
  const primary = enemy(100, 200);
  const other = enemy(160, 200);
  const distant = enemy(261, 200);
  const inactive = enemy(101, 200, { active: false });
  enemies.push(primary, distant, inactive, other);
  run.onImpact(100, 200, 'purple', primary);
  assert.deepEqual(enemies.map(item => item.hp), [1000, 1000, 1000, 992]);
  assert.equal(run.impacts, 1);
  other.active = false;
  run.onImpact(100, 200, 'purple', primary);
  assert.equal(primary.hp, 1000);
  assert.equal(distant.hp, 1000);
});

test('relay does not repaint the original or a third target when enemies overlap its splash', t => {
  const { run, enemies } = fixture(t);
  chooseBuild(run, 'relay');
  const primary = enemy(100, 200);
  const other = enemy(120, 200);
  const third = enemy(130, 200);
  enemies.push(primary, other, third);
  run.onImpact(primary.x, primary.y, 'purple', primary);
  assert.deepEqual([primary.hp, other.hp, third.hp], [1000, 992, 1000],
    'relay must paint exactly one different target, not the original or a third target');
});

for (const color of ['pink', 'yellow']) {
  test(`${color} relay applies exactly 8 with no color bonus, extra chain or anchor progress`, t => {
    const { run, enemies, zone, time } = fixture(t);
    chooseBuild(run, 'relay');
    const primary = enemy(100, 200);
    const other = enemy(120, 200, { publicStage1ReactionColor: color });
    const third = enemy(130, 200);
    const chainCandidate = enemy(180, 200);
    const anchor = device(other.x, other.y);
    enemies.push(primary, other, third, chainCandidate);
    zone.devices.push(anchor);
    run.onImpact(primary.x, primary.y, color, primary);
    const expected = [1000, 992, 1000, 1000];
    assert.deepEqual(enemies.map(target => target.hp), expected,
      'incoming color must not add matching paint, pink damage or a yellow chain');
    assert.equal(anchor.paint, 0, 'relay decoration must not award anchor paint');
    assert.equal(zone.getHeat(), 0);
    assert.equal(run.impacts, 1);
    assert.equal(run.timers.size, 0);
    time.advance(1000);
    assert.deepEqual(enemies.map(target => target.hp), expected);
  });
}

test('Venus paints each of three overlapping selected targets once and leaves the fourth untouched', t => {
  const { scene, run, enemies } = fixture(t, 'venus');
  enemies.push(enemy(110, 200), enemy(120, 200), enemy(130, 200), enemy(140, 200));
  assert.equal(run.triggerAction(), true);
  assert.deepEqual(enemies.map(target => target.hp), [958, 958, 958, 1000],
    'three exact 42-paint hits must not overlap or generate secondary yellow chains');
  assert.equal(run.actions, 1);
  assert.equal(scene._specialCharge, 0);
  assert.equal(run.impacts, 0, 'kit paint is not a projectile impact');
  assert.equal(run.timers.size, 0);
  assert.equal(run.triggerAction(), false);
  assert.deepEqual(enemies.map(target => target.hp), [958, 958, 958, 1000]);
});

test('real projectile impacts echo exactly every third hit after 200ms without recursion', t => {
  const { scene, run, enemies, time } = fixture(t);
  chooseBuild(run, 'tempo', 'echo');
  const target = enemy(100, 200);
  enemies.push(target);
  fire(scene, target);
  fire(scene, target);
  assert.equal(target.hp, 972);
  assert.equal(run.timers.size, 0);
  fire(scene, target);
  assert.equal(target.hp, 958);
  assert.equal(run.timers.size, 1);
  time.advance(199);
  assert.equal(target.hp, 958);
  time.advance(1);
  assert.equal(target.hp, 944);
  assert.equal(run.impacts, 3, 'echo paint must not count as a new projectile impact');
  assert.equal(run.timers.size, 0);
  time.advance(1000);
  assert.equal(target.hp, 944);
  for (let i = 0; i < 3; i += 1) fire(scene, target);
  time.advance(200);
  assert.equal(target.hp, 888);
  assert.equal(run.impacts, 6);
  assert.equal(run.timers.size, 0);
});

test('destroy removes action and echo timers and rejects callbacks already dequeued', t => {
  const { run, enemies, time } = fixture(t);
  chooseBuild(run, 'tempo', 'echo');
  const target = enemy(100, 200);
  enemies.push(target);
  assert.equal(run.triggerAction(), true);
  for (let i = 0; i < 3; i += 1) run.onImpact(100, 200, 'purple', target);
  const queued = [...run.timers];
  assert.equal(queued.length, 3);
  const hp = target.hp;
  run.destroy();
  assert.equal(run.timers.size, 0);
  for (const timer of queued) {
    assert.equal(timer.removed, true);
    assert.equal(timer.removeDispatch, false);
    timer.callback();
  }
  time.advance(1000);
  assert.equal(target.hp, hp);
  assert.equal(run.triggerAction(), false);
});

test('battle result suppresses delayed echo paint even before owner destruction', t => {
  const { scene, run, enemies, time } = fixture(t);
  chooseBuild(run, 'tempo', 'echo');
  const target = enemy(100, 200);
  enemies.push(target);
  for (let i = 0; i < 3; i += 1) run.onImpact(100, 200, 'purple', target);
  scene._battleEnded = true;
  time.advance(200);
  assert.equal(target.hp, 1000);
  assert.equal(run.timers.size, 0);
  run.onImpact(100, 200, 'purple', target);
  assert.equal(run.impacts, 3);
});

test('recovery restores exactly one HP up to five and does not revive a defeated player', t => {
  const { scene, run } = fixture(t);
  run.onAnchor();
  assert.equal(scene.player.hp, 3);
  chooseBuild(run, 'tempo', 'recovery');
  run.onAnchor();
  assert.equal(scene.player.hp, 4);
  run.onAnchor();
  run.onAnchor();
  assert.equal(scene.player.hp, 5);
  delete scene.player.maxHp;
  scene.player.hp = 4;
  run.onAnchor();
  assert.equal(scene.player.hp, 5);
  scene.player.hp = 0;
  run.onAnchor();
  assert.equal(scene.player.hp, 0);
});

test('overdrive changes real Enjo target damage and anchor paint from 52 to 78', t => {
  for (const [boosted, expected] of [[false, 52], [true, 78]]) {
    const { run, zone, enemies } = fixture(t, 'enjo');
    if (boosted) chooseBuild(run, 'tempo', 'overdrive');
    const anchor = device(100, 200);
    zone.devices.push(anchor);
    assert.equal(run.triggerAction(), true);
    assert.equal(anchor.paint, expected);
    const next = fixture(t, 'enjo');
    if (boosted) chooseBuild(next.run, 'tempo', 'overdrive');
    const target = enemy(100, 200);
    next.enemies.push(target);
    next.run.triggerAction();
    assert.equal(1000 - target.hp, expected);
    assert.equal(enemies.length, 0);
  }
});

test('Kai trail uses actual player displacement, ends at 160ms and grants no invulnerability', t => {
  const { scene, run, zone, time } = fixture(t, 'kai');
  const destination = device(200, 200);
  zone.devices.push(destination);
  assert.equal(run.triggerAction(), true);
  assert.equal(destination.paint, 0, 'no trail at a position not reached by the player');
  assert.equal(scene.player.invulnerable, false);
  assert.deepEqual(run.movement(0, 250), { vx: 700, vy: 0 });
  assert.equal(destination.paint, 0, 'requested velocity alone must not teleport paint');
  scene.player.x = 200;
  time.advance(80);
  run.movement(0, 250);
  assert.equal(destination.paint, 20);
  run.movement(0, 250);
  assert.equal(destination.paint, 20, 'stationary frames do not repeat trail paint');
  assert.equal(scene.player.invulnerable, false);
  time.advance(80);
  assert.deepEqual(run.movement(0, 250), { vx: 0, vy: 250 });
  assert.equal(run.dash, null);
});

test('wide brush extends normal projectile ground paint by 40 without expanding target damage', t => {
  for (const enabled of [false, true]) {
    const { scene, run, zone, enemies } = fixture(t);
    if (enabled) chooseBuild(run, 'wide_brush');
    const anchor = device(100 + STAGE1_PAINT_SPLAT_RADIUS + 20, 200);
    const primary = enemy(100, 200);
    const outside = enemy(anchor.x, anchor.y);
    zone.devices.push(anchor);
    enemies.push(primary, outside);
    fire(scene, primary);
    assert.equal(anchor.paint, enabled ? 14 : 0);
    assert.equal(primary.hp, 986);
    assert.equal(outside.hp, 1000);
  }
});

test('tempo multiplies event-earned special charge only, not Encore or elapsed time', t => {
  const { scene, run, time } = fixture(t);
  chooseBuild(run, 'tempo');
  scene._specialCharge = 0;
  scene._paintRoundEndsAt = 10000;
  scene._awardPublicSakuraActionCharge('required-anchor');
  assert.equal(scene._specialCharge, 33);
  assert.equal(scene._encoreCharge, 8);
  assert.equal(scene._paintRoundEndsAt, 10000);
  time.advance(5000);
  run.update();
  assert.equal(scene._specialCharge, 33);
  assert.equal(scene._encoreCharge, 8);
  assert.equal(scene._paintRoundEndsAt, 10000);
});

test('checkpoint pauses real scene and logical time for 10 seconds with idempotent pause/resume', t => {
  const { scene, run, zone, time } = fixture(t, 'kai');
  zone.devices.push(device(0, 0, { complete: true }), device(0, 0, { complete: true }));
  run.update();
  assert.equal(run.choiceOpen, false);
  zone.devices.push(device(0, 0, { complete: true }));
  scene._touchMoveActive = true;
  scene._touchMovePointerId = 2;
  run.triggerAction();
  run.update();
  assert.equal(run.choiceOpen, true);
  assert.equal(run.dash, null);
  assert.equal(scene._battlePaused, true);
  assert.equal(scene.physics.paused, true);
  assert.equal(scene.tweens.paused, true);
  assert.equal(time.paused, true);
  assert.equal(scene._touchMoveActive, false);
  assert.equal(scene._touchMovePointerId, null);
  assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
  assert.equal(scene._battlePauseOverlay, null, 'choice replaces the ordinary pause overlay');
  assert.equal(host.dataset.battlePaused, 'true');
  assert.equal(run.choiceRoot.getAttribute('role'), 'dialog');
  const now = run.now();
  const rawNow = time.now;
  time.advance(5000);
  run.pauseClock();
  run.pauseClock();
  assert.equal(scene._setBattlePaused(true), false);
  time.advance(5000);
  assert.equal(time.now, rawNow + 10000, 'Phaser Clock.now advances even while paused');
  assert.equal(run.now(), now, 'logical battle time must remain frozen for the entire pause');
  assert.equal(run.choose('tempo'), true);
  assert.equal(run.now(), now);
  run.resumeClock();
  run.resumeClock();
  assert.equal(run.now(), now, 'duplicate resume must not subtract paused time twice');
  time.advance(25);
  assert.equal(run.now(), now + 25);
  scene._setBattlePaused(true);
  time.advance(1000);
  scene._setBattlePaused(false);
  assert.equal(run.now(), now + 25, 'a second pause accumulates only its own duration');
  time.advance(25);
  assert.equal(run.now(), now + 50);
});

test('modal buttons apply only the current pool, resume the real scene and ignore stale clicks', t => {
  const { scene, run, zone } = fixture(t);
  for (let i = 0; i < 3; i += 1) zone.devices.push(device(0, 0, { complete: true }));
  run.update();
  const firstRoot = run.choiceRoot;
  const first = firstRoot.querySelectorAll('[data-choice]');
  assert.deepEqual(first.map(node => node.dataset.choice), ['wide_brush', 'relay', 'tempo']);
  assert.equal(run.choose('echo'), false);
  assert.equal(scene._battlePaused, true);
  first[2].click();
  assert.deepEqual(run.growth.choices, ['tempo']);
  assert.equal(firstRoot.parentNode, null);
  assert.equal(scene._battlePaused, false);
  assert.equal(scene.time.paused, false);
  assert.equal(scene.physics.paused, false);
  assert.equal(scene.tweens.paused, false);
  assert.equal(build.textContent, getRunChoice('tempo').label);
  for (let i = 0; i < 4; i += 1) zone.devices.push(device(0, 0, { complete: true }));
  run.update();
  const second = run.choiceRoot.querySelectorAll('[data-choice]');
  assert.deepEqual(second.map(node => node.dataset.choice), ['echo', 'overdrive', 'recovery']);
  first[0].click();
  assert.equal(scene._battlePaused, true);
  assert.deepEqual(run.growth.choices, ['tempo']);
  second[0].click();
  assert.deepEqual(run.growth.choices, ['tempo', 'echo']);
  assert.equal(scene._battlePaused, false);
  run.update();
  assert.equal(run.choiceOpen, false);
  assert.equal(run.choose('recovery'), false);
});

test('pause-toggle guard cannot bypass a choice, and destroying its DOM rejects stale buttons', t => {
  const { scene, run, zone } = fixture(t);
  for (let i = 0; i < 3; i += 1) zone.devices.push(device(0, 0, { complete: true }));
  run.update();
  const root = run.choiceRoot;
  const stale = root.querySelector('button');
  assert.equal(scene._toggleBattlePause(), false);
  assert.equal(scene._battlePaused, true);
  assert.equal(scene.time.paused, true);
  run.destroy();
  assert.equal(root.parentNode, null);
  assert.equal(run.choiceRoot, null);
  stale.click();
  assert.deepEqual(run.growth.choices, []);
  assert.equal(build.textContent, '');
});

test('finish writes the real profile once and returns the same result on duplicate settlement', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  let writes = 0;
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, value); } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  const { scene, run, time } = fixture(t, 'enjo');
  chooseBuild(run, 'tempo', 'recovery');
  run.triggerAction();
  time.advance(250);
  scene._setBattlePaused(true);
  time.advance(10000);
  const result = run.finish(true);
  assert.equal(result.actions, 1);
  assert.equal(result.durationMs, 250);
  assert.equal(result.persisted, true);
  assert.equal(run.finish(false), result);
  assert.equal(writes, 1);
  const profile = loadPublicProfile(storage);
  assert.equal(profile.attempts, 1);
  assert.equal(profile.clears, 1);
  assert.equal(profile.clearsByPerformer.enjo, 1);
  assert.equal(profile.lastRun.runId, run.runId);
  assert.equal(profile.lastRun.victory, true);
  assert.deepEqual(profile.lastRun.choices, ['tempo', 'recovery']);
});

test('real identity contracts reject hidden or mismatched public action ownership', t => {
  for (const overrides of [{ practiceMode: true }, { p15KaiPrototypeExperiment: true },
    { stageId: 2 }, { characterId: 'sakura' }]) {
    const { scene, run, zone } = fixture(t, 'kai', overrides);
    const anchor = device(100, 200);
    zone.devices.push(anchor);
    assert.equal(scene._battlePerformerContract.publicActionOwnerId, null);
    assert.equal(run.triggerAction(), false);
    assert.equal(scene._specialCharge, 100);
    assert.equal(run.actions, 0);
    assert.equal(run.dash, null);
    assert.equal(anchor.paint, 0);
  }
});
