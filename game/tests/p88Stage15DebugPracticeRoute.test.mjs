import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeBattleData,
  resolveStageWaveDefs,
  shouldRecordStage1Clear,
  shouldTrackStage1ReplayObjective,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';
import {
  BATTLE_RESULT_ACTIONS,
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  return null;
}

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

{
  assert.equal(normalizeBattleData({ stageId: 1, practiceMode: true }, getStageById).practiceMode, true);
  assert.equal(normalizeBattleData({ stageId: 1 }, getStageById).practiceMode, false);
  assert.equal(normalizeBattleData({ stageId: 1, practiceMode: false }, getStageById).practiceMode, false);
  assert.equal(
    normalizeBattleData({ stageId: 1, practiceMode: 'yes' }, getStageById).practiceMode,
    false,
    'practiceMode must stay a strict boolean'
  );
}

{
  assert.equal(shouldRecordStage1Clear({ stageId: 1, practiceMode: true, isVictory: true }), false);
  assert.equal(shouldTrackStage1ReplayObjective({ stageId: 1, practiceMode: true }), false);
  assert.equal(shouldRecordStage1Clear({ stageId: 1, practiceMode: false, isVictory: true }), true);
  assert.equal(shouldRecordStage1Clear({ stageId: 1, isVictory: true }), true);
  assert.equal(shouldRecordStage1Clear({ stageId: 1, practiceMode: false, isVictory: false }), false);
  assert.equal(shouldRecordStage1Clear({ stageId: 2, practiceMode: false, isVictory: true }), false);
  assert.equal(shouldTrackStage1ReplayObjective({ stageId: 1, practiceMode: false }), true);
  assert.equal(shouldTrackStage1ReplayObjective({ stageId: 1 }), true);
  assert.equal(shouldTrackStage1ReplayObjective({ stageId: 2, practiceMode: false }), false);
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true, p47Stage1ReplayObjectiveIndex: 0 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(defs.length, 4, 'practice uses 4 pacing segments');
  assert.deepEqual(defs.map((def) => def.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(defs[0].enemies, [{ type: 'trainee', count: 2 }]);
  assert.deepEqual(defs[1].enemies, [{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]);
  assert.deepEqual(defs[2].enemies, [
    { type: 'trainee', count: 1 },
    { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
  ]);
  assert.deepEqual(defs[3].enemies, [{ type: STAGE_1_PRACTICE_TARGET_TYPE, count: 1 }]);
  const allowed = new Set([
    'trainee',
    STAGE_1_PRACTICE_TARGET_TYPE,
    STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
    STAGE_15_STAGE_MARKER_TARGET_TYPE,
  ]);
  defs.flatMap((def) => def.enemies.map((enemy) => enemy.type)).forEach((type) => {
    assert.equal(allowed.has(type), true, `practice keeps a locked hidden-practice type set: ${type}`);
  });
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 0 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(defs, [], 'public Stage 1 uses the paint round; hidden practice stays separate');
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
  });
  assert.deepEqual(
    config.buttons.map((button) => button.action),
    [BATTLE_RESULT_ACTIONS.RETRY, BATTLE_RESULT_ACTIONS.TITLE],
    'result keeps only retry and title'
  );
  const copy = [
    config.title,
    ...config.descriptionLines,
    config.objectiveLine,
    config.climaxLine,
    ...config.supplementLines,
    ...config.buttons.map((button) => button.label),
  ].filter(Boolean).join('\n');
  ['next', 'reward', 'XP', 'drop', 'currency', 'gacha', 'shop', 'Stage 2'].forEach((forbidden) => {
    assert.equal(copy.includes(forbidden), false, `practice result must not surface: ${forbidden}`);
  });
}

{
  const titleSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8');

  assert.ok(titleSource.includes('p88Stage15Practice'), 'TitleScene wires the practice query param');
  assert.ok(titleSource.includes('practiceMode'), 'TitleScene sets practiceMode on battleData');
  assert.ok(titleSource.includes("query.has('debug')"), 'practice route stays behind the existing debug entry');
  assert.ok(titleSource.includes('p15SetlistCueExperiment'), 'TitleScene should carry the optional Setlist Cue experiment flag');
  assert.ok(
    titleSource.includes("query.get('p15SetlistCue') === '1'"),
    'Setlist Cue experiment should require its own extra debug query flag'
  );

  assert.ok(battleSource.includes('writeP15Stage1ClearCount'), 'normal Stage 1 still persists clear count');
  assert.ok(battleSource.includes('writeP47Stage1ReplayObjectiveIndex'), 'normal Stage 1 still tracks replay objective');
  assert.ok(battleSource.includes('practiceMode'), 'BattleScene end path consults practiceMode');

  assert.equal(titleSource.includes('this.load.image('), false, 'practice entry adds no image asset');
  assert.equal(titleSource.includes('this.load.audio('), false, 'practice entry adds no audio asset');
  assert.equal(stageWavesSource.includes('this.load'), false, 'wave resolver adds no asset load');
}
