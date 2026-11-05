import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {RIFLE_WALK_ART,ENJO_WALK_ART} from '../src/utils/userCastMotionData.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');

// Measured from the exported sheet: bounds alpha>=32 (right/bottom exclusive), barrel tip = rightmost alpha>=128 column.
const BOUNDS=[[95,124,304,305],[99,125,311,305],[91,127,315,305],[87,127,312,305]];
const MUZZLES=[[302,194],[310,194],[314,195],[310,196]];

function fixture(id='sakura',exists=()=>true){
  let time=0;
  const node=()=>({x:0,y:0,alpha:1,angle:0,frame:{name:0},texture:{key:''},destroyed:0,
    setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(x,y=x){this.originX=x;this.originY=y;return this;},
    setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(){return this;},
    setFlipX(v){this.flipX=v;return this;},setAngle(v){this.angle=v;return this;},setAlpha(v){this.alpha=v;return this;},
    setTint(){return this;},setFrame(v){this.frame.name=v;return this;},setTexture(key,frame=0){this.texture={key};return this.setFrame(frame);},
    getBounds(){const x=this.x-this.originX*this.displayWidth,y=this.y-this.originY*this.displayHeight;return {x,y,right:x+this.displayWidth,bottom:y+this.displayHeight};},
    destroy(){this.destroyed++;}});
  const scene={player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},game:{loop:{frame:0}},
    publicPerformerRun:{actions:0,now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists},add:{ellipse:node,image:node}};
  const view=new UserCastPresentation(scene,id);view.update(0,false);
  const step=(dx,frozen=false)=>{scene.player.x+=dx;time+=16;view.update(time,frozen);return view.image;};
  return {scene,view,step,now:()=>time};
}

test('rifle walk spec is deep-frozen, Sakura-only and leaves the other banks untouched',()=>{
  assert(Object.isFrozen(RIFLE_WALK_ART)&&Object.isFrozen(RIFLE_WALK_ART.bounds)&&Object.isFrozen(RIFLE_WALK_ART.muzzles));
  for(const row of [...RIFLE_WALK_ART.bounds,...RIFLE_WALK_ART.muzzles])assert(Object.isFrozen(row));
  assert.deepEqual({...RIFLE_WALK_ART},{key:'user-rifle-walk-20261022',path:'art/rifle-walk-volume-20261022/walk.png',frames:4,bounds:BOUNDS,muzzles:MUZZLES});
  const sakura=getUserCastArt('sakura').motion;
  assert.equal(sakura.walk,RIFLE_WALK_ART);assert.equal(sakura.hurt,undefined);
  assert.deepEqual([sakura.shoot.key,sakura.idle.key,sakura.rest.key],['user-rifle-shoot-20261021','user-rifle-idle-20261021','user-rifle-rest-20261022']);
  assert.equal(getUserCastArt('enjo').motion.walk,ENJO_WALK_ART);assert.equal(ENJO_WALK_ART.frames,undefined);
  assert.equal(getUserCastArt('kai').motion.walk,undefined);
});

test('four walk phases split the same 90 world-pixel cycle at 22.5/45/67.5/90 in both directions',()=>{
  for(const dir of [1,-1]){
    const {view:v,step}=fixture();
    for(const [dx,frame] of [[22,0],[.5,1],[22,1],[.5,2],[22,2],[.5,3],[22,3],[.5,0],[22.5,1]]){
      const image=step(dir*dx);assert.equal(v.state,'move');assert.equal(image.texture.key,RIFLE_WALK_ART.key);
      assert.equal(image.frame.name,frame,'walk distance '+v.walkDistance);assert.equal(v.flip,dir<0);
    }
    assert.equal(v.walkDistance,112.5);
  }
});

