import test from 'node:test';
import assert from 'node:assert/strict';
import { GroundEcho } from '../src/utils/groundEcho278.mjs';

// Radius checkpoints for start=0: t=200 -> 0, t=305 -> 37.5, t=410 -> 75, t=515 -> 112.5, t=620 -> 150.
const clear = () => true;
const wave = (over = {}) => new GroundEcho({ x: 0, y: 0, color: 'orange', start: 0, ...over });

test('sample reports color, origin, linear radius, progress and alpha', () => {
  const w = wave({ x: 10, y: 20, color: 0xff8800, start: 1000 });
  assert.equal(w.end, 1620);
  const first = w.sample(1200);
  assert.deepEqual(
    { x: first.x, y: first.y, color: first.color, radius: first.radius, progress: first.progress, alpha: first.alpha },
    { x: 10, y: 20, color: 0xff8800, radius: 0, progress: 0, alpha: 1 },
  );
  const quarter = w.sample(1305);
  assert.equal(quarter.radius, 37.5);
  assert.equal(quarter.progress, 0.25);
  assert.ok(Math.abs(quarter.alpha - 0.95) < 1e-12);
  const last = w.sample(1620);
  assert.equal(last.progress, 1);
  assert.ok(Math.abs(last.alpha - 0.8) < 1e-12);
});

test('public fields are immutable', () => {
  const w = wave();
  assert.throws(() => { w.origin.x = 9; }, TypeError);
  assert.throws(() => { w.origin = { x: 9, y: 9 }; }, TypeError);
  assert.throws(() => { w.color = 'blue'; }, TypeError);
  assert.throws(() => { w.start = 9; }, TypeError);
  assert.throws(() => { w.end = 9; }, TypeError);
});

test('sample and collect do not advance each other', () => {
  const a = { x: 100, y: 0 }, w = wave();
  w.sample(620);
  assert.deepEqual(w.collect(620, [a], clear), [a]);
  assert.equal(w.sample(620).radius, 150);
  assert.equal(w.sample(410).radius, 75);
});

test('collect before windup does not advance or query the line', () => {
  const center = { x: 0, y: 0 }, w = wave();
  let calls = 0;
  assert.deepEqual(w.collect(0, [center], () => { calls++; return true; }), []);
  assert.deepEqual(w.collect(199.999, [center], () => { calls++; return true; }), []);
  assert.equal(calls, 0);
  assert.deepEqual(w.collect(200, [center], clear), [center]);
});

test('repeated timestamps do not repeat or widen a sweep', () => {
  const a = { x: 37, y: 0 }, unseen = { x: 30, y: 0 }, w = wave();
  let calls = 0;
  assert.deepEqual(w.collect(305, [a], clear), [a]);
  assert.deepEqual(w.collect(305, [a, unseen], () => { calls++; return true; }), []);
  assert.equal(calls, 0);
});

test('a clock moving backwards cannot rewind the swept radius', () => {
  const a = { x: 50, y: 0 }, far = { x: 90, y: 0 }, w = wave();
  assert.deepEqual(w.collect(410, [], clear), []);
  assert.deepEqual(w.collect(305, [a], clear), []);
  assert.deepEqual(w.collect(410, [a], clear), []);
  assert.deepEqual(w.collect(515, [a, far], clear), [far]);
});

test('exact outer edge is hit in that sweep and excluded from the next', () => {
  const edge = { x: 75, y: 0 }, w = wave();
  assert.deepEqual(w.collect(410, [edge], clear), [edge]);
  const other = { x: 75, y: 0 };
  assert.deepEqual(w.collect(515, [other], clear), []);
});

test('exact final radius is hit, including off-axis, and beyond it never is', () => {
  const axis = { x: 160, y: 20 }, diagonal = { x: 100, y: 140 }, beyond = { x: 160.001, y: 20 };
  const w = wave({ x: 10, y: 20 });
  assert.deepEqual(w.collect(620, [axis, diagonal, beyond], clear), [axis, diagonal]);
  assert.deepEqual(w.collect(5000, [beyond], clear), []);
});

test('final radius and windup boundary hold on fractional clocks', () => {
  for (const start of [0.1, 16.7, 1000.1, 123456.789]) {
    const edge = { x: 150, y: 0 }, w = wave({ start });
    assert.equal(w.sample(w.end).radius, 150);
    assert.equal(w.sample(w.end).progress, 1);
    assert.ok(w.sample(start + 200).radius >= 0);
    assert.deepEqual(w.collect(w.end, [edge], clear), [edge]);
  }
});

test('zero-distance center is hit by the first sweep only', () => {
  const first = { x: 5, y: 7 }, second = { x: 5, y: 7 }, w = wave({ x: 5, y: 7 });
  assert.deepEqual(w.collect(200, [first], clear), [first]);
  assert.deepEqual(w.collect(300, [first, second], clear), []);

  const late = { x: 0, y: 0 };
  assert.deepEqual(wave().collect(450, [late], clear), [late]);
});

test('a sweep at radius zero spends the center', () => {
  const w = wave(), center = { x: 0, y: 0 };
  assert.deepEqual(w.collect(200, [], clear), []);
  assert.deepEqual(w.collect(620, [center], clear), []);
});

