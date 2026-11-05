const WINDUP_MS = 200;
const TRAVEL_MS = 420;
const MAX_RADIUS = 150;

export class GroundEcho {
  // Outer edge of the area already swept. Starting below zero makes the first
  // sweep include a target at distance 0 without a special case.
  #sweptRadius = -1;
  #hit = new WeakSet();
  #previousDistances = new Map();
  #destroyed = false;

  constructor({ x, y, color, start }) {
    this.origin = Object.freeze({ x, y });
    this.color = color;
    this.start = start;
    this.end = start + WINDUP_MS + TRAVEL_MS;
    Object.freeze(this);
  }

  sample(now) {
    if (this.#destroyed || now < this.start + WINDUP_MS || now > this.end) return null;
    const progress = this.#progress(now);
    return {
      x: this.origin.x,
      y: this.origin.y,
      color: this.color,
      radius: progress * MAX_RADIUS,
      progress,
      alpha: 1 - progress * 0.2,
    };
  }

  collect(now, targets, clearLine) {
    if (this.#destroyed || now < this.start + WINDUP_MS) return [];
    const inner = this.#sweptRadius;
    const outer = this.#progress(now) * MAX_RADIUS;
    // Covers repeated timestamps, a clock moving backwards and completed waves.
    if (outer <= inner) return [];
    this.#sweptRadius = outer;

    const swept = [];
    const distances = new Map();
    for (const target of targets) {
      const distance = Math.hypot(target.x - this.origin.x, target.y - this.origin.y);
      const previous = this.#previousDistances.get(target);
      distances.set(target, distance);
      const crossed = previous !== undefined && previous > inner && distance <= outer;
      if ((!crossed && distance <= inner) || distance > outer || this.#hit.has(target)) continue;
      if (!clearLine(this.origin, target)) continue;
      this.#hit.add(target);
      swept.push(target);
    }
    this.#previousDistances = distances;
    return swept;
  }

  destroy() {
    this.#destroyed = true;
    this.#previousDistances.clear();
  }

  // The explicit end check stops float error from leaving the final radius just
  // short of 150 on fractional clocks, which would miss the outer edge for good.
  #progress(now) {
    if (now >= this.end) return 1;
    return Math.min(1, Math.max(0, (now - this.start - WINDUP_MS) / TRAVEL_MS));
  }
}
