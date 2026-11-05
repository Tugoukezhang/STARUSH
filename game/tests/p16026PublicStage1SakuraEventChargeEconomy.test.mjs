import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS,
  resolvePublicStage1SakuraChargeAward,
} from '../src/systems/PublicStage1SakuraActionContract.mjs';

assert.deepEqual(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS, {
  REQUIRED_ANCHOR: 'required-anchor',
  THREAT_RESOLVED: 'threat-resolved',
  FINALE_ATTACK_RESPONSE: 'finale-attack-response',
  FINALE_WEAK_POINT: 'finale-weak-point',
});
assert.deepEqual(resolvePublicStage1SakuraChargeAward('required-anchor'), { special: 22, encore: 8 });
assert.deepEqual(resolvePublicStage1SakuraChargeAward('threat-resolved'), { special: 18, encore: 14 });
assert.deepEqual(resolvePublicStage1SakuraChargeAward('finale-attack-response'), { special: 20, encore: 12 });
assert.deepEqual(resolvePublicStage1SakuraChargeAward('finale-weak-point'), { special: 24, encore: 16 });
assert.deepEqual(resolvePublicStage1SakuraChargeAward('unknown'), { special: 0, encore: 0 });

const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const roundSource = readFileSync(new URL('../src/utils/stage1PaintRound.mjs', import.meta.url), 'utf8');

assert.ok(battleSource.includes('_awardPublicSakuraActionCharge(eventId)'));
assert.ok(battleSource.includes('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.REQUIRED_ANCHOR'));
assert.ok(battleSource.includes('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED'));
assert.ok(battleSource.includes('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_ATTACK_RESPONSE'));
assert.ok(battleSource.includes('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_WEAK_POINT'));
assert.equal(battleSource.includes('STAGE1_ENCORE_PASSIVE_PER_SEC'), false);
assert.equal(battleSource.includes('STAGE1_ENCORE_FROM_SPLAT'), false);
assert.equal(battleSource.includes('STAGE1_SPECIAL_CHARGE_MS'), false);
assert.equal(roundSource.includes('STAGE1_ENCORE_PASSIVE_PER_SEC'), false);
assert.equal(roundSource.includes('STAGE1_ENCORE_FROM_SPLAT'), false);
assert.equal(roundSource.includes('STAGE1_SPECIAL_CHARGE_MS'), false);

console.log('p16026 public Stage 1 Sakura event-charge economy: all assertions passed');
