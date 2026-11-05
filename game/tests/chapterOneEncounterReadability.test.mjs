import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {canEnemyBePublicStage1PaintTarget} from '../src/systems/PublicStage1EnemyRoles.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
const url=new URL('../src/systems/EnemyAttackPresentation.mjs',import.meta.url);
const presentation=existsSync(url)?await import(url):{};
const config={origin:{x:500,y:310},capture:{capturedX:500,capturedY:430},distance:900,width:1000,height:1778};
const graphics=()=>{
 const calls=[],g={calls,active:true};
 for(const method of ['clear','lineStyle','lineBetween','fillStyle','fillTriangle','fillCircle','strokeCircle'])g[method]=(...args)=>{calls.push([method,...args]);return g;};
 return g;
};

test('captured attack path covers actual travel beyond the captured point, without retargeting',()=>{
 assert.equal(typeof presentation.resolveCapturedAttackPath,'function','Missing real projectile-path presentation');
 const before=JSON.stringify(config),path=presentation.resolveCapturedAttackPath(config);
 assert.equal(path.radius,7);assert.equal(path.length,900);assert.deepEqual(path.end,{x:500,y:1210});
 assert.deepEqual(path.unit,{x:0,y:1});assert.equal(JSON.stringify(config),before);
 const diagonal=presentation.resolveCapturedAttackPath({...config,capture:{capturedX:620,capturedY:430}});
 assert(Math.abs(diagonal.unit.x-diagonal.unit.y)<1e-10);
});

test('danger path clips to world and first actual cover using existing projectile padding',()=>{
 assert.equal(typeof presentation.resolveCapturedAttackPath,'function');
 const wall=presentation.resolveCapturedAttackPath({...config,clearLine:(a,b,padding)=>{assert.equal(padding,4);return b.y<602;}});
 assert(wall.end.y>=601&&wall.end.y<602);assert(wall.length<292);
 const world=presentation.resolveCapturedAttackPath({...config,origin:{x:950,y:310},capture:{capturedX:990,capturedY:310}});
 assert.equal(world.end.x,1000);assert.equal(world.length,50);
 for(const bad of [{origin:{x:NaN,y:310}},{distance:Infinity},{width:0}])
  assert.equal(presentation.resolveCapturedAttackPath({...config,...bad}),null);
});

test('zero-distance real attacks keep a local danger cue and tiny nonzero capture keeps the full actual direction',()=>{
 const zero=presentation.resolveCapturedAttackPath({...config,capture:{capturedX:500,capturedY:310}});
 assert(zero,'The spawn path still creates a stationary hostile pulse');assert.equal(zero.length,0);
 const g=graphics();presentation.drawCapturedAttackCue(g,zero);assert(g.calls.length>0);
 const tiny=presentation.resolveCapturedAttackPath({...config,capture:{capturedX:500.0005,capturedY:310}});
 assert(tiny);assert.equal(tiny.unit.x,1);assert.equal(tiny.unit.y,0);assert.equal(tiny.end.x,1000);
});

test('opening the actual acoustic panel during windup updates cover, never the frozen captured direction',()=>{
 const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js'),state=new OldStreetState();
 const scene={oldStreet:{state,clearLine:(...args)=>state.clearLine(...args)},cameras:{main:{scrollX:350,scrollY:200}}};
 const enemy={x:500,y:310,publicStage1CueCapture:{capturedX:500,capturedY:430}},g=graphics();g.setDepth=()=>g;
 scene._drawPublicStage1AttackCue=BattleScene.prototype._drawPublicStage1AttackCue;
 scene._publicStage1FinaleBoss={...enemy,active:true,publicStage1FinaleAttackCue:g};
 scene._drawPublicStage1AttackCue(g,enemy);const before=g.publicAttackPath;
 assert(state.interact('acoustic-panel',{x:500,y:590}));
 BattleScene.prototype._updatePublicStage1AttackCues.call(scene);
 assert(g.publicAttackPath.end.y>before.end.y+400,'Old clipped warning may not survive newly opened cover');
 assert.deepEqual(g.publicAttackPath.unit,before.unit);assert.deepEqual(enemy.publicStage1CueCapture,{capturedX:500,capturedY:430});
});

test('cue uses a bounded narrow hostile shape with a visible source and direction, not a friendly mint aim line',()=>{
 assert.equal(typeof presentation.drawCapturedAttackCue,'function');
 const g=graphics(),path=presentation.resolveCapturedAttackPath(config);
 presentation.drawCapturedAttackCue(g,path);
 assert(g.calls.some(c=>c[0]==='fillTriangle'),'Captured corridor has visible geometry');
 assert(g.calls.some(c=>c[0]==='lineStyle'&&c[2]===0xD84961),'Danger hue differs from spray/recovery mint');
 assert(g.calls.filter(c=>c[0]==='lineBetween').length<60,'Bounded commands for long rays');
 assert(g.calls.filter(c=>c[0]==='fillStyle').every(c=>c[2]<=0.18),'No opaque lane hiding world');
 assert(!g.calls.some(c=>c[0]==='strokeCircle'),'No player-local shield or lock-on ring');
 const count=g.calls.length;presentation.drawCapturedAttackCue(g,null);assert.equal(g.calls.length,count);
});

test('hostile pulse has a dark silhouette, white core and directional trail without changing its host',()=>{
 assert.equal(typeof presentation.drawHostilePulse,'function');
 const g=graphics();presentation.drawHostilePulse(g);
 assert(g.calls.some(c=>c[0]==='fillCircle'&&c[3]===7));
 assert(g.calls.some(c=>c[0]==='fillStyle'&&c[1]===0xFFFFFF));
 assert(g.calls.some(c=>c[0]==='lineBetween'));
 assert.equal(g.active,true);
});

