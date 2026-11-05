import test from 'node:test';import assert from 'node:assert/strict';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{SHOOT_CONFIG}from'../src/utils/config.js';
// Real presentation class; only Phaser display nodes are stubbed.
const FIRE=SHOOT_CONFIG.FIRE_RATE,HOLD=Math.min(FIRE,500)+100;
function fixture(id='sakura'){const node=(x=0,y=0,k='',f=0)=>({x,y,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(){return this;},setTint(t){this.tint=t;return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:0,y:0,right:1,bottom:1};},destroy(){this.destroyed++;}});const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:()=>true},add:{image:node,ellipse:node}};return{s:scene,v:new UserCastPresentation(scene,id)};}
// 60fps render loop: move first, fire scheduled shots through the real notification, then render.
function run(v,s,from,to,{vx=3,shots={},log=[]}={}){
  for(let t=from;t<=to;t+=16){s.player.x+=vx;const a=shots[t];if(a)assert.equal(v.beginShot(t,a[0],a[1],FIRE),true,'shot '+t);
    v.update(t,false);log.push({t,flip:v.image.flipX,hand:v.handWorld().x-s.player.x,state:v.state});}
  return log;
}
const flips=log=>log.slice(1).filter((r,i)=>r.flip!==log[i].flip).length;
const firstTurn=(log,after,flip)=>log.find(r=>r.t>after&&r.flip===flip)?.t;

test('left streak continued by +-.14 vertical fire while moving right holds the left body past its original deadline, then expires',()=>{
  assert.equal(HOLD,433);const{s,v}=fixture();v.update(0,false);const log=run(v,s,16,96);assert(log.every(r=>r.flip===false));
  run(v,s,112,1900,{log,shots:{112:[-1,0],448:[.14,-.99],784:[-.14,-.99],1120:[.14,-.99]}});
  assert(log.filter(r=>r.t>=112&&r.t<=1552).every(r=>r.flip===true),'continuous fire keeps the established left body beyond 112+'+HOLD);
  assert.equal(firstTurn(log,1120,false),1568,'hold ends at the last vertical shot + '+HOLD);
  assert.equal(flips(log),2);assert(log.filter(r=>r.t>=1568).every(r=>r.flip===false));
  // Physical hand keeps its 140ms contract: lateral release side, then movement side; vertical shots do not move it.
  for(const r of log.filter(r=>r.t>=112&&r.t<=224))assert.equal(r.hand,-16,'t'+r.t);
  assert(log.filter(r=>r.t>=256).every(r=>r.hand===16));
  assert.equal(v.shotDuration,270);assert.equal(log.find(r=>r.t===448).state,'move-attack');
  assert.deepEqual([s.player.y,s.player.hp,s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[1000,6,0,0]);
});

test('right streak continued by vertical fire while backing left is the mirror image',()=>{
  const{s,v}=fixture();v.update(0,false);const log=run(v,s,16,96,{vx:-3});assert(log.every(r=>r.flip===true));
  run(v,s,112,1900,{vx:-3,log,shots:{112:[1,0],448:[-.14,-.99],784:[.14,-.99],1120:[-.14,-.99]}});
  assert(log.filter(r=>r.t>=112&&r.t<=1552).every(r=>r.flip===false));
  assert.equal(firstTurn(log,1120,true),1568);assert.equal(flips(log),2);
  for(const r of log.filter(r=>r.t>=112&&r.t<=224))assert.equal(r.hand,16,'t'+r.t);
  assert(log.filter(r=>r.t>=256).every(r=>r.hand===-16));
});

test('initially vertical fire still creates no artificial flip or hold',()=>{
  const{s,v}=fixture();v.update(0,false);const log=run(v,s,16,1100,{shots:{112:[-.14,-.99],448:[.14,-.99],784:[-.14,-.99]}});
  assert.equal(flips(log),0);assert(log.every(r=>r.hand===16));assert.equal(v.streakUntil,-Infinity);
  const{s:s2,v:v2}=fixture();v2.update(0,false);run(v2,s2,16,64);
  const turn=run(v2,s2,80,700,{vx:-3,shots:{80:[-.14,-.99],416:[.14,-.99]}});const first=firstTurn(turn,80,true);
  assert(first>=80+270&&first<=80+270+32,'turn waits only for the shot cel: '+first);
});

test('an expired hold is not revived by a later vertical shot',()=>{
  const{s,v}=fixture();v.update(0,false);run(v,s,16,64);
  const still=run(v,s,80,592,{vx:0,shots:{80:[-1,0]}});assert(still.every(r=>r.flip===true),'no movement, old side still shown');
  const a=run(v,s,608,1200,{shots:{608:[.14,-.99]}});assert.equal(firstTurn(a,608,false),880,'expired at 513: only the 270ms cel waits');
  const{s:s2,v:v2}=fixture();v2.update(0,false);run(v2,s2,16,64);
  const b=run(v2,s2,80,592,{shots:{80:[-1,0]}});assert.equal(firstTurn(b,80,false),528);
  const c=run(v2,s2,608,1200,{vx:-3,shots:{608:[.14,-.99]}});assert.equal(firstTurn(c,608,true),880);
});

test('the +-.15 threshold and the deadline boundary are exact',()=>{
  const{s,v}=fixture();v.update(0,false);run(v,s,16,64);
  const log=run(v,s,80,1400,{shots:{80:[-1,0],400:[.15,-.99],736:[-.15,-.99]}});
  assert(log.filter(r=>r.t<=1168).every(r=>r.flip===true),'abs dx .15 is vertical: no turn, hold renewed');assert.equal(firstTurn(log,736,false),1184);
  for(const[at,want]of[[513,960],[514,784]]){const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,512,{shots:{80:[-1,0]}});
    assert.equal(v.flip,true);assert.equal(v.beginShot(at,.14,-.99,FIRE),true);assert.equal(firstTurn(run(v,s,528,1200),528,false),want,'shot at '+at);}
  const{s:s2,v:v2}=fixture();v2.update(0,false);run(v2,s2,16,64);run(v2,s2,80,384,{shots:{80:[-1,0]}});
  assert.equal(v2.beginShot(400,.1501,-.99,FIRE),true);assert.equal(v2.flip,false,'strong opposite shot turns at once');assert.equal(v2.handWorld().x-s2.player.x,16);
  const back=run(v2,s2,400,1000,{vx:-3});assert(back.filter(r=>r.t<=832).every(r=>r.flip===false));assert.equal(firstTurn(back,400,true),848,'opposite shot renews hold');
});

