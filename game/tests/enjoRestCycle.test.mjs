import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{getUserCastArt}from'../src/utils/userCast.mjs';import*as motion from'../src/utils/userCastMotionData.mjs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
// Real presentation class; only Phaser display nodes are stubbed (copied from rifleRestCycle). No scene.time/tweens exist, so any timer use throws.
const REST='user-enjo-rest-20261023',restPath='art/enjo-rest-20261023/idle.png',base='user-motion-hammer-cat',RIFLE_REST='user-rifle-rest-20261022';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const B=[57,79,350,305],BOUNDS=[B,B,B,B];
function fixture(id='enjo',missing=[]){const nodes=[],node=(x=0,y=0,k='',f=0)=>{const n={x,y,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(a){this.angle=a;return this;},setAlpha(){return this;},setTint(){return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}};nodes.push(n);return n;};const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>!missing.includes(k)},add:{image:node,ellipse:node}};return{scene,view:new UserCastPresentation(scene,id),nodes};}
const at=(v,t,frozen=false)=>{v.update(t,frozen);return[v.image.texture.key,v.image.frame.name];};
const OPEN=[base,12],R=n=>[REST,n];
const transform=v=>[v.image.x,v.image.y,v.image.displayWidth,v.image.displayHeight,v.image.originX,v.image.originY,v.image.angle,v.image.flipX];
const raw=async p=>sharp(fs.readFileSync(new URL('../public/'+p,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const cel=({data,info},n)=>{const cols=info.width/384,fx=n%cols*384,fy=Math.floor(n/cols)*320,d=Buffer.alloc(384*320*4);for(let y=0;y<320;y++)data.copy(d,y*384*4,((y+fy)*info.width+fx)*4,((y+fy)*info.width+fx+384)*4);return d;};
const visible=d=>{let b=[384,320,0,0];for(let y=0;y<320;y++)for(let x=0;x<384;x++)if(d[(y*384+x)*4+3]>=32)b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x+1),Math.max(b[3],y+1)];return b;};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('enjo metadata offers one deeply frozen 4-cel rest bank beside walk/hurt; kai gets none and rifle keeps its own',()=>{
  const A=motion.ENJO_REST_ART;assert.deepEqual(JSON.parse(JSON.stringify(A)),{key:REST,path:restPath,bounds:BOUNDS});
  for(const o of[A,A.bounds,...A.bounds])assert(Object.isFrozen(o));
  const m=getUserCastArt('enjo').motion;assert.equal(m.rest,A);assert.equal(m.walk,motion.ENJO_WALK_ART);assert.equal(m.hurt,motion.ENJO_HURT_ART);
  assert.deepEqual([m.idle,m.shoot],[undefined,undefined],'no blink or shoot bank');assert.deepEqual(A.bounds[0],m.bounds[12]);
  assert.equal(getUserCastArt('kai').motion.rest,undefined);assert.equal(getUserCastArt('sakura').motion.rest,motion.RIFLE_REST_ART);
});

test('rest strip is the reviewed candidate: frame0 exact original ready12, feet band exact, upper-only change in cels 1..3',async()=>{
  const b=fs.readFileSync(new URL('../public/'+restPath,import.meta.url));assert.equal(b.length,171165);assert.equal(b.readUInt32BE(16),1536);assert.equal(b.readUInt32BE(20),320);
  assert.equal(sha(b),'91e18e61b0dea39a4d125b9ebfec51dd8b5ad0c9d2d77faa9a297abc99ff538a');
  const strip=await raw(restPath);assert.deepEqual([strip.info.width,strip.info.height,strip.info.channels],[1536,320,4]);
  const c=[0,1,2,3].map(n=>cel(strip,n)),feet=265*384*4,ready12=cel(await raw('art/three-cast-actions-20261018/hammer-cat.webp'),12);
  assert.equal(sha(c[0]),'27a84fcd1d58534c365cc4b5e223228233a55dbb13933ed7b236412206e69f28');assert(c[0].equals(ready12),'cel0 decodes identical to atlas ready12');
  for(let n=0;n<4;n++){assert.deepEqual(visible(c[n]),BOUNDS[n],'own bounds '+n);assert(c[n].subarray(feet).equals(c[0].subarray(feet)),'feet band y265..319 exact '+n);
    if(n)assert(!c[n].subarray(0,feet).equals(c[0].subarray(0,feet)),'cel '+n+' changes above the feet');}
});

test('only selected enjo preloads its rest bank at 384x320; practice and later stages never enable it',()=>{
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const{preloadActorPresentation}=e.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of['sakura','kai','enjo']){const calls=[],s={load:{image(){},spritesheet:(...a)=>calls.push(a)}};preloadActorPresentation(s,{stageId:1,performerId:id});
    const rest=calls.filter(a=>a[0]===REST);assert.equal(rest.length,id==='enjo'?1:0);if(rest.length)assert.deepEqual(JSON.parse(JSON.stringify(rest[0])),[REST,restPath,{frameWidth:384,frameHeight:320}]);
    assert.equal(calls.filter(a=>a[0]===RIFLE_REST).length,id==='sakura'?1:0);
    const n=calls.length;preloadActorPresentation(s,{stageId:1,performerId:id,practiceMode:true});preloadActorPresentation(s,{stageId:2,performerId:id});assert.equal(calls.length,n);}
});

