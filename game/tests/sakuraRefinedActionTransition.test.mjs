import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
const cardinal=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-refined-20261006/views.json',import.meta.url))).views;
const oblique=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-oblique-20261006/views.json',import.meta.url))).views;
const rigs={...cardinal,...oblique};
const a=(progress,phase='windup',id=7)=>({id,angle:Math.PI,direction:'left',phase,progress});
function actor(data=rigs){const c=new SakuraRefinedWorldFrame(data);c.controller.direction='right';c.update({now:0,x:220,y:580});return c;}
test('attack windup traverses authored neighboring views before exact release',()=>{
 const c=actor(),seen=[];
 for(const [i,p]of [0,.2,.4,.6,.85,1].entries()){
  const attack=a(p),f=c.update({now:16+i*16,x:220,y:580,attack});seen.push(f.upperDirection);
  assert.equal(f.attackId,7);assert.equal(f.attackPhase,'windup');assert.equal(f.attackSampleTime,220*p);assert.deepEqual(f.root,{x:220,y:580});assert(f.layers[0].gripError<1e-7);assert.equal(f.layers[0].direction,f.upperDirection);
 }
 assert.deepEqual(seen.filter((d,i)=>!i||d!==seen[i-1]),['right','front-right','front','front-left','left']);
 const release=c.update({now:128,x:220,y:580,attack:a(.1,'release')});assert.equal(release.upperDirection,'left');assert.equal(release.visualActionTurn.active,false);assert.equal(release.attackSampleTime,242);
});
test('starting arm and wrist offsets are continuous in their own bind, never copied absolute',()=>{
 const c=actor(),before=c.previous,f=c.update({now:16,x:220,y:580,attack:a(0)});
 assert.equal(f.visualActionTurn.poseBlend,true);
 for(let i=2;i<10;i++)assert(Math.abs((before.layers[0].baseBones[i][2]-rigs.right.rest[i][2])-(f.layers[0].baseBones[i][2]-rigs.right.rest[i][2]))<1e-9);
 const end=c.update({now:80,x:220,y:580,attack:a(.9)}),raw=sampleRefinedPose({rigs,direction:'left',mode:'attack',time:end.clock,attackTime:198});
 for(const i of [5,6,7,8,9])assert(Math.abs(end.layers[0].baseBones[i][2]-raw.pose.bones[i][2])<1e-9);
});
test('release-only late frame and short windup never wait for a cosmetic turn',()=>{
 for(const phase of ['release','recovery']){const c=actor(),f=c.update({now:500,x:220,y:580,attack:a(.7,phase)});assert.equal(f.upperDirection,'left');assert.equal(f.visualActionTurn.active,false);assert.equal(f.visualActionTurn.poseBlend,false);assert.equal(f.attackPhase,phase);}
 const c=actor();c.update({now:8,x:220,y:580,attack:a(0)});const f=c.update({now:48,x:218,y:580,attack:a(0,'release')});assert.equal(f.upperDirection,'left');assert.equal(f.attackSampleTime,220);assert.equal(f.root.x,218);
});
test('attack progress is monotonic and replaced action uses the latest actual upper pose',()=>{
 const c=actor();c.update({now:16,x:220,y:580,attack:a(.6)});const before=c.previous;
 const stale=c.update({now:32,x:220,y:580,attack:a(.2)});assert.equal(stale.upperDirection,before.upperDirection);
 const next=c.update({now:48,x:220,y:580,attack:{...a(0,'windup',8),angle:0,direction:'right'}});assert.equal(next.upperDirection,stale.upperDirection);assert.equal(next.attackId,8);assert(next.visualActionTurn.poseBlend);
 const ended=c.update({now:64,x:220,y:580,attack:{...a(.9,'windup',8),angle:0,direction:'right'}});assert.equal(ended.upperDirection,'right');
});
test('pause freezes visual attack clock and actual hurt cancels only the cosmetic bridge',()=>{
 const c=actor(),before=c.update({now:16,x:220,y:580,attack:a(.2)});assert.deepEqual(c.update({now:2016,x:220,y:580,attack:a(.8),frozen:true}),before);
 const hit=c.update({now:2032,x:220,y:580,attack:a(.3),hitCount:1});assert.equal(hit.clock,32);assert(hit.hurt);assert.equal(hit.visualActionTurn.active,false);assert.equal(hit.visualActionTurn.poseBlend,false);assert.equal(hit.attackId,7);assert.equal(hit.upperDirection,'left');
});
test('four-view fallback remains immediate and receives no new action pose bridge',()=>{
 const c=actor(cardinal),f=c.update({now:16,x:220,y:580,attack:a(0)});assert.equal(f.upperDirection,'left');assert.equal(f.visualActionTurn.active,false);assert.equal(f.visualActionTurn.poseBlend,false);
});
test('cancelled action returns through neighboring views after recovery without changing feet',()=>{
 const c=actor();c.update({now:16,x:220,y:580,attack:a(.5,'release')});const recovered=c.update({now:32,x:220,y:580});assert(recovered.visualRecovery);assert.equal(recovered.upperDirection,'left');
 const seq=[];for(let now=192;now<=400;now+=16){const f=c.update({now,x:220,y:580});seq.push(f.upperDirection);for(const foot of Object.values(f.contacts))assert(foot.error<1e-7);assert.equal(f.lowerDirection,'right');assert.equal(f.attackId,null);}
 assert.deepEqual(seq.filter((d,i)=>!i||d!==seq[i-1]),['back-left','back','back-right','right']);assert.equal(c.previous.visualReturn.active,false);
});
test('real movement remains live while attack-facing is winding up and authored rigs are immutable',()=>{
 const saved=JSON.stringify(rigs),c=actor();let f;
 for(let i=1;i<=12;i++){f=c.update({now:i*16,x:220+i*2,y:580+i,attack:a(Math.min(1,i/12))});assert.equal(f.root.x,220+i*2);assert.equal(f.root.y,580+i);assert(f.layers.length<=2);assert(f.layers.every(l=>l.pose.bones.flat().every(Number.isFinite)));for(const foot of Object.values(f.contacts))assert(foot.error<1e-6);}
 assert.equal(f.upperDirection,'left');assert.equal(f.lowerDirection,'front-right');assert.equal(JSON.stringify(rigs),saved);
});
test('all 64 directed view pairs settle before short-windup release without mutating the action',()=>{
 const directions=['right','front-right','front','front-left','left','back-left','back','back-right'];
 for(const from of directions)for(const [target,angleIndex]of directions.map((d,i)=>[d,i])){
  const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction=from;c.update({now:0,x:220,y:580});let last=from;
  for(let ms=0;ms<=44;ms+=4){const attack={...a(ms/45),angle:angleIndex*Math.PI/4},saved=JSON.stringify(attack),f=c.update({now:4+ms,x:220,y:580,attack});const jump=Math.abs(directions.indexOf(last)-directions.indexOf(f.upperDirection));assert(Math.min(jump,8-jump)<=1);assert.equal(JSON.stringify(attack),saved);last=f.upperDirection;}
  const release=c.update({now:49,x:220,y:580,attack:{...a(0,'release'),angle:angleIndex*Math.PI/4}});assert.equal(release.upperDirection,target);assert.equal(release.attackPhase,'release');assert.equal(release.visualActionTurn.poseBlend,false);
 }
});
