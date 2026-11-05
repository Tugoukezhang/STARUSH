import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id){
 let time=0;
 const node=(x=0,y=0,key='',frame=0)=>({x,y,active:true,alpha:1,frame:{name:frame},texture:{key},
  setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setTint(){return this;},
  setAlpha(a){this.alpha=a;return this;},setAngle(){return this;},setRotation(a){this.rotation=a;return this;},
  setFlipX(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},
  setTexture(key,f){this.texture={key};this.frame.name=f;return this;},setFrame(f){this.frame.name=f;return this;},destroy(){this.active=false;}});
 const scene={_userCastPresentation:true,game:{loop:{frame:1}},player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},
  battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0,now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{ellipse:node,image:node}};
 const view=new UserCastPresentation(scene,id);view.update(0,false);
 const bullet=()=>({active:true,paintShot:true,x:516,y:988,moveVx:300,moveVy:-100,color:'pink',gfx:{setRotation(){}}});
 return {scene,view,fx:view.weaponFx,bullet,at(t){time=t;}};
}

for(const id of ['sakura','kai','enjo'])test(id+' ordinary release waits for its actual final pose',()=>{
 const f=fixture(id),b=f.bullet();f.view.beginShot(0,1,0,400);assert.equal(f.fx.shot(b,0,f.view),true);
 assert.equal(f.fx.rows.length,0);assert.equal(f.fx.pendingShots.length,1);
 f.view.update(0,false);assert.equal(f.fx.rows.length,1);assert.equal(f.fx.pendingShots.length,0);
 if(id!=='sakura'){assert.equal(f.fx.rows[0].x,b.x);assert.equal(f.fx.rows[0].y,b.y);}
 assert.equal(f.fx.rows[0].angle,Math.atan2(-100,300)+(id==='enjo'?Math.PI/2:0));
 assert.equal(b.active,true);assert.equal(b.moveVx,300);f.view.destroy();
});

for(const mode of ['hurt','action'])test(mode+' on the same frame rejects ordinary release for all three casts, not gameplay',()=>{
 for(const id of ['sakura','kai','enjo']){
  const f=fixture(id),b=f.bullet();f.view.beginShot(0,1,0,400);f.fx.shot(b,0,f.view);
  if(mode==='hurt')f.scene.battleRecord.playerHitCount++;else f.scene.publicPerformerRun.actions++;
  f.view.update(0,false);assert.equal(f.view.state,mode);assert.equal(f.fx.rows.length,0,id+' incidental release interrupts '+mode);
  assert.equal(f.fx.pendingShots.length,0);assert.equal(b.active,true);assert.equal(b.x,516);assert.equal(b.moveVy,-100);
  f.at(400);f.view.update(400,false);f.scene.game.loop.frame++;f.view.beginShot(400,1,0,400);f.fx.shot(f.bullet(),400,f.view);f.view.update(400,false);
  assert.equal(f.view.state,'attack');assert.equal(f.fx.rows.length,1,'ordinary release recovers after priority');f.view.destroy();
 }
});

test('pending sword/hammer snapshots are bounded, immutable and dropped at pause or skipped frame',()=>{
 for(const id of ['kai','enjo'])for(const mode of ['pause','dialog','skip','expired','ended','missing']){
  const f=fixture(id);f.view.beginShot(0,1,0,400);
  for(let i=0;i<40;i++){const b=f.bullet();f.fx.shot(b,0,f.view);b.x=NaN;b.moveVx=0;}
  assert.equal(f.fx.pendingShots.length,24);assert.equal(f.fx.rows.length,0);
  if(mode==='pause')f.scene._battlePaused=true;if(mode==='dialog')f.scene._publicBattleDialog={};
  if(mode==='skip')f.scene.game.loop.frame++;if(mode==='expired')f.at(id==='kai'?240:360);if(mode==='ended')f.scene._battleEnded=true;
  f.fx.update(999,mode==='missing'?null:f.view);assert.equal(f.fx.pendingShots.length,0);assert.equal(f.fx.rows.length,0);f.view.destroy();
 }
});

test('skill release and accepted contact remain visible while ordinary emission is suppressed',()=>{
 for(const id of ['kai','enjo']){
  const f=fixture(id);f.scene.publicPerformerRun.actions++;f.view.update(0,false);assert.equal(f.view.state,'action');
  assert.equal(f.fx.release({x:550,y:1000,radius:190,start:0,contacts:[{x:560,y:1000}],angle:0,color:'pink'}),true);
  const primary=f.fx.rows.find(r=>r.release);assert(primary);assert(primary.node.active);
  f.fx.shot(f.bullet(),0,f.view);f.fx.update(0,f.view);assert.equal(f.fx.rows.filter(r=>r.release).length,1);assert(f.fx.rows.some(r=>r.kind==='impact'));
  assert.equal(f.fx.rows.filter(r=>!r.release&&['sweep','burst'].includes(r.kind)).length,0);
  assert.equal(f.fx.pendingShots.length,0);
  f.view.destroy();
 }
});

