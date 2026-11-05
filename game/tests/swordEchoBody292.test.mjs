import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SwordEcho,
  SWORD_ECHO_BODY_PAD_CAP,
  SWORD_ECHO_RADIUS,
  SWORD_ECHO_HALF_ANGLE,
} from '../src/utils/swordEcho291.mjs';

const clear = () => true;
const radius = value => () => value;
const body16 = radius(16);
const toRad = degrees => degrees * Math.PI / 180;
const polar = (degrees, distance, base = 0) => {
  const a = base + toRad(degrees);
  return {x: Math.cos(a) * distance, y: Math.sin(a) * distance};
};
const wave = (over = {}) => new SwordEcho({x: 0, y: 0, angle: 0, color: 'pink', start: 0, ...over});
const everHit = (target, radiusOf) => wave().collect(520, [target], clear, radiusOf).length === 1;

// Tangent half-width of a radius-16 body at distance 100, in degrees (about 9.207).
const TANGENT_16_AT_100 = Math.asin(16 / 100) * 180 / Math.PI;

test('the pad cap is the agreed explicit value', () => {
  assert.equal(SWORD_ECHO_BODY_PAD_CAP, 16);
});

// ---------------------------------------------------------------- radius edge

test('radius edge: a body overlapping the arc hits, one just past it does not', () => {
  assert.equal(everHit({x: 141, y: 0}, body16), true);
  assert.equal(everHit({x: 141.01, y: 0}, body16), false);
  assert.equal(everHit({x: 137, y: 0}, radius(12)), true);
  assert.equal(everHit({x: 137.01, y: 0}, radius(12)), false);
});

test('radius edge: the same position is still a miss for a point target', () => {
  assert.deepEqual(wave().collect(520, [{x: 141, y: 0}], clear), []);
  assert.deepEqual(wave().collect(520, [{x: 141, y: 0}], clear, radius(0)), []);
});

// ---------------------------------------------------------------- angular edge

test('angular edge: a body past the sector side hits, a small body there misses', () => {
  for (const side of [1, -1]) {
    const inside = polar(side * (70 + TANGENT_16_AT_100 - .01), 100);
    const outside = polar(side * (70 + TANGENT_16_AT_100 + .01), 100);
    assert.equal(everHit(inside, body16), true, `side ${side} tangent inside`);
    assert.equal(everHit(outside, body16), false, `side ${side} tangent outside`);
    assert.equal(everHit(inside, radius(1)), false, `side ${side} small body`);
    assert.deepEqual(wave().collect(520, [inside], clear), [], `side ${side} point`);
  }
});

test('angular edge survives a rotated wave, a moved origin and the +-PI seam', () => {
  const at = degrees => {
    const p = polar(degrees, 100, Math.PI);
    return {x: p.x + 5, y: p.y + 6};
  };
  const make = () => wave({x: 5, y: 6, angle: Math.PI});
  assert.equal(make().collect(520, [at(79)], clear, body16).length, 1);
  assert.equal(make().collect(520, [at(-79)], clear, body16).length, 1);
  assert.equal(make().collect(520, [at(79.3)], clear, body16).length, 0);
  assert.equal(make().collect(520, [at(-79.3)], clear, body16).length, 0);
});

// ---------------------------------------------------------------- sector corner

test('corner: reach+angular padding alone would accept this, the exact disk does not', () => {
  const miss = polar(76, 135), hit = polar(75, 135);
  // Guard: this target really is inside the rejected square-expansion rule.
  assert.ok(135 <= SWORD_ECHO_RADIUS + 16);
  assert.ok(76 - 70 <= Math.asin(16 / 135) * 180 / Math.PI);
  const corner = polar(70, SWORD_ECHO_RADIUS);
  assert.ok(Math.hypot(miss.x - corner.x, miss.y - corner.y) > 16);
  assert.ok(Math.hypot(hit.x - corner.x, hit.y - corner.y) < 16);
  assert.equal(everHit(miss, body16), false);
  assert.equal(everHit(hit, body16), true);
});

