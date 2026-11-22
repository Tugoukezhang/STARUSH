import test from 'node:test';
import assert from 'node:assert/strict';
import {applyActionCounterplay} from '../src/systems/ActionCounterplay388.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {ChapterChaserMotion,getChapterChaserRecoveryRemaining} from '../src/utils/chapterChaserContent.mjs';
import {disposeCombatObject} from '../src/systems/CombatObjectLifecycle.mjs';
function setup(id='enjo'){
 const timers=[],notices=[],enemies=[],bullets=[];
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id,campaignChapterId:'neon'},_battlePerformerContract:{publicActionOwnerId:id},
 player:{x:400,y:600,hp:5,active:true},_specialCharge:100,time:{now:100,delayedCall(ms,fn){timers.push(fn);return {remove(){}};}},
 oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>enemies},enemyBullets:{getChildren:()=>bullets},
 _stampGroundSplat(){},_showRoundBanner(){},_showPublicBattleNotice:t=>notices.push(t),_updateHUD(){},
 _disposeEnemyProjectile:(b,reason)=>disposeCombatObject(b,{reason}),
 _paintPublicStage1TargetsAt(x,y,amount,radius,color,exact,observer){let hit=false;for(const e of enemies){if(e.active&&e.hp>0&&Math.hypot(e.x-x,e.y-y)<=radius&&s.oldStreet.clearLine({x,y},e)){
 e.hp=Math.max(0,e.hp-amount);observer?.({x:e.x,y:e.y,kind:'enemy'},e);hit=true;}}return hit;},
 paintZone:{devices:[],applyPaintAt:()=>false,getPaintedCount:()=>0}};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
 const motion=new ChapterChaserMotion('neon');motion.state='windup';motion.path={origin:{x:400,y:560},unit:{x:0,y:1},length:144};
 const enemy={x:400,y:560,hp:1000,maxHp:1000,active:true,publicStage1EnemyRole:'unlit-chaser',publicStage1EnemyState:'windup',chapterChaserMotion:motion,moveVx:10,moveVy:180,chapterChaserCue:{destroy(){this.destroyed=true;}}};enemies.push(enemy);
 const bullet={x:400,y:560,active:true,paintDanmaku:true,destroy(){this.active=false;}};bullets.push(bullet);
 return {s,run,enemy,bullet,enemies,bullets,timers,notices};
}
test('real three role actions spend once, accepted contacts stop rush, live projectile disposal is idempotent',()=>{
 for(const id of ['sakura','kai','enjo']){const a=setup(id),cue=a.enemy.chapterChaserCue;
 assert.equal(a.run.triggerAction(),true);for(const fn of a.timers)fn();
 assert.deepEqual(a.run.actionCounterplayTotals,{projectiles:1,rushes:1});assert.equal(a.s._specialCharge,0);
 assert.equal(a.enemy.chapterChaserMotion.state,'recovery');assert.equal(a.enemy.moveVy,0);assert.equal(cue.destroyed,true);
 assert.equal(getChapterChaserRecoveryRemaining(a.enemy,a.run.now(),'neon'),720);
 assert.equal(getChapterChaserRecoveryRemaining(a.enemy,a.run.now()+720,'neon'),0);
 assert.equal(a.bullet.p16Disposed,true);assert.equal(a.run.triggerAction(),false);
 a.run.paint(400,560,1,100,null,null,{sequence:1,beat:2});assert.deepEqual(a.run.actionCounterplayTotals,{projectiles:1,rushes:1});
 assert.equal(a.notices.filter(t=>t.startsWith('演出反制')).length,1);a.run.destroy();}
});
test('ordinary paint and lethal skill contacts do not create interrupt or kill reward',()=>{
 const a=setup();a.run.paint(400,560,1,100);assert.equal(a.enemy.hp,999);assert.equal(a.enemy.chapterChaserMotion.state,'windup');assert.equal(a.bullet.active,true);assert.equal(a.run.actionCounterplayTotals,undefined);
 a.enemy.hp=1;a.run.triggerAction();assert.equal(a.enemy.hp,0);assert.equal(a.enemy.chapterChaserMotion.state,'windup');assert.deepEqual(a.run.actionCounterplayTotals,{projectiles:1,rushes:0});a.run.destroy();
});
test('walls, radius, protected pulse/ground/return, nonordinary bullets remain authoritative',()=>{
 const a=setup();a.enemies.length=0;a.bullets.length=0;
 for(const flags of [{publicStage1StageCuePulse:true},{publicHarborGroundStrike:true},{publicFinaleReturn:{}},{paintDanmaku:false},{x:900},{x:410}])a.bullets.push({...a.bullet,...flags});
 a.s.oldStreet.clearLine=(from,to)=>to.x!==410;a.run.triggerAction();assert(a.bullets.every(b=>b.active));assert.equal(a.run.actionCounterplayTotals,undefined);a.run.destroy();
});
test('paused, dead, restoring, superseded sequence, foreign owner and target fail closed',()=>{
 for(const patch of [a=>a.s._battlePaused=true,a=>a.s.player.hp=0,a=>a.s._restoringPublicBattleCheckpoint=true,a=>a.run.actions=2,a=>a.s.publicPerformerRun={},a=>a.run.choiceOpen=true,a=>a.s.paintZone.finaleMode=true,a=>a.run.context={modeId:'training'}]){
 const a=setup();a.run.actions=1;patch(a);
 assert.deepEqual(applyActionCounterplay(a.run,{release:{sequence:1},receipt:{targets:()=>[a.enemy]},x:400,y:560,radius:100}),{projectiles:0,rushes:0});assert.equal(a.bullet.active,true);a.run.destroy();}
 const a=setup();a.run.actions=1;a.bullets.length=0;
 assert.deepEqual(applyActionCounterplay(a.run,{release:{sequence:1},receipt:{targets:()=>[{...a.enemy}]},x:400,y:560,radius:100}),{projectiles:0,rushes:0});a.run.destroy();
});
