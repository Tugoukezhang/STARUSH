import test from 'node:test';import assert from 'node:assert/strict';
import{UserCastPresentation}from'../src/systems/UserCastPresentation.mjs';import{SHOOT_CONFIG}from'../src/utils/config.js';
// Real presentation class; only Phaser display nodes are stubbed.
const key='user-rifle-shoot-20261021',FIRE=SHOOT_CONFIG.FIRE_RATE;
function fixture(id='sakura'){const node=(x=0,y=0,k='',f=0)=>({x,y,texture:{key:k},frame:{name:f},destroyed:0,setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(){return this;},setTint(t){this.tint=t;return this;},setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:0,y:0,right:1,bottom:1};},destroy(){this.destroyed++;}});const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:()=>true},add:{image:node,ellipse:node}};return{s:scene,v:new UserCastPresentation(scene,id)};}
// 60fps render loop: move first, fire through the real notification, then render.
function drive(v,s,from,to,{vx=3,shootUntil=-Infinity,aim=[-1,0],interval=FIRE,log=[],last={t:-Infinity}}={}){
  for(let t=from;t<=to;t+=16){s.player.x+=vx;
    if(t<=shootUntil&&t-last.t>=interval){assert.equal(v.beginShot(t,aim[0],aim[1],interval),true);last.t=t;}
    v.update(t,false);log.push({t,flip:v.image.flipX,hand:v.handWorld().x-s.player.x,age:t-last.t,state:v.state});}
  return log;
}
const flips=log=>log.slice(1).filter((r,i)=>r.flip!==log[i].flip).length;

