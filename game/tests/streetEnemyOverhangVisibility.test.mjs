import test from 'node:test';import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
function fixture({gl=true}={}){
 const nodes=[],masks=[],graphics=[],owners=[],state={body:true,los:true,pose:null};
 const node=(extra={})=>{const n={active:true,scene:true,visible:true,alpha:1,x:140,y:260,displayWidth:280,displayHeight:260,texture:{key:'gray'},frame:{name:'__BASE'},
  setTexture(k,f){this.texture={key:k};this.frame={name:f};return this;},setPosition(x,y){Object.assign(this,{x,y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setOrigin(){return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},setVisible(v){this.visible=v;return this;},setMask(m){this.mask=m;return this;},clearMask(){this.mask=null;return this;},disableInteractive(){},getBounds(){return this.bounds??{x:this.x-this.displayWidth/2,y:this.y-this.displayHeight,width:this.displayWidth,height:this.displayHeight};},destroy(){assert(!this.mask);this.active=false;},...extra};nodes.push(n);return n;};
 const prop=(x=140)=>({definition:{art:'unknown'},image:node({x}),colorImage:node({x}).setVisible(false)}),item=prop(),enemies=new Map();
 const scene={_userCastPresentation:true,player:{active:true,hp:5,x:350,y:140},enemies:{getChildren:()=>owners},game:{renderer:{gl:gl?{}:null}},actorPresentation:{enemies,setWorldDepth(){},userCastView:{cueExclusionBounds:()=>state.pose}},add:{image:()=>node()},make:{graphics(){const gfx={commands:[],clear(){this.commands=[];return this;},fillStyle(){return this;},fillEllipse(...a){this.commands.push(['ellipse',...a]);return this;},fillRoundedRect(...a){this.commands.push(['round',...a]);return this;},createGeometryMask(){const m={setInvertAlpha(v){this.invertAlpha=v;return this;},destroy(){assert(nodes.every(n=>n.mask!==this));this.destroyed=true;}};masks.push(m);return m;},destroy(){this.destroyed=true;}};graphics.push(gfx);return gfx;}}};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{scene,items:new Map([['shop',item]]),disposed:false,storyOffered:true,nearestInteraction:()=>null,clearLine:(a,b)=>a===b?state.body:state.los});
 const enemy=(x=140)=>{const gfx=node({x:x-12,y:188}),image=node({x,y:200,displayWidth:36,displayHeight:36,bounds:{x:x-18,y:182,width:36,height:36}}),owner={active:true,hp:36,x,y:200,drawRadius:12,unlitBlob:true,gfx},view={image,ground:{x,y:212},role:'unlit-chaser',art:{offset:12,size:36}};owners.push(owner);enemies.set(gfx,view);return {gfx,image,owner,view};};
 return{street,scene,item,state,nodes,masks,graphics,owners,enemy,prop};
}

test('legal visible ordinary enemy under overhang gets its own local window while original depth stays behind',()=>{
 const f=fixture(),e=f.enemy();f.street.sync();assert.equal(f.item.image.alpha,.42);assert(f.item.image.mask);assert(f.item.occlusionImage.visible);assert.equal(f.item.occlusionImage.alpha,1);assert.equal(f.masks.length,2);
 assert.deepEqual(f.item.enemyOcclusion.occlusionGfx.commands,[['round',116,176,48,48,8]]);assert(e.image.depth<f.item.image.depth);assert(e.gfx.depth<f.item.image.depth);
});

test('wall-blocked, illegal, dead, hidden, transparent, unowned and nonordinary enemies never reveal a prop',()=>{
 for(const change of [f=>f.state.los=false,f=>f.state.body=false,(_f,e)=>e.owner.hp=0,(_f,e)=>e.owner.active=false,(_f,e)=>e.gfx.visible=false,(_f,e)=>e.image.visible=false,(_f,e)=>e.image.alpha=0,(_f,e)=>e.gfx.alpha=0,f=>f.owners.splice(0),(_f,e)=>e.owner.unlitBlob=false,(_f,e)=>e.view.role='spotlight-captain',(_f,e)=>e.owner.x=NaN,(_f,e)=>e.image.bounds.width=NaN]){
  const f=fixture(),e=f.enemy();change(f,e);f.street.sync();assert.equal(f.item.image.alpha,1,change.toString());assert.equal(f.masks.length,0,change.toString());
 }
});

test('enemy feet in front or pose disjoint from current opened prop geometry do not fade it',()=>{
 for(const change of [(_f,e)=>e.view.ground.y=260,(_f,e)=>e.view.ground.y=300,(_f,e)=>e.view.ground.y=-1,(_f,e)=>e.image.bounds.x=280,f=>f.item.image.setDisplaySize(40,40)]){
  const f=fixture(),e=f.enemy();change(f,e);f.street.sync();assert.equal(f.item.image.alpha,1);assert.equal(f.masks.length,0);
 }
});

test('separate props receive only their own intersecting enemy windows, not a scene-wide union',()=>{
 const f=fixture();f.enemy();f.enemy(540);const other=f.prop(540);f.street.items.set('other',other);f.street.sync();
 assert.equal(f.masks.length,4);assert.notEqual(f.item.image.mask,other.image.mask);
 assert.deepEqual(f.item.enemyOcclusion.occlusionGfx.commands,[['round',116,176,48,48,8]]);assert.deepEqual(other.enemyOcclusion.occlusionGfx.commands,[['round',516,176,48,48,8]]);
});

test('player and enemy local windows coexist and switch back to original shared player masks when enemy leaves',()=>{
 const f=fixture(),e=f.enemy();f.scene.player.x=140;f.scene.player.y=70;f.state.pose={x:80,y:30,right:200,bottom:100};f.street.sync();
 assert.deepEqual(f.item.enemyOcclusion.occlusionGfx.commands,[['round',72,22,136,86,12],['round',116,176,48,48,8]]);
 const prior=f.item.image.mask;e.owner.active=false;f.street.sync();assert.notEqual(f.item.image.mask,prior);assert.equal(f.item.image.mask,f.street.occlusionWindowMask);assert.equal(f.item.occlusionImage.mask,f.street.occlusionMask);
});

test('painted composite source and current image geometry remain single-pass outside enemy window',()=>{
 const f=fixture();f.enemy();f.item.attackSurface={dirty:false};f.item.colorImage.setVisible(true).setTexture('painted');f.street.sync();
 assert.equal(f.item.image.visible,false);assert.equal(f.item.occlusionImage.texture.key,'painted');assert.equal(f.item.colorImage.mask,f.item.image.mask);assert.notEqual(f.item.colorImage.mask,f.item.occlusionImage.mask);
 const n=f.nodes.length;f.item.colorImage.setTexture('next-painted');f.street.sync();assert.equal(f.item.occlusionImage.texture.key,'next-painted');assert.equal(f.nodes.length,n);
});

test('Canvas retains existing no-mask whole-prop fallback for eligible enemy only',()=>{
 const f=fixture({gl:false});f.enemy();f.street.sync();assert.equal(f.item.image.alpha,.42);assert.equal(f.masks.length,0);assert.equal(f.item.occlusionImage,undefined);
 f.state.los=false;f.street.sync();assert.equal(f.item.image.alpha,1);
});

test('enemy removal, LOS loss and battle end detach stale owned masks and hide outside pass immediately',()=>{
 for(const change of [f=>f.scene.actorPresentation.enemies.clear(),f=>f.state.los=false,f=>f.scene._battleEnded=true]){
  const f=fixture();f.enemy();f.street.sync();assert(f.item.image.mask);change(f);f.street.sync();assert.equal(f.item.image.mask,null);assert.equal(f.item.colorImage.mask,null);assert.equal(f.item.occlusionImage.visible,false);assert.equal(f.item.image.alpha,1);
 }
});

test('repeated sync creates bounded mask resources and freeze/destroy detaches before disposing them',()=>{
 const f=fixture();f.enemy();f.street.sync();const count=f.nodes.length;
 for(let n=0;n<60;n++)f.street.sync();assert.equal(f.nodes.length,count);assert.equal(f.masks.length,2);assert.equal(f.graphics.length,1);
 f.street.freeze();assert.equal(f.item.image.mask,null);assert.equal(f.item.occlusionImage.visible,false);f.street.destroy();f.street.destroy();assert(f.masks.every(m=>m.destroyed));assert(f.graphics.every(g=>g.destroyed));
});

test('enemy visibility never mutates positions, hp, captured attack state or collision data',()=>{
 const f=fixture(),e=f.enemy();e.owner.capture={x:400,y:200,length:144};e.owner.body={radius:12};const physics=()=>JSON.stringify({player:f.scene.player,owner:{...e.owner,gfx:undefined}}),before=physics();f.street.sync();assert.equal(physics(),before);assert(f.item.image.mask);
});
