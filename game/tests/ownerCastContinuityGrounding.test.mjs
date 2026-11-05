import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';

function node(){
 const n=Object.assign(new EventEmitter(),{active:true,visible:true,alpha:1,commands:[],frame:{name:12},dead:0});
 for(const method of ['setOrigin','setDisplaySize','setTint','setAngle','setRotation','setDepth'])n[method]=()=>n;
 n.setPosition=(x,y)=>{n.x=x;n.y=y;return n;};n.setVisible=v=>{n.visible=v;return n;};
 n.setAlpha=a=>{n.alpha=a;return n;};n.setFlipX=v=>{n.flipX=v;return n;};
 n.setTexture=(key,frame=0)=>{n.texture={key};n.frame.name=frame;return n;};
 n.clear=()=>{n.commands=[];return n;};
 for(const method of ['fillStyle','fillEllipse','fillCircle','lineStyle','lineBetween','strokeCircle'])n[method]=(...args)=>{n.commands.push([method,...args]);return n;};
 n.destroy=()=>{if(n.active){n.active=false;n.dead++;}};
 return n;
}
function fixture(id){
 let time=0;const made=[];
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:id},player:{x:100,y:200,hp:5,active:true},
  playerGfx:node(),battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0,now:()=>time},events:new EventEmitter(),
  textures:{exists:()=>true},add:{}};
 for(const kind of ['image','ellipse','graphics'])scene.add[kind]=()=>{const n=node();n.kind=kind;made.push(n);return n;};
 return {scene,made,setTime:t=>time=t};
}

test('all original-three actors use one shared floor owner rather than skipping it at early return',()=>{
 configureUserCast(true);
 for(const id of ['sakura','kai','enjo']){
  const {scene,made}=fixture(id),actor=new ActorPresentation(scene),view=actor.userCastView;
  assert.ok(actor.groundContacts,id+' ground owner missing');
  const image=node(),host=node();actor.enemies.set(host,{image,ground:{x:250,y:400},art:{size:36},dispose:()=>{}});
  actor.syncGroundContacts();
  assert.equal(view.shadow.visible,false,'private and shared player shadow must not overlap');
  const drawn=actor.groundContacts.graphics.commands.filter(c=>c[0]==='fillEllipse');
  assert.equal(drawn.length,3,'one proxy player floor and two registered enemy contact layers');
  assert.deepEqual(drawn[0].slice(1,5),[100,226,18,5.8]);
  assert.equal(made.filter(n=>n.kind==='graphics').length,1);
  view.update(0,false);actor.syncGroundContacts();assert.equal(view.shadow.visible,false);
  const owner=actor.groundContacts;actor.destroy();actor.destroy();assert.equal(owner.disposed,true);
  assert.equal(owner.graphics,null);assert.equal(scene.events.listenerCount('postupdate'),0);
 }
});

test('shared original-three contact owner freezes on pause and clears/releases at terminal state',()=>{
 configureUserCast(true);const {scene}=fixture('enjo'),actor=new ActorPresentation(scene);
 assert.ok(actor.groundContacts);actor.syncGroundContacts();const g=actor.groundContacts.graphics,before=structuredClone(g.commands);
 scene._battlePaused=true;scene.player.x+=20;actor.syncGroundContacts();assert.deepEqual(g.commands,before);
 scene._battlePaused=false;scene._battleEnded=true;actor.syncGroundContacts();assert.deepEqual(g.commands,[]);
 actor.destroy();assert.equal(g.dead,1);
});

test('the real owner draw branch syncs contact before paintZone exists during entry countdown',()=>{
 configureUserCast(true);const {scene}=fixture('kai'),actor=new ActorPresentation(scene);
 assert.equal(scene.paintZone,undefined);assert.equal(actor.userCastView.shadow.visible,true);
 assert.equal(actor.drawPlayerFrame(0,false,0xffffff),true);
 assert.equal(actor.userCastView.shadow.visible,false,'first visible frame must not use a different countdown shadow');
 assert.ok(actor.groundContacts.graphics.commands.some(c=>c[0]==='fillEllipse'&&c[3]===18));
 actor.destroy();
});

test('hurt facing survives opposite basic shots and movement without changing physical muzzle ownership',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {scene,setTime}=fixture(id),v=new UserCastPresentation(scene,id);v.update(0,false);
  scene.battleRecord.playerHitCount=1;setTime(10);v.update(10,false);const face=v.flip;
  setTime(12);assert.equal(v.beginShot(12,-1,0,400),true);scene.player.x-=3;
  setTime(20);v.update(20,false);assert.equal(v.state,'hurt');assert.equal(v.flip,face,id+' hurt flipped mid-cycle');
  assert.equal(v.handWorld().x,scene.player.x-16);v.destroy();
 }
});

test('matching committed action direction owns the body while automatic shots keep their own physical hand',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {scene,setTime}=fixture(id),v=new UserCastPresentation(scene,id);v.update(0,false);
  scene.publicPerformerRun.actions=1;scene.publicPerformerRun.actionPresentation={sequence:1,direction:'left'};
  setTime(10);v.update(10,false);assert.equal(v.state,'action');assert.equal(v.flip,id!=='kai');
  setTime(20);v.beginShot(20,1,0,400);scene.player.x+=3;setTime(30);v.update(30,false);
  assert.equal(v.flip,id!=='kai',id+' action interrupted by ordinary fire');assert.equal(v.handWorld().x,scene.player.x+16);
  setTime(250);scene.player.x+=3;v.update(250,false);assert.equal(v.flip,id!=='kai','movement cannot turn an unfinished action');
  v.beginShot(250,1,0,400);setTime(340);v.update(340,false);
  assert.equal(v.state,'attack');assert.equal(v.flip,id==='kai','recovery must hand body facing back to the ongoing real shot');
  setTime(400);v.beginShot(400,1,0,400);v.update(400,false);assert.equal(v.flip,id==='kai','expired action must not keep body facing locked');
  v.destroy();
 }
});

test('pending action locks basic notification before its first render; stale/up/down direction invents no turn',()=>{
 for(const direction of ['up','down','left']){
  const {scene,setTime}=fixture('sakura'),v=new UserCastPresentation(scene,'sakura');v.update(0,false);
  scene.publicPerformerRun.actions=1;scene.publicPerformerRun.actionPresentation={sequence:direction==='left'?0:1,direction};
  setTime(10);v.beginShot(10,-1,0,400);assert.equal(v.flip,false,'pending action must not flip before state observation');
  v.update(10,false);assert.equal(v.flip,false);assert.equal(v.handWorld().x,84);v.destroy();
 }
});
