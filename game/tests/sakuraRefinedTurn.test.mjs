import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
import {RefinedVisualTurn} from '../src/utils/sakuraRefinedTurn.mjs';
const cardinal=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-refined-20261006/views.json',import.meta.url))).views;
const oblique=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-oblique-20261006/views.json',import.meta.url))).views;
const rigs={...cardinal,...oblique};
test('180-degree actual movement visits neighboring views without changing root or gait distance',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';c.update({now:0,x:220,y:580});
 const sequence=[];for(let i=1;i<=12;i++){const f=c.update({now:i*16,x:220-i*2,y:580});sequence.push(f.lowerDirection);assert.equal(f.root.x,220-i*2);assert.equal(f.root.y,580);assert.equal(f.distance,i*2*40/64);assert.equal(f.scale,.24);assert.equal(f.groundY,606);assert(f.layers.length<=2);for(const foot of Object.values(f.contacts))assert(foot.error<1e-6);}
 const views=sequence.filter((d,i)=>!i||d!==sequence[i-1]);assert.deepEqual(views,['front-right','front','front-left','left']);
 assert.equal(c.previous.visualTurn.active,false);assert.equal(c.previous.visualTurn.requested,'left');
});
test('turn uses latest actual movement and freezes, not a queue of stale directions',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';c.update({now:0,x:220,y:580});
 const turn=c.update({now:16,x:218,y:580});assert.equal(turn.lowerDirection,'front-right');
 assert.deepEqual(c.update({now:516,x:218,y:580,frozen:true}),turn);
 const corrected=c.update({now:532,x:220,y:580});assert.equal(corrected.lowerDirection,'right');assert.equal(corrected.visualTurn.active,false);assert.equal(corrected.clock,32);assert.equal(corrected.distance,2.5);
});
test('four-view fallback and exact locked attack direction remain immediate',()=>{
 const old=new SakuraRefinedWorldFrame(cardinal);old.controller.direction='right';old.update({now:0,x:220,y:580});const fallback=old.update({now:16,x:218,y:580});assert.equal(fallback.lowerDirection,'left');assert.equal(fallback.visualTurn.poseBlend,false,'Four-view fallback must not receive new pose transitions');
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';c.update({now:0,x:220,y:580});
 const attack={id:7,angle:Math.PI,direction:'left',phase:'release',progress:.5};
 const f=c.update({now:16,x:218,y:580,attack});assert.equal(f.lowerDirection,'front-right');assert.equal(f.upperDirection,'left');assert.equal(f.attackId,7);assert.equal(f.attackPhase,'release');assert(f.layers[0].gripError<1e-7);
});
test('eye cover prioritizes actual hit, reopens, and never appears on rear views',()=>{
 for(const direction of Object.keys(rigs)){
  const closed=sampleRefinedPose({rigs,direction,time:0,hurtTime:0});assert.equal(closed.blink,!direction.startsWith('back'));
  const reopened=sampleRefinedPose({rigs,direction,time:3050,hurtTime:180});assert.equal(reopened.blink,false,'Periodic blink must not extend hit reaction');
  const ordinary=sampleRefinedPose({rigs,direction,time:3050});assert.equal(ordinary.blink,!direction.startsWith('back'));
  assert.equal(closed.phase,'hurt');assert.equal(closed.fanOpen,0);assert(closed.gripError<1e-7);
 }
});
test('relative-bind upper rotations settle, while reaction/attack interrupt the blend',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';c.update({now:0,x:220,y:580});
 const f=c.update({now:16,x:218,y:580});assert.equal(f.visualTurn.poseBlend,true);
 const hit=c.update({now:32,x:216,y:580,hitCount:1});assert(hit.hurt);assert.equal(hit.visualTurn.poseBlend,false);assert(hit.layers[0].blink);
 const paused=c.update({now:2032,x:216,y:580,hitCount:1,frozen:true});assert.deepEqual(paused,hit);
 const ended=c.update({now:2048,x:216,y:580,hitCount:1});assert(ended.hurt);assert.equal(ended.clock,48);
});
test('pose offset continuity is measured in each authored bind, not by copying absolute angles',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';const before=c.update({now:0,x:220,y:580});
 const after=c.update({now:16,x:218,y:580});assert.notEqual(before.upperDirection,after.upperDirection);
 for(let i=2;i<10;i++){
  const a=before.layers[0].baseBones[i][2]-rigs[before.upperDirection].rest[i][2];
  const b=after.layers[0].baseBones[i][2]-rigs[after.upperDirection].rest[i][2];
  assert(Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-9);
 }
});
test('short-route turn clock is consistent at 30/60/120Hz and stationary frames finish it',()=>{
 for(const hz of [30,60,120]){const c=new RefinedVisualTurn();c.sample('right',0);const directions=[];for(let t=0;t<=210;t+=1000/hz){const f=c.sample('left',t);directions.push(f.direction);}assert.deepEqual(directions.filter((d,i,a)=>!i||d!==a[i-1]),['front-right','front','front-left','left']);assert.equal(c.direction,'left');}
 const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction='right';c.update({now:0,x:220,y:580});c.update({now:16,x:218,y:580});const end=c.update({now:208,x:218,y:580});assert.equal(end.lowerDirection,'left');assert.equal(end.root.x,218);assert.equal(end.distance,1.25);
});
