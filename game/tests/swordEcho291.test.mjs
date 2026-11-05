import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SwordEcho,
  SWORD_ECHO_WINDUP_MS,
  SWORD_ECHO_SWEEP_MS,
  SWORD_ECHO_FADE_MS,
  SWORD_ECHO_RADIUS,
  SWORD_ECHO_HALF_ANGLE,
} from '../src/utils/swordEcho291.mjs';
import {SwordEchoField, SWORD_ECHO_ART, SWORD_ECHO_ART_MAX_ALPHA} from '../src/systems/SwordEchoField291.mjs';

const clear = () => true;
const near = (actual, expected, label = 'value') =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
const polar = (degrees, radius, base = 0) => {
  const a = base + degrees * Math.PI / 180;
  return {x: Math.cos(a) * radius, y: Math.sin(a) * radius};
};
const wave = (over = {}) => new SwordEcho({x: 0, y: 0, angle: 0, color: 'pink', start: 0, ...over});

// ---------------------------------------------------------------- pure model

test('contract constants are explicit', () => {
  assert.equal(SWORD_ECHO_WINDUP_MS, 200);
  assert.equal(SWORD_ECHO_SWEEP_MS, 180);
  assert.equal(SWORD_ECHO_FADE_MS, 140);
  assert.equal(SWORD_ECHO_RADIUS, 125);
  assert.equal(SWORD_ECHO_HALF_ANGLE, Math.PI * 7 / 18);
});

test('sample is null outside 200..520 and reverses from +half to -half', () => {
  const w = wave({angle: .5, start: 1000}), half = SWORD_ECHO_HALF_ANGLE;
  assert.equal(w.sample(1199), null);
  const first = w.sample(1200);
  assert.equal(first.progress, 0);
  assert.equal(first.alpha, 1);
  near(first.startAngle, .5 + half);
  near(first.endAngle, .5 + half);
  assert.equal(first.radius, 125);
  assert.equal(first.innerRadius, 0);
  const middle = w.sample(1290);
  near(middle.progress, .5);
  near(middle.endAngle, .5);
  near(middle.startAngle, .5 + half, 'start angle never moves');
  const swept = w.sample(1380);
  assert.equal(swept.progress, 1);
  assert.equal(swept.alpha, 1);
  near(swept.endAngle, .5 - half);
  near(w.sample(1450).alpha, .5);
  assert.equal(w.sample(1450).progress, 1);
  assert.equal(w.sample(1520).alpha, 0);
  assert.equal(w.sample(1521), null);
});

test('origin and angle are frozen copies of the source snapshot', () => {
  const source = {x: 10, y: 20, angle: .25, color: 'pink', start: 0}, w = new SwordEcho(source);
  source.x = 900; source.y = 900; source.angle = 3;
  assert.deepEqual({...w.origin}, {x: 10, y: 20});
  assert.equal(w.angle, .25);
  assert.throws(() => { w.origin.x = 1; }, TypeError);
  assert.throws(() => { w.angle = 1; }, TypeError);
  const target = {x: 60, y: 20};
  assert.deepEqual(w.collect(380, [target], clear), [target]);
});

test('forward targets are hit as the front reaches them, in reverse angular order, once', () => {
  const first = polar(60, 100), second = polar(-60, 100), w = wave();
  assert.deepEqual(w.collect(199, [first, second], clear), []);
  assert.deepEqual(w.collect(290, [first, second], clear), [first]);
  assert.deepEqual(w.collect(380, [first, second], clear), [second]);
  assert.deepEqual(w.collect(380, [first, second], clear), []);
});

test('a target appearing behind the front gets no retroactive hit', () => {
  const w = wave(), behind = polar(30, 100);
  w.collect(290, [], clear);
  assert.deepEqual(w.collect(300, [behind], clear), []);
  assert.deepEqual(w.collect(380, [behind], clear), []);
});

test('outside radius or sector is never hit, boundaries are inclusive', () => {
  const outside = [polar(71, 100), polar(-71, 100), polar(180, 100), {x: 125.01, y: 0}];
  assert.deepEqual(wave().collect(520, outside, clear), []);
  const edge = {x: 125, y: 0};
  assert.deepEqual(wave().collect(520, [edge], clear), [edge]);
  const startEdge = polar(70, 124.9), endEdge = polar(-70, 124.9), w = wave();
  assert.deepEqual(w.collect(200, [startEdge, endEdge], clear), [startEdge]);
  assert.deepEqual(w.collect(379, [startEdge, endEdge], clear), []);
  assert.deepEqual(w.collect(380, [startEdge, endEdge], clear), [endEdge]);
});

