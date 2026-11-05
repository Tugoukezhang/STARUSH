import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
import { PublicStage1EncounterDirector } from '../src/systems/PublicStage1EncounterDirector.mjs';
import { PublicStage1RoundController } from '../src/systems/PublicStage1RoundController.mjs';
import { PUBLIC_CHAPTERS } from '../src/utils/publicCampaign.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const Phaser = { Scene: class {}, Math: {
  Clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) },
} };
const { BattleScene, PaintZoneSystem } = loadBattleScene({ Phaser, includeOwners: true });
function graphic(x = 0, y = 0) {
  const node = { x, y, active: true, destroy() { this.active = false; } };
  const proxy = new Proxy(node, { get: (o, key) => key in o ? o[key] : () => proxy });
  return proxy;
}
function fixture(t, id = 'genya', preparation = null) {
  const s = new BattleScene(), enemies = [], timers = [];
  Object.assign(s, {
    battleData: { stageId: 1, performerId: id, publicPreparation: preparation },
    _battlePerformerContract: { publicActionOwnerId: id },
    _battleEnded: false, _battlePaused: false, _specialCharge: 100, _encoreCharge: 0,
    time: { now: 100, delayedCall(delay, callback) {
      const timer = { delay, callback, remove() { this.removed = true; } }; timers.push(timer); return timer;
    } },
    player: { x: 100, y: 200, hp: 3, maxHp: 5, invulnerable: false, body: { velocity: { x: 250, y: 0 } } },
    enemies: { getChildren: () => enemies, children: { iterate: callback => enemies.forEach(callback) } },
    add: Object.fromEntries(['graphics', 'circle', 'text', 'rectangle'].map(key => [key, graphic])),
    tweens: { add: () => ({ remove() {} }) }, hpPips: [],
    oldStreet: { clearLine: () => true }, _showRoundBanner() {}, _updateHUD() {},
  });
  s.paintZone = new PaintZoneSystem(s);
  s.publicStage1Round = new PublicStage1RoundController(s.battleData);
  s.publicStage1Round.begin();
  s.paintZone._redrawDevice = () => {};
  s.paintZone._emitProgress = () => {};
  const run = new PublicStage1PerformerRun(s); s.publicPerformerRun = run; s.currentColor = run.member.color;
  s._selectPublicSakuraLeadCueTarget = () => enemies[0] || s.paintZone.devices[0] || null;
  s._triggerPublicSakuraLeadCue = () => run.sakuraCombat.beginSpecial(s._selectPublicSakuraLeadCueTarget());
  t.after(() => run.destroy());
  return { s, run, enemies, timers, zone: s.paintZone };
}
const device = (x, y, extra = {}) => ({ x, y, zone: 0, required: true, paint: 0, paintMax: 10000,
  complete: false, paintPolicy: 'performer', gfx: graphic(), ...extra });
function detonate(s, target = null, x = 100, y = 200) {
  const bullet = { x, y, color: s.currentColor, paintShot: true, active: true,
    destroy() { this.active = false; } };
  s._detonatePaintBullet(bullet, target); assert.equal(bullet.active, false); return bullet;
}

test('empty detonations do not advance echo or send relay paint to an unhit distant target', t => {
  for (const first of ['tempo', 'relay']) {
    const { s, run, enemies, timers } = fixture(t);
    run.growth.choose(first); run.growth.choose('echo');
    const other = { x: 240, y: 200, hp: 1000, maxHp: 1000, active: true, publicStage1EnemyRole: 'unlit-chaser' };
    enemies.push(other);
    for (let i = 0; i < 3; i++) detonate(s);
    assert.equal(run.impacts, 0, 'empty detonations are not accepted target hits');
    assert.equal(timers.length, 0); assert.equal(other.hp, 1000);
    assert.equal(s.paintZone.getHeat(), 3, 'ordinary pigment/heat remains unchanged');
  }
});

test('rejected fixture and stale inactive target contacts do not count as hits', t => {
  const { s, run, zone } = fixture(t); run.growth.choose('tempo'); run.growth.choose('echo');
  const anchor = device(100, 200, { publicStage1Suppressed: true }); zone.devices = [anchor];
  const dead = { x: 100, y: 200, active: false, publicStage1EnemyRole: 'unlit-chaser' };
  detonate(s, dead); assert.equal(run.impacts, 0, 'rejected fixture is not a hit');
  assert.equal(anchor.paint, 0);
  anchor.publicStage1Suppressed = false; anchor.zone = 1;
  detonate(s); assert.equal(run.impacts, 0);
  anchor.zone = 0; anchor.complete = true;
  detonate(s); assert.equal(run.impacts, 0); assert.equal(run.timers.size, 0);
});

test('mixed fixture/enemy splash counts once, and only the third accepted hit schedules echo', t => {
  const { s, run, zone, enemies, timers } = fixture(t); run.growth.choose('tempo'); run.growth.choose('echo');
  const anchor = device(100, 200), enemy = { x: 100, y: 200, hp: 1000, maxHp: 1000,
    active: true, publicStage1EnemyRole: 'unlit-chaser' };
  zone.devices = [anchor]; enemies.push(enemy);
  detonate(s, enemy); assert.equal(run.impacts, 1);
  detonate(s, null, 500, 500); assert.equal(run.impacts, 1);
  detonate(s, enemy); assert.equal(run.impacts, 2); assert.equal(timers.length, 0);
  detonate(s, enemy); assert.equal(run.impacts, 3); assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 200);
  timers[0].callback(); assert.equal(run.impacts, 3); assert.equal(anchor.paint, 56);
  assert.equal(enemy.hp, 944);
});