test('action, hurt and pending event locks cancel and never revive a hold even when the vertical shot is accepted',()=>{
  {const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,112,{shots:{80:[-1,0]}});
    s.publicPerformerRun.actions=1;run(v,s,128,448);assert.equal(v.state,'move');assert.equal(v.flip,false);
    const log=run(v,s,464,1000,{vx:-3,shots:{464:[.14,-.99]}});const first=firstTurn(log,464,true);assert(first>=464+270&&first<=464+270+32,'after action: '+first);}
  for(const pend of [s=>s.publicPerformerRun.actions=1,s=>s.battleRecord.playerHitCount=1]){
    const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,240,{shots:{80:[-1,0]}});assert.equal(v.flip,true);
    pend(s);assert.equal(v.beginShot(256,.14,-.99,FIRE),true);assert.equal(v.streakUntil,-Infinity,'pending lock cancels the hold');
    run(v,s,256,592);assert.equal(v.flip,false,'movement owns after the locked state');
    const log=run(v,s,608,800,{vx:-3});assert.equal(log[0].flip,true,'no hold delays the movement turn');}
  {const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,112,{shots:{80:[-1,0]}});s.battleRecord.playerHitCount=1;run(v,s,128,128);assert.equal(v.state,'hurt');
    assert.equal(v.beginShot(144,.14,-.99,FIRE),true);assert.equal(v.streakUntil,-Infinity);run(v,s,144,368);assert.equal(v.flip,false);
    assert.deepEqual([s.player.hp,s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[6,0,1]);}
});

test('a renewed hold runs on the active clock across pause and resume',()=>{
  const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,480,{shots:{80:[-1,0],416:[.14,-.99]}});assert.equal(v.flip,true);
  s._battlePaused=true;v.update(5000,true);assert.equal(v.beginShot(5000,.14,-.99,FIRE),false);assert.equal(v.beginShot(5000,1,0,FIRE),false);assert.equal(v.flip,true);
  s._battlePaused=false;v.update(5016,false);
  assert(run(v,s,5032,5384).every(r=>r.flip===true),'active age 848 < 416+'+HOLD);
  run(v,s,5400,5400);assert.equal(v.flip,false,'renewed hold expired by active time');
});

test('sword and hammer keep exact old vertical-shot facing and never hold',()=>{
  for(const[id,base]of[['kai',240],['enjo',260]]){
    const{s,v}=fixture(id);v.update(0,false);const log=run(v,s,16,64);run(v,s,80,1000,{log,shots:{80:[-1,0],304:[.14,-.99]}});
    const move=log[0].flip,first=firstTurn(log,80,move);assert.equal(id==='kai',move);assert.equal(log.find(r=>r.t===80).flip,!move);
    assert(first>=304+base&&first<=304+base+32,id+' turned at '+first);assert.equal(v.shotDuration,base);assert.equal(v.streakUntil,-Infinity);
  }
});

test('rejected vertical shots during a hold do not renew it',()=>{
  for(const[block,unblock]of[[s=>s._battlePaused=true,s=>s._battlePaused=false],[s=>s._battleEnded=true,s=>s._battleEnded=false],[s=>s._publicBattleDialog={},s=>s._publicBattleDialog=null],[s=>s.player.hp=0,s=>s.player.hp=6],[s=>s.player.active=false,s=>s.player.active=true],[()=>{},()=>{}]]){
    const{s,v}=fixture();v.update(0,false);run(v,s,16,64);run(v,s,80,384,{shots:{80:[-1,0]}});const before=[v.flip,v.handFlip,v.shotClock,v.shotDuration,v.streakUntil];block(s);
    if(s._battlePaused||s._battleEnded||s._publicBattleDialog||s.player.hp<=0||!s.player.active)assert.equal(v.beginShot(400,.14,-.99,FIRE),false);
    assert.equal(v.beginShot(NaN,.14,-.99,FIRE),false);assert.equal(v.beginShot(400,NaN,-.99,FIRE),false);
    assert.deepEqual([v.flip,v.handFlip,v.shotClock,v.shotDuration,v.streakUntil],before);unblock(s);
    assert.equal(firstTurn(run(v,s,400,800),400,false),528,'original 80+'+HOLD+' deadline');}
  const{v}=fixture();v.update(0,false);v.beginShot(0,-1,0,FIRE);v.destroy();assert.equal(v.beginShot(16,.14,-.99,FIRE),false);
});