test('moving right while repeatedly firing at a fixed left target keeps one shot-aligned body through the streak',()=>{
  const{s,v}=fixture(),last={t:-Infinity};v.update(0,false);const log=drive(v,s,16,96,{last});
  assert(log.every(r=>r.flip===false),'movement owns facing before any shot');
  drive(v,s,112,1900,{shootUntil:1200,log,last});
  const shots=log.filter(r=>r.age===0).map(r=>r.t);assert.deepEqual(shots,[112,448,784,1120]);
  const streak=log.filter(r=>r.t>=112&&r.t<=1120+FIRE);
  assert.deepEqual(streak.filter(r=>r.flip!==true).map(r=>r.t),[],'body flipped back to movement between same-side shots');
  assert.equal(flips(log),2,'one turn into the streak, one turn back after it expires');
  assert.equal(log.find(r=>r.t>1120&&r.flip===false)?.t>1120+FIRE+40,true,'held across a normal fire gap');
  assert(log.filter(r=>r.t>1120+FIRE+150).every(r=>r.flip===false),'streak expiry returns body to movement heading');
  // Physical hand origin keeps its old 140ms semantics: aim side at release, movement side afterwards.
  for(const r of log.filter(r=>r.t>=112&&r.t<=1200)){if(r.age<=112)assert.equal(r.hand,-16,'t'+r.t);if(r.age>=144)assert.equal(r.hand,16,'t'+r.t);}
  assert.deepEqual([s.player.y,s.player.hp,s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[1000,6,0,0]);
});

test('a real opposite-side shot during the hold turns body and hand together, then holds the new side',()=>{
  const{s,v}=fixture(),last={t:-Infinity};v.update(0,false);drive(v,s,16,500,{shootUntil:400,last});assert.equal(v.flip,true);
  assert.equal(v.beginShot(512,1,0,FIRE),true);assert.equal(v.flip,false);assert.equal(v.handWorld().x-s.player.x,16);
  const log=drive(v,s,512,800,{vx:-3});assert(log.every(r=>r.flip===false),'new shot side held while backing left');
  assert.equal(log.at(-1).hand,-16,'hand still follows movement after 140ms');
});

test('near-vertical shots keep the old sign rule and add no artificial flip or hold',()=>{
  const{s,v}=fixture();v.update(0,false);const log=drive(v,s,16,1100,{shootUntil:1000,aim:[.1,-.995]});
  assert.equal(flips(log),0);assert(log.every(r=>r.hand===16));
  const{s:s2,v:v2}=fixture();v2.update(0,false);drive(v2,s2,16,64);v2.beginShot(80,-.1,-.995,FIRE);assert.equal(v2.flip,false);
  const turn=drive(v2,s2,80,600,{vx:-3});const first=turn.find(r=>r.flip===true).t;
  assert(first>=80+v2.shotDuration&&first<=80+v2.shotDuration+32,'movement turn waits only for the shot cel, not a streak hold');
});

test('pause freezes the streak hold on the active clock and late shots stay rejected',()=>{
  const{s,v}=fixture();v.update(0,false);drive(v,s,16,64);v.beginShot(80,-1,0,FIRE);drive(v,s,80,176);assert.equal(v.flip,true);
  s._battlePaused=true;v.update(5000,true);assert.equal(v.beginShot(5000,1,0,FIRE),false);assert.equal(v.flip,true);
  s._battlePaused=false;v.update(5016,false);
  drive(v,s,5032,5016+240);assert.equal(v.flip,true,'active hold age 336 < hold');
  drive(v,s,5016+256,5016+400);assert.equal(v.flip,false,'hold expired by active time, not wall time');
});

test('action and hurt precedence is unchanged and they end any streak hold',()=>{
  const{s,v}=fixture();v.update(0,false);drive(v,s,16,64);v.beginShot(80,-1,0,FIRE);drive(v,s,80,112);
  s.publicPerformerRun.actions=1;drive(v,s,128,128);assert.equal(v.state,'action');assert.equal(v.image.frame.name,14);
  drive(v,s,144,448);assert.equal(v.state,'move');assert.equal(v.flip,false,'after action the body uses old movement ownership');
  v.beginShot(464,-1,0,FIRE);s.battleRecord.playerHitCount=1;drive(v,s,464,480);assert.equal(v.state,'hurt');assert.equal(v.muzzleWorld(),null);
  drive(v,s,496,800);assert.equal(v.flip,false);assert.deepEqual([s.player.hp,s.publicPerformerRun.actions,s.battleRecord.playerHitCount],[6,1,1]);
});

test('ended, dialog, dead, inactive and destroyed shots are still rejected without touching facing',()=>{
  for(const block of [s=>s._battleEnded=true,s=>s._publicBattleDialog={},s=>s.player.hp=0,s=>s.player.active=false]){
    const{s,v}=fixture();v.update(0,false);drive(v,s,16,48);const before=[v.flip,v.handFlip,v.shotClock,v.shotDuration];block(s);
    assert.equal(v.beginShot(64,-1,0,FIRE),false);assert.deepEqual([v.flip,v.handFlip,v.shotClock,v.shotDuration],before);}
  const{v}=fixture();v.destroy();assert.equal(v.beginShot(0,-1,0,FIRE),false);
});

test('rifle shot cycle reads at ~270ms of the 333ms interval with four held recoil-to-ready cels',()=>{
  const{v}=fixture();v.update(0,false);v.beginShot(0,1,0,FIRE);
  assert.equal(v.shotDuration,270);assert(v.shotDuration<FIRE&&v.shotDuration>180);
  const runs=[];for(let t=0;t<v.shotDuration;t++){v.update(t,false);assert.equal(v.image.texture.key,key);const f=v.image.frame.name;if(runs.at(-1)?.f===f)runs.at(-1).n++;else runs.push({f,n:1});}
  assert.deepEqual(runs.map(r=>r.f),[0,1,2,3]);assert(runs.every(r=>r.n>=27),JSON.stringify(runs));
  assert(runs[1].n+runs[2].n>runs[0].n+runs[3].n,'kick and recovery held longer than release and ready');
  v.update(270,false);assert.equal(v.state,'idle');assert.equal(v.image.frame.name,12);
  for(const[interval,max]of[[undefined,270],[400,270],[1000,270],[250,205],[200,164],[150,123]]){const{v}=fixture();v.update(0,false);v.beginShot(0,1,0,interval);
    assert(v.shotDuration<=max+1e-9&&v.shotDuration>=80,interval+':'+v.shotDuration);if(interval)assert(v.shotDuration<interval);
    const seen=new Set();for(let t=0;t<v.shotDuration;t+=16){v.update(t,false);seen.add(v.image.frame.name);}assert.deepEqual([...seen],[0,1,2,3],'interval '+interval);}
});

test('sword and hammer keep exact old cadence and movement-facing return',()=>{
  for(const[id,base]of[['kai',240],['enjo',260]]){
    for(const[interval,want]of[[undefined,base],[FIRE,base],[400,base],[200,160]]){const{v}=fixture(id);v.update(0,false);v.beginShot(0,1,0,interval);assert.equal(v.shotDuration,want,id+interval);}
    const{s,v}=fixture(id);v.update(0,false);const log=drive(v,s,16,64);v.beginShot(80,-1,0,FIRE);drive(v,s,80,1000,{log});
    const move=log[0].flip,first=log.find(r=>r.t>80&&r.flip===move).t;assert.equal(id==='kai',move);
    assert(first>=80+base&&first<=80+base+32,id+' turned at '+first);
  }
});

test('rifle shot reads a real recoil peak: half-recovery cel is on screen at 170ms, cels 27/122/81/40 of 270',()=>{
  const{v}=fixture();v.update(0,false);v.beginShot(0,1,0,FIRE);v.update(170,false);
  assert.equal(v.image.texture.key,key);assert.equal(v.image.frame.name,2,'170ms must show half recovery, not the static ready cel');
  const{v:w}=fixture();w.update(0,false);w.beginShot(0,1,0,FIRE);assert.equal(w.shotDuration,270);assert(w.shotDuration<FIRE);
  const runs=[];for(let t=0;t<w.shotDuration;t++){w.update(t,false);const f=w.image.frame.name;if(runs.at(-1)?.f===f)runs.at(-1).n++;else runs.push({f,n:1});}
  assert.deepEqual(runs.map(r=>[r.f,r.n]),[[0,27],[1,122],[2,81],[3,40]]);assert.equal(runs[1].n+runs[2].n,203,'kick plus recovery');
  w.update(270,false);assert.equal(w.state,'idle');assert.equal(w.image.frame.name,12);
});