test('fixture-only and enemy-only accepted hits both advance progression exactly once', t => {
  for (const kind of ['fixture', 'enemy']) {
    const { s, run, zone, enemies } = fixture(t);
    if (kind === 'fixture') zone.devices = [device(100, 200)];
    else enemies.push({ x: 100, y: 200, hp: 1000, maxHp: 1000, active: true, publicStage1EnemyRole: 'unlit-chaser' });
    detonate(s); assert.equal(run.impacts, 1, kind);
  }
});

test('540 build/preparation combinations reach real five-person action and recovery consumers', t => {
  let cases = 0;
  for (const id of ['sakura', 'kai', 'venus', 'genya', 'enjo'])
    for (const first of ['wide_brush', 'relay', 'tempo'])
      for (const second of ['echo', 'overdrive', 'recovery'])
        for (const trainingLevel of [1, 2, 3])
          for (const equipmentId of [null, 'wide_nozzle', 'rhythm_sync', 'focus_lens']) {
            const { s, run, zone, timers } = fixture(t, id, { version: 1, performerId: id, trainingLevel, equipmentId });
            run.growth.choose(first); run.growth.choose(second);
            const expectedPower = (1 + (trainingLevel - 1) * .1) * (equipmentId === 'focus_lens' ? 1.15 : 1) * (second === 'overdrive' ? 1.5 : 1);
            const expectedRadius = (first === 'wide_brush' ? 40 : 0) + (equipmentId === 'wide_nozzle' ? 12 : 0);
            const expectedCharge = (first === 'tempo' ? 1.5 : 1) * (equipmentId === 'rhythm_sync' ? 1.15 : 1);
            assert.equal(run.effects().paintRadiusBonus, expectedRadius);
            assert.ok(Math.abs(run.effects().actionPower - expectedPower) < 1e-10);
            s._specialCharge = 0; s._awardPublicSakuraActionCharge('required-anchor');
            assert.ok(Math.abs(s._specialCharge - 22 * expectedCharge) < 1e-10);
            assert.equal(s._encoreCharge, 8); s._specialCharge = 100;
            const anchor = device(100, 160); zone.devices = [anchor];
            assert.equal(run.triggerAction(), true, id);
            if (id === 'sakura') { s.time.now += 500; run.sakuraCombat.update(); }
            if (id === 'genya') timers.forEach(timer => timer.callback());
            const base = { sakura: 18, kai: 20, venus: 42, genya: 66, enjo: 52 }[id];
            assert.ok(Math.abs(anchor.paint - base * expectedPower) < 1e-9, `${id} actual paint ${anchor.paint}`);
            assert.equal(s._specialCharge, 0); assert.equal(run.actions, 1);
            assert.equal(s.player.invulnerable, false);
            run.onAnchor(); assert.equal(s.player.hp, second === 'recovery' ? 4 : 3);
            assert.equal(s._encoreCharge, 8);
            run.destroy(); cases++;
          }
  assert.equal(cases, 540);
});

test('three-station cadence advances by actual objectives and waits for authored role resolution', () => {
  const expected = { opening: ['stage-cue-emitter', 'objective-disruptor', 'spotlight-captain'],
    neon: ['objective-disruptor', 'stage-cue-emitter', 'spotlight-captain'],
    encore: ['stage-cue-emitter', 'spotlight-captain', 'objective-disruptor'],
    raincheck: ['stage-cue-emitter', 'objective-disruptor', 'spotlight-captain'],
    homecoming: ['stage-cue-emitter', 'objective-disruptor', 'spotlight-captain'] };
  assert.deepEqual(Object.keys(expected), PUBLIC_CHAPTERS.map(chapter => chapter.id), 'each shipped chapter needs an explicit cadence expectation');
  for (const chapter of PUBLIC_CHAPTERS) {
    const director = new PublicStage1EncounterDirector({ stageId: 1, campaignChapterId: chapter.id });
    director.begin({ now: 0 });
    const initial = director.advance(200000, { completed: 0, total: 10 });
    assert.equal(initial.phaseId, 'opening-light-check', 'elapsed time alone cannot advance objective phases');
    for (const [completed, index] of [[2, 0], [5, 1], [8, 2]]) {
      const snapshot = director.advance(200010 + index, { completed, total: 10 });
      assert.deepEqual(director.getPendingAuthoredRoles(), [expected[chapter.id][index]]);
      assert.equal(director.beginAuthoredRole(expected[chapter.id][index]), true);
      assert.equal(director.beginAuthoredRole(expected[chapter.id][index]), false);
      assert.equal(director.canEnterFinale(), false);
      assert.equal(director.resolveAuthoredRole(expected[chapter.id][index], 'encounter-complete'), true);
      assert.equal(snapshot.cadence.unlitMax, [3, 4, 4][index]);
    }
    director.advance(200020, { completed: 10, total: 10 });
    assert.equal(director.canEnterFinale(), true);
    director.reset(); assert.equal(director.canEnterFinale(), false);
  }
});
