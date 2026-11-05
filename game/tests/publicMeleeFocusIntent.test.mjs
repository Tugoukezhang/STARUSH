import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {PublicTargetFocus} from '../src/systems/PublicTargetFocus.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';

function harness(t,id='kai'){
 const doc=createDocument(),handlers=new Map(),enemies=[],devices=[],paint=[],stamps=[],timers=[],blocked=new Set();
 const scene={battleData:{stageId:1,performerId:id},_userCastPresentation:true,_isPublicStage1Round:()=>true,
  _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,battleRecord:{playerHitCount:0},
  player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},currentColor:'blue',
  input:{on(k,fn){if(!handlers.has(k))handlers.set(k,new Set());handlers.get(k).add(fn);},off(k,fn){handlers.get(k)?.delete(fn);}},
  time:{now:0,delayedCall(delay,fn){const row={delay,fn,remove(){this.removed=true;}};timers.push(row);return row;}},
  paintZone:{currentZone:0,devices,canReceivePaint:d=>!d.complete&&!d.publicStage1Suppressed,
   applyPaint(d,n){paint.push(d);d.paint=(d.paint||0)+n;return true;},applyPaintAt:()=>true,
   getNearestPaintable:(_x,_y,accept)=>devices.find(accept)||null},
  enemies:{getChildren:()=>enemies},oldStreet:{clearLine:(_a,b)=>!blocked.has(b)},
  cameras:{main:{width:800,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,o)=>Object.assign(o,{x,y})}}},
  actorPresentation:{direction:'left',notifyBasicShot:()=>true,userCastView:{state:'idle'}},
  _getPublicStage1PaintTargetRange:()=>340,_getPublicStage1PaintShotOrigin:()=>({x:300,y:400}),_isMobileControlPointer:()=>false,
  _stampGroundSplat:(...a)=>stamps.push(a),_paintPublicStage1TargetsAt:(x,y,n,_r,_c,target,observe)=>{
   if(!target)return false;paint.push(target);target.hp-=n;observe?.({x,y,kind:'enemy'},target);return true;},
  _showPublicBattleNotice(){},_showRoundBanner(){},_updateHUD(){}};
 const run=new PublicStage1PerformerRun(scene);scene.publicPerformerRun=run;
 let clock=0;const focus=new PublicTargetFocus(scene,{doc,clock:()=>clock});scene.publicTargetFocus=focus;
 const tap=target=>{const p={id:1,x:target.x,y:target.y};for(const fn of handlers.get('pointerdown')||[])fn(p);
  clock+=40;for(const fn of handlers.get('pointerup')||[])fn(p);clock+=400;};
 const enemy=(x,y=400)=>{const row={x,y,hp:80,active:true,drawRadius:12,publicStage1EnemyRole:'unlit-chaser'};enemies.push(row);return row;};
 const device=(x,y=300)=>{const row={id:'d'+x,x,y,zone:0,complete:false,label:'灯箱'};devices.push(row);return row;};
 t.after(()=>{run.destroy();focus.destroy();});
 return{scene,run,focus,doc,enemies,devices,paint,stamps,timers,blocked,tap,enemy,device};
}

test('real melee selection retains remote action intent without granting basic attack reach or starving a near target',t=>{
 const Battle=loadBattleScene({Phaser:{Scene:class{}}});
 for(const id of ['kai','enjo']){
  const f=harness(t,id),near=f.enemy(350),far=f.enemy(460);f.tap(far);
  assert.equal(f.focus.getTarget(),far,'remote intent survives original 340-unit action boundary');
  assert.equal(f.run.meleeCombat.canAimAt(far),false);assert.equal(f.run.meleeCombat.beginBasic(far),false);
  assert.equal(Battle.prototype._selectAutoAimTarget.call(f.scene),near,'actual Scene continues legal local attack');
  assert(f.run.meleeCombat.beginBasic(near));f.scene.time.now=200;f.run.meleeCombat.update();
  assert(f.paint.includes(near));assert(!f.paint.includes(far));assert.equal(far.hp,80);
 }
});

test('remote marker is a lock, not an in-range attack cue, and transitions on real movement',t=>{
 for(const id of ['kai','enjo']){
  const f=harness(t,id),far=f.enemy(460);f.tap(far);f.focus.update();const node=f.doc.getElementById('public-target-focus');
  assert.equal(node.hidden,false);assert.equal(node.dataset.state,'locked');assert.match(node.textContent,/锁定/);
  f.scene.player.x=410;f.focus.update();assert.equal(node.dataset.state,'in-range');assert.match(node.textContent,/集火/);
  assert.equal(f.focus.getTarget(),far);assert.equal(f.run.meleeCombat.selectTarget(),far);
 }
});

