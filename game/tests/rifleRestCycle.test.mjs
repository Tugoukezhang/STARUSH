import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{getUserCastArt}from'../src/utils/userCast.mjs';import*as motion from'../src/utils/userCastMotionData.mjs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
// Real presentation class; only Phaser display nodes are stubbed (copied from rifleIdleBlink). No scene.time/tweens exist, so any timer use throws.
const REST='user-rifle-rest-20261022',restPath='art/rifle-rest-20261022/idle.png',BLINK='user-rifle-idle-20261021',SHOOT='user-rifle-shoot-20261021',base='user-motion-cat-rifle';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const BOUNDS=[[109,125,301,305],[100,124,308,305],[96,125,307,305],[107,125,307,305]],MUZZLES=[[300,192],[306,192],[306,193],[306,192]];
function fixture(id='sakura',missing=[]){const nodes=[],node=(x=0,y=0,k='',f=0)=>{const n={x,y,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(a){this.angle=a;return this;},setAlpha(){return this;},setTint(){return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}};nodes.push(n);return n;};const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>!missing.includes(k)},add:{image:node,ellipse:node}};return{scene,view:new UserCastPresentation(scene,id),nodes};}
const at=(v,t,frozen=false)=>{v.update(t,frozen);return[v.image.texture.key,v.image.frame.name];};
const OPEN=[base,12],CLOSED=[BLINK,0],R=n=>[REST,n];
const transform=v=>[v.image.x,v.image.y,v.image.displayWidth,v.image.displayHeight,v.image.originX,v.image.originY,v.image.angle,v.image.flipX];
async function cels(){const{data,info}=await sharp(fs.readFileSync(new URL('../public/'+restPath,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[1536,320,4]);
  return[0,1,2,3].map(n=>{const d=Buffer.alloc(384*320*4);for(let y=0;y<320;y++)data.copy(d,y*384*4,(y*1536+n*384)*4,(y*1536+n*384+384)*4);return d;});}
const visible=d=>{let b=[384,320,0,0];for(let y=0;y<320;y++)for(let x=0;x<384;x++)if(d[(y*384+x)*4+3]>=32)b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x+1),Math.max(b[3],y+1)];return b;};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('only rifle metadata offers one deeply frozen 4-cel rest bank; the blink cel stays unchanged',()=>{
  const A=motion.RIFLE_REST_ART;assert.deepEqual(JSON.parse(JSON.stringify(A)),{key:REST,path:restPath,bounds:BOUNDS,muzzles:MUZZLES});
  for(const o of[A,A.bounds,A.muzzles,...A.bounds,...A.muzzles])assert(Object.isFrozen(o));
  assert.deepEqual(JSON.parse(JSON.stringify(motion.RIFLE_IDLE_ART)),{key:BLINK,path:'art/rifle-idle-20261021/idle.png',bounds:[[109,125,301,305]],muzzles:[[300,192]]});
  const a=getUserCastArt('sakura').motion;assert.equal(a.rest,A);assert.equal(a.idle,motion.RIFLE_IDLE_ART);assert.deepEqual(A.bounds[0],a.bounds[12]);
  assert.equal(getUserCastArt('kai').motion.rest,undefined);assert.equal(getUserCastArt('enjo').motion.rest,motion.ENJO_REST_ART);
});

test('rest strip is the admitted candidate: frame0 exact original ready12, feet band exact in every cel, visible upper-body change',async()=>{
  const b=fs.readFileSync(new URL('../public/'+restPath,import.meta.url));assert.equal(b.length,239982);assert.equal(b.readUInt32BE(16),1536);assert.equal(b.readUInt32BE(20),320);
  assert.equal(sha(b),'6baf85b7e5ea1381d954e6900e4c798e70dd097a86875fbe3eb10dcd9d8cc961');
  const c=await cels(),feet=265*384*4;
  // RGBA sha of original ready12 (cat-rifle.webp frame12 == B50 reference/ready.png, proven in the B50 source gate).
  assert.equal(sha(c[0]),'0a616816c7379de7c84c98eb26054bcafe8854f38975608db9cf32fda853f66f');
  for(let n=0;n<4;n++){assert.deepEqual(visible(c[n]),BOUNDS[n],'own bounds '+n);assert(c[n].subarray(feet).equals(c[0].subarray(feet)),'feet band y265..319 exact '+n);
    if(n)assert(!c[n].subarray(0,feet).equals(c[0].subarray(0,feet)),'cel '+n+' changes hair/fabric/shoulder above the feet');}
});

