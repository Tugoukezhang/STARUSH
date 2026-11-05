import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture({webgl=true,config=null}={}){
 const created=[],masks=[];
 const node=()=>({active:true,scene:true,visible:true,alpha:1,x:140,y:260,displayWidth:280,displayHeight:260,texture:{key:'gray'},frame:{name:'__BASE'},
  setTexture(key,frame){this.texture={key};this.frame={name:frame};return this;},setPosition(x,y){this.x=x;this.y=y;return this;},
  setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setOrigin(){return this;},setDepth(v){this.depth=v;return this;},
  setAlpha(a){this.alpha=a;return this;},setVisible(v){this.visible=v;return this;},setMask(m){this.mask=m;return this;},clearMask(){this.mask=null;return this;},
  getBounds(){return {x:this.x-this.displayWidth/2,y:this.y-this.displayHeight,width:this.displayWidth,height:this.displayHeight};},
  destroy(){assert(!this.mask,'mask reference must be detached before overlay destruction');this.active=false;},disableInteractive(){}});
 const image=node(),colorImage=node();colorImage.setTexture('paint-composite').setVisible(false);
 const item={definition:{id:'shop',art:'shop'},image,colorImage};
 const scene={player:{x:140,y:70,hp:5},game:{renderer:{gl:webgl?{}:null}},actorPresentation:{visualMetrics:{groundOffset:26},setWorldDepth(){},enemies:new Map()},
  add:{image(x,y,key,frame){const n=node().setPosition(x,y).setTexture(key,frame);created.push(n);return n;}},
  make:{graphics(){const g={active:true,commands:[],clear(){this.commands=[];return this;},fillStyle(){return this;},fillEllipse(...v){this.commands.push(v);return this;},
   createGeometryMask(){const m={invertAlpha:false,setInvertAlpha(v=true){this.invertAlpha=v;return this;},destroy(){assert(created.every(n=>!n.mask));this.destroyed=true;}};masks.push(m);return m;},destroy(){this.active=false;}};return g;}}};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{config,disposed:false,storyOffered:true,scene,items:new Map([['shop',item]]),nearestInteraction:()=>null});
 return {street,scene,item,created,masks,node};
}
test('whole-building transparency is limited to a local window with shared complementary masks',()=>{
 const f=fixture(),before=JSON.stringify(f.scene.player);f.street.sync();
 assert(f.item.occlusionImage,'local foreground overlay must exist');
 assert.equal(f.created.length,1);assert.equal(f.masks.length,2);assert.equal(f.masks[0].invertAlpha,true);
 const o=f.item.occlusionImage;assert.equal(o.alpha,1);assert.equal(o.texture.key,'gray');assert.equal(o.visible,true);
 assert.equal(f.item.image.alpha,.42);assert.equal(f.item.image.mask,f.street.occlusionWindowMask);assert.equal(f.item.colorImage.mask,f.street.occlusionWindowMask);
 assert.equal(f.street.occlusionWindowMask.invertAlpha,false);assert.notEqual(f.item.image.mask,o.mask);
 assert.deepEqual(o.getBounds(),f.item.image.getBounds());assert(o.depth>f.item.image.depth);
 assert.deepEqual(f.street.occlusionGfx.commands,[[140,52,64,96]]);
 const other={definition:{id:'repair',art:'repair'},image:f.node(),colorImage:f.node().setVisible(false)};f.street.items.set('repair',other);
 f.street.sync();assert.equal(f.masks.length,2);assert.equal(other.occlusionImage.mask,o.mask);
 for(let i=0;i<20;i++)f.street.sync();assert.equal(f.created.length,2);assert.equal(JSON.stringify(f.scene.player),before);
 f.scene.player.y=300;f.street.sync();assert.equal(o.visible,false);assert.equal(f.item.image.alpha,1);
});
test('painted composition and opened display geometry reach the overlay without mutating alpha pixels',()=>{
 const f=fixture();f.item.attackSurface={dirty:false};f.item.image.setVisible(false);f.item.colorImage.setVisible(true);
 f.street.sync();assert(f.item.occlusionImage,'local foreground overlay must exist');
 assert.equal(f.item.occlusionImage.texture.key,'paint-composite');assert.equal(f.item.image.visible,false);
 f.item.colorImage.setPosition(160,240).setDisplaySize(220,200);f.street.sync();assert.deepEqual(f.item.occlusionImage.getBounds(),f.item.colorImage.getBounds());
 f.item.colorImage.setTexture('next-composite');f.street.sync();assert.equal(f.item.occlusionImage.texture.key,'next-composite');
 f.scene._battlePaused=true;const before=JSON.stringify(f.street.occlusionGfx.commands);f.street.sync();assert.equal(JSON.stringify(f.street.occlusionGfx.commands),before);
});
test('Canvas retains the no-mask fallback across all chapter configurations',()=>{
 for(const options of [{webgl:false},{webgl:false,config:{chapterId:'neon'}},{webgl:false,config:{chapterId:'encore'}}]){
  const f=fixture(options);f.street.sync();assert.equal(f.item.image.alpha,.42);assert.equal(f.created.length,0);assert.equal(f.masks.length,0);
 }
});

test('neon and harbor use the same local occlusion instead of fading the entire building',()=>{
 for(const chapterId of ['neon','encore']){
  const f=fixture({config:{chapterId}});f.street.sync();
  assert(f.item.occlusionImage,chapterId+' local window missing');
  assert.equal(f.masks.length,2);assert.equal(f.item.occlusionImage.alpha,1);
  f.item.colorImage.setVisible(true).setTexture('painted-'+chapterId);f.street.sync();
  assert.equal(f.item.occlusionImage.texture.key,'painted-'+chapterId);
  f.street.freeze();assert.equal(f.item.occlusionImage.visible,false);
  f.street.destroy();assert(f.masks.every(m=>m.destroyed));
 }
});
test('freeze hides local overlays and idempotent destruction detaches shared masks first',()=>{
 const f=fixture();f.street.sync();assert(f.item.occlusionImage,'local foreground overlay must exist');
 const o=f.item.occlusionImage,g=f.street.occlusionGfx,m=f.masks[0];f.street.freeze();assert.equal(o.visible,false);
 f.street.destroy();f.street.destroy();assert.equal(o.active,false);assert.equal(g.active,false);assert.equal(m.destroyed,true);assert.equal(f.street.items.size,0);
});
