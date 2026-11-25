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

function fixture(id='sakura', expanded=false){
  const nodes=[];
  const node=()=>{const n={x:0,y:0,alpha:1,frame:{name:0},destroyed:0,
    setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(){return this;},setDisplaySize(){return this;},
    setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(v){this.angle=v;return this;},
    setAlpha(v){this.alpha=v;return this;},setTint(){return this;},setFrame(v){this.frame.name=v;return this;},
    setTexture(key,frame=0){this.texture={key};return this.setFrame(frame);},
    getBounds(){return {x:this.x-80,y:this.y-100,right:this.x+80,bottom:this.y};},destroy(){this.destroyed++;}};
    nodes.push(n);return n;};
  const scene={player:{x:500,y:1000},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},
    publicPerformerRun:{actions:0},textures:{exists:()=>true,get:()=>({has:()=>expanded})},add:{ellipse:node,image:node}};
  const view=new UserCastPresentation(scene,id);
  return {scene,view,nodes};
}

test('three production actors preload their own animation atlas, never the other cast',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of ['sakura','kai','enjo']){
    const sheets=[],scene={load:{image(){},spritesheet:(...args)=>sheets.push(args)}};
    preloadActorPresentation(scene,{stageId:1,performerId:id});
    assert.equal(sheets.filter(([key])=>key.startsWith('stage-performer-')).length,1);
    assert(sheets.some(([key])=>key==='stage-performer-'+id));
    assert.equal(sheets.some(([key])=>key==='stage-rifle-stride'),id==='sakura');
    assert(sheets.some(([key])=>key==='stage-equipment-performance'));assert.equal(sheets.filter(row=>row[0]==='melee-directional-20261026-'+id).length,0);const art=getUserCastArt(id);
    assert.equal(sheets.filter(row=>row[0]==='enjo-north-rig-20261029').length,0,'rear bank belongs only to the heavy');
    assert.equal(sheets.filter(row=>row[0]==='melee-heavy-bridge-20261028-enjo').length,0,'new heavy bank is never loaded for rifle or sword');
    assert.equal(sheets.filter(row=>row[0]==='melee-authored-20261026-'+id).length,0);
    assert.equal(sheets.filter(row=>row[0]==='melee-authored-20261026-process').length,0);
    assert.equal(sheets.filter(row=>row[0]==='user-duo-contact-20261025').length,0,'existing B129 skill-contact bank belongs only to sword and hammer');
    assert.equal(sheets.filter(row=>row[0]==='user-rifle-deposition-20261023').length,1,'one neutral landing bank shared without loading other character atlases');
    assert.deepEqual(sheets.map(row=>row[0]).filter(key=>/^user-rifle-(projectile|contact)-20261021$/.test(key)),
      id==='sakura'?['user-rifle-projectile-20261021','user-rifle-contact-20261021']:[]);
    assert.equal(sheets[0][0],art.motion.key);assert.equal(sheets[0][1],art.motion.path);
    assert.equal(sheets[0][2].frameWidth,256);assert.equal(sheets[0][2].frameHeight,256);
    const activeLoads=sheets.length;preloadActorPresentation(scene,{stageId:1,performerId:id,practiceMode:true});
    assert.equal(sheets.length,activeLoads);assert.equal(scene._userCastPresentation,false);
  }
});

