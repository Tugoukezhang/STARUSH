import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_158_ENEMY_CONTACT_EDGE_ALPHA'), 0.16);
  assert.equal(numericConstant('P15_158_ENEMY_CONTACT_EDGE_SCRATCH_ALPHA'), 0.11);
  assert.equal(numericConstant('P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH'), 1.05);
  assert.equal(numericConstant('P15_158_ENEMY_CONTACT_EDGE_RADIUS_OFFSET'), 7);
  assert.equal(numericConstant('P15_158_ENEMY_CONTACT_EDGE_SCRATCH_LENGTH'), 5);
  assert.ok(
    numericConstant('P15_158_ENEMY_CONTACT_EDGE_ALPHA') <= 0.16,
    'enemy contact edge arc alpha must stay below source-only readability threshold'
  );
  assert.ok(
    numericConstant('P15_158_ENEMY_CONTACT_EDGE_SCRATCH_ALPHA') <= 0.11,
    'enemy contact edge scratch alpha must stay weaker than the arc fragments'
  );
  assert.ok(
    numericConstant('P1_73_ENEMY_OUTLINE_DEPTH') < numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH'),
    'enemy contact edge should stay below the player-local danger rim'
  );
  assert.ok(
    numericConstant('P1_73_ENEMY_OUTLINE_DEPTH') < numericConstant('P1_67_BULLET_VISUAL_DEPTH'),
    'enemy contact edge should stay below player bullets'
  );
  assert.ok(
    numericConstant('P1_73_ENEMY_OUTLINE_DEPTH') < numericConstant('P15_131_LAUNCH_FLICK_DEPTH'),
    'enemy contact edge should stay below launch flick'
  );
  assert.ok(
    numericConstant('P1_73_ENEMY_OUTLINE_DEPTH') < numericConstant('P15_108N_HIT_SPARK_DEPTH'),
    'enemy contact edge should stay below hit spark'
  );
}

