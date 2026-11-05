import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {ActorPresentation,getEnemyArt} from '../src/systems/ActorPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const url=new URL('../src/systems/EnemyEnsembleMotion.mjs',import.meta.url);
const motion=existsSync(url)?await import(url):{};
const roles=['unlit-chaser','stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point'];
function image(x,y,key){
 const n=new EventEmitter();Object.assign(n,{active:true,x,y,key,rotation:0,alpha:1,visible:true,
 setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
 setDepth(v){this.depth=v;return this;},setTint(v){this.tint=v;return this;},
 setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(v){this.rotation=v;return this;},
 setVisible(v){this.visible=v;return this;},setAlpha(v){this.alpha=v;return this;},
 destroy(){if(!this.active)return;this.active=false;this.emit('destroy');}});return n;
}
function fixture(){
 let now=0;const images=[],gfx=image(500,800,'graphics');gfx.commands=[];
 for(const method of ['clear','lineStyle','lineBetween','fillStyle','fillCircle','strokeCircle'])
 gfx[method]=(...args)=>{gfx.commands.push([method,...args]);return gfx;};
 const enemy={active:true,gfx,publicStage1EnemyRole:'stage-cue-emitter',publicStage1EnemyState:'windup',publicStage1CuePulse:null};
 const scene={battleData:{practiceMode:true},time:{now:0},textures:{exists:()=>true},
 publicPerformerRun:{actions:0,now:()=>now},enemies:{getChildren:()=>[enemy]},
 add:{image:(x,y,key)=>{const n=image(x,y,key);images.push(n);return n;}}};
 return {scene,gfx,enemy,images,time:v=>now=v};
}
test('six coherent exports replace only the six enemy paths, keeping keys, sizes and radii',()=>{
 for(const role of roles){
  const art=getEnemyArt(role);assert.match(art.path,/^art\/enemy-ensemble-20261009\/[^/]+\.webp$/);
  assert(RUNTIME_PAYLOAD.some(r=>r.file===art.path));assert(existsSync(new URL('../public/'+art.path,import.meta.url)));
 }
 assert.equal(new Set(roles.map(r=>getEnemyArt(r).key)).size,6);
 assert.deepEqual(roles.map(r=>[getEnemyArt(r).size,getEnemyArt(r).radius]),[[36,12],[42,14],[42,13],[48,16],[64,20],[36,12]]);
 const laterGroups=['owner-enemy-attack','owner-heavy-material','owner-dash-material','owner-dash-contrast-material','owner-character-gait','owner-character-hurt','owner-character-shoot','owner-character-idle','owner-character-walk'];
 for(const group of laterGroups)assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group===group).length,group==='owner-character-idle'?3:group==='owner-character-hurt'?2:1);
 assert.equal(RUNTIME_PAYLOAD.filter(a=>!['owner-menu-portrait','owner-character-cast','owner-character-motion','owner-weapon-fx','owner-ui','owner-world-ground','owner-facility-fx',...laterGroups].includes(a.group)&&!['fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt'].includes(a.file)).length,213);
 assert(!RUNTIME_PAYLOAD.some(r=>r.file.startsWith('art/phase16/p16-074-actors/')));
});
test('contact runner rocks only with actual displacement; stationary is grounded, never an idle march',()=>{
 assert.equal(typeof motion.createEnemyMotion,'function');
 const s=motion.createEnemyMotion('unlit-chaser',{now:0,x:0,y:0,state:'recovery'});
 const idle=motion.advanceEnemyMotion(s,{now:500,x:0,y:0,state:'recovery'});assert.equal(idle.rotation,0);
 const walk=motion.advanceEnemyMotion(s,{now:600,x:7,y:0,state:'recovery'});assert.notEqual(walk.rotation,0);
 const stop=motion.advanceEnemyMotion(s,{now:950,x:7,y:0,state:'recovery'});assert.equal(stop.rotation,0);
});
test('windup braces and actual projectile edge starts one release, never a guessed countdown',()=>{
 assert.equal(typeof motion.createEnemyMotion,'function');
 const s=motion.createEnemyMotion('stage-cue-emitter',{now:0,x:0,y:0,state:'windup'});
 const brace=motion.advanceEnemyMotion(s,{now:220,x:0,y:0,state:'windup'});assert(brace.rotation<0);
 motion.advanceEnemyMotion(s,{now:10000,x:0,y:0,state:'windup'});
 assert.equal(s.releasedAt,null,'Waiting is not permission to invent a shot');
 const pulse={};const shot=motion.advanceEnemyMotion(s,{now:10001,x:0,y:0,state:'recovery',pulse});
 assert(shot.rotation>0);assert.equal(s.releasedAt,10001);
 motion.advanceEnemyMotion(s,{now:10050,x:0,y:0,state:'recovery',pulse});assert.equal(s.releasedAt,10001);
 const settled=motion.advanceEnemyMotion(s,{now:10501,x:0,y:0,state:'recovery',pulse});assert.equal(settled.rotation,0);
});
test('all poses keep the original foot contact invariant and fit a bounded ten-degree envelope',()=>{
 assert.equal(typeof motion.groundedEnemyPosition,'function');
 for(const role of roles){
  const art=getEnemyArt(role),s=motion.createEnemyMotion(role,{now:0,x:500,y:800,state:'windup'});
  for(const now of [0,50,220,400,900]){
   const pose=motion.advanceEnemyMotion(s,{now,x:500+now/50,y:800,state:now<400?'windup':'recovery',pulse:now>=400?1:null});
   assert(Math.abs(pose.rotation)<=Math.PI/18+1e-12);
   const p=motion.groundedEnemyPosition(500,800,art.offset,art.radius,pose.rotation);
   assert(Math.abs(p.x-art.radius*Math.sin(pose.rotation)-(500+art.offset))<1e-10);
   assert(Math.abs(p.y+art.radius*Math.cos(pose.rotation)-(800+art.offset+art.radius))<1e-10);
  }
 }
});
test('a paused or unchanged run clock freezes motion and does not observe a phantom release',()=>{
 const s=motion.createEnemyMotion('stage-cue-emitter',{now:0,x:0,y:0,state:'windup'});
 const before=motion.advanceEnemyMotion(s,{now:100,x:0,y:0,state:'windup'});
 const after=motion.advanceEnemyMotion(s,{now:100,x:200,y:0,state:'recovery',pulse:1});assert.deepEqual(after,before);assert.equal(s.releasedAt,null);
 const paused=motion.advanceEnemyMotion(s,{now:200,x:200,y:0,state:'recovery',pulse:1,paused:true});assert.deepEqual(paused,before);
 assert.equal(s.releasedAt,null);
});
test('real owner state and exact pulse drive the existing one-image lifecycle without host mutation',()=>{
 const {scene,gfx,enemy,images,time}=fixture(),a=new ActorPresentation(scene);
 a.drawEnemy(gfx,'stage-cue-emitter','windup');a.syncEnemies();const n=images[0],host=JSON.stringify(enemy);
 time(220);a.syncEnemies();assert(n.rotation<0);assert.equal(JSON.stringify(enemy),host);
 enemy.publicStage1EnemyState='recovery';enemy.publicStage1CuePulse={active:true};time(230);a.syncEnemies();assert(n.rotation>0);
 assert.equal(a.enemies.size,1);assert.equal(images.length,1);
 const pose={x:n.x,y:n.y,rotation:n.rotation};scene._battlePaused=true;time(900);a.syncEnemies();assert.deepEqual({x:n.x,y:n.y,rotation:n.rotation},pose);
 scene._battlePaused=false;time(930);a.syncEnemies();assert.equal(n.rotation,0);
 gfx.destroy();assert.equal(a.enemies.size,0);assert.equal(n.active,false);
 a.destroy();a.destroy();assert.equal(gfx.listenerCount('destroy'),0);
});
test('actual release notification survives same-frame pulse consumption, without a second render-time shot',()=>{
 const {scene,gfx,enemy,images,time}=fixture(),a=new ActorPresentation(scene);
 a.drawEnemy(gfx,'stage-cue-emitter','windup');time(220);a.syncEnemies();
 assert.equal(typeof a.notifyEnemyRelease,'function');
 const pulse={active:true},capture={capturedX:500,capturedY:900};
 enemy.publicStage1CueCapture=capture;
 time(230);a.notifyEnemyRelease(gfx,pulse,230,capture);
 pulse.active=false;enemy.publicStage1CuePulse=null;enemy.publicStage1EnemyState='recovery';
 a.syncEnemies();assert(images[0].rotation>0);
 assert.equal(a.enemies.get(gfx).motion.releasedAt,230);
 time(270);a.syncEnemies();assert.equal(a.enemies.get(gfx).motion.releasedAt,230);
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const spawn=source.split('  _spawnPublicStage1StageCuePulse(enemy) {')[1].split('\n  _consumePublicStage1StageCuePulse')[0];
 assert.match(spawn,/enemy\.publicStage1CuePulse = pulse;[\s\S]*notifyEnemyRelease/);
 a.destroy();assert.equal(a.notifyEnemyRelease(gfx,{},280,capture),false);
});
test('boss remains in windup during travel but settles, then braces freshly for each actual new capture',()=>{
 const first={},next={},s=motion.createEnemyMotion('finale-boss',{now:0,x:0,y:0,state:'windup'});
 motion.advanceEnemyMotion(s,{now:500,x:0,y:0,state:'windup',capture:first});
 motion.advanceEnemyMotion(s,{now:720,x:0,y:0,state:'windup',capture:first});
 const release=motion.advanceEnemyMotion(s,{now:800,x:0,y:0,state:'windup',capture:first,pulse:1});assert(release.rotation>0);
 const tail=motion.advanceEnemyMotion(s,{now:1099,x:0,y:0,state:'windup',capture:first,pulse:1});
 const settle=motion.advanceEnemyMotion(s,{now:1100,x:0,y:0,state:'windup',capture:first,pulse:1});
 assert.equal(settle.rotation,0);assert(Math.abs(tail.rotation-settle.rotation)<0.001);
 const fresh=motion.advanceEnemyMotion(s,{now:1400,x:0,y:0,state:'windup',capture:next});
 assert.equal(fresh.rotation,0);assert.equal(s.releasedAt,null);
 const brace=motion.advanceEnemyMotion(s,{now:1620,x:0,y:0,state:'windup',capture:next});assert(brace.rotation<0);
});

test('release notification owns a same-frame state transition that render has not yet sampled',()=>{
 const {scene,gfx,enemy,images,time}=fixture(),a=new ActorPresentation(scene);
 enemy.publicStage1EnemyState='recovery';a.drawEnemy(gfx,'stage-cue-emitter','recovery');time(500);a.syncEnemies();
 const capture={};enemy.publicStage1EnemyState='windup';enemy.publicStage1CueCapture=capture;
 a.drawEnemy(gfx,'stage-cue-emitter','windup');
 a.notifyEnemyRelease(gfx,{},501,capture);time(502);a.syncEnemies();
 assert(images[0].rotation>0,'State sampling may not erase a real release notification');a.destroy();
});
test('motion has no combat timers, tweens, physics, input or gameplay writes',()=>{
 assert(existsSync(url));const s=readFileSync(url,'utf8');
 assert.doesNotMatch(s,/setTimeout|delayedCall|tweens|\.physics|\.input|\.hp\s*=|damage|supportGain|velocity/);
});

