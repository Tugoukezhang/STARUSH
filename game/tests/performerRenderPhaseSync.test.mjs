import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {PERFORMER_LEG_ATTACHMENTS} from '../src/systems/PerformerLegAttachments.mjs';
const require=createRequire(import.meta.url);
const Emitter=require('../node_modules/eventemitter3');
const Body=require('../node_modules/phaser/src/physics/arcade/Body.js');
const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-conformance-20261004/rig.json',import.meta.url)));
const directions=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-details-20261004/views.json',import.meta.url)));
const turns=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-turn-native-20261004/views.json',import.meta.url)));
function node(x=0,y=0){return {x,y,active:true,visible:true,alpha:1,vertices:[],width:375,height:667,
 setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},
 setDisplaySize(w,h){this.scaleX=w/128;this.scaleY=h/128;return this;},setFrame(v){this.frame=v;return this;},setCrop(){return this;},
 setOrigin(x,y){this.originX=x;this.originY=y;return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},setRotation(v){this.rotation=v;return this;},
 setAngle(){return this;},setDepth(v){this.depth=v;return this;},setScrollFactor(){return this;},setVisible(v){this.visible=v;return this;},
 clear(){this.clears=(this.clears||0)+1;return this;},fillStyle(){return this;},fillCircle(x,y){this.core={x,y};return this;},lineStyle(){return this;},strokeCircle(){return this;},
 addVertices(v,uv,indices){this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(){return this;}}));return this;},setOrtho(){return this;},preUpdate(){},destroy(){this.active=false;}};}