test('standing idle: ready12 until 400, rest 1..3 at 400/1000/1600, ready12 at 2200, no blink, repeats every 3600 without transforms',()=>{
  const{scene:s,view:v}=fixture(),before={...s.player};at(v,0);const fixed=transform(v);
  const plan=[[0,OPEN],[399,OPEN],[400,R(1)],[999,R(1)],[1000,R(2)],[1599,R(2)],[1600,R(3)],[2199,R(3)],[2200,OPEN],[3419,OPEN],[3420,OPEN],[3539,OPEN],[3599,OPEN],[3600,OPEN],
    [3999,OPEN],[4000,R(1)],[4600,R(2)],[5200,R(3)],[5800,OPEN],[7020,OPEN],[7199,OPEN],[7600,R(1)]];
  const seen=new Set();for(const[t,want]of plan){assert.deepEqual(at(v,t),want,'t'+t);assert.deepEqual(transform(v),fixed,'no whole-image transform t'+t);seen.add(want.join());}
  assert.equal(seen.size,4,'render really changes phase');
  for(let t=7600;t<14800;t+=10){const f=at(v,t);assert(f[0]===base?f[1]===12:f[0]===REST&&f[1]>=1&&f[1]<=3,'only ready12 or rest1..3 t'+t);}
  assert.equal(v.state,'idle');assert.deepEqual(s.player,before);assert.deepEqual([s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[0,0]);
});

test('rest cels drive hazard exclusion from their own bounds on both facings; hand origin unchanged and no muzzle',()=>{
  for(const sign of[1,-1]){const{scene:s,view:v}=fixture();at(v,0);v.beginShot(0,sign,0,400);at(v,10);at(v,260);assert.equal(v.state,'idle');const hand=v.handWorld();
    for(const n of[1,2,3]){assert.deepEqual(at(v,260+400+600*(n-1)),R(n));const r=BOUNDS[n],b=v.image.getBounds();
      assert.equal(v.muzzleWorld(),null);
      assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});
      assert.deepEqual(v.handWorld(),hand);assert.equal(v.flip,sign<0);assert.equal(v.image.flipX,sign<0);assert.deepEqual([s.player.x,s.player.y,s.player.hp],[500,1000,6]);}}
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
  // A real swing during a rest cel replaces it at once with the original atlas attack cels for its 260ms.
  const v=fixture().view;at(v,0);assert.deepEqual(at(v,1200),R(2));v.beginShot(1210,1,0,400);
  for(const t of[1220,1210+259]){const f=at(v,t);assert.equal(f[0],base);assert([14,15,16,17].includes(f[1]),'swing cel '+f[1]);}
  assert.deepEqual(at(v,1210+260),OPEN);assert.deepEqual(at(v,1210+260+399),OPEN);assert.deepEqual(at(v,1210+260+400),R(1));
});

test('pause holds the active idle clock and current rest cel; resume continues on active time',()=>{
  const{scene:s,view:v}=fixture();at(v,0);assert.deepEqual(at(v,900),R(1));s._battlePaused=true;
  assert.deepEqual(at(v,9000,true),R(1));assert.equal(v.beginShot(9000,1,0,400),false);s._battlePaused=false;
  assert.deepEqual(at(v,9010),R(1));assert.deepEqual(at(v,9010+99),R(1));assert.deepEqual(at(v,9010+100),R(2));
});

test('missing rest stays ready12; kai stays ready12; rifle rest and blink are unaffected',()=>{
  const run=(missing,id='enjo')=>{const{view:v}=fixture(id,missing);at(v,0);return[400,1000,1600,2200,3420,3539,3540].map(t=>at(v,t));};
  assert.deepEqual(run([REST]),Array(7).fill(OPEN));
  const kai=getUserCastArt('kai').motion.key;assert.deepEqual(run([],'kai'),Array(7).fill([kai,12]));
  const rifle='user-motion-cat-rifle',blink='user-rifle-idle-20261021';
  assert.deepEqual(run([],'sakura'),[[RIFLE_REST,1],[RIFLE_REST,2],[RIFLE_REST,3],[rifle,12],[blink,0],[blink,0],[rifle,12]]);
});

test('destroy cleans up once and stops the rest cycle',()=>{
  const{view:v,nodes}=fixture();at(v,0);assert.deepEqual(at(v,1000),R(2));v.destroy();v.destroy();assert(nodes.every(n=>n.destroyed===1));
  v.update(1600,false);assert.deepEqual([v.image.texture.key,v.image.frame.name],R(2));assert.equal(v.muzzleWorld(),null);assert.equal(v.cueExclusionBounds(),null);
});