test('only selected rifle preloads the rest bank at 384x320 beside idle; practice and later stages never enable it',()=>{
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const{preloadActorPresentation}=e.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of['sakura','kai','enjo']){const calls=[],s={load:{image(){},spritesheet:(...a)=>calls.push(a)}};preloadActorPresentation(s,{stageId:1,performerId:id});
    const rest=calls.filter(a=>a[0]===REST);assert.equal(rest.length,id==='sakura'?1:0);if(rest.length)assert.deepEqual(JSON.parse(JSON.stringify(rest[0])),[REST,restPath,{frameWidth:384,frameHeight:320}]);
    assert.equal(calls.filter(a=>a[0]===BLINK).length,id==='sakura'?1:0);
    const n=calls.length;preloadActorPresentation(s,{stageId:1,performerId:id,practiceMode:true});preloadActorPresentation(s,{stageId:2,performerId:id});assert.equal(calls.length,n);}
});

test('standing idle cycles ready12, rest 1..3, ready12, blink, ready12 on exact boundaries and repeats every 3600 without transforms',()=>{
  const{scene:s,view:v}=fixture(),before={...s.player};at(v,0);const fixed=transform(v);
  const plan=[[0,OPEN],[399,OPEN],[400,R(1)],[999,R(1)],[1000,R(2)],[1599,R(2)],[1600,R(3)],[2199,R(3)],[2200,OPEN],[3419,OPEN],[3420,CLOSED],[3539,CLOSED],[3540,OPEN],[3599,OPEN],[3600,OPEN],
    [3999,OPEN],[4000,R(1)],[4600,R(2)],[5200,R(3)],[5800,OPEN],[7020,CLOSED],[7140,OPEN],[7600,R(1)]];
  const seen=new Set();for(const[t,want]of plan){assert.deepEqual(at(v,t),want,'t'+t);assert.deepEqual(transform(v),fixed,'no whole-image transform t'+t);seen.add(want.join());}
  assert.equal(seen.size,5,'render really changes phase');for(let t=7600;t<14800;t+=10)assert.notDeepEqual(at(v,t),R(0),'rest frame0 is source proof only');
  assert.equal(v.state,'idle');assert.deepEqual(s.player,before);assert.deepEqual([s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[0,0]);
});

test('rest cels drive muzzle and hazard exclusion from their own landmarks on both facings; hand origin unchanged',()=>{
  for(const sign of[1,-1]){const{scene:s,view:v}=fixture();at(v,0);v.beginShot(0,sign,0,400);at(v,10);at(v,270);assert.equal(v.state,'idle');const hand=v.handWorld();
    for(const n of[1,2,3]){assert.deepEqual(at(v,270+400+600*(n-1)),R(n));const[x,y]=MUZZLES[n],r=BOUNDS[n],b=v.image.getBounds();
      assert.deepEqual(v.muzzleWorld(),{x:500+(v.flip?-1:1)*(x-192)*.5,y:1026+(y-304)*.5});
      assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});
      assert.deepEqual(v.handWorld(),hand);assert.equal(v.flip,sign<0);assert.deepEqual([s.player.x,s.player.y,s.player.hp],[500,1000,6]);}}
});