test('sector rule normalizes across the +-PI seam', () => {
  const inside = polar(.1 * 180 / Math.PI, 100, Math.PI), opposite = {x: 100, y: 0};
  assert.deepEqual(wave({angle: Math.PI}).collect(380, [inside, opposite], clear), [inside]);
});

test('a target standing exactly on the origin resolves at the sector center', () => {
  const w = wave({x: 5, y: 6, angle: 2}), target = {x: 5, y: 6};
  assert.deepEqual(w.collect(289, [target], clear), []);
  assert.deepEqual(w.collect(290, [target], clear), [target]);
});

test('walls use the frozen origin and a blocked pass is not retried behind the front', () => {
  const blocked = polar(60, 100), w = wave();
  assert.deepEqual(w.collect(290, [blocked], (from, to) => {
    assert.equal(from, w.origin);
    assert.equal(to, blocked);
    return false;
  }), []);
  assert.deepEqual(w.collect(300, [blocked], clear), []);
});

test('moving target: crossing the front counts, outrunning it delays, walking in behind does not', () => {
  const crossing = polar(-30, 100), w1 = wave();
  assert.deepEqual(w1.collect(290, [crossing], clear), []);
  Object.assign(crossing, polar(30, 100));
  assert.deepEqual(w1.collect(300, [crossing], clear), [crossing]);
  assert.deepEqual(w1.collect(380, [crossing], clear), []);

  const runner = polar(-10, 100), w2 = wave();
  assert.deepEqual(w2.collect(290, [runner], clear), []);
  Object.assign(runner, polar(-40, 100));
  assert.deepEqual(w2.collect(340, [runner], clear), []);
  assert.deepEqual(w2.collect(380, [runner], clear), [runner]);

  const walker = polar(30, 200), w3 = wave();
  assert.deepEqual(w3.collect(290, [walker], clear), []);
  Object.assign(walker, polar(30, 100));
  assert.deepEqual(w3.collect(300, [walker], clear), []);
});

test('a long frame resolves the whole remaining interval exactly once', () => {
  const a = polar(60, 100), b = polar(-60, 100), out = polar(90, 100), whole = wave();
  assert.deepEqual(whole.collect(900, [a, b, out], clear), [a, b]);
  assert.deepEqual(whole.collect(901, [a, b, out], clear), []);
  assert.equal(whole.sample(900), null);

  const partial = wave();
  assert.deepEqual(partial.collect(290, [a], clear), [a]);
  assert.deepEqual(partial.collect(900, [a, b], clear), [b]);
});

test('a paused run clock adapter freezes sweep and resumes it without loss', () => {
  const clock = {
    time: 290, pausedAt: null, pausedMs: 0,
    now() { return (this.pausedAt ?? this.time) - this.pausedMs; },
    pause() { this.pausedAt = this.time; },
    resume() { this.pausedMs += this.time - this.pausedAt; this.pausedAt = null; },
  };
  const a = polar(60, 100), b = polar(-60, 100), w = wave();
  assert.deepEqual(w.collect(clock.now(), [a, b], clear), [a]);
  clock.pause();
  clock.time = 5000;
  assert.deepEqual(w.collect(clock.now(), [a, b], clear), []);
  near(w.sample(clock.now()).progress, .5);
  clock.resume();
  assert.deepEqual(w.collect(clock.now(), [a, b], clear), []);
  clock.time = 5090;
  assert.deepEqual(w.collect(clock.now(), [a, b], clear), [b]);
});

test('clock regression cannot rewind the front', () => {
  const a = polar(60, 100), w = wave();
  w.collect(380, [], clear);
  assert.deepEqual(w.collect(250, [a], clear), []);
});

test('expiration: once the front finalized, nothing can be hit during or after fade', () => {
  const w = wave(), late = polar(-60, 100);
  w.collect(380, [], clear);
  for (const now of [400, 520, 600]) assert.deepEqual(w.collect(now, [late], clear), []);
});

