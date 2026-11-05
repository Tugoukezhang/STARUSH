import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {PerformerFootRig} from '../src/systems/PerformerFootRig.mjs';
import {PERFORMER_LEG_ATTACHMENTS} from '../src/systems/PerformerLegAttachments.mjs';
import {SakuraNativePresentation} from '../src/systems/SakuraNativePresentation.mjs';
import {captureSakuraDefeat} from '../src/systems/SakuraDefeatPresentation.mjs';
import {SakuraNativeDefeatPresentation} from '../src/systems/SakuraNativeDefeatPresentation.mjs';

function node(){return {active:true,visible:true,alpha:1,vertices:[],width:375,height:667,destroyCount:0,
 setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},
 setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;this.scaleX=w/128;this.scaleY=h/128;return this;},
 setFrame(f){this.frame=f;return this;},setCrop(...v){this.crop=v;return this;},setOrigin(x,y){this.originX=x;this.originY=y;return this;},
 setAlpha(a){this.alpha=a;return this;},setTint(t){this.tint=t;return this;},setRotation(a){this.rotation=a;return this;},
 setAngle(a){this.angle=a;return this;},setDepth(d){this.depth=d;return this;},setScrollFactor(){return this;},setVisible(v){this.visible=v;return this;},
 fillStyle(){return this;},fillCircle(){return this;},lineStyle(){return this;},strokeCircle(){return this;},
 addVertices(v,uv,indices){this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(u,v){this.u=u;this.v=v;return this;}}));return this;},
 setOrtho(){return this;},preUpdate(){},destroy(){if(!this.active)return;this.active=false;this.destroyCount++;}};}
function fixture(id){const made=[],make=()=>{const n=node();made.push(n);return n;};return {made,scene:{
 player:{x:500,y:1000,hp:5,active:true,body:{halfWidth:4}},playerGfx:node(),battleData:{stageId:1,performerId:id},
 publicPerformerRun:{member:{id},actions:0},textures:{exists:()=>true},add:{image:make,rectangle:make,ellipse:make,mesh:make}}};}