test('corner: the boundary is the 16-unit distance from the corner point', () => {
  // 115 degrees lies inside the corner's outward normal cone, so the corner is the nearest point.
  for (const side of [1, -1]) {
    const corner = polar(side * 70, SWORD_ECHO_RADIUS), out = polar(side * 115, 1);
    const at = s => ({x: corner.x + out.x * s, y: corner.y + out.y * s});
    assert.equal(everHit(at(15.9), body16), true, `side ${side} inside`);
    assert.equal(everHit(at(16.1), body16), false, `side ${side} outside`);
  }
});

// ---------------------------------------------------------------- timing

test('first touch: a body is hit when the front reaches its edge, not its center', () => {
  const big = polar(30, 100), w = wave();
  assert.deepEqual(w.collect(239, [big], clear, body16), []);
  assert.deepEqual(w.collect(240, [big], clear, body16), [big]);

  const point = polar(30, 100), p = wave();
  assert.deepEqual(p.collect(251, [point], clear), []);
  assert.deepEqual(p.collect(252, [point], clear), [point]);
});

test('first touch: a body overlapping the start edge is hit at release', () => {
  const target = polar(75, 100), w = wave();
  assert.deepEqual(w.collect(199, [target], clear, body16), []);
  assert.deepEqual(w.collect(200, [target], clear, body16), [target]);
});

test('first touch: a body past the far edge waits for the front to arrive', () => {
  const target = polar(-75, 100), w = wave();
  assert.deepEqual(w.collect(374, [target], clear, body16), []);
  assert.deepEqual(w.collect(375, [target], clear, body16), [target]);
});

// ---------------------------------------------------------------- moving targets

test('moving: a body entering an already cleared region gets no hit', () => {
  const walker = polar(30, 200), w = wave();
  assert.deepEqual(w.collect(290, [walker], clear, body16), []);
  Object.assign(walker, polar(30, 100));
  assert.deepEqual(w.collect(300, [walker], clear, body16), []);
  assert.deepEqual(w.collect(380, [walker], clear, body16), []);
});

test('moving: a body appearing wholly behind the front gets no hit', () => {
  const late = polar(20, 100), w = wave();
  w.collect(290, [], clear, body16);
  assert.deepEqual(w.collect(295, [late], clear, body16), []);
});

test('moving: a body crossing the front between updates is hit once', () => {
  const crossing = polar(-30, 100), w = wave();
  assert.deepEqual(w.collect(290, [crossing], clear, body16), []);
  Object.assign(crossing, polar(30, 100));
  assert.deepEqual(w.collect(300, [crossing], clear, body16), [crossing]);
  assert.deepEqual(w.collect(380, [crossing], clear, body16), []);
});

test('moving: a body outrunning the front is hit only when the front catches it', () => {
  const runner = polar(-10, 100), w = wave();
  assert.deepEqual(w.collect(290, [runner], clear, body16), []);
  Object.assign(runner, polar(-60, 100));
  assert.deepEqual(w.collect(340, [runner], clear, body16), []);
  assert.deepEqual(w.collect(380, [runner], clear, body16), [runner]);
});

test('moving: a body straddling the front is touching the blade, a point there is not new', () => {
  const big = polar(0, 100), w = wave();
  w.collect(290, [], clear, body16);
  assert.deepEqual(w.collect(295, [big], clear, body16), [big]);

  const point = polar(0, 100), p = wave();
  p.collect(290, [], clear);
  assert.deepEqual(p.collect(295, [point], clear), []);
});

// ---------------------------------------------------------------- cap

test('cap: a radius 48 boss contributes only 16 at range, angle and timing', () => {
  const boss = radius(48);
  assert.equal(everHit({x: 141, y: 0}, boss), true);
  assert.equal(everHit({x: 141.01, y: 0}, boss), false);
  assert.equal(everHit({x: 170, y: 0}, boss), false);
  assert.equal(everHit(polar(70 + TANGENT_16_AT_100 + .01, 100), boss), false);

  const target = polar(30, 100), w = wave();
  assert.deepEqual(w.collect(239, [target], clear, boss), []);
  assert.deepEqual(w.collect(240, [target], clear, boss), [target]);
});

// ---------------------------------------------------------------- single hit

