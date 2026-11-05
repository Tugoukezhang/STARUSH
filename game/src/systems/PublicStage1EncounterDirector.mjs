import {
  STAGE1_PAINT_TIMER_MS,
  STAGE1_PAINT_GATE_Y,
  isPublicStage1PaintRound,
} from '../utils/stage1PaintRound.mjs';
import { getBattleChapter } from '../utils/publicCampaign.mjs';
import {ChapterEncounterEvent} from '../utils/chapterEncounterEvents.mjs';

import {PUBLIC_STAGE1_ENCOUNTER_PHASES,getChapterEncounterContent} from '../utils/publicChapterEncounterDefinition.mjs';
export {PUBLIC_STAGE1_ENCOUNTER_PHASES};

function safeNow(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const ENCOUNTER_OUTCOMES = new Set([
  'painted', 'interrupted', 'recovery-complete', 'window-expired',
  'encounter-complete', 'objective-complete', 'objective-unavailable',
]);

function normalizeProgress(progress = {}) {
  const completed = Math.max(0, Math.floor(Number(progress?.completed) || 0));
  const total = Math.max(1, Math.floor(Number(progress?.total) || 10));
  return { completed: Math.min(total, completed), total };
}

function resolvePhase(progress, phases = PUBLIC_STAGE1_ENCOUNTER_PHASES, holdSouth = false) {
  const normalized = normalizeProgress(progress);
  return [...phases]
    .reverse()
    .find((phase) => normalized.completed >= phase.requiredCompleted
      && (!holdSouth || phase.requiredCompleted < PUBLIC_STAGE1_ENCOUNTER_PHASES[2].requiredCompleted))
    || phases[0];
}

export class PublicStage1EncounterDirector {
  constructor(battleData = {}) {
    this.battleData = { ...battleData };
    this.encounter = getChapterEncounterContent(getBattleChapter(this.battleData).id);
    this.chapterEvent=null;
    this.chapterPacingEnabled=false;
    this.reset();
  }

  isEligible() {
    return this.battleData.defenseMode !== true && isPublicStage1PaintRound(this.battleData);
  }

  begin({ now = 0 } = {}) {
    if (!this.isEligible() || this.active) return false;
    this.active = true;
    this.startedAt = safeNow(now);
    this.currentPhaseId = null;
    this.phaseEnteredAtMs = 0;
    return true;
  }

  advance(now = 0, progress = null) {
    const snapshot = this.snapshot(now, progress);
    if (!snapshot.active) return { ...snapshot, changed: false, previousPhaseId: null };
    const previousPhaseId = this.currentPhaseId;
    const changed = snapshot.phaseId !== previousPhaseId;
    this.currentPhaseId = snapshot.phaseId;
    if (changed) this.phaseEnteredAtMs = snapshot.elapsedMs;
    return { ...snapshot, changed, previousPhaseId };
  }

  claimStageCueEmitterOpportunity(now = 0, { hasActiveEmitter = false } = {}) {
    if (!this.active || hasActiveEmitter) return false;
    const elapsedMs = Math.max(0, Math.min(
      STAGE1_PAINT_TIMER_MS,
      safeNow(now) - this.startedAt,
    ));
    const phase = resolvePhase(this.objectiveProgress, this.encounter.phases, this.chapterPacingEnabled&&!this.chapterNorthEntered);
    const intervalMs = Number(phase.stageCueEmitterIntervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
    if (elapsedMs < this.phaseEnteredAtMs + 6000) return false;

    const lastAt = Number(this.lastStageCueEmitterAtMs);
    const phaseHasPreviousClaim = this.lastStageCueEmitterPhaseId === phase.id && Number.isFinite(lastAt);
    if (phaseHasPreviousClaim && elapsedMs - lastAt < intervalMs) return false;
    this.lastStageCueEmitterAtMs = elapsedMs;
    this.lastStageCueEmitterPhaseId = phase.id;
    return true;
  }

  getPendingAuthoredRoles() {
    if (!this.active) return [];
    return this.encounter.roles.filter(({ role, at }) => (
      (this.chapterEvent?this.chapterEvent.eligible(role,at,this.objectiveProgress.completed,this.authoredRoles)
        :this.objectiveProgress.completed >= at) && !this.authoredRoles[role]
        && (!this.chapterPacingEnabled || this._canPaceAuthoredRole(role))
    )).map(({ role }) => role);
  }

  beginAuthoredRole(role) {
    if (!this.getPendingAuthoredRoles().includes(role)) return false;
    this.authoredRoles[role] = { state: 'active', outcome: null };
    this.chapterEvent?.begin(role,this.authoredRoles);
    return true;
  }

  resolveAuthoredRole(role, outcome) {
    if (!this.active || this.authoredRoles[role]?.state !== 'active'
      || !ENCOUNTER_OUTCOMES.has(outcome)) return false;
    this.authoredRoles[role] = { state: 'resolved', outcome };
    this.chapterEvent?.resolved(role,outcome);
    return true;
  }

  canEnterFinale() {
    return this.active && this.objectiveProgress.completed >= this.objectiveProgress.total
      && (!this.chapterPacingEnabled || this.chapterNorthEntered)
      && this.encounter.roles.every(({ role }) => this.authoredRoles[role]?.state === 'resolved');
  }

  enableChapterPacing() {
    if(this.active||!this.isEligible()||!['opening','neon','encore'].includes(this.battleData.campaignChapterId)
      ||!['sakura','kai','enjo'].includes(this.battleData.performerId))return false;
    this.chapterPacingEnabled=true;return true;
  }

  observeChapterPacing({zone,playerY}={}) {
    if(!this.active||!this.chapterPacingEnabled||this.chapterNorthEntered||zone!==1
      ||!Number.isFinite(playerY)||playerY<0||playerY>=STAGE1_PAINT_GATE_Y)return false;
    this.chapterNorthEntered=true;return true;
  }

  _canPaceAuthoredRole(role) {
    const index=this.encounter.roles.findIndex(entry=>entry.role===role);
    if(index===0)return true;
    const previous=this.authoredRoles[this.encounter.roles[index-1]?.role];
    // Linked partners keep their original precise eligibility; solo follow-ups wait for entry.
    if(this.chapterEvent?.config?.secondary===role&&previous?.state==='active')return true;
    return this.chapterNorthEntered&&previous?.state==='resolved';
  }

  enableChapterEvents(){
    const id=getBattleChapter(this.battleData).id;
    if(this.active||!this.isEligible()||!new ChapterEncounterEvent(id).config)return false;
    this.chapterEvent=new ChapterEncounterEvent(id);return true;
  }
  observeChapterEvent(state){this.chapterEvent?.observe(state,this.authoredRoles);}
  getChapterEventAction(state){return this.chapterEvent?.action(this.authoredRoles,state)||null;}
  acknowledgeChapterEvent(action){return this.chapterEvent?.acknowledge(action)===true;}
  noteChapterEventRelease(role){return this.chapterEvent?.released(role)===true;}
  getChapterEventSnapshot(){return this.chapterEvent?.snapshot()||null;}

  claimObjectiveDisruptorOpportunity(now = 0, { hasActiveDisruptor = false } = {}) {
    if (!this.active || hasActiveDisruptor) return false;
    const elapsedMs = Math.max(0, Math.min(
      STAGE1_PAINT_TIMER_MS,
      safeNow(now) - this.startedAt,
    ));
    const phase = resolvePhase(this.objectiveProgress, this.encounter.phases, this.chapterPacingEnabled&&!this.chapterNorthEntered);
    const intervalMs = Number(phase.objectiveDisruptorIntervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
    if (elapsedMs < this.phaseEnteredAtMs + 8000) return false;

    const lastAt = Number(this.lastObjectiveDisruptorAtMs);
    const phaseHasPreviousClaim = this.lastObjectiveDisruptorPhaseId === phase.id && Number.isFinite(lastAt);
    if (phaseHasPreviousClaim && elapsedMs - lastAt < intervalMs) return false;
    this.lastObjectiveDisruptorAtMs = elapsedMs;
    this.lastObjectiveDisruptorPhaseId = phase.id;
    return true;
  }

  claimSpotlightCaptainOpportunity(now = 0, { hasActiveCaptain = false } = {}) {
    if (!this.active || hasActiveCaptain || this.spotlightCaptainClaimed) return false;
    const elapsedMs = Math.max(0, Math.min(
      STAGE1_PAINT_TIMER_MS,
      safeNow(now) - this.startedAt,
    ));
    const phase = resolvePhase(this.objectiveProgress, this.encounter.phases, this.chapterPacingEnabled&&!this.chapterNorthEntered);
    if (phase.spotlightCaptainEnabled !== true) return false;
    if (elapsedMs < this.phaseEnteredAtMs + 8000) return false;
    this.spotlightCaptainClaimed = true;
    return true;
  }

  snapshot(now = 0, progress = null) {
    if (!this.active) {
      return {
        active: false,
        elapsedMs: 0,
        remainingMs: STAGE1_PAINT_TIMER_MS,
        phaseId: null,
        phaseLabel: '',
        cadence: null,
      };
    }
    if (progress) this.objectiveProgress = normalizeProgress(progress);
    const elapsedMs = Math.max(0, Math.min(
      STAGE1_PAINT_TIMER_MS,
      safeNow(now) - this.startedAt,
    ));
    const phase = resolvePhase(this.objectiveProgress, this.encounter.phases, this.chapterPacingEnabled&&!this.chapterNorthEntered);
    return {
      active: true,
      elapsedMs,
      remainingMs: Math.max(0, STAGE1_PAINT_TIMER_MS - elapsedMs),
      phaseId: phase.id,
      phaseLabel: this.chapterPacingEnabled?(this.chapterNorthEntered?'北区 · ':'南区 · ')+phase.label:phase.label,
      objectiveProgress: { ...this.objectiveProgress },
      cadence: {
        unlitMax: phase.unlitMax,
        unlitSpawnMs: phase.unlitSpawnMs,
        danmakuIntervalMs: phase.danmakuIntervalMs,
        stageCueEmitterIntervalMs: phase.stageCueEmitterIntervalMs,
        objectiveDisruptorIntervalMs: phase.objectiveDisruptorIntervalMs,
        spotlightCaptainEnabled: phase.spotlightCaptainEnabled,
      },
    };
  }

  reset() {
    this.chapterEvent?.reset();
    this.active = false;
    this.startedAt = null;
    this.currentPhaseId = null;
    this.chapterNorthEntered=false;
    this.phaseEnteredAtMs = 0;
    this.objectiveProgress = normalizeProgress();
    this.lastStageCueEmitterAtMs = null;
    this.lastStageCueEmitterPhaseId = null;
    this.lastObjectiveDisruptorAtMs = null;
    this.lastObjectiveDisruptorPhaseId = null;
    this.spotlightCaptainClaimed = false;
    this.authoredRoles = {};
  }
}
