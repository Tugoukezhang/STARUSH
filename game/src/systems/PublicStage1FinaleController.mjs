import { isPublicStage1PaintRound } from '../utils/stage1PaintRound.mjs';
import { getBattleChapter } from '../utils/publicCampaign.mjs';
import { isUserCastEnabled } from '../utils/userCast.mjs';
import { getChapterFinalePatterns } from '../utils/chapterFinaleContent.mjs';
import {getPublicRoutePatterns} from '../utils/publicRoutePlan.mjs';

export const PUBLIC_STAGE1_FINALE_PHASES = Object.freeze({
  ATTACK: 'attack',
  WEAK_POINT: 'weak-point',
  BOSS_RECOVERY: 'boss-recovery',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

export const PUBLIC_STAGE1_FINALE_DURATION_MS = 32000;
export const PUBLIC_STAGE1_FINALE_WEAK_POINT_COUNT = 3;
export const PUBLIC_STAGE1_FINALE_ATTACK_PATTERNS = Object.freeze([
  'captured-line',
  'momentum-cutoff',
  'captured-line',
]);

function safeNow(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export class PublicStage1FinaleController {
  constructor(battleData = {}) {
    this.battleData = { ...battleData };
    this.attackPatterns=isUserCastEnabled()&&this.battleData.defenseMode!==true&&this.isEligible()
      ?getPublicRoutePatterns(this.battleData):getBattleChapter(this.battleData).finalePatterns;
    this.reset();
  }

  isEligible() {
    return isPublicStage1PaintRound(this.battleData);
  }

  begin({
    now = 0,
    durationMs = PUBLIC_STAGE1_FINALE_DURATION_MS,
    weakPointCount = PUBLIC_STAGE1_FINALE_WEAK_POINT_COUNT,
  } = {}) {
    if (!this.isEligible() || this.active || this.phase === PUBLIC_STAGE1_FINALE_PHASES.COMPLETE) {
      return false;
    }
    const startedAt = safeNow(now);
    this.active = true;
    this.phase = PUBLIC_STAGE1_FINALE_PHASES.ATTACK;
    this.startedAt = startedAt;
    this.endsAt = startedAt + Math.max(1, Number(durationMs) || PUBLIC_STAGE1_FINALE_DURATION_MS);
    this.weakPointCount = Math.max(1, Math.floor(Number(weakPointCount) || PUBLIC_STAGE1_FINALE_WEAK_POINT_COUNT));
    this.weakPointsResolved = 0;
    this.attackIndex = 0;
    this.lastAttackOutcome = null;
    return true;
  }

  recordAttackResolved(now = 0, { outcome = 'evaded' } = {}) {
    if (!this.active || this.phase !== PUBLIC_STAGE1_FINALE_PHASES.ATTACK) return false;
    if (safeNow(now) >= this.endsAt) {
      this._fail();
      return false;
    }
    this.lastAttackOutcome = outcome === 'hit' ? 'hit' : 'evaded';
    this.phase = PUBLIC_STAGE1_FINALE_PHASES.WEAK_POINT;
    return true;
  }

  recordWeakPointResolved(now = 0) {
    if (!this.active || this.phase !== PUBLIC_STAGE1_FINALE_PHASES.WEAK_POINT) return false;
    if (safeNow(now) >= this.endsAt) {
      this._fail();
      return false;
    }
    this.weakPointsResolved = Math.min(this.weakPointCount, this.weakPointsResolved + 1);
    if (this.weakPointsResolved >= this.weakPointCount) {
      this.phase = PUBLIC_STAGE1_FINALE_PHASES.BOSS_RECOVERY;
    } else {
      this.attackIndex = Math.min(
        PUBLIC_STAGE1_FINALE_ATTACK_PATTERNS.length - 1,
        this.weakPointsResolved,
      );
      this.phase = PUBLIC_STAGE1_FINALE_PHASES.ATTACK;
    }
    return true;
  }

  recordBossDefeated(now = 0) {
    if (!this.active || this.phase !== PUBLIC_STAGE1_FINALE_PHASES.BOSS_RECOVERY) return false;
    if (safeNow(now) >= this.endsAt) {
      this._fail();
      return false;
    }
    this.active = false;
    this.phase = PUBLIC_STAGE1_FINALE_PHASES.COMPLETE;
    return true;
  }

  advance(now = 0) {
    if (this.active && safeNow(now) >= this.endsAt) this._fail();
    return this.snapshot(now);
  }

  snapshot(now = 0) {
    const remainingMs = this.endsAt == null
      ? 0
      : Math.max(0, this.endsAt - safeNow(now));
    return {
      active: this.active,
      phase: this.phase,
      weakPointsResolved: this.weakPointsResolved,
      weakPointCount: this.weakPointCount,
      attackIndex: this.attackIndex,
      attackPattern: this.attackPatterns[this.attackIndex] || null,
      lastAttackOutcome: this.lastAttackOutcome,
      remainingMs,
      complete: this.phase === PUBLIC_STAGE1_FINALE_PHASES.COMPLETE,
      failed: this.phase === PUBLIC_STAGE1_FINALE_PHASES.FAILED,
    };
  }

  reset() {
    this.active = false;
    this.phase = null;
    this.startedAt = null;
    this.endsAt = null;
    this.weakPointCount = PUBLIC_STAGE1_FINALE_WEAK_POINT_COUNT;
    this.weakPointsResolved = 0;
    this.attackIndex = 0;
    this.lastAttackOutcome = null;
  }

  _fail() {
    this.active = false;
    this.phase = PUBLIC_STAGE1_FINALE_PHASES.FAILED;
  }
}