test('stationary sword captures selected bearing once; moving input and hammer ignore manual steering',t=>{
 const f=harness(t),far=f.enemy(460);f.enemy(280);f.tap(far);assert(f.run.triggerAction());
 assert.deepEqual({x:f.run.dash.x,y:f.run.dash.y},{x:1,y:0});far.x=140;f.tap(far);
 f.scene.time.now=50;assert.deepEqual(f.run.movement(0,0),{vx:700,vy:0});assert.equal(f.run.actions,1);
 const moving=harness(t),right=moving.enemy(460);moving.tap(right);moving.scene.player.body.velocity={x:0,y:-100};
 assert(moving.run.triggerAction());assert.deepEqual({x:moving.run.dash.x,y:moving.run.dash.y},{x:0,y:-1});
 const hammer=harness(t,'enjo'),target=hammer.enemy(460);hammer.tap(target);assert.equal(hammer.focus.getTarget(),target);
 assert(hammer.run.triggerAction());assert.deepEqual(hammer.stamps[0].slice(0,2),[300,400]);assert.equal(hammer.run.dash,null);
});

test('melee intent still rejects cover, dead bodies, completed or future fixtures, out-of-action-range and unowned objects',t=>{
 for(const kind of ['wall','dead','hp','removed','range','complete','zone','suppressed']){
  const f=harness(t),target=['complete','zone','suppressed'].includes(kind)?f.device(450):f.enemy(460);f.tap(target);
  assert.equal(f.focus.getTarget(),target,kind);
  if(kind==='wall')f.blocked.add(target);if(kind==='dead')target.active=false;if(kind==='hp')target.hp=0;
  if(kind==='removed')f.enemies.splice(0);if(kind==='range')target.x=650;if(kind==='complete')target.complete=true;
  if(kind==='zone')target.zone=1;if(kind==='suppressed')target.publicStage1Suppressed=true;
  assert.equal(f.focus.getTarget(),null,kind);assert.equal(f.doc.getElementById('public-target-focus').hidden,true,kind);
 }
});

test('remote fixture intent uses the original action geometry and pause-safe dash ownership',t=>{
 const f=harness(t),d=f.device(450,300);f.tap(d);assert.equal(f.focus.getTarget(),d);assert(f.run.triggerAction());
 const n=Math.hypot(150,-100);assert.equal(f.run.dash.x,150/n);assert.equal(f.run.dash.y,-100/n);
 f.scene.time.now=50;f.run.pauseClock();f.scene._battlePaused=true;f.scene.time.now=5000;assert.equal(f.run.now(),50);
 assert.equal(f.focus.getTarget(),null);f.run.resumeClock();f.scene._battlePaused=false;f.scene.time.now=5050;
 assert.equal(f.focus.getTarget(),d);assert.deepEqual(f.run.movement(0,0),{vx:150/n*700,vy:-100/n*700});
 f.scene.time.now=5110;assert.deepEqual(f.run.movement(1,2),{vx:1,vy:2});assert.equal(f.run.dash,null);
});

test('owner gates and destroy invalidate remote intent without timers, saved focus or listener leaks',t=>{
 const f=harness(t),target=f.enemy(460);f.tap(target);assert.equal(f.focus.getTarget(),target);
 f.scene._battlePerformerContract.publicActionOwnerId='enjo';assert.equal(f.focus.getTarget(),null);assert.equal(f.run.actions,0);
 assert.equal(f.timers.length,0);f.focus.destroy();assert.equal(f.doc.getElementById('public-target-focus'),null);
 assert.equal(f.focus.getTarget(),null);assert.equal(Object.hasOwn(f.run.growth.snapshot(),'focus'),false);
});

test('focus eligibility validates single targets without repeated full candidate sorts or quadratic cover checks',t=>{
 const f=harness(t);for(let i=0;i<20;i++)f.enemy(350+i*2);let lines=0,lists=0;
 f.scene.oldStreet.clearLine=()=>{lines++;return true;};
 for(const name of ['targets','fixtureTargets']){const original=f.run[name].bind(f.run);f.run[name]=(...a)=>{lists++;return original(...a);};}
 f.tap(f.enemies[0]);assert.equal(f.focus.getTarget(),f.enemies[0]);
 assert.equal(lists,0,'selection must not repeatedly build sorted action lists');assert(lines<=70,'cover queries scale with candidates, not squared');
 lines=0;f.focus.update();f.run.meleeCombat.selectTarget();assert.equal(lists,0);assert(lines<=12,'selected target revalidation is local');
});
