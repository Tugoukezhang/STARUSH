import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{getUserCastArt}from'../src/utils/userCast.mjs';import{RIFLE_IDLE_ART}from'../src/utils/userCastMotionData.mjs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
// Real presentation class; only Phaser display nodes are stubbed (copied from rifleShootRecovery).
const key='user-rifle-idle-20261021',path='art/rifle-idle-20261021/idle.png',base='user-motion-cat-rifle';
// Excludes the B50 rest bank so every case here keeps exercising the original blink-only fallback path.
function fixture(id='sakura',available=true){const nodes=[],node=(x=0,y=0,k='',f=0)=>{const n={x,y,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(a){this.angle=a;return this;},setAlpha(){return this;},setTint(){return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}};nodes.push(n);return n;};const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>k!=='user-rifle-rest-20261022'&&(k!==key||available)},add:{image:node,ellipse:node}};return{scene,view:new UserCastPresentation(scene,id),nodes};}
const at=(v,t,frozen=false)=>{v.update(t,frozen);return[v.image.texture.key,v.image.frame.name];};
const OPEN=[base,12],CLOSED=[key,0];

test('only rifle metadata offers one deeply frozen closed-eye idle cel with ready12 landmarks',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(RIFLE_IDLE_ART)),{key,path,bounds:[[109,125,301,305]],muzzles:[[300,192]]});
  for(const o of[RIFLE_IDLE_ART,RIFLE_IDLE_ART.bounds,RIFLE_IDLE_ART.bounds[0],RIFLE_IDLE_ART.muzzles,RIFLE_IDLE_ART.muzzles[0]])assert(Object.isFrozen(o));
  const a=getUserCastArt('sakura').motion;assert.equal(a.idle,RIFLE_IDLE_ART);assert.equal(a.shoot.key,'user-rifle-shoot-20261021');
  assert.deepEqual(a.idle.bounds[0],a.bounds[12],'closed cel keeps original ready12 raster bounds');
  for(const id of['kai','enjo'])assert.equal(getUserCastArt(id).motion.idle,undefined);
  const b=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(b.length,60673);assert.equal(b.readUInt32BE(16),384);assert.equal(b.readUInt32BE(20),320);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'e0a8c1160e9304b80c78f40aa69fc23a56812387c4899de1c3c021d72eccb3a9');
});

test('only selected rifle preloads its idle cel at the shared 384x320 frame; practice never enables it',()=>{
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const{preloadActorPresentation}=e.loadRuntime('systems/ActorPresentation.mjs');
  for(const id of['sakura','kai','enjo']){const calls=[],s={load:{image(){},spritesheet:(...a)=>calls.push(a)}};preloadActorPresentation(s,{stageId:1,performerId:id});
    const idle=calls.filter(a=>a[0]===key);assert.equal(idle.length,id==='sakura'?1:0);if(idle.length)assert.deepEqual(JSON.parse(JSON.stringify(idle[0])),[key,path,{frameWidth:384,frameHeight:320}]);
    const n=calls.length;preloadActorPresentation(s,{stageId:1,performerId:id,practiceMode:true});assert.equal(calls.length,n);}
});

