import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {ActorPresentation,getEnemyArt} from '../src/systems/ActorPresentation.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {SAKURA_REFINED_ART} from '../src/systems/SakuraRefinedPresentation.mjs';
import {VENUS_ART} from '../src/systems/VenusLayeredPresentation.mjs';
import {GENYA_ART} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KAI_ART} from '../src/systems/KaiLayeredPresentation.mjs';
import {ENJO_ART} from '../src/systems/EnjoLayeredPresentation.mjs';
const url=new URL('../src/systems/WorldGroundingPresentation.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
const roles=['unlit-chaser','stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point'];
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function node(){
 const n=new EventEmitter();Object.assign(n,{active:true,visible:true,alpha:1,commands:[],x:0,y:0,rotation:0,
  setDepth(v){this.depth=v;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
  setTint(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(v){this.rotation=v;return this;},
  setVisible(v){this.visible=v;return this;},setAlpha(v){this.alpha=v;return this;},
  destroy(){if(!this.active)return;this.active=false;this.emit('destroy');}});
 for(const m of ['fillStyle','fillEllipse','fillCircle','lineStyle','lineBetween','strokeCircle'])n[m]=(...a)=>{n.commands.push([m,...a]);return n;};
 for(const m of ['setOrigin','setScrollFactor','setTexture','setFrame','setAngle','setCrop','setOrtho'])n[m]=(...a)=>{n[m.slice(3).toLowerCase()]=a;return n;};
 Object.assign(n,{width:375,height:667,vertices:[],preUpdate(){},addVertices(v,_uv,indices){
  this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(){}}));return this;
 }});
 n.clear=()=>{n.commands=[];return n;};return n;
}
test('registered opaque enemy bases stay fixed for all roles, independent of gameplay radius',()=>{
 assert.equal(typeof api.enemyGroundPose,'function','RED: original-art ground registration missing');
 const ys=[210.5,211.5,205.5,210.5,204.5,211.5];
 for(const [i,role] of roles.entries())for(const rotation of [-Math.PI/18,0,Math.PI/18]){
  const art=getEnemyArt(role),host={x:500,y:800},before=JSON.stringify({art,host});
  const p=api.enemyGroundPose(art,host,rotation),distance=(ys[i]-128)*art.size/256;
  near(p.x-distance*Math.sin(rotation),500+art.offset);
  near(p.y+distance*Math.cos(rotation),800+art.offset+distance);
  near(p.ground.y,800+art.offset+distance);near(p.contactDistance,distance);
  assert.equal(JSON.stringify({art,host}),before);assert.notEqual(distance,art.radius);
 }
});

function publicFixture(id){
 const art={sakura:SAKURA_REFINED_ART,venus:VENUS_ART,genya:GENYA_ART,kai:KAI_ART,enjo:ENJO_ART}[id];
 const rig=JSON.parse(fs.readFileSync(new URL('../public/'+art.data,import.meta.url),'utf8'));
 const made=[],enemies=[],events=new EventEmitter(),scene={battleData:{stageId:1,performerId:id},
  player:{active:true,x:220,y:580,hp:5},playerGfx:node(),events,time:{now:0},
  publicPerformerRun:{member:{id},actions:0,now:()=>scene.time.now},battleRecord:{playerHitCount:0},
  textures:{exists:key=>key===art.key||key.startsWith('stage-actor-'),get:()=>({getSourceImage:()=>({width:2048,height:1024})})},
  cache:{json:{get:key=>key===(art.dataKey??art.rigKey)?rig:undefined}},enemies:{getChildren:()=>enemies},add:{}};
 for(const kind of ['rectangle','image','ellipse','mesh','graphics'])scene.add[kind]=()=>{const n=node();n.kind=kind;made.push(n);return n;};
 if(id==='sakura'){scene._sakuraNativePresentationRequested=true;scene._sakuraRefinedPresentationRequested=true;}
 const actor=scene.actorPresentation=new ActorPresentation(scene);
 const view=actor.sakuraView||actor.venusView||actor.genyaView||actor.kaiView||actor.enjoView;
 return {scene,actor,view,made,enemies,step(now,dx=0,dy=0){scene.time.now=now;scene.player.x+=dx;scene.player.y+=dy;
  actor.drawPlayer(now,Math.abs(dx)+Math.abs(dy)>0,0xffffff);events.emit('postupdate');}};
}

