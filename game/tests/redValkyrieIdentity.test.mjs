import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {SakuraDefeatPresentation} from '../src/systems/SakuraDefeatPresentation.mjs';
import {RED_VALKYRIE_ART as ART} from '../src/utils/redValkyrieArt.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

import {confirmedCastFixture as fixture} from './helpers/confirmedCastFixture.mjs';

test('red walk, shot, skill, hurt, rest and blink remain in the same registered atlas',()=>{
 const f=fixture(),v=f.view,s=f.scene,seen=new Set();
 const check=()=>{seen.add(v.state);assert.equal(v.image.texture.key,ART.motion.key);assert(v.image.frame.name>=0&&v.image.frame.name<24);};
 f.step(0);check();
 for(let i=1;i<=6;i++){s.player.x+=15;f.step(i*80);check();assert.equal(v.image.frame.name,6+i%6);}
 v.beginShot(480,1,0,400);f.step(510);check();assert.equal(v.state,'attack');
 s.publicPerformerRun.actions++;f.step(520);check();assert.equal(v.state,'action');
 const frame=v.image.frame.name;f.step(9000,true);assert.equal(v.image.frame.name,frame);
 f.step(9010);check();assert.equal(v.state,'action');
 f.step(9400);s.battleRecord.playerHitCount++;f.step(9420);check();assert.equal(v.state,'hurt');
 f.step(9800);check();const idle=v.idleClock;f.step(9800+3420);assert.equal(v.image.frame.name,0);check();
 assert.equal(v.idleClock,idle);assert.deepEqual([...seen].sort(),['action','attack','hurt','idle','move']);
});

test('registered muzzle and visible bounds follow the scaled sprite and its mirrored origin',()=>{
 const f=fixture(),v=f.view;f.step(0);const m=ART.motion;
 for(const flip of [false,true]){
  v.flip=flip;v.handFlip=flip;f.step(0);
  const point=v.muzzleWorld(),sign=flip?-1:1;
  assert.equal(point.x,f.scene.player.x+sign*(m.muzzles[12][0]-152)*m.scale);
  assert.equal(point.y,f.scene.player.y+26+(m.muzzles[12][1]-251)*m.scale);
  const b=v.cueExclusionBounds();assert(b.right>b.x&&b.bottom>b.y);
  assert(Math.abs(b.bottom-(f.scene.player.y+26+.38))<1e-8);
 }
});

test('death uses four red poses, completes once, and can be canceled before result navigation',()=>{
 for(const cancel of [false,true]){
  const f=fixture();f.step(0);assert.equal(f.view.captureDefeat(),null);
  f.scene.player.hp=0;f.view.flip=true;const pose=f.view.captureDefeat();
  assert.equal(pose.art.key,ART.motion.key);assert.deepEqual(pose.frames,[18,19,22,23]);
  let complete=0;const d=new SakuraDefeatPresentation(f.scene,pose,()=>complete++);
  assert.equal(d.started,true);assert.equal(d.image.flipX,true);assert.equal(d.image.frame.name,18);
  if(cancel)d.destroy();
  for(const timer of f.timers){if(!timer.removed)timer.fn();}
  assert.equal(complete,cancel?0:1);assert.equal(d.disposed,true);
 }
});

test('normal roster mounts the confirmed portrait without the old layered body or companion rig',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.IdolRosterScene);h.scene.create();
 const mark=h.query('.member-mark-full');assert.equal(mark.querySelector('img').src,ART.portrait);
 assert.equal(mark.dataset.confirmedDesign,'red-valkyrie');
 assert.equal(mark.querySelector('.home-portrait-rig'),null);assert.equal(mark.querySelector('canvas'),null);
 const member=e.loadRuntime('utils/userCast.mjs').getPlayablePerformer('sakura');assert.equal(member.id,'sakura');
 h.shutdown();
});

test('new source images are real RGBA exports and runtime copies exactly match the editable raster sources',()=>{
 for(const [name,width,height]of [['motion',1536,1024],['portrait',1070,1470],['avatar',1254,1254],['weapon',1254,1254]]){
  const runtime=fs.readFileSync(new URL('../public/art/red-valkyrie-20261123/'+name+'.png',import.meta.url));
  const source=fs.readFileSync(new URL('../../01-美术/red-valkyrie-chibi-20261123/'+name+'.png',import.meta.url));
  assert.deepEqual(runtime,source);assert.equal(runtime.readUInt32BE(16),width);assert.equal(runtime.readUInt32BE(20),height);
  assert.equal(runtime[25],6,'PNG RGBA rather than a painted background');
 }
});

test('portrait becomes usable only after decoding; a failed or canceled load cannot expose an old model',async()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 for(const cancel of [false,true]){
  const h=e.harness(e.IdolRosterScene);h.scene.create();
  const mark=h.query('.member-mark-full'),img=mark.querySelector('img');
  assert.equal(mark.dataset.portraitState,'loading');assert.equal(img.hidden,true);
  img.naturalWidth=1070;img.naturalHeight=1470;
  let decoded;img.decode=()=>new Promise(resolve=>decoded=resolve);
  img.dispatchEvent({type:'load'});assert.equal(mark.dataset.portraitState,'loading');
  if(cancel)h.shutdown();decoded();await new Promise(resolve=>setImmediate(resolve));
  if(cancel)assert.equal(mark.dataset.portraitState,undefined);
  else{assert.equal(mark.dataset.portraitState,'static');assert.equal(img.hidden,false);h.shutdown();}
 }
 const h=e.harness(e.IdolRosterScene);h.scene.create();const mark=h.query('.member-mark-full');
 mark.querySelector('img').dispatchEvent({type:'error'});
 assert.equal(mark.dataset.portraitState,'unavailable');assert.equal(mark.querySelector('img').src,ART.portrait);
 h.shutdown();
});

test('moving releases in the confirmed cast show a weapon pose before returning to stride',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {view,scene,step}=fixture(id);
  step(0);view.beginShot(0,1,0,400);scene.player.x+=6;step(10);
  assert.equal(view.state,'move-attack');assert.equal(view.image.frame.name,14);
  scene.player.x+=8;step(view.shotDuration*.8);
  assert(view.image.frame.name>=6&&view.image.frame.name<=11);
  assert.equal(scene.publicPerformerRun.actions,0);view.destroy();
 }
});