test('missing new texture keeps the old six 15px cels; Enjo and Kai walks are unchanged',()=>{
  const {scene:s,view:v,step}=fixture('sakura',key=>key!==RIFLE_WALK_ART.key),motion=getUserCastArt('sakura').motion;
  for(const [dx,frame] of [[14.5,6],[.5,7],[15,8],[15,9],[15,10],[15,11],[15,6]]){
    const image=step(dx);assert.equal(image.texture.key,motion.key);assert.equal(image.frame.name,frame);
  }
  const fallback=fixture('sakura',key=>key!==RIFLE_WALK_ART.key);fallback.step(15);assert.equal(fallback.view.image.frame.name,7);
  assert.deepEqual(fallback.view.muzzleWorld(),{x:557.5,y:981.5},'old cel keeps the old barrel marker');
  const b=fallback.view.image.getBounds(),r=motion.bounds[7];
  assert.deepEqual(fallback.view.cueExclusionBounds(),{x:b.x+r[0]*.5,y:b.y+r[1]*.5,right:b.x+r[2]*.5,bottom:b.y+r[3]*.5});
  assert.equal(s.player.x,590);assert.equal(v.walkDistance,90);
  const enjo=fixture('enjo');
  for(const [dx,frame] of [[14.5,0],[.5,1],[15,2],[15,3],[15,4],[15,5],[15,0]]){
    const image=enjo.step(dx);assert.equal(image.texture.key,ENJO_WALK_ART.key);assert.equal(image.frame.name,frame);
  }
  const kai=fixture('kai');
  for(const [dx,frame] of [[15,7],[15,8]]){const image=kai.step(dx);assert.equal(image.texture.key,getUserCastArt('kai').motion.key);assert.equal(image.frame.name,frame);}
});

test('new walk cels reuse the existing 192x160 display, 304/320 ground origin and zero angle',()=>{
  for(const dir of [1,-1]){
    const {scene:s,step}=fixture(),image=step(dir*22.5);
    assert.equal(image.texture.key,RIFLE_WALK_ART.key);assert.equal(image.displayWidth,192);assert.equal(image.displayHeight,160);
    assert.equal(image.originX,.5);assert.equal(image.originY,304/320);assert.equal(image.angle,0);assert.equal(image.flipX,dir<0);
    assert.equal(image.x,s.player.x);assert.equal(image.y,s.player.y+26);assert.equal(s.player.y,1000);
  }
});

test('pause freezes walk phase and distance; resume continues; stopping returns to ready',()=>{
  const {view:v,step}=fixture(),motion=getUserCastArt('sakura').motion;
  step(22.5);assert.equal(v.image.frame.name,1);const distance=v.walkDistance,clock=v.clock;
  step(30,true);step(30,true);
  assert.equal(v.walkDistance,distance);assert.equal(v.clock,clock);assert.equal(v.image.texture.key,RIFLE_WALK_ART.key);assert.equal(v.image.frame.name,1);
  step(10);assert.equal(v.walkDistance,distance,'first resumed update never converts the paused gap into stride');assert.equal(v.image.frame.name,1);
  step(22.5);assert.equal(v.image.frame.name,2);
  step(0);assert.equal(v.state,'idle');assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,12);
});

test('shooting while walking keeps the walk bank; standing fire, action and hurt keep their own cels',()=>{
  const {scene:s,view:v,step,now}=fixture(),motion=getUserCastArt('sakura').motion;
  step(22.5);v.beginShot(now(),1,0,400);step(22.5);
  assert.equal(v.state,'move-attack');assert.equal(v.image.texture.key,RIFLE_WALK_ART.key);assert.equal(v.image.frame.name,2);
  step(0);assert.equal(v.state,'attack');assert.equal(v.image.texture.key,motion.shoot.key);
  s.publicPerformerRun.actions++;step(22.5);
  assert.equal(v.state,'action');assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,14);assert.equal(v.muzzleWorld(),null);
  s.battleRecord.playerHitCount++;step(22.5);
  assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,18);assert.equal(v.muzzleWorld(),null);
});