function assertActualFootCommands(f,requireStance=false){
 const {scene,actor,view}=f,gfx=actor.groundContacts.graphics;
 assert.equal(view.shadow.visible,false,'actual public shadow must be replaced');
 const feet=api.performerGroundFeet(actor),drawn=gfx.commands.filter(c=>c[0]==='fillEllipse'&&c[3]===4.8&&c[4]===1.6);
 if(requireStance)assert(feet.length>0,'idle pose must provide a stance foot');
 assert.deepEqual(drawn.map(c=>({x:c[1],y:c[2]})),feet,'only real stance contacts may be drawn');
 assert(gfx.commands.some(c=>c[0]==='fillEllipse'&&c[1]===scene.player.x&&c[2]===scene.player.y+26&&c[3]===18));
}

for(const id of ['sakura','venus','genya','kai','enjo'])test(id+' actual public Actor schedules real pose contacts and releases the one floor owner',()=>{
 const f=publicFixture(id),{actor,scene,view,made}=f,owner=actor.groundContacts,gfx=owner.graphics;
 try{
  assert.equal(owner.constructor,api.WorldGroundContacts);assert(gfx.depth<9.2);
  assert.equal(made.filter(n=>n.kind==='graphics').length,1);
  f.step(0);assertActualFootCommands(f,true);
  for(let frame=1;frame<=40;frame++){f.step(frame*16,2,-1);assertActualFootCommands(f);}
  const before=JSON.stringify(gfx.commands);scene._battlePaused=true;f.step(1000);
  assert.equal(JSON.stringify(gfx.commands),before);scene._battlePaused=false;
  scene._publicBattleDialog=true;f.step(1100);assert.equal(JSON.stringify(gfx.commands),before);
  scene._publicBattleDialog=false;f.step(1116,3,0);assertActualFootCommands(f);assert.notEqual(JSON.stringify(gfx.commands),before);
  OldStreetScene.prototype.sync.call({disposed:false,storyOffered:true,scene,items:new Map(),nearestInteraction:()=>null,flushPaintSurfaces:OldStreetScene.prototype.flushPaintSurfaces});
  assert.equal(view.shadow.visible,false,'depth sorting must not revive the old shadow');
  scene._battleEnded=true;actor.syncEnemies();assert.equal(gfx.commands.length,0);
 }finally{actor.destroy();actor.destroy();}
 assert.equal(owner.disposed,true);assert.equal(gfx.active,false);assert.equal(actor.groundContacts,null);
 assert.equal(scene.events.listenerCount('postupdate'),0);assert(made.every(n=>!n.active));
});

test('counterexample: disabling actual public sync must fail the grounded pose contract',()=>{
 const original=ActorPresentation.prototype.syncGroundContacts;
 try{
  ActorPresentation.prototype.syncGroundContacts=()=>{};
  for(const id of ['sakura','venus','genya','kai','enjo']){
   const f=publicFixture(id);
   try{f.step(0);assert.throws(()=>assertActualFootCommands(f),/actual public shadow must be replaced/);}
   finally{f.actor.destroy();}
  }
 }finally{ActorPresentation.prototype.syncGroundContacts=original;}
});

