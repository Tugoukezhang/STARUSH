import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {UserWeaponFx,preloadUserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
import {RELAY_TRANSFER_ART} from '../src/systems/RelayInkTransfer.mjs';
function runFixture(id='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const calls=[],a={x:510,y:600,zone:0},b={x:550,y:620,zone:0};
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id},time:{now:1000},player:{active:true,hp:4,maxHp:5,x:500,y:600},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},paintZone:{currentZone:0,devices:[a,b],applyPaint:()=>true},_stampGroundSplat(){},actorPresentation:{userCastView:{weaponFx:{choice:(...args)=>calls.push(args)}}},_showPublicBattleNotice(){}};
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;run.growth.choose('relay');return{e,run,s,a,b,calls};
}
test('all owners report immutable accepted fixture transfer origin, destination and actual pigment',()=>{
 for(const id of ['sakura','kai','enjo'])for(const color of ['pink','blue','yellow','purple','orange']){
  const f=runFixture(id);let paints=0;f.s.paintZone.applyPaint=()=>{paints++;f.b.x=900;f.b.y=900;return true;};
  f.run.onImpact(510,600,color,f.a);assert.equal(paints,1);assert.equal(f.run.choiceEffects.relay,1);assert.equal(f.calls.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])),['relay',{x:550,y:620,from:{x:510,y:600},color}]);assert.equal(f.run.impacts,1);
 }
});
test('enemy transfer retains pre-paint receipt even if successful paint removes the target',()=>{
 const f=runFixture(),enemy={active:true,x:560,y:620,hp:10,publicStage1EnemyRole:'unlit-chaser'};f.s.enemies.getChildren=()=>[enemy];let paints=0;
 f.s._paintPublicStage1TargetsAt=(x,y,amount,radius,unused,target)=>{paints++;assert.equal(target,enemy);assert.equal(amount,8);enemy.active=false;enemy.x=NaN;enemy.y=NaN;return true;};
 f.run.onImpact(510,600,'blue',f.a);assert.equal(paints,1);assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])),['relay',{x:560,y:620,from:{x:510,y:600},color:'blue'}]);
});
test('rejected transfer never reports a successful visual or contribution',()=>{
 const f=runFixture();f.s.paintZone.applyPaint=()=>false;f.run.onImpact(510,600,'pink',f.a);assert.equal(f.calls.length,0);assert.equal(f.run.choiceEffects.relay,0);
});
test('real owner run, choice hook, shared preload, throttle and destruction form one integrated path',()=>{
 for(const id of ['sakura','kai','enjo']){
  const loaded=new Set(),loads=[],loader={spritesheet:(...a)=>{loads.push(a);loaded.add(a[0]);},image:key=>loaded.add(key)};
  preloadUserWeaponFx({battleData:{performerId:id},textures:{exists:()=>false},load:loader},id);
  const f=runFixture(id),images=[];f.e.loadRuntime('systems/BattleSurfaceView.mjs').preloadPublicBattleUi({load:loader,textures:{exists:()=>false}},{stageId:1,performerId:id});
  assert(loads.some(([key,path,config])=>key===RELAY_TRANSFER_ART.key&&path===RELAY_TRANSFER_ART.path&&config.frameWidth===512&&config.frameHeight===192));
  f.s.textures={exists:key=>loaded.has(key)};f.s.add={image(x,y,key,frame){assert(loaded.has(key),'Runtime cannot draw an unloaded texture');const n={x,y,key,frame,active:true,setOrigin(){return this;},setDisplaySize(){return this;},setAlpha(){return this;},setDepth(){return this;},setRotation(){return this;},setFrame(v){this.frame=v;return this;},destroy(){this.active=false;}};images.push(n);return n;}};
  const fx=new UserWeaponFx(f.s,id);f.s.actorPresentation.userCastView.weaponFx=fx;
  f.s.paintZone.applyPaint=()=>false;f.run.onImpact(510,600,'orange',f.a);assert.equal(fx.relayTransfer.rows.length,0);
  f.s.paintZone.applyPaint=()=>true;f.run.onImpact(510,600,'orange',f.a);assert.equal(fx.relayTransfer.rows.length,1);assert.equal(fx.relayTransfer.rows[0].bank,4);assert.equal(fx.rows[0].choice,'relay');
  f.run.onImpact(510,600,'orange',f.a);assert.equal(fx.relayTransfer.rows.length,1);assert.equal(f.run.choiceEffects.relay,2);
  f.s.time.now=1250;f.run.onImpact(510,600,'orange',f.a);assert.equal(fx.relayTransfer.rows.length,2);assert.equal(f.run.choiceEffects.relay,3);
  fx.destroy();fx.destroy();assert.equal(fx.relayTransfer.rows.length,0);assert(images.every(n=>!n.active));
 }
});