test('walk muzzle and cue exclusion use the walk metadata on both sides; physical hand origin is unchanged',()=>{
  for(const dir of [1,-1]){
    const {scene:s,view:v,step}=fixture();
    for(const [k,dx] of [[0,.5],[1,22],[2,22.5],[3,22.5]]){
      step(dir*dx);assert.equal(v.image.texture.key,RIFLE_WALK_ART.key);assert.equal(v.image.frame.name,k);
      const [mx,my]=MUZZLES[k],[l,t,r,bottom]=BOUNDS[k],p=s.player,b=v.image.getBounds();
      assert.deepEqual(v.muzzleWorld(),{x:p.x+dir*(mx-192)*.5,y:p.y+26+(my-304)*.5});
      assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(dir>0?l:384-r)*.5,y:b.y+t*.5,right:b.x+(dir>0?r:384-l)*.5,bottom:b.y+bottom*.5});
      assert.deepEqual(v.handWorld(),{x:p.x+dir*16,y:p.y-12});
    }
  }
});

test('Phaser preload adds the rifle walk sheet for Sakura only',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of ['sakura','kai','enjo']){
    const sheets=[],scene={load:{image(){},spritesheet:(...args)=>sheets.push(args)}};
    preloadActorPresentation(scene,{stageId:1,performerId:id});
    const rows=sheets.filter(row=>row[0]===RIFLE_WALK_ART.key||row[1]===RIFLE_WALK_ART.path);
    if(id!=='sakura'){assert.equal(rows.length,0);continue;}
    assert.equal(rows.length,1);assert.equal(rows[0][1],RIFLE_WALK_ART.path);assert.deepEqual({...rows[0][2]},{frameWidth:384,frameHeight:320});
  }
});

// Pins the exported pixels only; still cels cannot prove a full alternating stride, which needs compiled review.
test('actual walk PNG matches its pinned bytes, bounds, barrel tips and constant body volume',async()=>{
  const buffer=fs.readFileSync(new URL('../public/'+RIFLE_WALK_ART.path,import.meta.url));
  assert.equal(buffer.length,250129);
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),'1d4c7b5a7552d8a9ace9526ef97ec012424b6ba64a9525be9df9955460db1e21');
  const {data:pixels,info:{width,height,channels}}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([width,height,channels],[1536,320,4]);
  const hashes=new Set(),areas=[];
  for(let n=0;n<4;n++){
    let box=[384,320,0,0],tip=-1,rows=[],edge=0,area=0;
    for(let y=0;y<320;y++)for(let x=0;x<384;x++){const a=pixels[(y*width+n*384+x)*4+3];
      if(a&&(x===0||y===0||x===383||y===319))edge++;
      if(a>=32){area++;box=[Math.min(box[0],x),Math.min(box[1],y),Math.max(box[2],x+1),Math.max(box[3],y+1)];}
      if(a>=128){if(x>tip){tip=x;rows=[y];}else if(x===tip)rows.push(y);}}
    assert.deepEqual(box,RIFLE_WALK_ART.bounds[n]);
    assert.deepEqual([tip,Math.round(rows.reduce((sum,y)=>sum+y,0)/rows.length)],RIFLE_WALK_ART.muzzles[n]);
    assert.equal(edge,0,'no clipped cel margins');
    assert(box[1]>=124&&box[1]<=127,'ear tops stay at ready12 height 125, not the old walk top 144');
    assert.equal(box[3],305,'common sole baseline');assert(box[3]-box[1]>=178,'body volume is not the old 161px shrink');
    areas.push(area);
    const cel=Buffer.alloc(384*320*4);for(let y=0;y<320;y++)pixels.copy(cel,y*1536,(y*width+n*384)*4,(y*width+n*384+384)*4);
    hashes.add(crypto.createHash('sha256').update(cel).digest('hex'));
  }
  const mean=areas.reduce((sum,a)=>sum+a,0)/4;assert(areas.every(a=>Math.abs(a-mean)/mean<.05),'opaque volume is constant across cels');
  assert.equal(hashes.size,4,'four distinct authored cels');
});
