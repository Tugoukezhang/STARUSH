import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveStageWaveDefs,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';

const waveSystemSource = readFileSync(
  new URL('../src/systems/WaveSystem.js', import.meta.url),
  'utf8'
);

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  return null;
}

const practiceDefs = resolveStageWaveDefs({
  battleData: { stageId: 1, practiceMode: true },
  waveDefs: baseWaveDefs,
  getStageById,
});

assert.equal(practiceDefs.length, 4, 'hidden Stage 1.5 practice should retain four segments');

const practice3 = practiceDefs[2];
assert.equal(
  practice3.interval,
  500,
  'Practice 3 should use the 500ms actionability interval instead of the blocked 2200ms interval'
);
assert.equal(practice3.minActiveMs, 8000, 'Practice 3 should retain its 8000ms minimum active time');
assert.deepEqual(
  practice3.enemies,
  [
    { type: 'trainee', count: 1 },
    { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
  ],
  'Practice 3 should retain one trainee followed by one Stage Marker Target'
);

const spawnOffsetsMs = practice3.enemies.flatMap(({ count }, groupIndex) =>
  Array.from({ length: count }, (_, itemIndex) => (
    (practice3.enemies
      .slice(0, groupIndex)
      .reduce((sum, group) => sum + group.count, 0) + itemIndex + 1) * practice3.interval
  ))
);
assert.deepEqual(
  spawnOffsetsMs,
  [500, 1000],
  'trainee and Stage Marker Target should be scheduled at +500ms and +1000ms'
);

const measuredTraineeLifetimeMs = 1761;
const estimatedOverlapMs = measuredTraineeLifetimeMs - practice3.interval;
assert.equal(estimatedOverlapMs, 1261, 'the P15-227 evidence should estimate a 1261ms overlap');
assert.ok(
  estimatedOverlapMs >= 1000,
  'the implementation hypothesis should provide at least a 1000ms overlap budget for later QA'
);

const anchorLastStart = waveSystemSource.indexOf('const anchorLastTypes = new Set');
const anchorLastEnd = waveSystemSource.indexOf(
  'const regulars = this.spawnQueue.filter',
  anchorLastStart
);
assert.ok(anchorLastStart >= 0 && anchorLastEnd > anchorLastStart, 'anchor-last queue block should exist');
const anchorLastBlock = waveSystemSource.slice(anchorLastStart, anchorLastEnd);
assert.ok(
  anchorLastBlock.includes('STAGE_15_STAGE_MARKER_TARGET_TYPE'),
  'Stage Marker Target should remain anchored last'
);

assert.deepEqual(
  practiceDefs.map((def) => def.interval),
  [3000, 2200, 500, 2200],
  'only the hidden Practice 3 interval should change'
);
assert.deepEqual(
  practiceDefs.map((def) => def.minActiveMs),
  [9000, 12000, 8000, 10000],
  'all hidden-practice minimum active times should remain unchanged'
);

const estimatedPracticeMs = (
  3000
  + practiceDefs.reduce((sum, def) => sum + def.minActiveMs, 0)
  + 3000 * practiceDefs.length
);
assert.equal(estimatedPracticeMs, 54000, 'planned hidden-practice duration should remain 54 seconds');
assert.ok(
  estimatedPracticeMs >= 50000 && estimatedPracticeMs <= 58000,
  'planned hidden-practice duration should remain inside the accepted 50-58s band'
);

const normalStage1Defs = resolveStageWaveDefs({
  battleData: { stageId: 1, practiceMode: false },
  waveDefs: baseWaveDefs,
  getStageById,
});
assert.deepEqual(normalStage1Defs, [], 'public Stage 1 uses the paint round');

console.log('p15227 manual focus runtime actionability blocker: all assertions passed');
