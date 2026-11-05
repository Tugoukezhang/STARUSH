import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{getUserCastArt}from'../src/utils/userCast.mjs';import{SHOOT_CONFIG}from'../src/utils/config.js';
// B61: standing rifle holds the existing approved kick cel longer; duration, facing and physical shots stay as before.
const key='user-rifle-shoot-20261021',FIRE=SHOOT_CONFIG.FIRE_RATE;
function fixture(id='sakura',available=true){const node=(x=0,y=0,k='',f=0)=>({x,y,angle:0,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(a){this.angle=a;return this;},setAlpha(){return this;},setTint(){return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}});const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>k!==key||available},add:{image:node,ellipse:node}};return{s:scene,v:new UserCastPresentation(scene,id)};}
const runs=v=>{const out=[];for(let t=0;t<v.shotDuration;t++){v.update(t,false);assert.equal(v.image.texture.key,key);const f=v.image.frame.name;if(out.at(-1)?.f===f)out.at(-1).n++;else out.push({f,n:1});}return out;};

test('standing rifle endpoints are .1/.55/.85/1 of the unchanged 270ms shot inside the 333ms fire interval',()=>{
  const src=fs.readFileSync(new URL('../src/systems/UserCastPresentation.mjs',import.meta.url),'utf8');
  assert.equal(src.match(/const RIFLE_SHOT_CELS=\[[^\]]*\];/g)?.join(),'const RIFLE_SHOT_CELS=[.1,.55,.85,1];');
  assert.equal(FIRE,333);const{v}=fixture();v.update(0,false);assert.equal(v.beginShot(0,1,0,FIRE),true);assert.equal(v.shotDuration,270);
  // Exact cel spans 27 / 121.5 / 81 / 40.5ms sample at whole milliseconds as 27 / 122 / 81 / 40.
  assert.deepEqual(runs(v).map(r=>[r.f,r.n]),[[0,27],[1,122],[2,81],[3,40]]);
  v.update(270,false);assert.equal(v.state,'idle');assert.equal(v.image.texture.key,getUserCastArt('sakura').motion.key);assert.equal(v.image.frame.name,12);
});

test('130ms is still the kick cel, 170ms half recovery, 245ms ready; both facings use the same cel and its own muzzle marker',()=>{
  for(const sign of[1,-1]){const{s,v}=fixture();v.update(0,false);const before={...s.player};v.beginShot(0,sign,0,FIRE);const hand=v.handWorld();
    for(const[t,f]of[[0,0],[26,0],[27,1],[130,1],[148,1],[149,2],[170,2],[229,2],[230,3],[245,3],[269,3]]){v.update(t,false);
      assert.equal(v.state,'attack');assert.equal(v.image.texture.key,key);assert.equal(v.image.frame.name,f,sign+'@'+t);assert.equal(v.image.flipX,sign<0);
      assert.deepEqual([v.image.x,v.image.y,v.image.displayWidth,v.image.displayHeight,v.image.originY,v.image.angle],[500,1026,192,160,304/320,0]);
      const[x,y]=v.art.motion.shoot.muzzles[f];assert.deepEqual(v.muzzleWorld(),{x:500+(v.flip?-1:1)*(x-192)*.5,y:1026+(y-304)*.5});assert.deepEqual(v.handWorld(),hand);}
    assert.deepEqual(s.player,before);assert.equal(s.publicPerformerRun.actions,0);assert.equal(s.battleRecord.playerHitCount,0);}
});

test('paced shots keep old 80ms floor, .82 mapping and 270 cap; every paced cycle still shows all four cels',()=>{
  for(const[interval,want]of[[undefined,270],[FIRE,270],[400,270],[250,205],[200,164],[150,123],[60,80]]){const{v}=fixture();v.update(0,false);v.beginShot(0,1,0,interval);
    assert(Math.abs(v.shotDuration-want)<1e-9,interval+':'+v.shotDuration);assert.deepEqual(runs(v).map(r=>r.f),[0,1,2,3],'interval '+interval);}
  for(const[id,base]of[['kai',240],['enjo',260]])for(const[interval,want]of[[undefined,base],[FIRE,base],[200,160]]){const{v}=fixture(id);v.update(0,false);v.beginShot(0,1,0,interval);assert.equal(v.shotDuration,want);}
});

test('pause/dialog freeze the held kick; walk, action and hurt keep priority; fallback and other casts keep 14..17 quarters',()=>{
  const{s,v}=fixture();v.update(0,false);v.beginShot(0,1,0,FIRE);v.update(130,false);assert.equal(v.image.frame.name,1);const clock=v.clock;
  s._battlePaused=true;v.update(4000,true);assert.equal(v.beginShot(4000,-1,0,FIRE),false);s._battlePaused=false;v.update(4010,false);assert.equal(v.clock,clock);assert.equal(v.image.frame.name,1);
  v.update(4050,false);assert.equal(v.image.frame.name,2);v.update(4125,false);assert.equal(v.image.frame.name,3);
  s._publicBattleDialog=true;assert.equal(v.beginShot(4200,1,0,FIRE),false);s._publicBattleDialog=false;
  const w=fixture();w.v.update(0,false);w.v.beginShot(0,1,0,FIRE);w.s.player.x+=15;w.v.update(130,false);assert.equal(w.v.state,'move-attack');assert.equal(w.v.image.texture.key,getUserCastArt('sakura').motion.walk.key);
  w.s.publicPerformerRun.actions=1;w.v.update(140,false);assert.equal(w.v.state,'action');assert.equal(w.v.image.frame.name,14);
  w.s.battleRecord.playerHitCount=1;w.v.update(150,false);assert.equal(w.v.state,'hurt');assert.equal(w.v.image.frame.name,18);
  for(const[id,available]of[['sakura',false],['kai',true],['enjo',true]]){const{v}=fixture(id,available);v.update(0,false);v.beginShot(0,1,0,FIRE);
    for(const i of[0,1,2,3]){v.update(v.shotDuration*i/4,false);assert.equal(v.image.texture.key,getUserCastArt(id).motion.key);assert.equal(v.image.frame.name,14+i);}}
});
