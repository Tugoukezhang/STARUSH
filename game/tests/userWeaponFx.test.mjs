import {BLUE_SPELL_FX} from '../src/utils/blueAcademyArt.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {UserWeaponFx,USER_WEAPON_FX,HEAVY_WEAPON_FX,KAI_DASH_FX,RIFLE_COMIC_MUZZLE,preloadUserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
import {GREEN_WIND_FX} from '../src/utils/greenWindsongArt.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura'){
  let time=500;const nodes=[];
  const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},
    oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key,frame){
      const n={x,y,texture:{key},frame:{name:frame??0},active:true,visible:true,destroyed:0,
        setOrigin(){return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
        setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},
        setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},
        setVisible(v){this.visible=v;return this;},destroy(){if(this.active){this.active=false;this.destroyed++;}}};
      nodes.push(n);return n;
    }}};
  return {scene,fx:new UserWeaponFx(scene,id),nodes,setTime:v=>time=v,view:{depth:12,disposed:false}};
}

test('four explicit bitmap FX sheets are preloaded only through the selected public-cast branch',()=>{
  const calls=[],images=[];preloadUserWeaponFx({load:{spritesheet:(...args)=>calls.push(args),image:(...args)=>images.push(args)}});assert.deepEqual(images,[['graffiti-ground','art/comic-ground-ribbons-20261022/ground-v2.png'],['compact-pool-ground','art/infield/ground-footprints.webp'],['three-cast-comic-material','art/comic-ink-planes-20261029/body.png']]);
  assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c[0]),Object.values(USER_WEAPON_FX).map(a=>a.key));
  assert(calls.every(c=>c[2].frameWidth===256&&c[2].frameHeight===256));
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  const sheets=[],s={load:{image(){},spritesheet:(...a)=>sheets.push(a)}};
  preloadActorPresentation(s,{stageId:1,performerId:'sakura'});
  for(const art of Object.values(USER_WEAPON_FX))assert.equal(sheets.filter(([key])=>key===art.key).length,1);
  assert.equal(sheets.filter(row=>row[0]==='user-rifle-shoot-20261021').length,0);
  assert.deepEqual(sheets.slice(-3).map(row=>row[0]),['user-rifle-projectile-20261021','user-rifle-contact-20261021','user-rifle-deposition-20261023']);
  sheets.length=0;preloadActorPresentation(s,{stageId:1,practiceMode:true});assert.equal(sheets.length,0);
});

test('shot FX requires a real living paint projectile, deduplicates it and preserves physics ownership',()=>{
  const {scene:s,fx,nodes,view,setTime}=fixture(),b={active:true,paintShot:true,x:116,y:88,moveVx:400,moveVy:0,color:'pink',body:{untouched:true}};
  assert.equal(fx.shot({...b,active:false},500),false);assert.equal(fx.shot({...b,paintShot:false},500),false);
  assert.equal(fx.shot(b,500),true);assert.equal(fx.shot(b,500),false);assert.equal(fx.stats.shots,1);
  fx.update(500,view);assert.equal(nodes[0].texture.key,RIFLE_COMIC_MUZZLE.key);assert.equal(nodes[0].rotation,0);
  assert.deepEqual(b.body,{untouched:true});assert.equal(b.active,true);
  s._battlePaused=true;const frame=nodes[0].frame.name;setTime(500);fx.update(9000,view);assert.equal(nodes[0].frame.name,frame);
  s._battlePaused=false;setTime(560);fx.update(9060,view);assert(nodes[0].frame.name>frame);
  setTime(1000);fx.update(9500,view);assert.equal(fx.rows.length,0);assert.equal(nodes[0].destroyed,1);
});

test('three skill releases select distinct art, preserve real radius and never produce gameplay work',()=>{
  for(const [id,kind]of [['sakura','spray'],['kai','sweep'],['enjo','burst']]){
    const {fx,view}=fixture(id),row={x:100,y:100,radius:72,start:500,angle:.3,sequence:1,beat:0,color:'blue',contacts:[]};
    assert.equal(fx.release(row),true);fx.update(500,view);
    assert.equal(fx.rows[0].kind,kind);assert.equal(fx.rows[0].node.texture.key,id==='enjo'?BLUE_SPELL_FX.key:id==='kai'?GREEN_WIND_FX.key:USER_WEAPON_FX[kind].key);
    assert(fx.rows[0].size<=row.radius*2);assert.equal(row.radius,72);assert.equal(fx.stats.releases,1);
  }
});

test('accepted contacts and empty-ground pigment cannot share a false hit cue',()=>{
  const {fx,view}=fixture();fx.impact({x:150,y:100,radius:108,color:'pink',hit:true});
  fx.impact({x:160,y:100,radius:148,color:'pink',hit:false});fx.update(500,view);
  assert.equal(fx.rows[0].kind,'impact');assert.equal(fx.rows[1].kind,'burst');
  assert(fx.rows[0].alpha>fx.rows[1].alpha);assert.equal(fx.stats.impacts,1);assert.equal(fx.stats.ground,1);
  assert(fx.rows[1].node.depth<view.depth);
});

