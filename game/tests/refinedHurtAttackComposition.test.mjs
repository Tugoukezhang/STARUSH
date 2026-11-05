import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {compactSakuraBind} from '../src/utils/sakuraCompactBind.mjs';
import {visibleRefinedPart} from '../src/systems/SakuraRefinedPresentation.mjs';
const data=name=>JSON.parse(fs.readFileSync(new URL('../public/art/'+name+'/views.json',import.meta.url))).views;
const rigs=compactSakuraBind({...data('sakura-refined-20261006'),...data('sakura-oblique-20261006')});

test('hurt overlays body and eyes without closing the ongoing authored attack fan, in all eight views',()=>{
 const saved=JSON.stringify(rigs);
 for(const direction of Object.keys(rigs))for(const mode of ['attack','walk-attack'])for(const attackTime of [0,110,180,220,330,440,620,799]){
  const options={rigs,direction,mode,time:90,gaitTime:200,travel:10,weight:.8,attackTime};
  const normal=sampleRefinedPose(options),hit=sampleRefinedPose({...options,hurtTime:90});
  assert.equal(hit.fanOpen,normal.fanOpen,'Hurt must not fake an attack cancellation at '+direction+'/'+attackTime);
  assert.equal(hit.phase,'hurt');assert.equal(hit.blink,!direction.startsWith('back'));
  for(const index of [5,6,7,8,9])assert.deepEqual(hit.pose.bones[index],normal.pose.bones[index]);
  assert.deepEqual(hit.feet,normal.feet);assert(hit.gripError<1e-7);
  assert(Math.abs(hit.pose.bones[2][2]-normal.pose.bones[2][2])>.09);
 }
 assert.equal(JSON.stringify(rigs),saved);
});

test('real world frame keeps committed phase/id, rendered open fan, live legs and reaction simultaneously',()=>{
 for(const direction of Object.keys(rigs)){
  const c=new SakuraRefinedWorldFrame(rigs);c.controller.direction=direction;c.update({now:0,x:500,y:900});
  const index=['right','front-right','front','front-left','left','back-left','back','back-right'].indexOf(direction);
  const attack={id:17,kind:'basic',phase:'release',progress:.5,angle:index*Math.PI/4};
  const saved=JSON.stringify(attack),f=c.update({now:16,x:502,y:901,attack,hitCount:1});
  assert(f.hurt);assert.equal(f.attackId,17);assert.equal(f.attackPhase,'release');assert.equal(f.upperDirection,direction);
  assert(f.layers[0].fanOpen>.99);assert.equal(visibleRefinedPart('fan-open',f.layers[0]),true);
  assert.equal(visibleRefinedPart('fan-closed',f.layers[0]),false);assert.equal(f.visualActionTurn.active,false);
  assert.deepEqual(f.root,{x:502,y:901});assert(f.layers.every(l=>l.gripError<1e-7));
  assert(Object.values(f.contacts).every(c=>c.error<.001));assert.equal(JSON.stringify(attack),saved);
 }
});

test('standalone hurt stays closed, retains its exact reaction window and never creates a phantom action',()=>{
 for(const mode of ['idle','walk'])for(const hurtTime of [0,90,180,359,360]){
  const f=sampleRefinedPose({rigs,direction:'front',mode,time:3050,hurtTime});
  assert.equal(f.fanOpen,0);assert.equal(f.phase,hurtTime<360?'hurt':'rest');
  assert.equal(f.blink,hurtTime<360?hurtTime<120:true);
 }
 const c=new SakuraRefinedWorldFrame(rigs);c.update({now:0,x:500,y:900});
 let f=c.update({now:16,x:500,y:900,hitCount:1});assert(f.hurt);assert.equal(f.attackId,null);
 const frozen=c.update({now:5016,x:500,y:900,hitCount:1,frozen:true});assert.deepEqual(frozen,f);
 f=c.update({now:5032,x:500,y:900,hitCount:1});assert.equal(f.clock,32);assert(f.hurt);
 f=c.update({now:5376,x:500,y:900,hitCount:1});assert.equal(f.hurt,false);assert.equal(f.attackId,null);
});

test('committed recovery closes on its own timeline while repeated hit count does not prolong hurt',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.update({now:0,x:500,y:900});
 const expected=[];
 for(const [now,phase,progress]of [[16,'windup',.8],[32,'release',.5],[64,'recovery',.3],[192,'recovery',.8]]){
  const attack={id:23,phase,progress,angle:0},f=c.update({now,x:500,y:900,attack,hitCount:1});
  const raw=sampleRefinedPose({rigs,direction:f.upperDirection,mode:'attack',time:f.clock,attackTime:f.attackSampleTime});
  assert.equal(f.layers[0].fanOpen,raw.fanOpen);assert(f.hurt);expected.push(f.layers[0].fanOpen);
 }
 assert(expected[3]<expected[2]);const ended=c.update({now:400,x:500,y:900,hitCount:1});assert.equal(ended.hurt,false);
 assert.equal(ended.attackId,null);
});
