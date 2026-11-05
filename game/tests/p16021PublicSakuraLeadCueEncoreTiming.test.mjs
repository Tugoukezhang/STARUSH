import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID,
  PUBLIC_STAGE1_SAKURA_ENCORE_PAINT_MULTIPLIER,
  PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS,
  canUsePublicStage1SakuraAction,
  getPublicStage1SakuraLeadCueTargetPriority,
  resolvePublicStage1SakuraEncorePaintAmount,
} from '../src/systems/PublicStage1SakuraActionContract.mjs';

const ROOT = new URL('../', import.meta.url);
const battleSource = await readFile(new URL('src/scenes/BattleScene.js', ROOT), 'utf8');
const htmlSource = await readFile(new URL('index.html', ROOT), 'utf8');

assert.equal(PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID, 'sakura');
assert.equal(PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS, 5000);
assert.equal(PUBLIC_STAGE1_SAKURA_ENCORE_PAINT_MULTIPLIER, 2);

assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: true,
  actionOwnerId: 'sakura',
  charge: 100,
}), true);
assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: false,
  actionOwnerId: 'sakura',
  charge: 100,
}), false, 'hidden practice must not receive Sakura public actions');
assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: true,
  actionOwnerId: 'kai',
  charge: 100,
}), false, 'identity mismatch must fail closed');
assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: true,
  actionOwnerId: 'sakura',
  charge: 99.99,
}), false, 'actions must not fire before their meter is ready');
assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: true,
  actionOwnerId: 'sakura',
  charge: 100,
  battlePaused: true,
}), false);
assert.equal(canUsePublicStage1SakuraAction({
  isPublicStage1: true,
  actionOwnerId: 'sakura',
  charge: 100,
  battleEnded: true,
}), false);

assert.equal(resolvePublicStage1SakuraEncorePaintAmount(14, false), 14);
assert.equal(resolvePublicStage1SakuraEncorePaintAmount(14, true), 28);
assert.equal(resolvePublicStage1SakuraEncorePaintAmount(-5, true), 0);

const priority = (role, state) => getPublicStage1SakuraLeadCueTargetPriority({
  publicStage1EnemyRole: role,
  publicStage1EnemyState: state,
  active: true,
});
assert.ok(priority('finale-boss', 'recovery') > priority('finale-weak-point', 'recovery'));
assert.ok(priority('finale-weak-point', 'recovery') > priority('spotlight-captain', 'recovery'));
assert.ok(priority('spotlight-captain', 'recovery') > priority('objective-disruptor', 'disrupting'));
assert.ok(priority('objective-disruptor', 'disrupting') > priority('stage-cue-emitter', 'recovery'));
assert.ok(priority('stage-cue-emitter', 'recovery') > priority('unlit-chaser', 'windup'));
assert.equal(priority('spotlight-captain', 'windup'), -1, 'closed captain windows are not valid cue targets');
assert.equal(priority('stage-cue-emitter', 'windup'), -1, 'closed emitter windows are not valid cue targets');

assert.ok(battleSource.includes("_isPublicBattleActionOwnedBy(PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID)"));
assert.ok(battleSource.includes('_triggerPublicSakuraLeadCue()'));
assert.ok(battleSource.includes('_isPublicSakuraEncoreWindowActive()'));
assert.ok(battleSource.includes('resolvePublicStage1SakuraEncorePaintAmount('));
assert.ok(!battleSource.includes('this._paintPublicStage1TargetsAt(this.player.x, this.player.y, STAGE1_UNLIT_HP)'),
  'Encore must not keep the old instant local enemy-delete shortcut');
assert.ok(htmlSource.includes('id="skill-special"'));
assert.ok(htmlSource.includes('<span id="special-label">扇奏</span><span id="special-fill">'));
assert.ok(htmlSource.includes('aria-label="绯樱：领唱扇奏"'));
assert.equal(htmlSource.includes('电脑：WASD'), false);