test('destroy disables the model and is idempotent', () => {
  const w = wave(), a = polar(60, 100);
  w.collect(250, [a], clear);
  w.destroy();
  w.destroy();
  assert.equal(w.sample(300), null);
  assert.deepEqual(w.collect(380, [a], clear), []);
});

// ---------------------------------------------------------------- field

function harness({texture = true, clearLine = clear} = {}) {
  const log = {images: [], graphics: [], masks: [], hits: [], fixtures: [], fans: []};
  const scene = {
    _battlePaused: false,
    _publicBattleDialog: null,
    get time() { throw new Error('field must not use scene timers'); },
    textures: {exists: key => texture && key === SWORD_ECHO_ART.key},
    add: {image(x, y, key) {
      const image = {x, y, key, destroyed: false,
        setDepth(v) { this.depth = v; return this; },
        setRotation(v) { this.rotation = v; return this; },
        setFrame(v) { this.frame = v; return this; },
        setTint(v) { this.tint = v; return this; },
        setDisplaySize(w, h) { this.size = [w, h]; return this; },
        setAlpha(v) { this.alpha = v; return this; },
        setMask(v) { this.mask = v; this.maskSets = (this.maskSets || 0) + 1; return this; },
        destroy() { this.destroyed = true; }};
      log.images.push(image);
      return image;
    }},
    make: {graphics(options) {
      assert.deepEqual(options, {add: false});
      const graphic = {style: false, points: null, fills: 0, destroyed: false,
        // Phaser's clear() also empties queued fill style commands.
        clear() { this.style = false; this.points = null; return this; },
        fillStyle() { this.style = true; return this; },
        fillPoints(points, close) {
          assert.equal(this.style, true, 'fill style must follow clear()');
          assert.equal(close, true);
          this.points = points; this.fills++;
          return this;
        },
        createGeometryMask() {
          const mask = {destroyed: false, destroy() { this.destroyed = true; }};
          log.masks.push(mask);
          return mask;
        },
        destroy() { this.destroyed = true; }};
      log.graphics.push(graphic);
      return graphic;
    }},
    enemies: {list: [], getChildren() { return this.list; }},
    paintZone: {
      devices: [], currentZone: 0, finaleMode: false,
      canReceivePaint: device => device.receive !== false,
      applyPaint(device, amount, color) { log.fixtures.push([device, amount, color]); return true; },
      paintAttackFan(fan) { if (scene._battlePaused) return false; log.fans.push(fan); return true; },
    },
    oldStreet: {clearLine: clearLine},
    _paintPublicStage1TargetsAt(...args) { log.hits.push(args); return true; },
  };
  const run = {scene, living: true, choiceEffects: {echo: 0},
    meleeCombat: {radius: () => 0},
    alive() { return this.living; },
    onImpact() { throw new Error('echo must never recurse into onImpact'); }};
  return {scene, run, log, field: new SwordEchoField(run)};
}
const chaser = position => ({...position, active: true, publicStage1EnemyRole: 'unlit-chaser'});
const release = {x: 0, y: 0, angle: 0, color: 'pink', start: 0};

test('art contract keeps the Codex-loaded asset identity', () => {
  assert.equal(SWORD_ECHO_ART.key, 'kai-sword-sequence-292');
  assert.equal(SWORD_ECHO_ART.path, 'art/kai-sword-sequence-292/slash.webp');
});

test('missing required texture throws at queue, before any wave exists', () => {
  const {field, run, log} = harness({texture: false});
  assert.throws(() => field.queue(release), /texture/i);
  assert.equal(field.rows.length, 0);
  field.update(300);
  assert.equal(run.choiceEffects.echo, 0);
  assert.equal(log.images.length, 0);
});

test('windup shows authored charge only, with no ground, hit or release count', () => {
  const {field, scene, run, log} = harness();
  scene.enemies.list = [chaser(polar(60, 100))];
  field.queue(release);
  field.update(0);
  field.update(199);
  assert.equal(log.images.length, 1);
  assert.equal(log.images[0].frame, 0);
  assert.equal(log.graphics.length, 0);
  assert.equal(log.fans.length, 0);
  assert.equal(log.hits.length, 0);
  assert.equal(run.choiceEffects.echo, 0);
});