for(const id of ['venus','genya','kai','enjo'])test(`${id}: every upper state shares the calibrated scale and waist, preserving physics`,()=>{
 const {scene,made}=fixture(id),view=new ActorPresentation(scene),host=JSON.stringify(scene.player);
 assert.equal(view.playerImage.displayHeight,96,'64px padded sheets visibly dwarf the new native performer');
 view.drawPlayer(0,false,0xffffff);assert.ok(Math.abs(view.playerImage.y-987)<.021,'scale around y+26, allowing the existing IK reach epsilon');
 assert.equal(view.footRig.visualScale,1.5);assert.ok(Math.abs(view.footRig.upperOffset)<.021);
 for(const image of [view.playerLegs,view.basicShotImage,view.reactionImage,view.turnImage])assert.equal(image.displayHeight,96);
 assert.equal(JSON.stringify(scene.player),host);
 scene.publicPerformerRun.actions++;view.drawPlayer(30,false,0xffffff);assert.ok(Math.abs(view.playerImage.y-987)<.021);
 scene.player.hp--;view.drawPlayer(60,false,0xffffff);assert.equal(view.reactionImage.y,view.playerImage.y);
 assert.equal(view.captureDefeatPose('player-defeat'),null);scene.player.hp=0;
 const defeat=view.captureDefeatPose('player-defeat');assert.equal(defeat.size,96);assert.equal(defeat.y,987);
 view.destroy();view.destroy();assert.ok(made.every(n=>n.destroyCount===1));
});
test('scaled IK solves longer limbs before projection, keeping stance contacts fixed in world space',()=>{
 const {scene}=fixture('kai'),view=new PerformerFootRig(scene,'kai',1.5);view.update(0,0,0,'down',false);
 assert.equal(view.visualScale,1.5);assert.equal(view.state.feet[0].y,1026);
 assert.equal(view.footOptions.stride,68,'visual scale must not lengthen the unsupported flight interval');
 let previous=null,locked=0;
 for(let i=1;i<=150;i++){scene.player.x++;view.update(i*4,1,0,'right',false);
  for(const g of view.geometry){assert.ok(g.error<.02);assert.ok(Math.abs(Math.hypot(g.knee.x-g.hip.x,g.knee.y-g.hip.y,g.knee.z)-9)<.03);}
  view.state.feet.forEach((f,j)=>{if(previous&&f.contact&&previous[j].contact&&f.plantId===previous[j].plantId){assert.equal(f.x,previous[j].x);assert.equal(f.y,previous[j].y);locked++;}});
  view.state.feet.forEach((f,j)=>{
   const n=view.nodes[j*3+2],m=PERFORMER_LEG_ATTACHMENTS.kai.find(m=>m.frame===n.frame);
   const dx=(m.tail[0]-n.originX*128)*n.scaleX,dy=(m.tail[1]-n.originY*128)*n.scaleY;
   const x=n.x+dx*Math.cos(n.rotation)-dy*Math.sin(n.rotation),y=n.y+dx*Math.sin(n.rotation)+dy*Math.cos(n.rotation);
   assert.ok(Math.abs(x-f.x)<1e-7,'actual rendered sole cannot slide relative to its planted world contact');
   assert.ok(Math.abs(y-(f.y-f.lift))<1e-7,'actual sole transform must preserve ground registration');
  });
  previous=structuredClone(view.state.feet);
 }
 assert.ok(locked>20);const before=JSON.stringify(view.state);view.update(10000,10,10,'left',true);assert.equal(JSON.stringify(view.state),before);
 view.destroy();
});
test('native mesh/socket/defeat apply exactly one shared ground registration; default rig remains unchanged',()=>{
 const rig=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-conformance-20261004/rig.json',import.meta.url)));
 const {scene}=fixture('sakura');scene.cache={json:{get:()=>rig}};
 const original=JSON.stringify(rig),base=new SakuraNativePresentation(scene),view=new SakuraNativePresentation(scene,{scale:2/3,groundOffset:26});
 assert.equal(view.visualScale,2/3);assert.equal(view.clock.stride,64);
 base.update(30,0,0,null,false,false);view.update(30,0,0,null,false,false);
 for(let j=0;j<base.nodes.length;j++)for(let i=0;i<base.nodes[j].node.vertices.length;i++){
  const a=base.nodes[j].node.vertices[i],b=view.nodes[j].node.vertices[i];
  assert.ok(Math.abs(b.x-a.x*2/3)<1e-7);assert.ok(Math.abs(b.y-a.y*2/3)<1e-7);
 }
 const hand=base.handWorld(),scaled=view.handWorld();
 assert.ok(Math.abs(scaled.x-(500+(hand.x-500)*2/3))<1e-7);
 assert.ok(Math.abs(scaled.y-(1026+(hand.y-1026)*2/3))<1e-7);
 assert.equal(view.upper.y,1000+26/3);assert.equal(view.shadow.y,1026);assert.equal(JSON.stringify(rig),original);
 scene.player.hp=0;const snap=captureSakuraDefeat({nativeSakura:true,freshSakura:true,scene,sakuraView:view},'player-defeat');
 assert.equal(snap.presentation.scale,2/3);
 scene.events={on(){},off(){}};scene.time={delayedCall(){return {remove(){}};}};
 const defeat=new SakuraNativeDefeatPresentation(scene,snap,560,()=>{});
 assert.equal(defeat.nodes[0].node.y,view.nodes[0].node.y);
 assert.deepEqual(defeat.nodes[0].node.vertices.map(v=>[v.x,v.y]),view.nodes[0].node.vertices.map(v=>[v.x,v.y]));
 defeat.destroy();base.destroy();view.destroy();
});
