import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './motionStageFixture.mjs';
import {solveLeg} from '../src/systems/SakuraFootMotion.mjs';

const ids=['sakura','venus','genya','kai','enjo'];
const stateOf=f=>f.actor.sakuraView?.state??f.actor.footRig.state;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('equal-length folded legs keep the true ankle instead of an artificial minimum offset',()=>{
 for(const distance of [0,.0001,.007,.02]){
  const hip={x:100,y:100},ankle={x:100,y:100+distance},g=solveLeg(hip,ankle,6,6);
  near(g.ankle.x,ankle.x);near(g.ankle.y,ankle.y);near(g.error,0);
  near(Math.hypot(g.knee.x-hip.x,g.knee.y-hip.y),6);
  near(Math.hypot(g.knee.x-ankle.x,g.knee.y-ankle.y),6);
 }
});
for(const id of ids)test(`${id}: sustained run shows support at every supported frame rate`,()=>{
 for(const fps of [15,30,60,120])for(const [ux,uy] of [[1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
  const f=fixture(id),dt=1000/fps;f.draw(0);let samples=0,support=0,gap=0,maxGap=0,previous=null;
  for(let n=1;n<=fps*4;n++){
   const root={x:f.s.player.x+ux*250/fps,y:f.s.player.y+uy*250/fps};
   f.draw(n*dt,ux*250/fps,uy*250/fps);near(f.s.player.x,root.x);near(f.s.player.y,root.y);
   const s=stateOf(f),legs=f.actor.sakuraView?.state.legGeometry??f.actor.footRig.geometry;
   assert.ok(legs.every(g=>g.error<.02),`${id}/${fps}: visible ankle unreachable`);
   const offset=f.actor.sakuraView?f.actor.sakuraView.visualRoot.y-f.s.player.y:f.actor.footRig.upperOffset;
   assert.ok(Math.abs(offset)<10,`${id}/${fps}: excessive body offset ${offset}`);
   if(n>fps){
    samples++;
    if(s.feet.some(foot=>foot.contact)){support++;gap=0;}else{gap+=dt;maxGap=Math.max(maxGap,gap);}
    s.feet.forEach((foot,i)=>{
     if(previous&&foot.contact&&previous[i].contact&&foot.plantId===previous[i].plantId){near(foot.x,previous[i].x);near(foot.y,previous[i].y);}
    });
   }
   previous=structuredClone(s.feet);
  }
  assert.ok(support/samples>=.45,`${id}/${fps}/${ux},${uy}: support only ${support}/${samples}`);
  assert.ok(maxGap<=1000/fps+60,`${id}/${fps}: extended airborne interval ${maxGap}`);
  f.actor.destroy();
 }
});

test('five actors preserve cadence, waist attachment, running attacks and settled support',()=>{
 for(const id of ids){
  const f=fixture(id);f.draw(0);let now=0,travel=0;
  for(let n=1;n<=240;n++){
   now+=1000/60;const dx=n<120?250/60:-250/60;travel+=Math.abs(dx);
   if(id!=='sakura'&&n%15===0)f.actor.notifyBasicShot(now,100,0,300);
   f.draw(now,dx,0);const s=stateOf(f);near(s.travel,travel);near(s.phase,(travel/(f.actor.footRig?.footOptions.stride??68))%1);
   if(id!=='sakura')near(f.actor.playerImage.y,f.s.player.y-13+f.actor.footRig.upperOffset);
  }
  f.s._battlePaused=true;const pose=JSON.stringify(stateOf(f));f.draw(now+5000);assert.equal(JSON.stringify(stateOf(f)),pose);
  f.s._battlePaused=false;for(let n=1;n<=30;n++)f.draw(now+5000+n*16);
  const s=stateOf(f);assert.equal(s.mode,'idle');assert.ok(s.feet.every(foot=>foot.contact&&Math.abs(foot.lift)<1e-8));
  f.actor.destroy();
 }
});
