export const BATTLE_RUNTIME_RELEASE_STEPS = Object.freeze([
  'mobile-input',
  'player-feedback',
  'stage-feedback',
  'prototype-control',
  'authored-pressure',
  'projectile-objects',
  'color-status',
  'enemy-readability',
  'hints-and-polish',
]);

export class BattleRuntimeReleaseFacade {
  constructor(handlers = {}) {
    this.handlers = { ...handlers };
    this.released = false;
    this.firstReason = null;
  }

  release(reason = 'unspecified') {
    const safeReason = String(reason || 'unspecified');
    if (this.released) {
      return {
        released: false,
        repeated: true,
        reason: safeReason,
        firstReason: this.firstReason,
        executed: [],
        missing: [],
      };
    }

    const executed = [];
    const missing = [];
    BATTLE_RUNTIME_RELEASE_STEPS.forEach((step) => {
      const handler = this.handlers[step];
      if (typeof handler !== 'function') {
        missing.push(step);
        return;
      }
      handler();
      executed.push(step);
    });
    this.released = true;
    this.firstReason = safeReason;
    return {
      released: true,
      repeated: false,
      reason: safeReason,
      firstReason: safeReason,
      executed,
      missing,
    };
  }

  snapshot() {
    return {
      released: this.released,
      firstReason: this.firstReason,
    };
  }
}
