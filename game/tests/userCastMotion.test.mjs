import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import fs from 'node:fs';

test('only the three selected motion atlases enter the release allowlist',()=>{
  const entries=RUNTIME_PAYLOAD.filter(row=>row.group==='owner-character-motion');
  assert.deepEqual(entries.map(row=>row.file),['cat-rifle','mecha-sword','hammer-cat'].map(id=>'art/three-cast-actions-20261018/'+id+'.webp'));
  for(const entry of entries){const buffer=fs.readFileSync(new URL('../public/'+entry.file,import.meta.url));
    assert.equal(buffer.subarray(8,12).toString(),'WEBP');assert(buffer.length>20000&&buffer.length<1200000);}
});

function fixture(id='sakura'){
  const nodes=[];
  const node=()=>{const n={x:0,y:0,alpha:1,frame:{name:0},destroyed:0,
    setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(){return this;},setDisplaySize(){return this;},
    setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(v){this.angle=v;return this;},
    setAlpha(v){this.alpha=v;return this;},setTint(){return this;},setFrame(v){this.frame.name=v;return this;},
    setTexture(key,frame=0){this.texture={key};return this.setFrame(frame);},
    getBounds(){return {x:this.x-80,y:this.y-100,right:this.x+80,bottom:this.y};},destroy(){this.destroyed++;}};
    nodes.push(n);return n;};
  const scene={player:{x:500,y:1000},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},
    publicPerformerRun:{actions:0},textures:{exists:()=>true},add:{ellipse:node,image:node}};
  const view=new UserCastPresentation(scene,id);
  return {scene,view,nodes};
}

test('three production actors preload their own animation atlas, never the other cast',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of ['sakura','kai','enjo']){
    const sheets=[],scene={load:{image(){},spritesheet:(...args)=>sheets.push(args)}};
    preloadActorPresentation(scene,{stageId:1,performerId:id});
    assert.equal(sheets.length,id==='enjo'?20:id==='kai'?7:9);assert.equal(sheets.filter(row=>row[0]==='melee-directional-20261026-'+id).length,id==='enjo'?1:0);const art=getUserCastArt(id);
    assert.equal(sheets.filter(row=>row[0]==='enjo-north-rig-20261029').length,id==='enjo'?1:0,'rear bank belongs only to the heavy');
    assert.equal(sheets.filter(row=>row[0]==='melee-heavy-bridge-20261028-enjo').length,id==='enjo'?1:0,'new heavy bank is never loaded for rifle or sword');
    assert.equal(sheets.filter(row=>row[0]==='melee-authored-20261026-'+id).length,id==='enjo'?1:0);
    assert.equal(sheets.filter(row=>row[0]==='melee-authored-20261026-process').length,id==='enjo'?1:0);
    assert.equal(sheets.filter(row=>row[0]==='user-duo-contact-20261025').length,id==='enjo'?1:0,'existing B129 skill-contact bank belongs only to sword and hammer');
    assert.equal(sheets.filter(row=>row[0]==='user-rifle-deposition-20261023').length,1,'one neutral landing bank shared without loading other character atlases');
    assert.deepEqual(sheets.map(row=>row[0]).filter(key=>/^user-rifle-(projectile|contact)-20261021$/.test(key)),
      id==='sakura'?['user-rifle-projectile-20261021','user-rifle-contact-20261021']:[]);
    assert.equal(sheets[0][0],art.motion.key);assert.equal(sheets[0][1],art.motion.path);
    assert.equal(sheets[0][2].frameWidth,id==='enjo'?384:256);assert.equal(sheets[0][2].frameHeight,id==='enjo'?320:256);
    preloadActorPresentation(scene,{stageId:1,performerId:id,practiceMode:true});
    assert.equal(sheets.length,id==='enjo'?20:id==='kai'?7:9);assert.equal(scene._userCastPresentation,false);
  }
});

