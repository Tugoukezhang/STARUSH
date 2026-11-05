import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture({x=500,y=1380,pose={x:428.5,y:1292,right:577,bottom:1406.5},gl=true}={}) {
  const masks=[],nodes=[],state={pose,reads:0};
  const node=()=>{const n={active:true,scene:true,visible:true,alpha:1,x:339,y:1420,displayWidth:280,displayHeight:260,texture:{key:'gray'},frame:{name:'__BASE'},
    setTexture(k,f){this.texture={key:k};this.frame={name:f};return this;},setPosition(x,y){Object.assign(this,{x,y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setOrigin(){return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},setVisible(v){this.visible=v;return this;},setMask(m){this.mask=m;return this;},clearMask(){this.mask=null;return this;},disableInteractive(){},getBounds(){return{x:199,y:1160,width:280,height:260};},destroy(){assert(!this.mask);this.active=false;}};nodes.push(n);return n;};
  const item={definition:{art:'shop'},image:node(),colorImage:node().setVisible(false)};
  const scene={player:{x,y,hp:6},game:{renderer:{gl:gl?{}:null}},actorPresentation:{enemies:new Map(),setWorldDepth(){},userCastView:{cueExclusionBounds(){state.reads++;return state.pose;}}},add:{image:node},make:{graphics(){return{commands:[],clear(){this.commands=[];return this;},fillStyle(){return this;},fillEllipse(...a){this.commands.push(['ellipse',...a]);return this;},fillRoundedRect(...a){this.commands.push(['round',...a]);return this;},createGeometryMask(){const m={setInvertAlpha(v){this.invertAlpha=v;return this;},destroy(){assert(nodes.every(n=>n.mask!==this));this.destroyed=true;}};masks.push(m);return m;},destroy(){this.destroyed=true;}};}}};
  const street=Object.assign(Object.create(OldStreetScene.prototype),{scene,items:new Map([['record-shop',item]]),disposed:false,storyOffered:true,nearestInteraction:()=>null});
  return{street,scene,item,state,masks,nodes};
}

test('right-edge current pose opens the existing local window with player centre outside the registered facade',()=>{
  const f=fixture(),before=JSON.stringify({player:f.scene.player,pose:f.state.pose});
  f.street.sync();
  assert.equal(f.item.image.alpha,.42);assert.equal(f.masks.length,2);
  assert.equal(f.item.image.mask,f.street.occlusionWindowMask);assert.equal(f.item.occlusionImage.alpha,1);
  assert.deepEqual(f.street.occlusionGfx.commands,[['round',420.5,1284,164.5,130.5,12]]);
  assert.equal(JSON.stringify({player:f.scene.player,pose:f.state.pose}),before);
});
test('left-edge pose overlap is admitted without raising the actor in front of the facade',()=>{
  const f=fixture({x:180,y:1350,pose:{x:110,y:1260,right:255,bottom:1376}});f.street.sync();
  assert.equal(f.item.image.alpha,.42);assert(f.item.image.mask);assert.equal(f.item.image.depth,9.2+1419/10000);
});
test('front, disjoint and merely touching poses do not fade foreground art',()=>{
  for(const input of [{y:1450},{pose:{x:478,y:1292,right:600,bottom:1406}},{pose:{x:500,y:1300,right:600,bottom:1406}},{pose:{x:420,y:1419,right:577,bottom:1500}}]){
    const f=fixture(input);f.street.sync();assert.equal(f.item.image.alpha,1);assert.equal(f.masks.length,0);
  }
});
test('missing or invalid pose cannot create an edge window; legacy centre remains supported',()=>{
  for(const pose of [null,{}, {x:400,y:1200,right:NaN,bottom:1400},{x:500,y:1200,right:400,bottom:1400},{x:400,y:1300,right:500,bottom:1200}]){
    const f=fixture({pose});f.street.sync();assert.equal(f.item.image.alpha,1);assert.equal(f.masks.length,0);
  }
  const f=fixture({x:420,y:1270,pose:null});f.street.sync();assert.equal(f.item.image.alpha,.42);assert.equal(f.street.occlusionGfx.commands[0][0],'ellipse');
});
test('Canvas edge admission retains existing whole-prop fallback without geometry masks',()=>{
  const f=fixture({gl:false});f.street.sync();assert.equal(f.item.image.alpha,.42);assert.equal(f.masks.length,0);assert.equal(f.item.occlusionImage,undefined);
});
test('edge window detaches after moving clear and releases masks on freeze and repeated destroy',()=>{
  const f=fixture();f.street.sync();assert(f.item.image.mask);
  for(let n=0;n<12;n++)f.street.sync();assert.equal(f.masks.length,2);assert.equal(f.nodes.length,3);
  f.scene.player.y=1500;f.street.sync();assert.equal(f.item.image.alpha,1);assert.equal(f.item.image.mask,null);assert.equal(f.item.occlusionImage.visible,false);
  f.street.freeze();f.street.destroy();f.street.destroy();assert(f.masks.every(m=>m.destroyed));assert(f.nodes.every(n=>!n.active));
});
test('ended battle never admits a new edge window',()=>{
  const f=fixture();f.scene._battleEnded=true;f.street.sync();assert.equal(f.item.image.alpha,1);assert.equal(f.state.reads,0);assert.equal(f.masks.length,0);
});
