import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';

function fixture(id='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);let now=1000;const images=[],timers=[],notices=[];
 const node=(x,y,key)=>({x,y,texture:{key},active:true,frame:0,setOrigin(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(){return this;},setAlpha(a){this.alpha=a;return this;},setRotation(){return this;},setDepth(d){this.depth=d;return this;},setFrame(f){assert(!key.startsWith('public-ui:'),'Static icons must keep their base frame');this.frame=f;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;}});
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id},time:{get now(){return now;},delayedCall(delay,callback){const t={delay,callback,remove(){}};timers.push(t);return t;}},
  player:{active:true,x:500,y:600,hp:4,maxHp:5},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},paintZone:{currentZone:0,devices:[],applyPaint:()=>true,applyPaintAt:()=>false},
  textures:{exists:()=>true},add:{image(x,y,key){const n=node(x,y,key);images.push(n);return n;}},_stampGroundSplat(){},_paintPublicStage1TargetsAt:()=>false,_showPublicBattleNotice:(...a)=>notices.push(a)};
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
 const fx=new UserWeaponFx(s,id);s.actorPresentation={userCastView:{weaponFx:fx}};
 return {e,s,run,fx,images,timers,notices,view:{depth:9.8},setTime:v=>now=v};
}
test('rejected fixture paint cannot claim relay success or produce a proc cue',()=>{
 const f=fixture(),target={x:510,y:600,zone:0},other={x:530,y:600,zone:0};f.run.growth.choose('relay');f.s.paintZone.devices=[target,other];f.s.paintZone.applyPaint=()=>false;
 f.run.onImpact(target.x,target.y,'pink',target);assert.equal(f.notices.length,0);assert.equal(f.fx.rows.length,0);assert.equal(f.run.impacts,1);
});
test('rifle retains relay and delayed echo cues at actual accepted world positions',()=>{
 for(const id of ['sakura']){
  const f=fixture(id),a={x:510,y:600,zone:0},b={x:550,y:600,zone:0};f.s.paintZone.devices=[a,b];f.run.growth.choose('relay');f.run.growth.choose('echo');
  f.run.onImpact(a.x,a.y,'pink',a);const relay=f.fx.rows.find(r=>r.choice==='relay');assert(relay);assert.equal(relay.x,b.x);assert.equal(relay.y,b.y);
  f.run.onImpact(a.x,a.y,'pink',a);f.run.onImpact(a.x,a.y,'pink',a);assert.equal(f.timers.length,1);assert(!f.fx.rows.some(r=>r.choice==='echo'));
  f.setTime(1200);f.timers[0].callback();const echo=f.fx.rows.find(r=>r.choice==='echo');assert(echo);assert.equal(echo.x,a.x);assert.equal(echo.y,a.y);assert.equal(f.run.impacts,3);
 }
});

test('Enjo third accepted impact queues a real outward echo at the old impact',()=>{
 const f=fixture('enjo');f.run.growth.choose('relay');f.run.growth.choose('echo');
 for(let i=0;i<3;i++)f.run.onImpact(510,600,'orange',null);
 assert.equal(f.timers.length,0);assert.equal(f.run.groundEcho.rows.length,1);
 assert.equal(f.run.groundEcho.rows[0].wave.origin.x,510);assert.equal(f.run.groundEcho.rows[0].wave.origin.y,600);
 f.run.destroy();assert.equal(f.run.groundEcho.rows.length,0);
});
test('real charge award observes only the actual tempo bonus, including cap and prepared multipliers',()=>{
 const f=fixture('kai');f.run.growth.choose('tempo');f.run.preparationEffects=Object.freeze({paintRadiusBonus:0,actionPower:1,chargeMultiplier:1.15});
 const {BattleScene}=f.e.loadRuntime('scenes/BattleScene.js');f.s._isPublicStage1Round=()=>true;f.s._addPublicEncoreCharge=()=>{};f.s._specialCharge=0;
 BattleScene.prototype._awardPublicSakuraActionCharge.call(f.s,'required-anchor');assert(Math.abs(f.s._specialCharge-37.95)<1e-9);assert(f.fx.rows.some(r=>r.choice==='tempo'));
 f.fx.clear();f.setTime(2000);f.s._specialCharge=95;BattleScene.prototype._awardPublicSakuraActionCharge.call(f.s,'required-anchor');assert.equal(f.s._specialCharge,100);assert.equal(f.fx.rows.length,0);
 f.s._specialCharge=0;f.run.growth=new f.e.profile.PublicRunProgression();BattleScene.prototype._awardPublicSakuraActionCharge.call(f.s,'required-anchor');assert.equal(f.fx.rows.length,0);
});
test('recovery cues only an actual HP increase, never full HP or defeated players',()=>{
 for(const id of ['sakura','kai','enjo']){const f=fixture(id);f.run.growth.choose('tempo');f.run.growth.choose('recovery');f.run.onAnchor();assert.equal(f.s.player.hp,5);assert(f.fx.rows.some(r=>r.choice==='recovery'));
  f.fx.clear();f.setTime(2000);f.run.onAnchor();assert.equal(f.fx.rows.length,0);f.s.player.hp=0;f.run.onAnchor();assert.equal(f.s.player.hp,0);assert.equal(f.fx.rows.length,0);}
});
test('bitmap proc cues share bounded pause/end/expiry cleanup and never create gameplay effects',()=>{
 const f=fixture();assert.equal(typeof f.fx.choice,'function');
 for(let i=0;i<100;i++){f.setTime(1000+i*300);f.fx.choice(['relay','echo','tempo','recovery'][i%4],{x:510,y:600});}
 assert(f.fx.rows.length<=4);assert(f.images.filter(n=>n.active).length<=4);const hp=f.s.player.hp,paint=f.run.impacts;
 f.fx.update(31000,f.view);const row=f.fx.rows.at(-1);f.s._battlePaused=true;f.setTime(31000);f.fx.update(99000,f.view);assert(row.node.active);
 f.s._battlePaused=false;f.setTime(32000);f.fx.update(100000,f.view);assert.equal(f.fx.rows.length,0);assert.equal(f.s.player.hp,hp);assert.equal(f.run.impacts,paint);
 f.fx.choice('relay',{x:510,y:600});f.s._battleEnded=true;f.fx.update(32000,f.view);assert.equal(f.fx.rows.length,0);f.fx.destroy();f.fx.destroy();assert(f.images.every(n=>!n.active));
});

test('no-target relay, blocked echo, missing texture and hidden routes cannot produce false cues',()=>{
 const f=fixture();f.run.growth.choose('relay');f.run.onImpact(510,600,'pink',null);assert.equal(f.fx.rows.length,0);assert.equal(f.notices.length,0);
 f.run.growth.choose('echo');f.run.onImpact(510,600,'pink',null);f.run.onImpact(510,600,'pink',null);f.s.oldStreet.clearLine=()=>false;f.timers[0].callback();assert.equal(f.fx.rows.length,0);assert.equal(f.notices.length,0);
 f.s.oldStreet.clearLine=()=>true;f.s.textures.exists=()=>false;assert.equal(f.fx.choice('echo',{x:510,y:600}),false);assert.equal(f.images.length,0);
 f.s.textures.exists=()=>true;f.s._userCastPresentation=false;assert.equal(f.fx.choice('echo',{x:510,y:600}),false);assert.equal(f.images.length,0);
});