function fixture(id='venus',withEvents=true){
 const p={x:500,y:1000,active:true,hp:5,angle:0,rotation:0,scaleX:1,scaleY:1,displayOriginX:16,displayOriginY:16,displayWidth:32,displayHeight:32,frame:{realWidth:32,realHeight:32},parentContainer:null,
 getTopLeft(out){return out.set(this.x-16,this.y-16);}};
 const world={defaults:{debugShowBody:false,debugShowVelocity:false,bodyDebugColor:0}};p.body=new Body(world,p);p.body.updateFromGameObject();
 const events=new Emitter(),calls=[];let attack=null;
 const s={player:p,playerGfx:node(),battleData:{stageId:1,performerId:id},publicPerformerRun:{member:{id},actions:0,sakuraCombat:{snapshot:()=>attack,draw:()=>calls.push('fx')}},
 textures:{exists:()=>true},_sakuraNativePresentationRequested:id==='sakura',_sakuraNativeDirectionsRequested:id==='sakura',_sakuraNativeTurnRequested:id==='sakura',
 cache:{json:{get:key=>key.includes('turn')?turns:key.includes('directions')?directions:front}},add:{image:node,rectangle:node,ellipse:node,mesh:node},
 oldStreet:{sync(){calls.push('street');s.actorPresentation.setWorldDepth(9.2+(p.y+26)/10000);}},
 _updatePlayerReadabilityMarker(){calls.push('marker');},_updatePlayerDangerPressureRim(){calls.push('danger');},_updatePublicStage1ObjectiveRouteCue(){calls.push('route');}};
 if(withEvents)s.events=events;
 // Real Phaser writeback is subscribed first, as ArcadePhysics.boot does.
 events.on('postupdate',()=>p.body.postUpdate());
 const actor=s.actorPresentation=new ActorPresentation(s);
 function frame(now,dx=0,dy=0){p.body.prevFrame.copy(p.body.position);p.body.position.x+=dx;p.body.position.y+=dy;actor.drawPlayer(now,!!(dx||dy),0xffffff);events.emit('postupdate',now,16);}
 return {s,p,actor,events,calls,frame,attack:a=>attack=a};
}
test('installed Phaser writeback precedes one actual native pose and its socket-attached FX',()=>{
 const f=fixture('sakura'),v=f.actor.sakuraView,update=v.update.bind(v);let draws=0;v.update=(...a)=>{draws++;f.calls.push('pose');return update(...a);};
 f.frame(0);f.calls.length=0;draws=0;f.attack({id:3,kind:'basic',phase:'release',progress:.3,direction:'right'});f.frame(16,250/60,-2);
 assert.equal(f.actor.lastX,f.p.x,'pre-fix presenter samples old Sprite position');assert.equal(f.actor.lastY,f.p.y);
 assert.equal(v.shadow.x,f.p.x);assert.equal(v.shadow.y,f.p.y+26);assert.equal(draws,1);assert.equal(v.state.travel,Math.hypot(f.p.x-500,f.p.y-1000));
 assert.equal(v.state.attackId,3);assert.equal(v.state.attackPhase,'release');assert.ok(f.calls.indexOf('pose')<f.calls.indexOf('fx'));
 assert.equal(v.worldDepth,9.2+(f.p.y+26)/10000);assert.deepEqual(f.s.playerGfx.core,{x:f.p.x,y:f.p.y});
 for(const n of v.nodes)assert.equal(n.node.x,f.p.x);f.actor.destroy();
});
test('multiple requests coalesce, empty postupdate does not advance motion, and no gameplay is called',()=>{
 const f=fixture(),a=f.actor;let draws=0;const sample=a.celMotion.sample.bind(a.celMotion);a.celMotion.sample=(...v)=>{draws++;return sample(...v);};
 a.drawPlayer(10,false,1);a.drawPlayer(16,true,2);assert.equal(draws,0,'drawing must not advance before physics writeback');
 f.events.emit('postupdate',16,16);assert.equal(draws,1);assert.equal(f.s.playerGfx.clears,1);assert.equal(a.turnLastNow,16);
 f.calls.length=0;f.events.emit('postupdate',32,16);assert.equal(draws,1);assert.deepEqual(f.calls,[]);
 assert.equal(f.p.body.halfWidth,16);assert.deepEqual(f.s.playerGfx.core,{x:500,y:1000});a.destroy();
});
for(const id of ['venus','genya','kai','enjo'])test(`${id}: completed motion, rendered soles and stop/idle share one frame`,()=>{
 const f=fixture(id);f.frame(0);for(let i=1;i<=25;i++){
  f.frame(i*16,4,0);assert.equal(f.actor.lastX,f.p.x);assert.equal(f.actor.direction,'right');
  f.actor.footRig.state.feet.forEach((foot,j)=>{const n=f.actor.footRig.nodes[j*3+2],m=PERFORMER_LEG_ATTACHMENTS[id].find(m=>m.frame===n.frame),dx=(m.tail[0]-n.originX*128)*n.scaleX,dy=(m.tail[1]-n.originY*128)*n.scaleY;
   assert.ok(Math.abs(n.x+dx*Math.cos(n.rotation)-dy*Math.sin(n.rotation)-foot.x)<1e-7);
   assert.ok(Math.abs(n.y+dx*Math.sin(n.rotation)+dy*Math.cos(n.rotation)-(foot.y-foot.lift))<1e-7);});
 }
 for(let i=26;i<=60;i++)f.frame(i*16);assert.equal(f.actor.state,'idle');assert.equal(f.actor.footRig.state.mode,'idle');f.actor.destroy();
});
test('pause/dialog/end/inactive player discard a queued frame, never replaying it on resume',()=>{
 for(const kind of ['_battlePaused','_publicBattleDialog','_battleEnded','inactive']){
  const f=fixture('sakura');f.frame(0);const before=structuredClone(f.actor.sakuraView.state);f.actor.drawPlayer(16,true,1);
  if(kind==='inactive')f.p.active=false;else f.s[kind]=true;
  f.events.emit('postupdate',16,16);assert.deepEqual(f.actor.sakuraView.state,before);assert.equal(f.s.playerGfx.clears,1);
  f.s[kind]=false;f.p.active=true;f.events.emit('postupdate',32,16);assert.deepEqual(f.actor.sakuraView.state,before);
  f.frame(48,1,0);assert.equal(f.actor.lastX,f.p.x);assert.equal(f.actor.sakuraView.state.travel,1);f.actor.destroy();
 }
});
test('destroy removes only its subscription; retry cannot accumulate callbacks or stale requests',()=>{
 const f=fixture();assert.equal(f.events.listenerCount('postupdate'),2);f.actor.drawPlayer(16,true,1);f.actor.destroy();f.actor.destroy();
 assert.equal(f.events.listenerCount('postupdate'),1);f.events.emit('postupdate',16,16);assert.equal(f.s.playerGfx.clears,undefined);
 for(let i=0;i<5;i++){f.s.actorPresentation=new ActorPresentation(f.s);assert.equal(f.events.listenerCount('postupdate'),2);f.s.actorPresentation.destroy();assert.equal(f.events.listenerCount('postupdate'),1);}
});
test('no-event fixtures keep immediate drawing; absent art never registers a render callback',()=>{
 const f=fixture('venus',false);f.actor.drawPlayer(16,false,1);assert.equal(f.actor.turnLastNow,16);f.actor.destroy();
 const absent=fixture();absent.actor.destroy();absent.s.textures.exists=()=>false;const actor=new ActorPresentation(absent.s);
 assert.equal(absent.events.listenerCount('postupdate'),1);assert.equal(actor.drawPlayer(16,false,1),false);actor.destroy();
});