function assertPublicEnemyGroundChain(f){
 const {actor,scene,enemies}=f;
 f.step(0);
 for(const [i,role]of roles.entries()){
  const gfx=node();gfx.x=400+i*50;gfx.y=800;gfx.depth=10;
  enemies.push({active:true,gfx,publicStage1EnemyState:'windup'});
  assert.equal(actor.drawEnemy(gfx,role,'windup'),true);
 }
 scene.time.now=220;actor.syncEnemies();
 const graphics=actor.groundContacts.graphics;
 for(const [host,item]of actor.enemies){
  const ground=api.enemyGroundPose(item.art,host,item.image.rotation).ground;
  assert.deepEqual(item.ground,ground);
  const drawn=graphics.commands.filter(c=>c[0]==='fillEllipse'&&c[1]===ground.x&&c[2]===ground.y);
  assert.equal(drawn.length,2,'exact registered enemy bases must reach actual floor owner');
  near(drawn[0][3],item.art.size*.64);near(drawn[1][3],item.art.size*.64*.66);
 }
 assert.equal(actor.enemies.size,6);
 const imageRefs=[...actor.enemies.values()].map(i=>i.image);
 for(const enemy of enemies)enemy.gfx.destroy();
 actor.syncEnemies();assert.equal(actor.enemies.size,0);assert(imageRefs.every(n=>!n.active));
 assertActualFootCommands(f,true);
 assert.equal(graphics.commands.filter(c=>c[0]==='fillEllipse').length,3,'destroyed enemies must not leave a floor stamp');
}

test('actual public drawEnemy and syncEnemies forward all six registered bases to the same ground owner',()=>{
 const f=publicFixture('sakura');try{assertPublicEnemyGroundChain(f);}finally{f.actor.destroy();}
});