test('release counts echo once even with no targets, never per hit or frame', () => {
  const {field, run} = harness();
  field.queue(release);
  for (const now of [200, 250, 380, 450, 520, 600]) field.update(now);
  assert.equal(run.choiceEffects.echo, 1);
});

test('eligible enemy and fixture receive 14 once through their existing owners', () => {
  const {field, scene, log} = harness();
  const enemy = chaser(polar(60, 100)), device = {...polar(-60, 100), zone: 0, complete: false};
  scene.enemies.list = [enemy];
  scene.paintZone.devices = [device];
  field.queue(release);
  for (const now of [200, 290, 380, 450]) field.update(now);
  assert.deepEqual(log.hits, [[enemy.x, enemy.y, 14, 1, 'pink', enemy]]);
  assert.deepEqual(log.fixtures, [[device, 14, 'pink']]);
});

test('ineligible enemies and fixtures use the ground echo filters', () => {
  const {field, scene, log} = harness();
  const at = polar(0, 100);
  scene.enemies.list = [
    {...chaser(at), active: false},
    {...at, active: true, publicStage1EnemyRole: 'spotlight-captain', publicStage1EnemyState: 'windup'},
    {...at, active: true, publicStage1EnemyRole: 'finale-boss', publicStage1EnemyState: 'windup'},
  ];
  scene.paintZone.devices = [
    {...at, zone: 0, complete: true},
    {...at, zone: 1, complete: false},
    {...at, zone: 0, complete: false, receive: false},
  ];
  field.queue(release);
  field.update(380);
  assert.equal(log.hits.length, 0);
  assert.equal(log.fixtures.length, 0);

  const finale = harness();
  finale.scene.paintZone.finaleMode = true;
  finale.scene.paintZone.devices = [{...at, zone: 0, complete: false}];
  finale.field.queue(release);
  finale.field.update(380);
  assert.equal(finale.log.fixtures.length, 0);
});

test('a target deactivated by an earlier hit in the same update is skipped', () => {
  const {field, scene, log} = harness();
  const first = chaser(polar(60, 100)), second = chaser(polar(50, 100));
  scene.enemies.list = [first, second];
  scene._paintPublicStage1TargetsAt = (...args) => { log.hits.push(args); second.active = false; return true; };
  field.queue(release);
  field.update(380);
  assert.deepEqual(log.hits.map(args => args[5]), [first]);
});

test('walls block enemy paint and clip the visual mask', () => {
  const {field, scene, log} = harness({clearLine: (a, b) => b.x <= 60});
  scene.enemies.list = [chaser({x: 100, y: 0})];
  field.queue(release);
  field.update(378);
  assert.equal(log.hits.length, 0);
  const points = log.graphics[0].points;
  assert.ok(points.every(point => point.x <= 60));
  assert.ok(points.length > 2);
});

test('ground bands are adjacent incremental segments covering the full reverse sweep', () => {
  const {field, log} = harness();
  const half = SWORD_ECHO_HALF_ANGLE;
  field.queue(release);
  for (const now of [199, 200, 245, 290, 380, 450, 519]) field.update(now);
  assert.equal(log.fans.length, 3, 'no zero-width band at 200 and none during fade');
  for (const fan of log.fans) {
    assert.equal(fan.x, 0);
    assert.equal(fan.y, 0);
    assert.equal(fan.color, 'pink');
    assert.equal(fan.radius, 125);
    assert.equal(fan.innerRadius, 0);
    assert.equal(fan.solidFootprint, true);
    assert.equal(fan.sweep, undefined);
  }
  near(log.fans[0].angle + log.fans[0].halfAngle, half, 'starts at +half');
  near(log.fans[0].angle - log.fans[0].halfAngle, log.fans[1].angle + log.fans[1].halfAngle, 'adjacent');
  near(log.fans[1].angle - log.fans[1].halfAngle, log.fans[2].angle + log.fans[2].halfAngle, 'adjacent');
  near(log.fans[2].angle - log.fans[2].halfAngle, -half, 'ends at -half');
});