test('sword/hammer queued release uses numeric birth snapshots even after projectile disposal and actor movement',()=>{
 for(const id of ['kai','enjo']){
  const f=fixture(id),b=f.bullet();f.view.beginShot(0,1,0,400);f.fx.shot(b,0,f.view);
  b.active=false;b.x=NaN;b.y=NaN;b.moveVx=0;f.scene.player.x+=15;f.view.update(0,false);
  assert.equal(f.view.state,'move-attack');assert.equal(f.fx.rows.length,1);
  assert.equal(f.fx.rows[0].x,516);assert.equal(f.fx.rows[0].y,988);
  assert.equal(f.fx.rows[0].angle,Math.atan2(-100,300)+(id==='enjo'?Math.PI/2:0));f.view.destroy();
 }
});

test('rewound time or mismatched final view never replays a queued ordinary release',()=>{
 for(const id of ['kai','enjo'])for(const mode of ['rewind','wrong-view']){
  const f=fixture(id);f.view.beginShot(0,1,0,400);f.fx.shot(f.bullet(),0,f.view);
  if(mode==='rewind')f.at(-1);
  f.fx.update(0,mode==='wrong-view'?{art:{id:'sakura'},state:'attack'}:f.view);
  assert.equal(f.fx.rows.length,0);assert.equal(f.fx.pendingShots.length,0);f.view.destroy();
 }
});

test('actual Actor queue passes matching sword/hammer view and flushes through the existing actor update',()=>{
 const {ActorPresentation}=loadScenes().loadRuntime('systems/ActorPresentation.mjs');
 for(const id of ['kai','enjo']){
  const f=fixture(id);f.view.beginShot(0,1,0,400);
  assert.equal(ActorPresentation.prototype.queueBasicShotFx.call({userCastView:f.view,disposed:false},f.bullet(),0),true);
  assert.equal(f.fx.pendingShots.length,1);assert.equal(f.fx.rows.length,0);
  f.view.update(0,false);assert.equal(f.fx.rows.length,1);assert.equal(f.fx.pendingShots.length,0);f.view.destroy();
 }
});

test('empty ordinary queue does not project a rifle muzzle every rendered frame',()=>{
 const f=fixture('sakura');f.view.muzzleWorld=()=>{throw new Error('No pending shot needs a marker');};
 assert.doesNotThrow(()=>f.fx.update(0,f.view));f.view.destroy();
});

test('melee pose samples actual windup/contact/recovery even while feet keep moving',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id);let pose={phase:'windup',progress:.8,angle:0};f.scene.publicPerformerRun.meleeCombat={snapshot:()=>pose};
  for(const [phase,progress,frame]of [['windup',.8,14],['release',.1,15],['release',.7,16],['recovery',.3,17]]){
   pose={phase,progress,angle:0};f.scene.player.x+=2;f.at(f.view.clock+16);f.view.update(f.view.clock+16,false);assert.equal(f.view.image.frame.name,frame,id+' '+phase);assert.equal(f.scene.player.x,f.view.image.x);assert.equal(f.view.state,'move-attack');
  }f.view.destroy();}
});
test('melee local swing is a bounded anchored existing bank, not a projectile or a skill release',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id);assert.equal(typeof f.fx.meleeSwing,'function');assert(f.fx.meleeSwing({x:540,y:1000,angle:.3,reach:84,color:'blue',start:0}));
  assert.equal(f.fx.rows.length,1);assert.equal(f.fx.projectiles.length,0);assert.equal(f.fx.pendingShots.length,0);assert.equal(f.fx.stats.releases,0);assert(f.fx.rows[0].ground);assert.equal(f.fx.rows[0].release,false);assert.equal(f.fx.rows[0].x,540);
  f.scene._battlePaused=true;assert(!f.fx.meleeSwing({x:540,y:1000,angle:.3,reach:84,start:0}));f.view.destroy();assert.equal(f.fx.rows.length,0);}
 const rifle=fixture('sakura');assert(!rifle.fx.meleeSwing({x:540,y:1000,angle:0,reach:84,start:0}));rifle.view.destroy();
});
