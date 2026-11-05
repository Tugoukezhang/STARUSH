import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './motionStageFixture.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const BattleScene=loadBattleScene({Phaser:{Scene:class{}}});

function damageFixture(id){
  const f=fixture(id);
  Object.assign(f.s,{battleRecord:{playerHitCount:0},_consumeP15HostileProjectile(){},
    _spawnPlayerHitBeatFlash(){},cameras:{main:{shake(){}}},support:{gainFromTakeDamage(){}},
    tweens:{add(){}},_getPlayerVisualTarget:BattleScene.prototype._getPlayerVisualTarget});
  f.run.growth.choose('tempo');f.run.growth.choose('recovery');
  f.s.player.hp=4;f.draw(0);f.draw(500);
  return f;
}

for(const id of ['venus','genya','kai','enjo'])for(const mode of ['shot','action']){
  test(`${id}: recorded damage interrupts ${mode} even when anchor healing masks net HP loss`,()=>{
    const f=damageFixture(id),before=f.actor.hitSequence;
    if(mode==='shot')assert.equal(f.actor.notifyBasicShot(500,1,0,333),true);
    else assert.equal(f.run.triggerAction(),true);
    f.draw(516);
    f.run.onAnchor();assert.equal(f.s.player.hp,5);
    f.s.time.now=533;BattleScene.prototype._onEnemyHitPlayer.call(f.s);
    assert.equal(f.s.battleRecord.playerHitCount,1);assert.equal(f.s.player.hp,4);
    assert.equal(f.actor.notifyBasicShot(533,1,0,333),false,'unrendered damage cannot be hidden by another shot');
    f.draw(533);
    assert.equal(f.actor.hitSequence,before+1);
    assert.equal(f.actor.state,'hurt');assert.equal(f.actor.reactionImage.visible,true);
    assert.equal(f.actor.basicShotImage.visible,false);
    f.draw(540);assert.equal(f.actor.hitSequence,before+1,'do not retrigger the same recorded hit');
    f.draw(714);assert.equal(f.actor.reactionImage.visible,false,'180ms reaction still expires');
    f.actor.destroy();f.run.destroy();
  });
}

test('blocked contact and healing do not create reactions; pending hit survives pause',()=>{
  const f=damageFixture('kai'),before=f.actor.hitSequence;
  f.s.player.invulnerable=true;BattleScene.prototype._onEnemyHitPlayer.call(f.s);
  f.run.onAnchor();f.draw(516);
  assert.equal(f.actor.hitSequence,before);assert.equal(f.actor.reactionImage.visible,false);
  f.s.player.invulnerable=false;BattleScene.prototype._onEnemyHitPlayer.call(f.s);
  f.s._battlePaused=true;f.draw(533);assert.equal(f.actor.hitSequence,before);
  f.s._battlePaused=false;f.draw(550);assert.equal(f.actor.hitSequence,before+1);
  assert.equal(f.actor.reactionImage.visible,true);
});