test('HUD-hidden source is indicated inside the current visible arena, pointing upstream rather than at the player',()=>{
 assert.equal(typeof presentation.resolveOffscreenAttackSource,'function','Hidden emitter source requires an honest edge cue');
 const path=presentation.resolveCapturedAttackPath(config),view={x:350,y:390,width:300,height:310};
 const cue=presentation.resolveOffscreenAttackSource(path,view);
 assert(cue.x>=view.x+7&&cue.x<=view.x+view.width-7);
 assert(cue.y>=view.y+7&&cue.y<=view.y+view.height-7);
 assert.deepEqual(cue.direction,{x:0,y:-1});
 assert.equal(presentation.resolveOffscreenAttackSource(path,{x:350,y:200,width:300,height:500}),null);
 assert.equal(presentation.resolveOffscreenAttackSource(path,{x:700,y:390,width:200,height:310}),null);
 const movingView=presentation.resolveOffscreenAttackSource(path,{...view,y:420});assert(movingView.y>cue.y);
});

test('real cue caches only presentation geometry, redraws for the camera and stays above scenery without new owners',()=>{
 const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
 const g=graphics();g.setDepth=v=>{g.depth=v;return g;};
 const scene={oldStreet:{clearLine:()=>true},cameras:{main:{scrollX:350,scrollY:200}}};
 const enemy={x:500,y:310,publicStage1CueCapture:config.capture};
 BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,enemy);
 assert(g.publicAttackPath,'Cache geometry in existing Graphics, not in combat target');
 assert.equal(g.depth,10.4,'Visible narrow telegraph stays above scenery, below existing restoration/labels/HUD');
 scene._drawPublicStage1AttackCue=BattleScene.prototype._drawPublicStage1AttackCue;
 scene._publicStage1StageCueEmitter={active:true,publicStage1CueLine:g};
 assert.equal(typeof BattleScene.prototype._updatePublicStage1AttackCues,'function');
 const initialPath=g.publicAttackPath;scene.cameras.main.scrollY=220;
 BattleScene.prototype._updatePublicStage1AttackCues.call(scene);assert.equal(g.publicAttackPath,initialPath);
});

test('actual actor recovery distinguishes spray opening, while paintable contact chasers are not labelled safe',()=>{
 assert.equal(typeof presentation.drawEnemyStateCue,'function');
 const open=graphics();presentation.drawEnemyStateCue(open,{role:'finale-boss',state:'recovery',radius:20,offset:0});
 assert(open.calls.some(c=>c[0]==='lineStyle'&&c[2]===0x77D6C3));
 const attack=graphics();presentation.drawEnemyStateCue(attack,{role:'finale-boss',state:'windup',radius:20,offset:0});
 assert(attack.calls.some(c=>c[0]==='lineStyle'&&c[2]===0xD84961));
 const chaser=graphics();presentation.drawEnemyStateCue(chaser,{role:'unlit-chaser',state:'recovery',radius:12,offset:12});
 assert.equal(chaser.calls.length,0,'Paintable chaser still deals contact damage');
});

test('every spray opening agrees with the actual enemy target contract, including interruptible disruptor windup',()=>{
 for(const role of ['stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point'])
  for(const state of ['windup','disrupting','recovery']){
   const g=graphics();presentation.drawEnemyStateCue(g,{role,state,radius:14});
   const accepted=canEnemyBePublicStage1PaintTarget({active:true,publicStage1EnemyRole:role,publicStage1EnemyState:state});
   assert.equal(g.calls.some(c=>c[0]==='lineStyle'&&c[2]===0x77D6C3),accepted,role+' '+state);
  }
});

test('actual actor image is not darkened when the disruptor can already be interrupted',()=>{
 const image={};for(const method of ['setDisplaySize','setDepth'])image[method]=()=>image;
 image.setTint=value=>{image.tint=value;return image;};
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{disposed:false,enemies:new Map(),scene:{textures:{exists:()=>true},add:{image:()=>image}}});
 const g=graphics();g.once=()=>g;g.x=g.y=0;g.depth=3;
 actor.drawEnemy(g,'objective-disruptor','windup',0,'yellow');
 assert.equal(image.tint,0xFFFFFF,'Windup is interruptible, not a protected gray state');
 actor.drawEnemy(g,'finale-boss','windup',0,'pink');assert.equal(image.tint,0xA6B4BD);
});

test('real scene delegates three captured attacks and projectile draw, preserving cleanup and capture',()=>{
 const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
 assert.equal(typeof BattleScene.prototype._drawPublicStage1AttackCue,'function','All three existing cue owners use one renderer');
 const scene={oldStreet:{clearLine:()=>true}},enemy={x:500,y:310,publicStage1CueCapture:config.capture},g=graphics();g.setDepth=()=>g;
 const before=JSON.stringify(enemy);BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,enemy);
 assert(g.calls.some(c=>c[0]==='fillTriangle'));assert.equal(JSON.stringify(enemy),before);
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 for(const object of ['boss','captain','enemy'])assert(source.includes(`this._drawPublicStage1AttackCue(${object==='boss'?'cue':object==='captain'?'captain.publicStage1CaptainCueLine':'enemy.publicStage1CueLine'}, ${object})`));
 assert(source.includes('drawHostilePulse(pulse.gfx)'));
 for(const key of ['publicStage1CueLine','publicStage1CaptainCueLine','publicStage1FinaleAttackCue'])assert(source.includes(`${key}?.destroy?.()`));
 assert.equal((source.match(/const P16_013_STAGE_CUE_EMITTER_HIT_RADIUS = 7;/g)||[]).length,1);
});