test('single hit: a body is hit once across updates, duplicates and later movement', () => {
  const target = polar(0, 100), w = wave();
  assert.deepEqual(w.collect(280, [target, target], clear, body16), [target]);
  assert.deepEqual(w.collect(281, [target], clear, body16), []);
  Object.assign(target, polar(-60, 100));
  assert.deepEqual(w.collect(300, [target], clear, body16), []);
  assert.deepEqual(w.collect(380, [target], clear, body16), []);
  assert.deepEqual(w.collect(520, [target], clear, body16), []);
});

test('single hit: an already hit target is not measured again', () => {
  const target = polar(0, 100), w = wave();
  let calls = 0;
  const counted = t => { calls += 1; assert.equal(t, target); return 16; };
  assert.deepEqual(w.collect(280, [target], clear, counted), [target]);
  assert.equal(calls, 1);
  w.collect(300, [target], clear, counted);
  assert.equal(calls, 1);
});

// ---------------------------------------------------------------- walls

test('wall: line of sight runs from the frozen origin to the target and denies the hit', () => {
  const target = polar(0, 100), w = wave();
  let calls = 0;
  const blocked = (...args) => {
    calls += 1;
    assert.equal(args.length, 2);
    assert.equal(args[0], w.origin);
    assert.equal(args[1], target);
    return false;
  };
  assert.deepEqual(w.collect(278, [target], blocked, body16), []);
  assert.equal(calls, 0, 'no wall query before first touch');
  assert.deepEqual(w.collect(279, [target], blocked, body16), []);
  assert.equal(calls, 1, 'wall queried at first touch');
  assert.deepEqual(w.collect(380, [target], blocked, body16), []);
});

test('wall: body overlap never pushes a hit through a blocked center line', () => {
  assert.deepEqual(wave().collect(520, [{x: 141, y: 0}], () => false, body16), []);
  assert.deepEqual(wave().collect(520, [polar(75, 100)], () => false, body16), []);
  assert.deepEqual(wave().collect(520, [{x: 5, y: 0}], () => false, body16), []);
});

test('wall: a cleared line hits while the blade still touches the body, never afterwards', () => {
  const blocked = () => false;

  const during = polar(0, 100), w1 = wave();
  assert.deepEqual(w1.collect(280, [during], blocked, body16), []);
  assert.deepEqual(w1.collect(290, [during], clear, body16), [during]);

  const after = polar(0, 100), w2 = wave();
  assert.deepEqual(w2.collect(280, [after], blocked, body16), []);
  assert.deepEqual(w2.collect(302, [after], blocked, body16), []);
  assert.deepEqual(w2.collect(310, [after], clear, body16), []);
  assert.deepEqual(w2.collect(380, [after], clear, body16), []);
});

// ---------------------------------------------------------------- origin

test('origin: a body covering the origin is touched at release, in any direction', () => {
  const center = {x: 5, y: 6}, w = wave({x: 5, y: 6, angle: 2});
  assert.deepEqual(w.collect(199, [center], clear, body16), []);
  assert.deepEqual(w.collect(200, [center], clear, body16), [center]);

  for (const target of [polar(180, 10), {x: -16, y: 0}, polar(100, 12)]) {
    const row = wave();
    assert.deepEqual(row.collect(200, [target], clear, body16), [target]);
  }
});

test('origin: a body just clear of the origin obeys the sector again', () => {
  assert.equal(everHit(polar(180, 17), body16), false);
  assert.equal(everHit(polar(150, 17), body16), false);
  assert.equal(everHit(polar(100, 17), body16), true);
});

test('origin: a zero radius target stays at the exact sector center', () => {
  const target = {x: 5, y: 6}, w = wave({x: 5, y: 6, angle: 2});
  assert.deepEqual(w.collect(289, [target], clear, radius(0)), []);
  assert.deepEqual(w.collect(290, [target], clear, radius(0)), [target]);
});

// ---------------------------------------------------------------- input contract

test('contract: omitted and undefined radiusOf both mean point targets', () => {
  const a = {x: 100, y: 0}, wide = {x: 130, y: 0};
  const omitted = wave(), undefinedArg = wave();
  assert.deepEqual(omitted.collect(520, [a, wide], clear), [a]);
  assert.deepEqual(undefinedArg.collect(520, [a, wide], clear, undefined), [a]);
});

