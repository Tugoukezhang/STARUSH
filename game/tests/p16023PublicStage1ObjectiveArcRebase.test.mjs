import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGE1_AMBIENT_PROP_COUNT,
  STAGE1_PAINT_DEVICES,
  STAGE1_REQUIRED_OBJECTIVE_COUNT,
  formatPaintObjectiveLine,
  getStage1AmbientPropCount,
  getStage1RequiredObjectiveCount,
} from '../src/utils/stage1PaintRound.mjs';
import {
  PUBLIC_STAGE1_ENCOUNTER_PHASES,
  PublicStage1EncounterDirector,
} from '../src/systems/PublicStage1EncounterDirector.mjs';

assert.equal(STAGE1_REQUIRED_OBJECTIVE_COUNT, 10);
assert.equal(STAGE1_AMBIENT_PROP_COUNT, 18);
assert.equal(getStage1RequiredObjectiveCount(), 10);
assert.equal(getStage1AmbientPropCount(), 18);
assert.equal(STAGE1_PAINT_DEVICES.filter((device) => device.required === true).length, 10);
assert.equal(STAGE1_PAINT_DEVICES.filter((device) => device.required === false).length, 18);
assert.deepEqual(
  STAGE1_PAINT_DEVICES.filter((device) => device.required === true).map((device) => device.id),
  [
    'z0-stage',
    'z0-tower-l',
    'z0-tower-r',
    'z0-booth',
    'z0-gate',
    'z1-rig',
    'z1-door',
    'z1-center',
    'z1-left',
    'z1-plaza',
  ],
);
assert.equal(formatPaintObjectiveLine(0), '街区设施 0/10');
assert.equal(formatPaintObjectiveLine(10), '街区设施 10/10');

assert.deepEqual(
  PUBLIC_STAGE1_ENCOUNTER_PHASES.map((phase) => phase.requiredCompleted),
  [0, 2, 5, 8],
);

const director = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: false });
assert.equal(director.begin({ now: 1000 }), true);
assert.equal(director.advance(1000, { completed: 0, total: 10 }).phaseId, 'opening-light-check');
assert.equal(director.advance(181000, { completed: 0, total: 10 }).phaseId, 'opening-light-check',
  'elapsed time must not silently promote encounter roles');
assert.equal(director.advance(181000, { completed: 2, total: 10 }).phaseId, 'movement-build');
assert.equal(director.advance(181000, { completed: 5, total: 10 }).phaseId, 'pressure-stack');
assert.equal(director.advance(181000, { completed: 8, total: 10 }).phaseId, 'high-point-chase');
assert.equal(director.advance(241000, { completed: 8, total: 10 }).remainingMs, 0,
  'the clock remains a hard cap even though it no longer schedules phases');

const paintSystemSource = readFileSync(
  new URL('../src/systems/PaintZoneSystem.js', import.meta.url),
  'utf8',
);
const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8',
);

assert.equal(paintSystemSource.includes('physics.add.sprite(def.x, def.y'), false,
  'plain paint objectives must not allocate invisible Arcade hosts');
assert.ok(paintSystemSource.includes('getObjectiveProgress()'));
assert.ok(paintSystemSource.includes('device.required === true'));
assert.ok(paintSystemSource.includes('def.required === true'));
assert.ok(battleSource.includes('this.paintZone?.getObjectiveProgress?.()'));
assert.ok(battleSource.includes('device?.required !== true'));

console.log('p16023 public Stage 1 objective/arc rebase: all assertions passed');
