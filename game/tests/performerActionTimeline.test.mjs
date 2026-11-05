import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
const api=await import('../src/utils/publicPerformerAction.mjs').catch(()=>({}));
function fixture(id){
 const timers=[],paints=[];
 const node=()=>({x:0,y:0,ox:0,oy:0,w:192,h:160,alpha:1,frame:{name:0},
  setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(x,y){this.ox=x;this.oy=y;return this;},setDisplaySize(w,h){this.w=w;this.h=h;return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(){return this;},setTint(){return this;},setTexture(key,frame){this.texture={key};this.frame.name=frame;return this;},destroy(){}});
 const s={battleData:{stageId:1,performerId:id},_userCastPresentation:true,
  time:{now:0,delayedCall(delay,fn){const row={delay,fn,remove(){this.removed=true;}};timers.push(row);return row;}},
  player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},battleRecord:{playerHitCount:0},
  _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,
  paintZone:{devices:[],currentZone:0,applyPaintAt(...args){paints.push(args);return true;}},
  enemies:{getChildren:()=>[]},oldStreet:{clearLine:()=>true},_stampGroundSplat(){},_paintPublicStage1TargetsAt:()=>false,
  _showRoundBanner(){},_updateHUD(){},textures:{exists:()=>true},add:{image:node,ellipse:node}};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
 const view=new UserCastPresentation(s,id);s.actorPresentation={direction:'left',userCastView:view};
 return {s,run,view,timers,paints,at(now,frozen=false){s.time.now=now;view.update(now,frozen);},destroy(){view.destroy();run.destroy();}};
}
test('current owner definitions expose immutable existing release schedules, not legacy or arbitrary keys',()=>{
 assert.equal(typeof api.getPublicPerformerAction,'function','shared action definitions missing');
 const a=api.getPublicPerformerAction('sakura');assert.deepEqual(a.releaseBeats,[0,100,200]);assert.equal(a.presentationMs,320);
 assert.equal(api.getPublicPerformerAction('kai').dashMs,160);assert.equal(api.getPublicPerformerAction('enjo').presentationMs,320);
 assert(Object.isFrozen(a)&&Object.isFrozen(a.releaseBeats));assert.throws(()=>a.releaseBeats.push(300));
 for(const id of ['venus','genya','toString',null])assert.equal(api.getPublicPerformerAction(id),null);
});
test('sampler validates timestamps, samples exact boundaries and never schedules or replays expired action',()=>{
 assert.equal(typeof api.samplePublicPerformerAction,'function','shared action sampler missing');
 const sample=now=>api.samplePublicPerformerAction('sakura',{sequence:2,direction:'left'},100,now);
 assert.equal(sample(99),null);assert.equal(sample(100).age,0);assert.equal(sample(299).phase,'release');
 assert.equal(sample(300).phase,'recovery');assert.equal(sample(419).age,319);assert.equal(sample(420),null);
 assert(Object.isFrozen(sample(120)));assert.equal(sample(NaN),null);
 assert.equal(api.samplePublicPerformerAction('kai',{sequence:0,direction:'left'},0,10),null);
 assert.equal(api.samplePublicPerformerAction('sakura',{sequence:1,direction:'bogus'},0,10),null);
 assert.equal(api.samplePublicPerformerAction('venus',{sequence:1,direction:'left'},0,10),null);
});
for(const id of ['sakura','kai','enjo']){
 test(id+': real Run schedules retain paint timing and compatibility object; active clock pauses and destroy clears snapshot',()=>{
  const f=fixture(id);try{
   assert.equal(typeof f.run.getActionPresentation,'function','Run action timeline missing');
   f.s.time.now=20;assert(f.run.triggerAction());assert.deepEqual(Object.keys(f.run.actionPresentation),['sequence','direction']);
   assert.equal(f.run.getActionPresentation().age,0);assert.equal(f.run.getActionPresentation().sequence,1);
   if(id==='sakura')assert.deepEqual(f.timers.map(t=>t.delay),[0,100,200]);
   if(id==='kai')assert.equal(f.run.dash.endsAt,180);
   f.s.time.now=120;f.run.pauseClock();const paused=f.run.getActionPresentation();
   f.s.time.now=5120;assert.deepEqual(f.run.getActionPresentation(),paused);f.run.resumeClock();
   assert.deepEqual(f.run.getActionPresentation(),paused);f.s.time.now=5340;assert.equal(f.run.getActionPresentation(),null);
   f.run.destroy();assert.equal(f.run.getActionPresentation(),null);assert.equal(f.run.actionStartedAt,null);
  }finally{f.destroy();}
 });
 test(id+': late first rendered action samples real age instead of restarting from notification',()=>{
  const f=fixture(id);try{f.at(0);f.s.time.now=20;assert(f.run.triggerAction());f.at(180);
   assert.equal(f.view.state,'action');assert.equal(f.view.image.frame.name,16,'160ms into original 320ms action');
   assert.equal(f.run.actions,1);assert.equal(f.s.battleRecord.playerHitCount,0);
  }finally{f.destroy();}
 });
 test(id+': expired unseen action does not replay; pause and hurt do not resurrect it',()=>{
  const f=fixture(id);try{f.at(0);f.s.time.now=20;assert(f.run.triggerAction());f.at(400);
   assert.equal(f.view.state,'idle','expired action must not start a new 320ms animation');
   f.s._specialCharge=100;f.s.time.now=420;assert(f.run.triggerAction());f.at(500);assert.equal(f.view.image.frame.name,15);
   f.run.pauseClock();f.at(5500,true);assert.equal(f.view.image.frame.name,15);f.run.resumeClock();f.at(5500);assert.equal(f.view.image.frame.name,15);
   f.s.battleRecord.playerHitCount++;f.at(5520);assert.equal(f.view.state,'hurt');f.at(5900);assert.equal(f.view.state,'idle');
  }finally{f.destroy();}
 });
}
test('synchronous run destruction during accepted paint cannot publish a new action timestamp',()=>{
 const f=fixture('enjo');try{f.s.paintZone.applyPaintAt=()=>{f.run.destroy();return true;};assert(f.run.triggerAction());
  assert.equal(typeof f.run.getActionPresentation,'function');assert.equal(f.run.getActionPresentation(),null);assert.equal(f.run.actionStartedAt,null);
 }finally{f.destroy();}
});
