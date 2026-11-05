import test from 'node:test';import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import * as roles from '../src/systems/PublicStage1EnemyRoles.mjs';
const Phaser={Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Distance:{Between:(x,y,a,b)=>Math.hypot(a-x,b-y)}}};
const Battle=loadBattleScene({Phaser});
function fixture(){
 const boss={active:true,hp:60,maxHp:60,x:500,y:310,drawRadius:20,publicStage1EnemyRole:'finale-boss',publicStage1EnemyState:'windup'},enemies=[boss],calls={dispose:[],fx:[],damage:0};
 const s=Object.assign(Object.create(Battle.prototype),{battleData:{stageId:1,performerId:'sakura'},_userCastPresentation:true,_battleEnded:false,_battlePaused:false,player:{active:true,hp:5,x:500,y:430},
  _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,paintZone:{getNearestPaintable:()=>null},publicStage1Finale:{snapshot:()=>({active:true,phase:'attack'})},publicPerformerRun:{now:()=>1234,onImpact(){throw Error('blocked shot must not award impact')}},
  enemies:{getChildren:()=>enemies,children:{iterate:fn=>enemies.forEach(fn)}},oldStreet:{clearLine:()=>true},_getPublicStage1PaintShotOrigin:()=>({x:500,y:418}),_publicStage1FinaleBoss:boss,
  actorPresentation:{userCastView:{weaponFx:{blocked:info=>calls.fx.push({...info,blocked:true}),impact(){throw Error('armor must not reuse empty-ground paint burst')}}}},_disposePlayerProjectile:(b,reason)=>{b.active=false;calls.dispose.push(reason);},_stampGroundSplat(){throw Error('blocked shot must not add heat/ground')},_paintPublicStage1TargetsAt(){calls.damage++;},_isPublicSakuraEncoreWindowActive:()=>false});
 return {s,boss,enemies,calls,bullet:()=>({active:true,paintShot:true,x:500,y:314,color:'pink',moveVx:0,moveVy:-520})};
}
test('actual ordinary auto aim keeps a protected real Boss as fallback without making it damageable',()=>{
 const {s,boss}=fixture();assert.equal(roles.canEnemyBePublicStage1PaintTarget(boss),false);assert.equal(s._selectAutoAimTarget(),boss);
 assert.equal(typeof roles.isProtectedPublicStage1Boss,'function');assert.equal(roles.isProtectedPublicStage1Boss(boss),true);assert.equal(roles.canEnemyBePublicStage1PaintTarget(boss),false);
});
test('real weak point and any other eligible target still win over the protected fallback',()=>{
 const {s,boss,enemies}=fixture(),weak={active:true,hp:3,x:438,y:340,publicStage1EnemyRole:'finale-weak-point'};enemies.push(weak);assert.equal(s._selectAutoAimTarget(),weak);enemies.pop();
 const chaser={active:true,hp:3,x:500,y:550,publicStage1EnemyRole:'unlit-chaser'};enemies.push(chaser);assert.equal(s._selectAutoAimTarget(),chaser);enemies.pop();boss.publicStage1EnemyState='recovery';assert.equal(s._selectAutoAimTarget(),boss);assert.equal(roles.canEnemyBePublicStage1PaintTarget(boss),true);
});
test('protected fallback never grants through-wall, out-of-range, dead, orphaned, paused or hidden targeting',()=>{
 const cases=[f=>f.s.oldStreet.clearLine=()=>false,f=>f.boss.x=5000,f=>f.boss.active=false,f=>f.boss.destroyed=true,f=>f.boss.hp=0,f=>f.enemies.length=0,f=>f.s._userCastPresentation=false,f=>f.s.battleData.practiceMode=true,f=>f.s.battleData.defenseMode=true,f=>f.s._isFinaleTrialRound=()=>true,f=>f.s._battlePaused=true,f=>f.s._battleEnded=true,f=>f.s.publicStage1Finale.snapshot=()=>({active:false})];
 for(const change of cases){const f=fixture();change(f);assert.equal(f.s._selectAutoAimTarget(),null,String(change));}
});
test('actual protected contact consumes once, shows non-damage feedback, never paints, charges or damages',()=>{
 const {s,boss,calls,bullet}=fixture(),b=bullet();s._onBulletHitEnemy(b,boss);assert.equal(b.active,false);assert.deepEqual(calls.dispose,['boss-protected']);assert.equal(calls.damage,0);assert.equal(boss.hp,60);assert.equal(boss.publicBlockedHitAt,1234);assert.equal(calls.fx.length,1);assert.equal(calls.fx[0].blocked,true);assert.equal(calls.fx[0].angle,-Math.PI/2);s._onBulletHitEnemy(b,boss);assert.equal(calls.fx.length,1);
});
test('manual landing at the protected body follows the same no-reward contact, not the ground-deposition path',()=>{
 const {s,boss,calls,bullet}=fixture(),b=bullet();s._detonatePaintBullet(b);assert.equal(b.active,false);assert.equal(boss.hp,60);assert.deepEqual(calls.dispose,['boss-protected']);assert.equal(calls.damage,0);
});

test('priority weak-point projectiles retain their original path through the protected body, including a near-body origin',()=>{
 const {s,boss,enemies,calls,bullet}=fixture(),weak={active:true,hp:3,x:562,y:340,publicStage1EnemyRole:'finale-weak-point'};
 enemies.push(weak);s._publicStage1FinaleWeakPoint=weak;
 const b={...bullet(),x:510,y:320,paintTargetX:562,paintTargetY:340,moveVx:500,moveVy:30};
 s._onBulletHitEnemy(b,boss);assert.equal(b.active,true);assert.equal(calls.dispose.length,0);assert.equal(boss.hp,60);
 assert.equal(s._selectAutoAimTarget(),weak);weak.hp=0;
 assert.equal(s._tryBlockPublicBossProjectile(b,boss),true,'a destroyed weak point cannot bypass armor');assert.equal(boss.hp,60);
});
test('protected contact helper rejects unrelated contacts, missing contact, recovery, inactive shots and hidden modes',()=>{
 const changes=[f=>f.boss.publicStage1EnemyState='recovery',f=>f.s.battleData.practiceMode=true,f=>f.s.battleData.defenseMode=true,f=>f.s._isFinaleTrialRound=()=>true,f=>f.s._userCastPresentation=false,f=>f.s._battlePaused=true];
 for(const change of changes){const f=fixture();change(f);const b=f.bullet();assert.equal(f.s._tryBlockPublicBossProjectile(b,f.boss),false);assert.equal(b.active,true);assert.equal(f.calls.dispose.length,0);}
 const f=fixture();assert.equal(f.s._tryBlockPublicBossProjectile({...f.bullet(),x:800},null),false);assert.equal(f.s._tryBlockPublicBossProjectile(f.bullet(),{active:true}),false);assert.equal(f.s._tryBlockPublicBossProjectile({...f.bullet(),active:false},f.boss),false);
});