test('long frame past expiry still resolves hits and one full band, without any image', () => {
  const {field, scene, run, log} = harness();
  const enemy = chaser(polar(-60, 100));
  scene.enemies.list = [enemy];
  field.queue(release);
  field.update(900);
  assert.equal(run.choiceEffects.echo, 1);
  assert.equal(log.hits.length, 1);
  assert.equal(log.fans.length, 1);
  near(log.fans[0].angle, 0);
  near(log.fans[0].halfAngle, SWORD_ECHO_HALF_ANGLE);
  assert.equal(log.images.length, 0);
  assert.equal(log.graphics.length, 0);
  assert.equal(field.rows.length, 0);
  field.update(901);
  assert.equal(log.hits.length, 1);
});

test('image is fixed at world origin, 250 square, locked rotation, above actors', () => {
  const {field, log} = harness();
  field.queue({...release, x: 40, y: 50, angle: .75});
  field.update(250);
  field.update(300);
  const [image] = log.images;
  assert.equal(log.images.length, 1);
  assert.equal(image.key, SWORD_ECHO_ART.key);
  assert.deepEqual([image.x, image.y], [40, 50]);
  assert.deepEqual(image.size, [250, 250]);
  assert.equal(image.rotation, .75);
  assert.equal(image.depth, 9.8);
  assert.equal(log.masks.length, 0, 'open ground needs no stencil reveal');
  assert.equal(image.frame, 2);
});

test('forward wall mask is built once with 49 rays plus apex; authored frames provide motion', () => {
  const {field, log} = harness({clearLine:(a,b)=>b.x<=60});
  field.queue(release);
  field.update(200);
  const clip = log.graphics[0];
  const firstPoints=clip.points;
  for (const now of [210, 250, 290, 340, 378]) {
    field.update(now);
    assert.equal(clip.points,firstPoints);
    assert.equal(clip.points.length,50);
    assert(clip.points.every(p=>p.x<=60));
  }
  assert.equal(log.graphics.length, 1);
  assert.equal(log.masks.length, 1);
  field.update(380);
  const fills = clip.fills;
  field.update(450);
  assert.equal(clip.fills, fills, 'fade reuses the finished mask');
  assert.equal(clip.points.length,50);
});

test('a wall behind the authored forward half-plane does not allocate a mask', () => {
  const {field,log}=harness({clearLine:(a,b)=>b.x>=-1});
  field.queue(release);field.update(290);
  assert.equal(log.masks.length,0);
  assert.equal(field.rows[0].rays.length,49);
});

test('field passes actual body radii to the model, capped at16', () => {
  const {field,run,scene,log}=harness();
  const edge=chaser({x:135,y:0}),beyond=chaser({x:142,y:0});
  scene.enemies.list=[edge,beyond];run.meleeCombat.radius=()=>48;
  field.queue(release);field.update(380);field.update(530);
  assert.deepEqual(log.hits.map(h=>h[5]),[edge]);
});

test('a dialog opened by the first contact preserves the atomic target batch and deferred ground', () => {
  const {field,scene,log}=harness();
  const first=chaser(polar(60,100)),second=chaser(polar(50,100));
  const fixture={...polar(40,100),zone:0,complete:false};
  scene.enemies.list=[first,second];scene.paintZone.devices=[fixture];
  scene._paintPublicStage1TargetsAt=(...args)=>{log.hits.push(args);scene._publicBattleDialog={};return true;};
  field.queue(release);field.update(290);
  assert.deepEqual(log.hits.map(h=>h[5]),[first,second]);
  assert.equal(log.fixtures.length,1);assert.equal(log.fans.length,0);
  scene._publicBattleDialog=null;field.update(300);
  assert.equal(log.hits.length,2);assert.equal(log.fixtures.length,1);assert.equal(log.fans.length,1);
});

test('art alpha is bounded and fades after the sweep, then everything is destroyed', () => {
  const {field, log} = harness({clearLine:(a,b)=>b.x<=60});
  field.queue(release);
  field.update(300);
  const [image] = log.images, [clip] = log.graphics, [mask] = log.masks;
  assert.equal(image.alpha, SWORD_ECHO_ART_MAX_ALPHA);
  assert.ok(SWORD_ECHO_ART_MAX_ALPHA < 1);
  field.update(380);
  assert.equal(image.alpha, SWORD_ECHO_ART_MAX_ALPHA);
  field.update(530);
  near(image.alpha, SWORD_ECHO_ART_MAX_ALPHA / 2);
  assert.equal(image.destroyed, false);
  field.update(640);
  assert.deepEqual([image.destroyed, clip.destroyed, mask.destroyed], [true, true, true]);
  assert.equal(field.rows.length, 0);
});