test('standing idle stays native ready12, shows closed cel 0 for 120ms at 3420, then reopens and repeats every 3600',()=>{
  const{scene:s,view:v}=fixture(),before={...s.player};
  for(let t=0;t<3420;t+=20)assert.deepEqual(at(v,t),OPEN,'t'+t);
  assert.deepEqual(at(v,3419),OPEN);assert.deepEqual(at(v,3420),CLOSED);assert.deepEqual(at(v,3500),CLOSED);assert.deepEqual(at(v,3539),CLOSED);
  assert.deepEqual(at(v,3540),OPEN);assert.deepEqual(at(v,7019),OPEN);assert.deepEqual(at(v,7020),CLOSED);assert.deepEqual(at(v,7140),OPEN);
  // No whole-body fake breathing: scale, origin, position, rotation and facing are untouched by the blink.
  assert.deepEqual(at(v,10700),CLOSED);assert.deepEqual([v.image.x,v.image.y,v.image.displayWidth,v.image.displayHeight,v.image.originX,v.image.originY,v.image.angle,v.image.flipX],[500,1026,192,160,.5,304/320,0,false]);
  assert.equal(v.state,'idle');assert.deepEqual(s.player,before);assert.deepEqual([s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[0,0]);
});

test('movement, attack, action and hurt never blink and each re-entry to idle restarts the 3420ms wait',()=>{
  const moving=fixture();at(moving.view,0);
  for(let t=16;t<=3600;t+=16){moving.scene.player.x+=3;assert.notEqual(at(moving.view,t)[0],key,'move t'+t);}
  assert.deepEqual(at(moving.view,3616),OPEN);assert.deepEqual(at(moving.view,3616+3419),OPEN);assert.deepEqual(at(moving.view,3616+3420),CLOSED);
  const firing=fixture().view;at(firing,0);let last=-Infinity;
  for(let t=0;t<=4000;t+=16){if(t-last>=333){assert.equal(firing.beginShot(t,1,0,333),true);last=t;}assert.notEqual(at(firing,t)[0],key,'attack t'+t);}
  for(const trigger of[s=>s.publicPerformerRun.actions=1,s=>s.battleRecord.playerHitCount=1]){
    const{scene:s,view:v}=fixture();at(v,0);at(v,3400);trigger(s);at(v,3410);assert(['action','hurt'].includes(v.state),v.state);
    for(let t=3410;t<=3410+330;t+=10)assert.notEqual(at(v,t)[0],key,v.state+t);
    const entered=v.idleClock;assert.equal(v.state,'idle');assert(entered>=3410+240&&entered<=3410+320,'re-entered idle at '+entered);
    assert.deepEqual(at(v,entered+3419),OPEN);assert.deepEqual(at(v,entered+3420),CLOSED);
  }
  // A real shot during the closed cel replaces it immediately; returning to idle waits a full 3420 again.
  const v=fixture().view;at(v,0);assert.deepEqual(at(v,3450),CLOSED);v.beginShot(3460,1,0,333);assert.equal(at(v,3470)[0],'user-rifle-shoot-20261021');
  assert.deepEqual(at(v,3460+270),OPEN);assert.deepEqual(at(v,3460+270+3419),OPEN);assert.deepEqual(at(v,3460+270+3420),CLOSED);
});

test('pause holds the idle clock and current eye cel; resume continues on active time',()=>{
  const{scene:s,view:v}=fixture();at(v,0);at(v,3400);s._battlePaused=true;
  assert.deepEqual(at(v,9000,true),OPEN);assert.equal(v.beginShot(9000,1,0,333),false);s._battlePaused=false;
  assert.deepEqual(at(v,9010),OPEN);assert.deepEqual(at(v,9029),OPEN);assert.deepEqual(at(v,9030),CLOSED);
  s._battlePaused=true;assert.deepEqual(at(v,20000,true),CLOSED);s._battlePaused=false;
  assert.deepEqual(at(v,20010),CLOSED);assert.deepEqual(at(v,20010+100),CLOSED);assert.deepEqual(at(v,20010+120),OPEN);
});

test('missing idle texture and the other two members keep original frame12 through the blink window',()=>{
  for(const[id,available]of[['sakura',false],['kai',true],['enjo',true]]){const{view:v}=fixture(id,available);at(v,0);
    for(const t of[3420,3500,3539,7020]){v.update(t,false);assert.equal(v.image.texture.key,getUserCastArt(id).motion.key);assert.equal(v.image.frame.name,12);}}
  const{view:v}=fixture('sakura',false);at(v,0);at(v,3500);assert.deepEqual(v.muzzleWorld(),{x:500+(300-192)*.5,y:1026+(192-304)*.5});
});

test('closed cel drives muzzle and hazard exclusion from idle landmarks on both facings, hand origin unchanged',()=>{
  for(const sign of[1,-1]){const{scene:s,view:v}=fixture();at(v,0);v.beginShot(0,sign,0,400);at(v,10);at(v,270);assert.equal(v.state,'idle');
    const hand=v.handWorld(),open=v.muzzleWorld();assert.deepEqual(at(v,270+3500),CLOSED);
    const[x,y]=RIFLE_IDLE_ART.muzzles[0],r=RIFLE_IDLE_ART.bounds[0],b=v.image.getBounds();
    assert.deepEqual(v.muzzleWorld(),{x:500+(v.flip?-1:1)*(x-192)*.5,y:1026+(y-304)*.5});assert.deepEqual(v.muzzleWorld(),open,'closed eye does not move the barrel');
    assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});
    assert.deepEqual(v.handWorld(),hand);assert.equal(v.flip,sign<0);assert.deepEqual([s.player.x,s.player.y,s.player.hp],[500,1000,6]);}
});

test('destroy cleans up once and stops the blink',()=>{
  const{view:v,nodes}=fixture();at(v,0);at(v,3500);v.destroy();v.destroy();assert(nodes.every(n=>n.destroyed===1));
  v.update(3600,false);assert.deepEqual([v.image.texture.key,v.image.frame.name],CLOSED);assert.equal(v.muzzleWorld(),null);assert.equal(v.cueExclusionBounds(),null);
});
