import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  canEnemyUseLegacyBottomChaseAI,
} from '../src/systems/PublicStage1EnemyRoles.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

Object.values(PUBLIC_STAGE1_ENEMY_ROLES).forEach((role) => {
  assert.equal(canEnemyUseLegacyBottomChaseAI({
    enemy: { active: true, publicStage1EnemyRole: role },
    isPublicStage1: true,
  }), false, `${role} must stay under its authored public role owner`);
});

assert.equal(canEnemyUseLegacyBottomChaseAI({
  enemy: { active: true, publicStage1EnemyRole: null },
  isPublicStage1: true,
}), true, 'an untagged legacy enemy must retain the existing public fallback AI');
assert.equal(canEnemyUseLegacyBottomChaseAI({
  enemy: { active: true, publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS },
  isPublicStage1: false,
}), true, 'non-public battle behavior must not be changed by a public-role guard');
assert.equal(canEnemyUseLegacyBottomChaseAI({
  enemy: { active: false, publicStage1EnemyRole: null },
  isPublicStage1: true,
}), false);
assert.equal(canEnemyUseLegacyBottomChaseAI({
  enemy: { active: true, destroyed: true, publicStage1EnemyRole: null },
  isPublicStage1: true,
}), false);

const legacyAiBlock = sourceBlock(
  battleSource,
  '    // 底部边界 + 敌人AI：到达底部后主动接近玩家，不停留',
  '    // BPM灯光脉冲 + 聚光灯呼吸',
);
const guardIndex = legacyAiBlock.indexOf('canEnemyUseLegacyBottomChaseAI({');
const randomAiIndex = legacyAiBlock.indexOf('if (!e.aiTimer)');
assert.ok(guardIndex >= 0, 'legacy AI loop must call the public authored-role ownership guard');
assert.ok(randomAiIndex > guardIndex, 'ownership guard must run before random aiTimer/moveVx assignment');
assert.ok(legacyAiBlock.includes('isPublicStage1: this._isPublicStage1Round()'));

const finaleSpawnBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1FinaleBoss() {',
  '  _resolvePublicStage1FinaleWeakPoint('
);
assert.equal(
  /moveV[xy]\s*=/.test(finaleSpawnBlock),
  false,
  'the fix must not hide ownership leakage by inventing finale movement values',
);
assert.equal(
  /Number\.isFinite|fallback|setPosition\([^)]*\|\|/.test(finaleSpawnBlock),
  false,
  'the fix must not mask non-finite finale coordinates with runtime fallbacks',
);

console.log('p16020a public Stage 1 authored role legacy AI ownership: all assertions passed');