test('walk phases follow actual distance, continue while shooting, and stop when position stops',()=>{
  const {scene:s,view:v}=fixture('sakura',true);v.update(0,false);s.player.x+=15;v.update(60,false);
  assert.equal(v.state,'move');assert.equal(v.image.texture.key,getUserCastArt('sakura').motion.key);
  const first=v.image.frame.name;assert.equal(first,7,'15px advances one cel in the six-frame 90px walk cycle');v.beginShot(61,1);s.player.x+=15;v.update(120,false);
  assert.equal(v.state,'move-attack');assert.notEqual(v.image.frame.name,first);
  assert.equal(v.image.frame.name%6,2,'the rendered shot includes the current pair of feet');
  assert.equal(v.image.texture.key,'stage-rifle-stride');
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
    if(id==='enjo')assert.equal(frame,14,'new atlas contact cel starts with instant spell consequence, not windup');
    v.update(140,false);assert.notEqual(v.image.frame.name,frame);
    v.update(1200,false);assert.equal(v.state,'idle');
    s.battleRecord.playerHitCount++;v.update(1210,false);assert.equal(v.state,'hurt');
    if(id==='enjo'){assert.equal(v.image.texture.key,getUserCastArt(id).motion.key);assert.equal(v.image.frame.name,18);}
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

test('confirmed skill poses register the three rifle beats, the dash end and the instant spell',()=>{
 const samples={
  sakura:[[0,9],[60,8],[100,9],[160,8],[200,9],[268,11],[305,12]],
  kai:[[0,8],[80,9],[159,10],[160,10],[250,11]],
  enjo:[[0,9],[80,10],[160,11],[220,11]],
 };
 for(const [id,checks] of Object.entries(samples)){
  const {scene,view}=fixture(id,true);
  view.update(0,false);scene.publicPerformerRun.actions++;
  for(const [age,cel] of checks){
   view.update(10+age,false);
   assert.equal(view.image.frame.name,cel,id+' at '+age+'ms');
  }
  assert.equal(scene.publicPerformerRun.actions,1);
  view.destroy();
 }
});

test('each performer faces travel, plants feet on release, and returns to a distinct recovery cel',()=>{
  for(const id of ['sakura','kai','enjo']){
    const {scene,view}=fixture(id,true);
    scene.player.hp=5;
    view.update(0,false);
    scene.player.y-=18;view.update(50,false);
    assert.equal(view.image.texture.key,'stage-performer-'+id);
    assert(view.image.frame.name>=0&&view.image.frame.name<4);
    const planted=view.image.frame.name;
    view.update(72,false);assert.equal(view.image.frame.name,planted);
    view.update(190,false);assert.equal(view.image.frame.name,0);
    scene.player.y+=18;view.update(245,false);
    assert(view.image.frame.name>=4&&view.image.frame.name<8);
    view.beginShot(245,1,0,500);view.update(245,false);
    view.update(245+view.shotDuration*.93,false);
    assert.equal(view.image.texture.key,'stage-performer-'+id);
    assert.equal(view.image.frame.name,12);
    scene.battleRecord.lastPlayerHit={source:{position:{x:scene.player.x-20,y:scene.player.y}}};
    scene.battleRecord.playerHitCount++;scene.playerGfx.alpha=.3;view.update(620,false);
    assert(view.image.x>scene.player.x);assert(view.image.angle>0);assert(view.image.alpha>=.67);
    scene.player.active=true;scene.player.hp=0;
    const pose=view.captureDefeat();assert.deepEqual(pose.frames,[18,13,14,15]);
    assert.equal(pose.keys[0],getUserCastArt(id).motion.key);
    assert.equal(pose.keys[3],'stage-performer-'+id);
    view.destroy();
  }
});

test('a sideways shot carries the real north and south steps under the aiming shoulder',()=>{
  const {scene,view}=fixture('sakura',true);
  view.update(0,false);view.beginShot(1,1,0,500);
  scene.player.y-=18;view.update(30,false);
  assert.equal(view.image.texture.key,'stage-rifle-stride');
  const up=view.image.frame.name;
  assert(up>=24&&(up-24)%8<4);assert(view.muzzleWorld());
  scene.player.y+=18;view.update(65,false);
  const down=view.image.frame.name;
  assert(down>=24&&(down-24)%8>=4);assert(view.muzzleWorld());
  view.beginShot(70,0,-1,500);scene.player.y-=18;view.update(80,false);
  assert.equal(view.image.texture.key,'stage-performer-sakura');
  assert(view.image.frame.name<4);
});

test('the visible stationary volley tip and frontal barrel track the painted sprite',()=>{
 const {scene,view}=fixture('sakura',true);
 view.update(0,false);scene.publicPerformerRun.actions++;view.update(5,false);
 assert.equal(view.muzzleWorld(),null);
 const tip=view.muzzleWorld(true);
 assert.deepEqual(tip,{x:view.image.x+(239-152)*view.scale,y:view.image.y+(118-251)*view.scale});
 view.update(380,false);view.beginShot(380,0,1,500);scene.player.y+=18;view.update(400,false);
 assert(view.muzzleWorld());view.beginShot(402,0,-1,500);scene.player.y-=18;view.update(420,false);
 assert.equal(view.muzzleWorld(),null,'the ponytail hides the barrel on the north-facing pose');
});