{
  const helperBlock = sourceBlock(
    battleSceneSource,
    '  _drawEnemyBodyContactPressureEdge(gfx, radius, enemyType) {',
    '  _attachStage1EnemyReadabilityOutline(enemy, enemyType, radius) {'
  );

  assert.ok(
    helperBlock.includes("enemyType !== 'trainee' && enemyType !== STAGE_1_PRACTICE_TARGET_TYPE"),
    'enemy contact edge helper should scope to trainee and stage1PracticeTarget only'
  );
  assert.ok(
    helperBlock.includes('radius + P1_73_ENEMY_OUTLINE_PADDING + P15_158_ENEMY_CONTACT_EDGE_RADIUS_OFFSET'),
    'enemy contact edge should derive its radius from the existing P1-73 outline padding'
  );
  assert.ok(
    helperBlock.includes('P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH'),
    'enemy contact edge should use the P15-158 line width constant'
  );
  assert.ok(
    helperBlock.includes('P15_158_ENEMY_CONTACT_EDGE_ALPHA'),
    'enemy contact edge should use the capped arc alpha constant'
  );
  assert.ok(
    helperBlock.includes('P15_158_ENEMY_CONTACT_EDGE_SCRATCH_ALPHA'),
    'enemy contact edge should use the weaker scratch alpha constant'
  );
  assert.ok(
    helperBlock.includes('P15_158_ENEMY_CONTACT_EDGE_SCRATCH_LENGTH'),
    'enemy contact edge should use the scratch length constant'
  );
  assert.ok(
    helperBlock.includes('0xDDEAF0') && helperBlock.includes('0x77D6C3') && helperBlock.includes('0xAAB7C4'),
    'enemy contact edge should use muted cream/mint/blue-gray colors'
  );
  assert.ok(
    (helperBlock.match(/gfx\.arc\(/g) || []).length >= 3,
    'enemy contact edge should use broken partial arc fragments'
  );
  assert.ok(
    (helperBlock.match(/gfx\.lineBetween\(/g) || []).length >= 2,
    'enemy contact edge should include short scratch lines'
  );

  [
    'this.add.graphics',
    'this.add.image',
    'load.image',
    'this.load',
    'preload',
    'registry',
    'public/art',
    '.png',
    'enemy_body_contact_pressure_edge_source',
    'phase15-p15-155',
    'STAGE_15_DRIFTING_LIGHTSTICK_TYPE',
    'STAGE_15_STAGE_MARKER_TARGET_TYPE',
    'strokeCircle',
    'fillCircle',
    'fillStyle',
    'this.tweens',
    'tweens.add',
    'duration',
    'repeat',
    'Math.sin',
    'setAlpha(',
    'setDepth(',
  ].forEach((forbidden) => {
    assert.equal(helperBlock.includes(forbidden), false, `enemy contact edge helper must stay draw-only and graphics-local: ${forbidden}`);
  });
}

{
  const attachBlock = sourceBlock(
    battleSceneSource,
    '  _attachStage1EnemyReadabilityOutline(enemy, enemyType, radius) {',
    '  _clearEnemyReadabilityOutline(enemy) {'
  );

  assert.ok(
    attachBlock.includes('this.add.graphics().setDepth(P1_73_ENEMY_OUTLINE_DEPTH)'),
    'enemy contact edge should reuse the existing P1-73 graphics node'
  );
  assert.ok(
    attachBlock.includes('this._drawEnemyBodyContactPressureEdge(enemy.readabilityOutline, radius, enemyType);'),
    'Stage 1 readability outline should draw the enemy contact pressure edge'
  );

  const outlineIndex = attachBlock.indexOf('enemy.readabilityOutline.strokeCircle(0, 0, radius + P1_73_ENEMY_OUTLINE_PADDING);');
  const edgeIndex = attachBlock.indexOf('this._drawEnemyBodyContactPressureEdge(enemy.readabilityOutline, radius, enemyType);');
  const holdHighlightIndex = attachBlock.indexOf('if (this._shouldUseHoldHighlightOptionalWindowCue(enemyType)) {');
  assert.ok(outlineIndex >= 0 && edgeIndex > outlineIndex, 'enemy contact edge should draw after the base P1-73 outline');
  assert.ok(holdHighlightIndex < 0 || edgeIndex < holdHighlightIndex, 'enemy contact edge should stay below the optional hold-highlight cue');
}

{
  const stage15PressureBlock = sourceBlock(
    battleSceneSource,
    '  _attachStage15PressureGraphics(enemy, enemyType, radius) {',
    '  _syncStage15PressureGraphics(enemy) {'
  );
  assert.equal(
    stage15PressureBlock.includes('_drawEnemyBodyContactPressureEdge'),
    false,
    'enemy contact edge must not enter Stage 1.5 pressure graphics'
  );
  assert.equal(stage15PressureBlock.includes('P15_158'), false, 'Stage 1.5 pressure graphics must not use P15-158 constants');
}

{
  [
    'enemy_body_contact_pressure_edge_source',
    'hostile_bullet_warning_hold_source',
    'stage_noise_pulse_context_source',
    'stage1_5_threat_boundary_reference',
    'phase15-p15-155',
    'enemy_attack_threat_telegraph_source_style_tile',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-155 source art: ${forbidden}`);
  });

  [
    'P15_158',
    'enemy_body_contact_pressure_edge',
    'hostile_bullet_warning',
  ].forEach((forbidden) => {
    assert.equal(stageWavesSource.includes(forbidden), false, `P15-158 must not change stage wave defs: ${forbidden}`);
    assert.equal(waveSystemSource.includes(forbidden), false, `P15-158 must not change WaveSystem: ${forbidden}`);
  });
}

{
  const relevantSurface = [
    sourceBlock(
      battleSceneSource,
      'const P15_158_ENEMY_CONTACT_EDGE_ALPHA',
      'const NOTE_ART_FRAMES'
    ),
    sourceBlock(
      battleSceneSource,
      '  _drawEnemyBodyContactPressureEdge(gfx, radius, enemyType) {',
      '  _clearEnemyReadabilityOutline(enemy) {'
    ),
  ].join('\n');

  [
    'shield',
    'buff',
    'reward',
    'task',
    'red dot',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
    'lock-on',
    'attack windup',
    'lane cue',
    'skill line',
    'arrow',
    'reticle',
  ].forEach((forbidden) => {
    assert.equal(relevantSurface.includes(forbidden), false, `enemy contact edge must not introduce forbidden semantics: ${forbidden}`);
  });
}

console.log('p15158 enemy body contact pressure edge: all assertions passed');
