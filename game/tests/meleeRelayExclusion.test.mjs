import test from 'node:test';import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {STAGE1_PAINT_PER_HIT} from '../src/utils/stage1PaintRound.mjs';
function fixture(id){
 const devices=[],enemies=[],paints=[],receipts=[];let time=1000;
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id},_battlePerformerContract:{publicActionOwnerId:id},battleRecord:{playerHitCount:0},player:{x:100,y:100,hp:5,active:true},currentColor:'blue',time:{now:1000,delayedCall(delay,callback){receipts.push({delay,callback});return{remove(){}};}},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>enemies},_stampGroundSplat(){},paintZone:{devices,currentZone:0,finaleMode:false,canReceivePaint:d=>!d.complete,applyPaint(d,amount){if(d.reject)return false;d.paint+=amount;paints.push({target:d,amount});return true;},getNearestPaintable:()=>devices[0]},_paintPublicStage1TargetsAt(x,y,amount,radius,color,target,observe){target.hp-=amount;paints.push({target,amount});observe?.({x:target.x,y:target.y,kind:'enemy'},target);return true;}};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;run.now=()=>time;run.growth.choose('relay');const melee=run.meleeCombat;
 const add=(x,y,extra={})=>{const d={x,y,zone:0,paint:0,complete:false,...extra};devices.push(d);return d;};
 const strike=target=>{assert(melee.beginBasic(target,time));time+=melee.kit.windup;melee.update(time);};
 return{s,run,melee,add,strike,devices,enemies,paints,receipts};
}
for(const id of ['kai','enjo']){
 test(id+' solo fixture never relays back onto the accepted source',()=>{
  const f=fixture(id),a=f.add(160,100);f.strike(a);assert.equal(a.paint,STAGE1_PAINT_PER_HIT);assert.equal(f.paints.length,1);assert.equal(f.run.getChoiceReview().relay,0);assert.equal(f.run.impacts,1);
 });
 test(id+' excludes the whole accepted fan and transfers once to a different fixture',()=>{
  const f=fixture(id),a=f.add(160,100),b=f.add(150,110),c=f.add(90,150);f.strike(a);
  assert.equal(a.paint,STAGE1_PAINT_PER_HIT);assert.equal(b.paint,STAGE1_PAINT_PER_HIT);assert.equal(c.paint,8);assert.equal(f.run.getChoiceReview().relay,1);assert.equal(f.run.impacts,1);assert.equal(f.melee.stats.contacts,2);
 });
 test(id+' rejected or occluded alternatives cannot cause a self-transfer',()=>{
  const f=fixture(id),a=f.add(160,100),b=f.add(150,110,{reject:true}),c=f.add(90,150,{publicStage1Suppressed:true});f.strike(a);
  assert.equal(a.paint,STAGE1_PAINT_PER_HIT);assert.equal(b.paint,0);assert.equal(c.paint,0);assert.equal(f.run.getChoiceReview().relay,0);
  const g=fixture(id),d=g.add(160,100),other=g.add(90,150);g.s.oldStreet.clearLine=(p,q)=>q!==other;g.strike(d);assert.equal(d.paint,STAGE1_PAINT_PER_HIT);assert.equal(other.paint,0);
 });
 test(id+' mixed enemy/fixture fan retains enemy priority and one echo count',()=>{
  const f=fixture(id);f.run.growth.choose('echo');const a=f.add(150,100),b=f.add(90,150);
  const enemy=(x,y)=>({x,y,hp:1000,active:true,drawRadius:12,publicStage1EnemyRole:'unlit-chaser'}),hit=enemy(160,100),next=enemy(230,100);f.enemies.push(hit,next);f.strike(hit);
  assert.equal(a.paint,STAGE1_PAINT_PER_HIT);assert.equal(b.paint,0);assert.equal(hit.hp,1000-STAGE1_PAINT_PER_HIT);assert.equal(next.hp,992);assert.equal(f.run.getChoiceReview().relay,1);assert.equal(f.run.impacts,1);assert.equal(f.receipts.length,0);
 });
}