test('counterexample: retaining player sync but dropping enemies must fail the public chain',()=>{
 const original=ActorPresentation.prototype.syncGroundContacts;
 try{
  ActorPresentation.prototype.syncGroundContacts=function(){
   const view=this.sakuraView||this.venusView||this.genyaView||this.kaiView||this.enjoView;
   view.shadow.setVisible(false);
   this.groundContacts.update({player:this.scene.player,feet:api.performerGroundFeet(this),alpha:this.scene.playerGfx.alpha,enemies:[]});
  };
  const f=publicFixture('sakura');
  try{assert.throws(()=>assertPublicEnemyGroundChain(f),/exact registered enemy bases must reach actual floor owner/);}
  finally{f.actor.destroy();}
 }finally{ActorPresentation.prototype.syncGroundContacts=original;}
});
test('six reviewed prop envelopes exclude canvas padding without shifting paint or footprint',()=>{
 assert.equal(typeof api.streetVisibleBounds,'function');
 for(const [art,w,h,l,t,r,b] of [['shop',560,520,2,143,558,518],['repair',480,402,19,117,461,400],
  ['garden',340,328,2,121,338,326],['kiosk',344,368,21,56,323,366],['canopy',704,332,23,33,681,330],['tree',180,240,11,2,168,238]]){
  const outer={x:100,y:200,width:w/2,height:h/2},before=JSON.stringify(outer),visible=api.streetVisibleBounds(art,outer);
  near(visible.x,100+l/2);near(visible.y,200+t/2);near(visible.width,(r-l)/2);near(visible.height,(b-t)/2);
  assert.equal(JSON.stringify(outer),before);
 }
 const b={x:0,y:0,width:10,height:20};assert.equal(api.streetVisibleBounds('gate',b),b);
});
test('five actual pose owners expose only planted feet, no rest-position guesses',()=>{
 assert.equal(typeof api.performerGroundFeet,'function');
 const frame={contacts:{R:{state:'stance',actual:{x:5,y:9}},L:{state:'swing',actual:{x:10,y:7}}}};
 assert.deepEqual(api.performerGroundFeet({sakuraView:{frame}}),[{x:5,y:9}]);
 for(const name of ['venusView','genyaView','kaiView','enjoView']){
  const pose={feet:[{x:5,y:9,contact:true,lift:0},{x:10,y:7,contact:false,lift:3}]};
  assert.deepEqual(api.performerGroundFeet({[name]:{pose}}),[{x:5,y:9}]);
 }
 assert.deepEqual(api.performerGroundFeet({}),[]);
 assert.deepEqual(api.performerGroundFeet({sakuraView:{frame:{contacts:{R:{state:'stance',actual:{x:NaN,y:2}}}}}}),[]);
});
test('one floor-only graphics draws real foot contacts and visible equipment, then freezes and clears',()=>{
 assert.equal(typeof api.WorldGroundContacts,'function');const gfx=node(),scene={add:{graphics:()=>gfx}};
 const owner=new api.WorldGroundContacts(scene),player={active:true,x:100,y:200,hp:5},before=JSON.stringify(player);
 const input={player,alpha:.5,feet:[{x:96,y:226},{x:104,y:226}],enemies:[{ground:{x:80,y:220},image:{active:true,visible:true,alpha:.7},art:getEnemyArt(roles[0])}]};
 owner.update(input);assert(gfx.depth<9.2);assert.equal(gfx.commands.filter(c=>c[0]==='fillEllipse').length,5);
 assert(gfx.commands.filter(c=>c[0]==='fillStyle').every(c=>c[2]<=.2));
 assert(gfx.commands.some(c=>c[0]==='fillEllipse'&&c[1]===96&&c[2]===226));
 const saved=JSON.stringify(gfx.commands);scene._battlePaused=true;owner.update({...input,player:{...player,x:900}});assert.equal(JSON.stringify(gfx.commands),saved);
 scene._battlePaused=false;owner.update({...input,alpha:0,enemies:[]});assert.equal(gfx.commands.length,0);
 owner.update(input);scene._battleEnded=true;owner.update(input);assert.equal(gfx.commands.length,0);
 owner.destroy();owner.destroy();assert.equal(gfx.active,false);assert.equal(JSON.stringify(player),before);
});
test('hidden, invisible and dead equipment cannot leave a ground shadow',()=>{
 const gfx=node(),owner=new api.WorldGroundContacts({add:{graphics:()=>gfx}});
 const player={active:false,x:100,y:200},art=getEnemyArt(roles[0]);
 owner.update({player,feet:[],alpha:1,enemies:[{art,ground:{x:1,y:2},image:{active:false,visible:true,alpha:1}},
  {art,ground:{x:1,y:2},image:{active:true,visible:false,alpha:1}},
  {art,ground:{x:1,y:2},image:{active:true,visible:true,alpha:0}}]});assert.equal(gfx.commands.length,0);owner.destroy();
});
test('actual Actor sync registers and disposes exact enemy presentation without writing physics host',()=>{
 const images=[],gfx=node(),enemy={active:true,gfx,publicStage1EnemyState:'windup'},scene={battleData:{practiceMode:true},
  textures:{exists:()=>true},time:{now:0},enemies:{getChildren:()=>[enemy]},add:{image:()=>{const n=node();images.push(n);return n;}}};
 gfx.x=500;gfx.y=800;const actor=new ActorPresentation(scene);assert.equal(actor.groundContacts,null,'hidden practice must not create new presentation');
 const before=JSON.stringify({x:gfx.x,y:gfx.y});actor.drawEnemy(gfx,roles[1],'windup');scene.time.now=220;actor.syncEnemies();
 const item=actor.enemies.get(gfx),p=api.enemyGroundPose(item.art,gfx,images[0].rotation);
 near(images[0].x,p.x);near(images[0].y,p.y);assert.deepEqual(item.ground,p.ground);
 assert.equal(JSON.stringify({x:gfx.x,y:gfx.y}),before);gfx.destroy();assert.equal(images[0].active,false);assert.equal(actor.enemies.size,0);actor.destroy();
});
test('actual OldStreet sorts enemy by visible base and does not fade a player above the opaque roof',()=>{
 const image=node();image.getBounds=()=>({x:0,y:0,width:280,height:260});
 const colorImage=node(),enemyImage=node(),gfx=node();gfx.y=100;
 const item={definition:{art:'shop'},image,colorImage},enemy={image:enemyImage,art:getEnemyArt(roles[1]),ground:{x:0,y:114}};
 const actor={visualMetrics:{groundOffset:26},setWorldDepth(){},enemies:new Map([[gfx,enemy]])};
 const scene={player:{x:140,y:0},actorPresentation:actor},owner={disposed:false,storyOffered:true,scene,items:new Map([['shop',item]]),nearestInteraction:()=>null,flushPaintSurfaces:OldStreetScene.prototype.flushPaintSurfaces};
 OldStreetScene.prototype.sync.call(owner);assert.equal(image.alpha,1,'Transparent roof padding may not fade the whole building');near(enemyImage.depth,9.2+114/10000);
 scene.player.y=70;OldStreetScene.prototype.sync.call(owner);assert.equal(image.alpha,.42);
});