for (const [name, block] of [
  ['pause', scene => { scene._battlePaused = true; }],
  ['dialog', scene => { scene._publicBattleDialog = {}; }],
]) {
  test(`${name} freezes all effects, resume continues without loss`, () => {
    const {field, scene, run, log} = harness();
    const enemy = chaser(polar(-60, 100));
    scene.enemies.list = [enemy];
    field.queue(release);
    block(scene);
    field.update(600);
    assert.equal(run.choiceEffects.echo, 0);
    assert.equal(log.hits.length + log.fans.length + log.images.length, 0);
    assert.equal(field.rows.length, 1);
    scene._battlePaused = false;
    scene._publicBattleDialog = null;
    field.update(290);
    assert.equal(run.choiceEffects.echo, 1);
    assert.equal(log.fans.length, 1);
    assert.equal(log.hits.length, 0);
    field.update(380);
    assert.equal(log.hits.length, 1);
  });
}

test('a pause raised by a hit does not lose that frame ground band', () => {
  const {field, scene, log} = harness();
  scene.enemies.list = [chaser(polar(60, 100))];
  scene._paintPublicStage1TargetsAt = () => { scene._battlePaused = true; return true; };
  field.queue(release);
  field.update(290);
  assert.equal(log.fans.length, 0);
  assert.equal(log.images.length, 0);
  scene._battlePaused = false;
  field.update(300);
  assert.equal(log.fans.length, 1);
  near(log.fans[0].angle + log.fans[0].halfAngle, SWORD_ECHO_HALF_ANGLE, 'band starts at the unpainted edge');
});

test('dead run destroys every wave without further effects', () => {
  const {field, scene, run, log} = harness({clearLine:(a,b)=>b.x<=60});
  scene.enemies.list = [chaser(polar(-60, 100))];
  field.queue(release);
  field.update(250);
  const fans = log.fans.length;
  run.living = false;
  field.update(380);
  assert.equal(log.hits.length, 0);
  assert.equal(log.fans.length, fans);
  assert.equal(log.images[0].destroyed, true);
  assert.equal(log.graphics[0].destroyed, true);
  assert.equal(log.masks[0].destroyed, true);
  assert.equal(field.rows.length, 0);
});

test('a hit that settles the run stops remaining hits, band and render', () => {
  const {field, scene, run, log} = harness();
  scene.enemies.list = [chaser(polar(60, 100)), chaser(polar(50, 100))];
  scene._paintPublicStage1TargetsAt = (...args) => { log.hits.push(args); run.living = false; return true; };
  field.queue(release);
  field.update(380);
  assert.equal(log.hits.length, 1);
  assert.equal(log.fans.length, 0);
  assert.equal(log.images.length, 0);
  assert.equal(field.rows.length, 0);
});

test('destroy during windup or sweep is complete and idempotent; waves own separate masks', () => {
  const {field, log} = harness({clearLine:(a,b)=>b.x<=60});
  field.queue(release);
  field.queue({...release, start: 50});
  field.update(260);
  assert.equal(log.images.length, 2);
  assert.equal(log.graphics.length, 2);
  assert.equal(log.masks.length, 2);
  field.queue({...release, start: 250});
  field.destroy();
  field.destroy();
  for (const row of [...log.images, ...log.graphics, ...log.masks]) assert.equal(row.destroyed, true);
  assert.equal(field.rows.length, 0);
  field.update(600);
  assert.equal(log.images.length, 2);
});

test('queue snapshot cannot be changed by later source or player movement', () => {
  const {field, scene, log} = harness();
  const source = {...release}, enemy = chaser(polar(60, 100));
  scene.enemies.list = [enemy];
  field.queue(source);
  source.x = 900; source.y = 900; source.angle = Math.PI;
  field.update(290);
  assert.deepEqual(log.hits.map(args => args[5]), [enemy]);
  assert.deepEqual([log.images[0].x, log.images[0].y, log.images[0].rotation], [0, 0, 0]);
});
