import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {VenusMotion} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
let feedback={};
try{feedback=await import('../src/systems/PerformerShotFeedback.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const root={x:200,y:400},types={venus:VenusMotion,genya:GenyaMotion,kai:KaiMotion,enjo:EnjoMotion};
for(const [id,Motion]of Object.entries(types))test(id+': release begins with the emitted shot, recovers, freezes and leaves feet unchanged',()=>{
 for(const interval of [120,200,333,600])for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const m=new Motion(root),control=new Motion(root);m.sample({now:0,player:root});control.sample({now:0,player:root});
  assert(m.beginShot(0,dx,dy,interval));const p=m.sample({now:0,player:root}),c=control.sample({now:0,player:root});
  assert(p.shotWeight>.99,'Actual shot starts with no release gesture: '+p.shotWeight);
  assert.deepEqual(p.feet,c.feet);assert.equal(m.shot.duration,m.shot.remaining,'Duration must match actual initial lifetime');
  const mid=m.sample({now:50,player:root});assert(mid.shotWeight>0&&mid.shotWeight<p.shotWeight);
  assert.deepEqual(m.sample({now:5000,player:root,frozen:true}),mid);
  const end=m.sample({now:5100,player:root,hurt:true,action:true});assert.equal(end.state,'hurt');
  assert(end.parts.every(p=>Number.isFinite(p.x+p.y+p.angle)));
 }
});
test('release envelope is bounded, monotonic and is not a new combat timer',()=>{
 assert.equal(typeof feedback.basicShotReleaseWeight,'function');
 const f=feedback.basicShotReleaseWeight;assert.equal(f(100,100),1);assert.equal(f(0,100),0);assert.equal(f(NaN,100),0);assert.equal(f(10,0),0);
 let last=1;for(let age=0;age<=100;age++){const w=f(100-age,100);assert(w>=0&&w<=last);last=w;}
});
function gfx(){return {active:true,commands:[],destroyed:0,clear(){this.commands=[];return this;},setDepth(n){this.depth=n;return this;},
 setAlpha(n){this.alpha=n;return this;},lineStyle(...a){this.commands.push(['style',...a]);return this;},
 lineBetween(...a){this.commands.push(['line',...a]);return this;},destroy(){this.active=false;this.destroyed++;}};}
function hand(x=210,y=402,angle=0,scale=1){const r=angle*Math.PI/180;return {active:true,visible:true,width:20,height:40,displayOriginX:10,displayOriginY:4,
 texture:{key:'venus-layered-20261006'},frame:{name:'down/forearmR'},
 getWorldTransformMatrix:()=>({transformPoint:(a,b)=>({x:x+scale*(a*Math.cos(r)-b*Math.sin(r)),y:y+scale*(a*Math.sin(r)+b*Math.cos(r))})})};}
function fixture(){const nodes=[],scene={player:{active:true,hp:5},oldStreet:{clearLine:()=>true},add:{graphics:()=>{const n=gfx();nodes.push(n);return n;}},
 _battlePaused:false,_battleEnded:false,_publicBattleDialog:false};
 const node=hand(),view={disposed:false,depth:9.26,pose:{state:'attack'},nodes:new Map([['forearmR',node]])};
 return {scene,view,node,nodes};}
const bullet=()=>({active:true,paintShot:true,x:200,y:400,color:'blue',moveVx:450,moveVy:0});
test('socket uses actual displayed world transform, not root, canonical pose or parent-space position',()=>{
 assert.equal(typeof feedback.visibleShotHand,'function');const n=hand(100,80,90,.25);
 const h=feedback.visibleShotHand({nodes:new Map([['forearmR',n]])});assert(Math.abs(h.x-93.4)<1e-9);assert.equal(h.y,80);
 n.visible=false;assert.equal(feedback.visibleShotHand({nodes:new Map([['forearmR',n]])}),null);
});
test('all 32 own hand anchors lie on opaque palm pixels, never transparent fingers or sleeve',async()=>{
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const dirs=['down','down-left','left','up-left','up','up-right','right','down-right'];
 for(const id of Object.keys(types))for(const dir of dirs){
  const base=dir.includes('-')?'../public/art/team-oblique-20261007/'+id+'-oblique'
   :'../public/art/'+id+'-layered-'+(id==='enjo'?'20261007':'20261006')+'/'+id+'-parts';
  const atlas=JSON.parse(readFileSync(new URL(base+'.json',import.meta.url))),f=atlas.frames[dir+'/forearmR'].frame;
  const {data}=await sharp(fileURLToPath(new URL(base+'.webp',import.meta.url))).extract({left:f.x,top:f.y,width:f.w,height:f.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const n={active:true,visible:true,width:f.w,height:f.h,displayOriginX:0,displayOriginY:0,texture:{key:id+'-parts'},frame:{name:dir+'/forearmR'},
   getWorldTransformMatrix:()=>({transformPoint:(x,y)=>({x,y})})};
  const p=feedback.visibleShotHand({nodes:new Map([['forearmR',n]])});assert(p,id+'/'+dir+' missing palm anchor');
  const k=(Math.floor(p.y)*f.w+Math.floor(p.x))*4;
  assert(data[k+3]>=240,id+'/'+dir+' anchor is transparent: '+data[k+3]);
  assert(data[k]>150&&data[k+1]>95&&data[k+2]>70,id+'/'+dir+' anchor must be skin, not sleeve');
 }
 const n=hand();n.texture.key='unknown';assert.equal(feedback.visibleShotHand({nodes:new Map([['forearmR',n]])}),null);
});
test('final world sorting updates feedback depth even after postupdate street sync',()=>{
 const {scene,view}=fixture();view.setWorldDepth=n=>{view.depth=n;};
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,venusView:view,disposed:false,lastBasicShotAccepted:true});
 actor.queueBasicShotFx(bullet(),0);actor.shotFeedback.update(0,view);actor.setWorldDepth(9.243);
 assert.equal(actor.shotFeedback.gfx.depth,9.24302,'Street sync left the feedback behind the rendered actor');
 actor.shotFeedback.destroy();
});
test('local release strokes respect the real loading gate and their stroke radii',()=>{
 const {scene,view,node,nodes}=fixture(),street=new OldStreetState(),f=new feedback.PerformerShotFeedback(scene);
 // Center line is clear, but the primary stroke reaches across the loading gate.
 node.getWorldTransformMatrix=()=>({transformPoint:()=>({x:134,y:1004.5})});
 scene.oldStreet.clearLine=(a,b,r)=>street.clearLine(a,b,r);
 const b={...bullet(),x:123,y:1004.5,moveVx:450,moveVy:0};assert(street.clearLine({x:134,y:1004.5},b));
 assert(!street.clearLine({x:132,y:1004.5},{x:140,y:1004.5},1.05));
 f.queue(b,0);f.update(0,view);assert.equal(nodes[0].commands.length,0,'A release stroke drew across cover');f.destroy();
});
test('bridge age, distance and local curved cover boundaries cannot produce a ghost extension',()=>{
 const {scene,view,node}=fixture(),f=new feedback.PerformerShotFeedback(scene);
 node.getWorldTransformMatrix=()=>({transformPoint:()=>({x:200,y:400})});const b=bullet();f.queue(b,0);
 b.x=256;f.update(54.999,view);assert.equal(f.lastFrame[0].bridge.length,6);
 b.x=256.001;f.update(54.999,view);assert.equal(f.lastFrame[0].bridge.length,0);
 b.x=256;f.update(55,view);assert.equal(f.lastFrame[0].bridge.length,0);
 f.update(119.999,view);assert.equal(f.lastFrame.length,1);f.update(120,view);assert.equal(f.lastFrame.length,0);
 const blocked=new OldStreetState([{id:'local-wall',footprint:{x:202,y:417,width:1,height:1}}]);
 scene.oldStreet.clearLine=(a,b,r)=>blocked.clearLine(a,b,r);
 const curved={...bullet(),x:210,y:410,bornX:200,bornY:430};f.queue(curved,200);f.update(200,view);
 assert.equal(f.lastFrame[0].bridge.length,0,'Curved bridge ignores a local stroked obstruction');f.destroy();
});
test('one reusable feedback node uses exact live projectile, current hand and short cover-safe bridge without physics writes',()=>{
 assert.equal(typeof feedback.PerformerShotFeedback,'function');const {scene,view,node,nodes}=fixture(),f=new feedback.PerformerShotFeedback(scene),b=bullet();
 const before=structuredClone(b);assert(f.queue(b,0));node.getWorldTransformMatrix=hand(215,375,20).getWorldTransformMatrix;
 f.update(0,view);assert.equal(nodes.length,1);assert.deepEqual(b,before);assert.deepEqual(f.lastFrame[0].hand,feedback.visibleShotHand(view));
 assert(f.lastFrame[0].bridge.length>0);assert(nodes[0].depth>view.depth);const first=nodes[0].commands;
 b.x+=7;f.update(16,view);assert.equal(f.lastFrame[0].projectile.x,207);assert.equal(nodes.length,1);
 scene._battlePaused=true;const paused=structuredClone(nodes[0].commands);f.update(8000,view);assert.deepEqual(nodes[0].commands,paused);assert.equal(f.rows.length,1);
 scene._battlePaused=false;b.active=false;f.update(32,view);assert.equal(f.lastFrame[0].bridge.length,0,'Consumed projectile must not draw a ghost trail');
 f.update(200,view);assert.equal(f.rows.length,0);assert.equal(nodes[0].commands.length,0);assert(first.length>0);
 f.destroy();f.destroy();assert.equal(nodes[0].destroyed,1);assert(!f.queue(bullet(),300));
});
test('cover, unrendered hands, priority interruption, cap and discontinuity fail closed',()=>{
 assert.equal(typeof feedback.PerformerShotFeedback,'function');const {scene,view,nodes}=fixture(),f=new feedback.PerformerShotFeedback(scene);
 assert.equal(f.queue({...bullet(),active:false},0),false);assert.equal(f.queue({...bullet(),paintShot:false},0),false);
 for(let i=0;i<10;i++)f.queue(bullet(),i);assert.equal(f.rows.length,4);
 scene.oldStreet.clearLine=()=>false;f.update(10,view);assert.equal(f.lastFrame.length,0);assert.equal(nodes[0].commands.length,0);
 scene.oldStreet.clearLine=()=>true;view.pose.state='hurt';f.update(16,view);assert.equal(f.rows.length,0);
 view.pose.state='attack';f.queue(bullet(),20);view.nodes.get('forearmR').visible=false;f.update(20,view);assert.equal(f.rows.length,0);
 view.nodes.get('forearmR').visible=true;f.queue(bullet(),30);scene._battleEnded=true;f.update(30,view);assert.equal(f.rows.length,0);
 assert.equal(f.queue(bullet(),31),false);f.destroy();
});
test('real Actor owns feedback after render and destroys it; hidden/fallback never queues a socket',()=>{
 assert.equal(typeof ActorPresentation.prototype.queueBasicShotFx,'function');const {scene,view,nodes}=fixture();
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,venusView:view,disposed:false,lastBasicShotAccepted:true});
 assert(actor.queueBasicShotFx(bullet(),0));actor.shotFeedback.update(0,view);assert.equal(nodes.length,1);
 actor.lastBasicShotAccepted=false;const count=actor.shotFeedback.rows.length;
 assert.equal(actor.queueBasicShotFx(bullet(),1),true,'Layered owner suppresses fixed fallback when pose is interrupted');
 assert.equal(actor.shotFeedback.rows.length,count,'Interrupted shot must not queue a ghost');
 actor.lastBasicShotAccepted=true;actor.venusView=null;assert.equal(actor.queueBasicShotFx(bullet(),1),false);
 actor.shotFeedback.destroy();const src=readFileSync(new URL('../src/systems/ActorPresentation.mjs',import.meta.url),'utf8');
 const draw=src.slice(src.indexOf('  drawPlayerFrame('),src.indexOf('  captureDefeatPose('));
 assert(draw.indexOf('this.shotFeedback?.update(')>draw.indexOf('this.enjoView.update('));assert.match(src,/this\.shotFeedback\?\.destroy\(\)/);
});
test('real shooting call keeps exact projectile contract and four-argument pose notification, replaces rather than stacks flick',()=>{
 const Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}}});
 const rows=[],b={...bullet(),setAlpha(){},setDepth(){},body:{setCircle(){}}};
 const s={lastShotTime:-10000,_selectAutoAimTarget:()=>({x:300,y:400}),support:{getCenterStageFireRateMultiplier:()=>1},
  _isPublicStage1Round:()=>true,player:{...root},currentColor:'blue',publicPerformerRun:{now:()=>77},physics:{add:{sprite:(x,y)=>{b.x=x;b.y=y;return b;}}},
  dmgCalc:{rollCrit:()=>false},_createPlayerBulletVisual:()=>({node:{},offsetX:0,offsetY:0}),_configureCenteredArcadeCircle(){},
  _trackCombatObject:()=>true,playerBullets:{add:n=>rows.push(['track',n])},_spawnChargeNoteFx:()=>rows.push(['old']),time:{delayedCall(){}},
  actorPresentation:{notifyBasicShot:(...a)=>rows.push(['pose',...a]),queueBasicShotFx:(...a)=>{rows.push(['socket',...a]);return true;}}};
 Battle.prototype._tryShoot.call(s,1000);assert.equal(b.bornX,200);assert.equal(b.bornY,400);assert.equal(rows[0][0],'track');
 assert.equal(rows.find(r=>r[0]==='pose').length,5);assert.equal(rows.find(r=>r[0]==='socket')?.[1],b,'Exact tracked bullet must reach presentation');
 assert(!rows.some(r=>r[0]==='old'),'Fixed flick must not stack on hand feedback');
 s.lastShotTime=-10000;s.actorPresentation.queueBasicShotFx=()=>false;Battle.prototype._tryShoot.call(s,2000);assert(rows.some(r=>r[0]==='old'));
});