test('contract: radiusOf returning 0 matches the three-argument timeline exactly', () => {
  const positions = [polar(70, 124.9), polar(-70, 124.9), polar(71, 100), polar(30, 100),
    {x: 125, y: 0}, {x: 125.01, y: 0}, {x: 0, y: 0}, polar(180, 5)];
  for (const position of positions) {
    const plain = wave(), zero = wave();
    for (const now of [200, 245, 290, 335, 379, 380]) {
      assert.deepEqual(
        zero.collect(now, [position], clear, radius(0)),
        plain.collect(now, [position], clear),
        `${position.x},${position.y} at ${now}`,
      );
    }
  }
});

test('contract: a radiusOf that is not a function throws, with no silent fallback', () => {
  for (const bad of [null, 16, 'radius', {}]) {
    assert.throws(() => wave().collect(290, [{x: 100, y: 0}], clear, bad), TypeError);
  }
});

test('contract: an invalid radius throws and consumes neither sweep nor hit', () => {
  for (const bad of [NaN, -1, Infinity, -Infinity, '16', undefined, null]) {
    const target = polar(60, 100), w = wave();
    assert.throws(() => w.collect(290, [target], clear, radius(bad)), RangeError, String(bad));
    assert.deepEqual(w.collect(290, [target], clear, body16), [target], `${bad} kept the sweep`);
  }
});

test('contract: a non-finite position is never a contact', () => {
  for (const target of [{x: NaN, y: 0}, {x: 0, y: NaN}, {x: Infinity, y: 0}]) {
    assert.deepEqual(wave().collect(520, [target], clear, body16), []);
    assert.deepEqual(wave().collect(520, [target], clear), []);
  }
});

// ---------------------------------------------------------------- independent geometry oracle

// Brute force over the front ray segments. It shares no formula with the implementation.
const ORACLE_STEPS = 3600;
const ORACLE_MS_PER_STEP = 180 / ORACLE_STEPS;
const ORACLE_RAYS = Array.from({length: ORACLE_STEPS + 1}, (_, k) => {
  const a = SWORD_ECHO_HALF_ANGLE * (1 - 2 * k / ORACLE_STEPS);
  return [Math.cos(a), Math.sin(a)];
});

function oracle(target, pad) {
  let nearest = Infinity, first = null;
  for (let k = 0; k <= ORACLE_STEPS; k += 1) {
    const [c, s] = ORACLE_RAYS[k];
    const along = Math.min(SWORD_ECHO_RADIUS, Math.max(0, target.x * c + target.y * s));
    const distance = Math.hypot(target.x - along * c, target.y - along * s);
    if (distance < nearest) nearest = distance;
    if (first === null && distance <= pad) first = k;
  }
  return {nearest, firstMs: first === null ? null : 200 + first * ORACLE_MS_PER_STEP};
}

function modelFirstMs(target, pad) {
  const w = wave();
  for (let ms = 200; ms <= 380; ms += 1) {
    if (w.collect(ms, [target], clear, radius(pad)).length) return ms;
  }
  return null;
}

test('oracle: hit decision and first-touch time match brute force over a grid', () => {
  let hits = 0, misses = 0;
  for (const pad of [1, 12, 16]) {
    for (let distance = 0; distance <= 154; distance += 11) {
      for (let degrees = -180; degrees < 180; degrees += 13) {
        const target = polar(degrees, distance), label = `pad ${pad} d ${distance} deg ${degrees}`;
        const {nearest, firstMs} = oracle(target, pad);
        // Grazing contact is below the oracle's sampling resolution.
        if (Math.abs(nearest - pad) < .2) continue;
        const actual = modelFirstMs(target, pad);
        if (firstMs === null) {
          assert.equal(actual, null, label);
          misses += 1;
        } else {
          assert.notEqual(actual, null, label);
          assert.ok(Math.abs(actual - Math.ceil(firstMs)) <= 1, `${label}: ${actual} vs ${firstMs}`);
          hits += 1;
        }
      }
    }
  }
  assert.ok(hits > 100, `hits ${hits}`);
  assert.ok(misses > 100, `misses ${misses}`);
});
