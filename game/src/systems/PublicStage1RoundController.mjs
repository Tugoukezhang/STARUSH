import { isPublicStage1PaintRound } from '../utils/stage1PaintRound.mjs';
import { getPublicPerformer } from '../utils/publicRunProgression.mjs';

export const PUBLIC_STAGE1_PERFORMER_ID = 'sakura';

export const PUBLIC_STAGE1_ROUND_PHASES = Object.freeze({
  IDLE: 'idle',
  ACTIVE: 'active',
  FINISHED: 'finished',
});

export class PublicStage1RoundController {
  constructor(battleData = {}) {
    this.battleData = { ...battleData };
    this.reset();
  }

  isEligible() {
    return isPublicStage1PaintRound(this.battleData);
  }

  getPerformerId() {
    return this.isEligible() ? getPublicPerformer(this.battleData.performerId).id : null;
  }

  canSelectPerformer(performerId) {
    return this.isEligible() && performerId === this.getPerformerId();
  }

  begin({ now = 0, durationMs = 0 } = {}) {
    if (!this.isEligible() || this.phase !== PUBLIC_STAGE1_ROUND_PHASES.IDLE) return false;
    const safeNow = Number.isFinite(Number(now)) ? Number(now) : 0;
    const safeDuration = Math.max(0, Number(durationMs) || 0);
    this.phase = PUBLIC_STAGE1_ROUND_PHASES.ACTIVE;
    this.endsAt = safeNow + safeDuration;
    this.finishReason = null;
    return true;
  }

  finish(reason = 'stopped') {
    if (!this.isEligible() || this.phase !== PUBLIC_STAGE1_ROUND_PHASES.ACTIVE) return false;
    this.phase = PUBLIC_STAGE1_ROUND_PHASES.FINISHED;
    this.endsAt = null;
    this.finishReason = String(reason || 'stopped');
    return true;
  }

  reset() {
    this.phase = PUBLIC_STAGE1_ROUND_PHASES.IDLE;
    this.endsAt = null;
    this.finishReason = null;
    return this.snapshot();
  }

  snapshot() {
    return {
      eligible: this.isEligible(),
      phase: this.phase,
      performerId: this.getPerformerId(),
      endsAt: this.endsAt,
      finishReason: this.finishReason,
    };
  }
}