test('movement, attack, action and hurt never show rest and each re-entry to idle restarts at ready12',()=>{
  const moving=fixture();at(moving.view,0);
  for(let t=16;t<=3600;t+=16){moving.scene.player.x+=3;assert.notEqual(at(moving.view,t)[0],REST,'move t'+t);}
  assert.deepEqual(at(moving.view,3616),OPEN);assert.deepEqual(at(moving.view,3616+399),OPEN);assert.deepEqual(at(moving.view,3616+400),R(1));
  const firing=fixture().view;at(firing,0);let last=-Infinity;
  for(let t=0;t<=4000;t+=16){if(t-last>=333){assert.equal(firing.beginShot(t,1,0,333),true);last=t;}assert.notEqual(at(firing,t)[0],REST,'attack t'+t);}
  for(const trigger of[s=>s.publicPerformerRun.actions=1,s=>s.battleRecord.playerHitCount=1]){
    const{scene:s,view:v}=fixture();at(v,0);assert.deepEqual(at(v,1100),R(2));trigger(s);at(v,1110);assert(['action','hurt'].includes(v.state),v.state);
    for(let t=1110;t<=1110+330;t+=10)assert.notEqual(at(v,t)[0],REST,v.state+t);
    const entered=v.idleClock;assert.equal(v.state,'idle');assert(entered>=1110+240&&entered<=1110+320,'re-entered idle at '+entered);
    assert.deepEqual(at(v,entered+399),OPEN);assert.deepEqual(at(v,entered+400),R(1));
  }
  // A real shot during a rest cel replaces it at once and keeps the 270ms rifle shot.
  const v=fixture().view;at(v,0);assert.deepEqual(at(v,1200),R(2));v.beginShot(1210,1,0,333);assert.equal(at(v,1220)[0],SHOOT);assert.equal(at(v,1210+269)[0],SHOOT);
  assert.deepEqual(at(v,1210+270),OPEN);assert.deepEqual(at(v,1210+270+399),OPEN);assert.deepEqual(at(v,1210+270+400),R(1));
});

test('pause holds the active idle clock and current rest cel; resume continues on active time',()=>{
  const{scene:s,view:v}=fixture();at(v,0);assert.deepEqual(at(v,900),R(1));s._battlePaused=true;
  assert.deepEqual(at(v,9000,true),R(1));assert.equal(v.beginShot(9000,1,0,333),false);s._battlePaused=false;
  assert.deepEqual(at(v,9010),R(1));assert.deepEqual(at(v,9010+99),R(1));assert.deepEqual(at(v,9010+100),R(2));
});

test('missing rest keeps ready12 with the original blink; missing blink keeps rest; both missing and kai stay ready12',()=>{
  const run=(missing,id='sakura')=>{const{view:v}=fixture(id,missing);at(v,0);return[400,1000,1600,2200,3420,3539,3540].map(t=>at(v,t));};
  assert.deepEqual(run([REST]),[OPEN,OPEN,OPEN,OPEN,CLOSED,CLOSED,OPEN]);
  assert.deepEqual(run([BLINK]),[R(1),R(2),R(3),OPEN,OPEN,OPEN,OPEN]);
  assert.deepEqual(run([REST,BLINK]),Array(7).fill(OPEN));
  const k=getUserCastArt('kai').motion.key;assert.deepEqual(run([],'kai'),Array(7).fill([k,12]));
  const{view:v}=fixture('sakura',[REST]);at(v,0);at(v,1000);assert.deepEqual(v.muzzleWorld(),{x:500+(300-192)*.5,y:1026+(192-304)*.5});
});

test('destroy cleans up once and stops the rest cycle',()=>{
  const{view:v,nodes}=fixture();at(v,0);assert.deepEqual(at(v,1000),R(2));v.destroy();v.destroy();assert(nodes.every(n=>n.destroyed===1));
  v.update(1600,false);assert.deepEqual([v.image.texture.key,v.image.frame.name],R(2));assert.equal(v.muzzleWorld(),null);assert.equal(v.cueExclusionBounds(),null);
});
