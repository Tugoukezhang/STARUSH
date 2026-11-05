export const SWORD_ECHO_WINDUP_MS = 200;
export const SWORD_ECHO_SWEEP_MS = 180;
export const SWORD_ECHO_FADE_MS = 140;
export const SWORD_ECHO_RADIUS = 125;
export const SWORD_ECHO_INNER_RADIUS = 0;
export const SWORD_ECHO_HALF_ANGLE = Math.PI * 7 / 18;
export const SWORD_ECHO_BODY_PAD_CAP = 16;

// Keeps a target exactly on a sector edge from losing its hit to atan2 float error.
const SECTOR_TOLERANCE = 1e-9;

const clampProgress = value => Math.min(1, Math.max(0, value));

// Half-width, seen from the origin, of the part of a body the blade can reach. Requires
// distance > pad. Beyond the tangent point the blade tip limits it, so the body's corner
// contact is the circle-circle intersection. Both formulas agree at the tangent distance,
// and the second reaches 0 at the reach limit.
function reachableHalfWidth(distance, pad) {
  if (distance > SWORD_ECHO_RADIUS + pad) return 0;
  const radiusSquared = SWORD_ECHO_RADIUS * SWORD_ECHO_RADIUS;
  const tangentSquared = distance * distance - pad * pad;
  if (tangentSquared <= radiusSquared) return Math.asin(pad / distance);
  const cosine = (distance * distance + radiusSquared - pad * pad) / (2 * distance * SWORD_ECHO_RADIUS);
  return Math.acos(Math.min(1, cosine));
}

// Sweep positions: 0 at angle+half, 1 at angle-half. Outside 0..1 is outside the sector.
export class SwordEcho {
  // Starting below zero makes the first sweep include a target on the leading edge.
  #swept = -1;
  #hit = new WeakSet();
  #previous = new Map();
  #destroyed = false;

  constructor({ x, y, angle, color, start }) {
    this.origin = Object.freeze({ x, y });
    this.angle = angle;
    this.color = color;
    this.start = start;
    this.releaseAt = start + SWORD_ECHO_WINDUP_MS;
    this.sweepEnd = this.releaseAt + SWORD_ECHO_SWEEP_MS;
    this.end = this.sweepEnd + SWORD_ECHO_FADE_MS;
    Object.freeze(this);
  }

  frontAt(progress) {
    return this.angle + SWORD_ECHO_HALF_ANGLE * (1 - 2 * progress);
  }

  sample(now) {
    if (this.#destroyed || now < this.releaseAt || now > this.end) return null;
    const progress = this.#progress(now);
    return {
      progress,
      alpha: now <= this.sweepEnd ? 1 : Math.max(0, 1 - (now - this.sweepEnd) / SWORD_ECHO_FADE_MS),
      startAngle: this.frontAt(0),
      endAngle: this.frontAt(progress),
      radius: SWORD_ECHO_RADIUS,
      innerRadius: SWORD_ECHO_INNER_RADIUS,
    };
  }

  // radiusOf(target) is optional. Omitted means point targets, tested at their exact center.
  // Passed, it must return a finite radius >= 0, and the body pad is min(radius, 16).
  // Anything else throws: an invalid radius is a caller bug and never becomes a default.
  collect(now, targets, clearLine, radiusOf) {
    if (radiusOf !== undefined && typeof radiusOf !== 'function') {
      throw new TypeError('SwordEcho.collect: radiusOf must be a function when provided');
    }
    if (this.#destroyed || now < this.releaseAt) return [];
    const inner = this.#swept;
    const outer = this.#progress(now);
    // Covers repeated timestamps, a clock moving backwards and a finalized sweep.
    if (outer <= inner) return [];

    // Measured before any state changes, so a radius error consumes no sweep.
    const extents = new Map();
    for (const target of targets) {
      if (!this.#hit.has(target)) extents.set(target, this.#extent(target, this.#pad(target, radiusOf)));
    }
    this.#swept = outer;

    const swept = [];
    const positions = new Map();
    for (const [target, { inReach, leading, trailing }] of extents) {
      const previous = this.#previous.get(target);
      positions.set(target, leading);
      if (!inReach) continue;
      if (trailing < -SECTOR_TOLERANCE || leading > 1 + SECTOR_TOLERANCE) continue;
      const contact = clampProgress(leading - SECTOR_TOLERANCE);
      const departure = clampProgress(trailing - SECTOR_TOLERANCE);
      // Wholly behind the front only counts when this target was wholly ahead of it last
      // update: it ran through the blade between frames rather than walking into cleared space.
      const crossed = previous !== undefined && previous > inner;
      if (contact > outer || (departure <= inner && !crossed)) continue;
      if (!clearLine(this.origin, target)) continue;
      this.#hit.add(target);
      swept.push(target);
    }
    this.#previous = outer < 1 ? positions : new Map();
    return swept;
  }

  destroy() {
    this.#destroyed = true;
    this.#previous = new Map();
    this.#hit = new WeakSet();
  }

  // The explicit end check stops float error from leaving the front short of the far edge.
  #progress(now) {
    if (now >= this.sweepEnd) return 1;
    return Math.max(0, (now - this.releaseAt) / SWORD_ECHO_SWEEP_MS);
  }

  #pad(target, radiusOf) {
    if (radiusOf === undefined) return 0;
    const radius = radiusOf(target);
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError(`SwordEcho.collect: radiusOf returned an invalid radius: ${String(radius)}`);
    }
    return Math.min(radius, SWORD_ECHO_BODY_PAD_CAP);
  }

  // The sweep positions where the front first touches (leading) and last touches (trailing)
  // the body, unclamped. With a zero pad both equal the target's own center position.
  #extent(target, pad) {
    const dx = target.x - this.origin.x;
    const dy = target.y - this.origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= pad) {
      // A body covering the origin touches every front. A true point has no direction at
      // the origin, so resolve it at the sector center, not world angle 0.
      return pad > 0
        ? { inReach: true, leading: 0, trailing: 1 }
        : { inReach: true, leading: 0.5, trailing: 0.5 };
    }
    const delta = Math.atan2(dy, dx) - this.angle;
    const offset = Math.atan2(Math.sin(delta), Math.cos(delta));
    const halfWidth = reachableHalfWidth(distance, pad);
    return {
      inReach: distance <= SWORD_ECHO_RADIUS + pad,
      leading: (SWORD_ECHO_HALF_ANGLE - offset - halfWidth) / (2 * SWORD_ECHO_HALF_ANGLE),
      trailing: (SWORD_ECHO_HALF_ANGLE - offset + halfWidth) / (2 * SWORD_ECHO_HALF_ANGLE),
    };
  }
}
