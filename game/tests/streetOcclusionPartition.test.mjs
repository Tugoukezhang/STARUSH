import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture(){
 const nodes=[],masks=[];
 const node=()=>{const n={active:true,visible:true,x:140,y:260,displayWidth:280,displayHeight:260,texture:{key:'gray'},frame:{name:'__BASE'},alpha:1,mask:null,
  setOrigin(){return this;},setTexture(k,f){this.texture={key:k};this.frame={name:f};return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},setVisible(v){this.visible=v;return this;},setMask(m){this.mask=m;return this;},clearMask(){this.mask=null;return this;},disableInteractive(){},getBounds(){return{x:0,y:0,width:280,height:260};},destroy(){assert.equal(this.mask,null);this.active=false;}};nodes.push(n);return n;};
 const image=node(),colorImage=node().setVisible(false),item={definition:{art:'unknown'},image,colorImage};
 const scene={player:{x:140,y:70},game:{renderer:{gl:{}}},actorPresentation:{visualMetrics:{groundOffset:26},enemies:new Map(),setWorldDepth(){}},add:{image:()=>node()},make:{graphics(){return{clear(){return this;},fillStyle(){return this;},fillEllipse(){return this;},createGeometryMask(){const m={invertAlpha:false,setInvertAlpha(v=true){this.invertAlpha=v;return this;},destroy(){assert(nodes.every(n=>n.mask!==this),'all base and overlay references detach before mask destroy');this.destroyed=true;}};masks.push(m);return m;},destroy(){this.destroyed=true;}};}}};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{scene,items:new Map([['fixture',item]]),disposed:false,storyOffered:true,nearestInteraction:()=>null});
 return {street,scene,item,masks,node};
}

test('local cutout partitions each source pixel into one pass instead of duplicating translucent edges',()=>{
 const {street,item,masks}=fixture();street.sync();
 assert.equal(masks.length,2,'one shared inside and one shared outside mask');
 assert(item.image.mask,'base must not also render outside the window');assert.equal(item.image.mask.invertAlpha,false);
 assert.equal(item.colorImage.mask,item.image.mask);assert(item.occlusionImage.mask.invertAlpha);
 assert.notEqual(item.occlusionImage.mask,item.image.mask);assert.equal(item.image.alpha,.42);assert.equal(item.occlusionImage.alpha,1);
 const sourceAlpha=.5;
 const outsideBase=item.image.mask.invertAlpha?item.image.alpha*sourceAlpha:0,outsideOverlay=sourceAlpha;
 assert.equal(outsideBase+outsideOverlay*(1-outsideBase),sourceAlpha,'outside edge opacity cannot inflate');
});

test('paint switching and several occluders share two masks without losing original image ownership',()=>{
 const {street,item,masks,node}=fixture();street.sync();const inside=item.image.mask,outside=item.occlusionImage.mask;
 item.image.setVisible(false);item.colorImage.setVisible(true).setTexture('painted');street.sync();
 assert.equal(item.occlusionImage.texture.key,'painted');assert.equal(item.image.visible,false);assert.equal(item.colorImage.visible,true);
 const other={definition:{art:'unknown'},image:node(),colorImage:node().setVisible(false)};street.items.set('other',other);
 for(let i=0;i<12;i++)street.sync();assert.equal(masks.length,2);assert.equal(other.image.mask,inside);assert.equal(other.occlusionImage.mask,outside);
});

test('walking to the front detaches only owned masks and hides the extra pass',()=>{
 const {street,scene,item}=fixture();street.sync();scene.player.y=300;street.sync();
 assert.equal(item.image.mask,null);assert.equal(item.colorImage.mask,null);assert.equal(item.occlusionImage.visible,false);assert.equal(item.image.alpha,1);
 const external={};item.image.mask=external;street.sync();assert.equal(item.image.mask,external,'do not clear a non-owned mask on the unoccluded path');item.image.clearMask();
});

test('ending and freeze restore the entire prop rather than leaving a window-only fragment',()=>{
 for(const mode of ['end','freeze']){
  const {street,scene,item}=fixture();street.sync();
  if(mode==='end'){scene._battleEnded=true;street.sync();}else street.freeze();
  assert.equal(item.image.mask,null);assert.equal(item.colorImage.mask,null);assert.equal(item.occlusionImage.visible,false);assert.equal(item.image.alpha,1);assert.equal(item.colorImage.alpha,1);
 }
});

test('Canvas fallback and invalid player data cannot keep stale WebGL masks attached',()=>{
 for(const mode of ['canvas','invalid']){
  const {street,scene,item}=fixture();street.sync();
  if(mode==='canvas')scene.game.renderer.gl=null;else scene.player.x=NaN;
  street.syncForegroundOcclusion(item,true,9.3);assert.equal(item.image.mask,null);assert.equal(item.colorImage.mask,null);assert.equal(item.occlusionImage.visible,false);
 }
});

test('destroy detaches both sides of every shared mask exactly before disposal',()=>{
 const {street,masks}=fixture();street.sync();assert.equal(masks.length,2);street.destroy();street.destroy();assert(masks.every(m=>m.destroyed));assert.equal(street.occlusionMask,null);assert.equal(street.occlusionWindowMask,null);
});