test('clearLine gets the origin and target, only for targets in the band', () => {
  const near = { x: 10, y: 0 }, inBand = { x: 40, y: 0 }, outside = { x: 120, y: 0 }, w = wave();
  const calls = [];
  w.collect(250, [near], clear);
  const result = w.collect(350, [near, inBand, outside], (origin, target) => {
    calls.push([origin, target]);
    return true;
  });
  assert.deepEqual(result, [inBand]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], w.origin);
  assert.equal(calls[0][1], inBand);
});

test('blocked targets are filtered per target and keep input order', () => {
  const a = { x: 10, y: 0 }, wall = { x: 20, y: 0 }, b = { x: 30, y: 0 }, w = wave();
  assert.deepEqual(w.collect(620, [b, wall, a], (_, t) => t !== wall), [b, a]);
});

test('a stationary blocked target is not retried once the wave has passed', () => {
  const a = { x: 40, y: 0 }, w = wave();
  assert.deepEqual(w.collect(350, [a], () => false), []);
  assert.deepEqual(w.collect(620, [a], clear), []);
});

test('a blocked target is not spent and can be hit if the wave catches it again', () => {
  const a = { x: 40, y: 0 }, w = wave();
  assert.deepEqual(w.collect(350, [a], () => false), []);
  a.x = 100;
  assert.deepEqual(w.collect(620, [a], clear), [a]);
});

test('deduplication uses object identity', () => {
  const a = { x: 40, y: 0 }, twin = { x: 40, y: 0 }, w = wave();
  const result = w.collect(350, [a, a, twin], clear);
  assert.equal(result.length, 2);
  assert.equal(result[0], a);
  assert.equal(result[1], twin);
});

test('a hit target moving ahead of the wave is not hit again', () => {
  const a = { x: 40, y: 0 }, w = wave();
  assert.deepEqual(w.collect(350, [a], clear), [a]);
  a.x = 100;
  assert.deepEqual(w.collect(620, [a], clear), []);
});

test('late first collect covers center through edge once', () => {
  const center = { x: 0, y: 0 }, middle = { x: 80, y: 0 }, edge = { x: 150, y: 0 }, w = wave();
  assert.deepEqual(w.collect(10000, [center, middle, edge], clear), [center, middle, edge]);
  assert.deepEqual(w.collect(10000, [center, middle, edge], clear), []);
  assert.deepEqual(w.collect(10001, [{ x: 10, y: 0 }], clear), []);
  assert.equal(w.sample(10000), null);
});

test('late collect after a partial sweep processes only the remaining interval', () => {
  const inner = { x: 30, y: 0 }, outer = { x: 100, y: 0 }, w = wave();
  assert.deepEqual(w.collect(305, [], clear), []);
  assert.deepEqual(w.collect(900, [inner, outer], clear), [outer]);
});

test('a late sweep still respects blocked targets', () => {
  const a = { x: 149, y: 0 }, w = wave();
  assert.deepEqual(w.collect(900, [a], () => false), []);
  assert.deepEqual(w.collect(901, [a], clear), []);
});

test('no retrigger after completion, for old or new targets', () => {
  const w = wave();
  assert.deepEqual(w.collect(620, [], clear), []);
  assert.deepEqual(w.collect(621, [{ x: 149, y: 0 }], clear), []);
  assert.deepEqual(w.collect(620, [{ x: 150, y: 0 }], clear), []);
});

test('destroy before windup or mid-wave stops sample, collect and clearLine', () => {
  for (const before of [0, 350]) {
    const w = wave();
    w.collect(before, [], clear);
    w.destroy();
    assert.equal(w.sample(400), null);
    let calls = 0;
    assert.deepEqual(w.collect(900, [{ x: 149, y: 0 }], () => { calls++; return true; }), []);
    assert.equal(calls, 0);
  }
});

test('inputs are not mutated and results are a new array', () => {
  const a = Object.freeze({ x: 40, y: 0 }), b = Object.freeze({ x: 120, y: 0 });
  const targets = Object.freeze([a, b]);
  const config = Object.freeze({ x: 0, y: 0, color: 'orange', start: 0 });
  const w = new GroundEcho(config);
  const result = w.collect(350, targets, clear);
  assert.notEqual(result, targets);
  assert.equal(result[0], a);
  assert.deepEqual(targets, [{ x: 40, y: 0 }, { x: 120, y: 0 }]);
  assert.deepEqual(config, { x: 0, y: 0, color: 'orange', start: 0 });
  assert.deepEqual(w.origin, { x: 0, y: 0 });
});

// Pins the specified behavior, not a desirable one. See finding F2 in
// CLAUDE-FINDINGS.md. Update this test if the crossing rule is changed.
test('F2 fixed: target walking through the ring between sweeps is hit once', () => {
  const a = { x: 80, y: 0 }, w = wave();
  assert.deepEqual(w.collect(410, [a], clear), []); // outside the ring: 80 > 75
  a.x = 70;
  assert.deepEqual(w.collect(431, [a], clear), [a]); // crossed the moving front
  assert.deepEqual(w.collect(620, [a], clear), []);
});
