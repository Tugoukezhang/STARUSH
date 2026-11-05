import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusLayeredPresentation} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaLayeredPresentation} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiLayeredPresentation} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoLayeredPresentation} from '../src/systems/EnjoLayeredPresentation.mjs';
function node(){
 const n={alpha:1,vertices:[],width:375,height:667};
 for(const m of ['setOrigin','setDisplaySize','setPosition','setAngle','setTint','setDepth','setOrtho','preUpdate'])n[m]=()=>n;
 n.setAlpha=a=>{n.alpha=a;return n;};n.setVisible=v=>{n.visible=v;return n;};
 n.setTexture=(key,frame)=>{n.key=key;n.frame=frame;return n;};n.setFrame=f=>{n.frame=f;return n;};
 n.addVertices=(xy,uv,indices)=>{n.vertices=indices.map(i=>({x:xy[i*2],y:xy[i*2+1],setUVs(){}}));return n;};n.destroy=()=>{};
 return n;
}
for(const View of [VenusLayeredPresentation,GenyaLayeredPresentation,KaiLayeredPresentation,EnjoLayeredPresentation]){
 test(View.name+' keeps live hit/invulnerability visible on images and sleeve meshes',()=>{
  const player={x:500,y:1600,hp:5,invulnerable:true},scene={player,playerGfx:{alpha:.3},
   add:{image:node,ellipse:node,mesh:node},textures:{exists:()=>false,getFrame:()=>({cutX:0,cutY:0,cutWidth:104,cutHeight:104,source:{width:1024,height:1024}})}};
  const view=new View(scene),before=structuredClone(player);
  view.update(16,0,0,{hurt:true});
  for(const n of view.nodes.values())assert.equal(n.alpha,.75,'No dim face/body while the physics player is alive');
  assert(view.seams.nodes.size>0);
  for(const n of view.seams.nodes.values())assert.equal(n.alpha,.75,'Actual deforming mesh needs the same floor');
  assert(view.nodes.get('face').frame.endsWith('/hurtFace'));assert.deepEqual(player,before);assert.equal(scene.playerGfx.alpha,.3);
  view.setWorldDepth(100);assert.equal(view.upper.alpha,.75);
  view.update(32,0,0,{hurt:false});assert.equal(view.upper.alpha,.75,'The floor lasts for live invulnerability, not just the expression');
  view.render(view.pose,0);for(const n of view.nodes.values())assert.equal(n.alpha,0,'Explicit hide must remain hidden');
  player.invulnerable=false;scene.playerGfx.alpha=.42;view.update(48,0,0);assert.equal(view.upper.alpha,.42);
  player.invulnerable=true;player.hp=0;scene.playerGfx.alpha=.3;view.update(64,0,0,{hurt:true});assert.equal(view.upper.alpha,.3,'Death opacity must not be clamped');
  view.destroy();view.destroy();
 });
}