test('walk phases follow actual distance, continue while shooting, and stop when position stops',()=>{
  const {scene:s,view:v}=fixture();v.update(0,false);s.player.x+=15;v.update(60,false);
  assert.equal(v.state,'move');assert.equal(v.image.texture.key,getUserCastArt('sakura').motion.key);
  const first=v.image.frame.name;assert.equal(first,7,'15px advances one cel in the six-frame 90px walk cycle');v.beginShot(61,1);s.player.x+=15;v.update(120,false);
  assert.equal(v.state,'move-attack');assert.notEqual(v.image.frame.name,first);
  assert.equal(v.image.frame.name,8,'walking cels survive automatic fire');assert.equal(v.image.texture.key,getUserCastArt('sakura').motion.key);
  const distance=v.walkDistance;v.update(150,false);v.update(360,false);
  assert.equal(v.walkDistance,distance);assert.equal(v.state,'idle');
});

test('pose clock and active action/hurt remaining time freeze across pause and resume',()=>{
  const {scene:s,view:v}=fixture('enjo');v.update(0,false);s.publicPerformerRun.actions++;v.update(20,false);
  const before=v.image.frame.name;v.update(1000,true);v.update(2000,true);
  assert.equal(v.image.frame.name,before);v.update(2010,false);
  assert.equal(v.state,'action','pause must not skip recovery');
  s.battleRecord.playerHitCount++;v.update(2020,false);assert.equal(v.state,'hurt');
  const hurt=v.image.frame.name;v.update(4000,true);v.update(4010,false);
  assert.equal(v.state,'hurt');assert.equal(v.image.frame.name,hurt);
});

test('the production run clock excludes pause gaps even when no render updates run during the pause',()=>{
  const {scene:s,view:v}=fixture('kai');let activeTime=0;s.publicPerformerRun.now=()=>activeTime;
  v.update(0,false);s.publicPerformerRun.actions++;activeTime=20;v.update(20,false);
  activeTime=40;v.update(5000,false);assert.equal(v.state,'action');
  assert.equal(v.clock,40,'scene render timestamps include paused wall time, run time does not');
});

test('real action and damage counters select one finite cycle and return to idle',()=>{
  for(const id of ['sakura','kai','enjo']){
    const {scene:s,view:v}=fixture(id);v.update(0,false);s.publicPerformerRun.actions++;v.update(10,false);
    assert.equal(v.state,'action');const frame=v.image.frame.name;
    if(id==='enjo')assert.equal(frame,14,'new atlas contact cel starts with instant hammer consequence, not windup');
    v.update(140,false);assert.notEqual(v.image.frame.name,frame);
    v.update(1200,false);assert.equal(v.state,'idle');
    s.battleRecord.playerHitCount++;v.update(1210,false);assert.equal(v.state,'hurt');
    if(id==='enjo'){assert.equal(v.image.texture.key,getUserCastArt(id).motion.hurt.key);assert.equal(v.image.frame.name,0);}
    else assert(v.image.frame.name>=18);v.update(2000,false);assert.equal(v.state,'idle');
    assert.equal(s.publicPerformerRun.actions,1);assert.equal(s.battleRecord.playerHitCount,1);
    v.destroy();v.destroy();assert(v.disposed);assert.equal(v.image.destroyed,1);assert.equal(v.shadow.destroyed,1);
  }
});

test('confirmed wind character facing and camera-only image motion never alter physics or muzzle ownership',()=>{
  const {scene:s,view:v}=fixture('kai');v.update(0,false);v.beginShot(1,1);v.update(16,false);
  assert.equal(v.flip,false);assert.deepEqual(v.handWorld(),{x:516,y:988});
  v.beginShot(17,-1);v.update(32,false);assert.equal(v.flip,true);
  assert.deepEqual(v.handWorld(),{x:484,y:988});assert.deepEqual(s.player,{x:500,y:1000});
  assert.equal(v.image.angle,0);
});