test('confirmed spell and other authored effects retain their identity colors',()=>{
  const {fx,nodes}=fixture('enjo');fx.release({x:100,y:100,radius:190,start:500,color:'orange'});
  assert.equal(nodes[0].tint,0xffffff);assert.equal(fx.rows[0].node.texture.key,BLUE_SPELL_FX.key);assert.equal(fx.rows[0].node.frame.name,0);
  for(const id of['kai','sakura']){const f=fixture(id);f.fx.release({x:100,y:100,radius:190,start:500,color:'orange'});
    assert.notEqual(f.nodes[0].tint,0xff8c00);assert.equal(f.nodes[0].tint,0xffffff);
    assert((f.nodes[0].tint&255)>60,'other original raster palettes retain the blue channel');}
});

test('spell uses one authored burst, inside the actual issued footprint',()=>{
  const {fx}=fixture('enjo');fx.release({x:100,y:100,radius:190,start:500,color:'orange'});
  assert.equal(fx.rows.length,1,'do not repeat a complete authored burst six times');
  for(const row of fx.rows){assert(Math.hypot(row.x-100,row.y-100)+row.size/2<=190);assert(row.ground);}
});

test('cover rejects invisible releases; FX budgets, end and destroy dispose exact nodes without timers',()=>{
  const {scene:s,fx,nodes,view}=fixture('enjo');s.oldStreet.clearLine=()=>false;
  assert.equal(fx.release({x:500,y:500,radius:190,start:500,angle:0}),false);assert.equal(nodes.length,0);
  s.oldStreet.clearLine=()=>true;for(let i=0;i<80;i++)fx.impact({x:100,y:100,radius:100,hit:true});
  assert.equal(fx.rows.length,24);assert.equal(nodes.filter(n=>n.active).length,24);
  s._battleEnded=true;fx.update(500,view);assert.equal(fx.rows.length,0);assert(nodes.every(n=>n.destroyed===1));
  fx.destroy();fx.destroy();assert(fx.disposed);assert(nodes.every(n=>n.destroyed===1));
});

test('actual detonation dispatches the exact accepted result once, never from a consumed projectile',()=>{
  const BattleScene=loadBattleScene({Phaser:{Scene:class{}}}),calls=[],s=Object.create(BattleScene.prototype);
  Object.assign(s,{_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>{b.active=false;},
    _stampGroundSplat(){},paintZone:{applyPaintAt:()=>false},_paintPublicStage1TargetsAt:()=>true,
    publicPerformerRun:{effects:()=>({paintRadiusBonus:0}),onImpact(){}},actorPresentation:{userCastView:{weaponFx:{impact:r=>calls.push(r)}}}});
  const b={active:true,x:150,y:100,color:'pink'};s._detonatePaintBullet(b);s._detonatePaintBullet(b);
  assert.equal(calls.length,1);assert.equal(calls[0].hit,true);assert.equal(calls[0].x,150);
  s._paintPublicStage1TargetsAt=()=>false;s._detonatePaintBullet({active:true,x:160,y:100,color:'pink'});
  assert.equal(calls[1].hit,false);
});

test('the actual actor shot queue uses the current bitmap owner instead of old note fallback',()=>{
  const env=loadScenes(),{ActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  const calls=[],b={active:true,paintShot:true},actor=Object.create(ActorPresentation.prototype);
  Object.assign(actor,{disposed:false,userCastView:{weaponFx:{shot:(...a)=>{calls.push(a);return true;}}}});
  assert.equal(actor.queueBasicShotFx(b,500),true);assert.deepEqual(calls,[[b,500,actor.userCastView]]);
});

test('three accepted fan rays share one short barrel flash per real beat, with no enemy hit on empty ground',()=>{
 const {scene,fx,view,setTime}=fixture();
 scene.game={loop:{frame:50}};view.art={id:'sakura'};view.state='action';view.muzzleWorld=active=>active?{x:120,y:90}:null;
 fx.motionPreference={matches:true};
 for(let beat=0;beat<3;beat++){
   const start=500+100*beat;setTime(start);
   for(const angle of [-.3,0,.3])fx.release({x:150,y:100,radius:40,color:'pink',sequence:1,beat,angle,start,hit:false,contacts:[]});
   fx.update(start,view);fx.update(start,view);
   const flashes=fx.rows.filter(r=>r.volleyMuzzle);
   assert.equal(flashes.length,1);const [flash]=flashes;
   assert.equal(flash.x,120);assert.equal(flash.y,90);assert.equal(flash.size,20);assert(Math.abs(flash.angle)<.001);
   assert.equal(fx.stats.impacts,0);
   setTime(start+65);fx.update(start+65,view);assert(!fx.rows.some(r=>r.volleyMuzzle));
 }
 scene.oldStreet.clearLine=()=>false;
 assert.equal(fx.release({x:150,y:100,radius:40,sequence:2,beat:0,angle:0,start:800}),false);
 fx.update(800,view);assert(!fx.rows.some(r=>r.volleyMuzzle));
});
