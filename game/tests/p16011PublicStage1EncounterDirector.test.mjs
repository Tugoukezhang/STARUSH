import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENCOUNTER_PHASES,
  PublicStage1EncounterDirector,
} from '../src/systems/PublicStage1EncounterDirector.mjs';
import { STAGE1_PAINT_TIMER_MS } from '../src/utils/stage1PaintRound.mjs';

const EXPECTED_PHASES = [
  {
    id: 'opening-light-check',
    label: '开场校灯',
    requiredCompleted: 0,
    unlitMax: 2,
    unlitSpawnMs: 1800,
    danmakuIntervalMs: 2200,
    stageCueEmitterIntervalMs: null,
    objectiveDisruptorIntervalMs: null,
    spotlightCaptainEnabled: false,
  },
  {
    id: 'movement-build',
    label: '走位升温',
    requiredCompleted: 2,
    unlitMax: 3,
    unlitSpawnMs: 1500,
    danmakuIntervalMs: 1750,
    stageCueEmitterIntervalMs: 18000,
    objectiveDisruptorIntervalMs: null,
    spotlightCaptainEnabled: false,
  },
  {
    id: 'pressure-stack',
    label: '压力叠加',
    requiredCompleted: 5,
    unlitMax: 4,
    unlitSpawnMs: 1250,
    danmakuIntervalMs: 1400,
    stageCueEmitterIntervalMs: 15000,
    objectiveDisruptorIntervalMs: 22000,
    spotlightCaptainEnabled: false,
  },
  {
    id: 'high-point-chase',
    label: '压轴追光',
    requiredCompleted: 8,
    unlitMax: 4,
    unlitSpawnMs: 1100,
    danmakuIntervalMs: 1200,
    stageCueEmitterIntervalMs: 12000,
    objectiveDisruptorIntervalMs: 16000,
    spotlightCaptainEnabled: true,
  },
];

assert.equal(STAGE1_PAINT_TIMER_MS, 240000, 'public Stage 1 should provide the four-minute vertical-slice floor');
assert.deepEqual(PUBLIC_STAGE1_ENCOUNTER_PHASES, EXPECTED_PHASES);

{
  const director = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: false });
  assert.equal(director.isEligible(), true);
  assert.equal(director.snapshot(1000).active, false);
  assert.equal(director.begin({ now: 1000 }), true);
  assert.equal(director.begin({ now: 2000 }), false, 'one round must have one encounter timeline');

  const opening = director.advance(1000, { completed: 0, total: 10 });
  assert.equal(opening.changed, true);
  assert.equal(opening.phaseId, 'opening-light-check');
  assert.equal(opening.elapsedMs, 0);
  assert.equal(opening.remainingMs, 240000);
  assert.equal(opening.cadence.unlitMax, 2);

  const sameOpening = director.advance(166000, { completed: 0, total: 10 });
  assert.equal(sameOpening.changed, false);
  assert.equal(sameOpening.phaseId, 'opening-light-check');

  const movement = director.advance(166000, { completed: 2, total: 10 });
  assert.equal(movement.changed, true);
  assert.equal(movement.previousPhaseId, 'opening-light-check');
  assert.equal(movement.phaseId, 'movement-build');
  assert.equal(movement.cadence.danmakuIntervalMs, 1750);

  assert.equal(director.advance(166000, { completed: 5, total: 10 }).phaseId, 'pressure-stack');
  assert.equal(director.advance(166000, { completed: 8, total: 10 }).phaseId, 'high-point-chase');
  const endedClock = director.advance(241000, { completed: 8, total: 10 });
  assert.equal(endedClock.phaseId, 'high-point-chase');
  assert.equal(endedClock.remainingMs, 0);

  director.reset();
  assert.equal(director.snapshot(242000).active, false);
}

{
  const hiddenPractice = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: true });
  const otherStage = new PublicStage1EncounterDirector({ stageId: 2, practiceMode: false });
  assert.equal(hiddenPractice.isEligible(), false);
  assert.equal(hiddenPractice.begin({ now: 0 }), false);
  assert.equal(otherStage.isEligible(), false);
  assert.equal(otherStage.begin({ now: 0 }), false);
}

{
  const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const paintZoneSource = readFileSync(new URL('../src/systems/PaintZoneSystem.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.ok(battleSource.includes('new PublicStage1EncounterDirector(this.battleData)'));
  assert.ok(battleSource.includes('_updatePublicStage1Encounter()'));
  assert.ok(battleSource.includes('_scheduleNextUnlitSpawn('));
  assert.equal(battleSource.includes('_scheduleUnlitBlobShot('), false);
  assert.ok(battleSource.includes('this.publicStage1Encounter?.reset()'));
  assert.ok(paintZoneSource.includes('_scheduleNextDanmaku('));
  assert.ok(paintZoneSource.includes('_getPublicStage1EncounterCadence'));
  assert.ok(html.includes('<span id="round-clock">04:00</span>'), 'pre-hydration clock must match the four-minute contract');
}

console.log('p16011 public Stage 1 encounter director: all assertions passed');
