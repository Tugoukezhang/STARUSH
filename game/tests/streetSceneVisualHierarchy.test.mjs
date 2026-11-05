import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function node(bounds){return {active:true,x:0,y:0,alpha:1,depth:0,visible:true,
 getBounds:()=>({...bounds}),setAlpha(v){this.alpha=v;return this;},
 setDepth(v){this.depth=v;return this;},setVisible(v){this.visible=v;return this;}};}
function street(x=184,y=470){
 const actor={visualMetrics:{groundOffset:26},enemies:new Map(),setWorldDepth(v){this.depth=v;}};
 const scene={player:{x,y},actorPresentation:actor};
 const owner=Object.create(OldStreetScene.prototype);
 Object.assign(owner,{scene,items:new Map(),storyOffered:true,nearestInteraction:()=>null});
 return {scene,actor,owner};
}
const depth=y=>9.2+y/10000;

test('performer sorting uses the calibrated sole rather than the old body offset',()=>{
 const {owner,actor}=street();owner.sync();assert.equal(actor.depth,depth(496));
});

test('a performer with feet in front of a shop does not make that shop transparent',()=>{
 const {owner}=street();const item={definition:{x:184,y:482,width:170,height:164},image:node({x:99,y:318,width:170,height:164}),colorImage:node({})};
 owner.items.set('shop',item);owner.sync();assert.equal(item.image.alpha,1);assert.equal(item.colorImage.alpha,1);
});

test('folded scenery only fades inside its remaining rendered strip',()=>{
 const {owner,scene}=street(530,590);const item={definition:{x:530,y:640,width:150,height:64},image:node({x:455,y:576,width:22,height:64})};
 owner.items.set('panel',item);owner.sync();assert.equal(item.image.alpha,1,'old full-width box must not survive the fold');
 scene.player.x=466;owner.sync();assert.equal(item.image.alpha,.42);
 scene.player.y=650;owner.sync();assert.equal(item.image.alpha,1);
});

test('opened gate depth follows its actual remaining base, not its original definition',()=>{
 const {owner}=street(175,990);const image=node({x:135,y:975,width:80,height:18});
 owner.items.set('gate',{definition:{x:175,y:1020,width:80,height:45},image});
 owner.sync();assert.equal(image.depth,depth(993));assert.equal(image.alpha,1);
});

test('painted and gray scenery share one fade and an adjacent depth pair behind the performer',()=>{
 const {owner}=street(184,400);const item={definition:{x:184,y:482,width:170,height:164},image:node({x:99,y:318,width:170,height:164}),colorImage:node({}),progress:.5};
 owner.items.set('shop',item);owner.sync();assert.equal(item.image.alpha,.42);assert.equal(item.colorImage.alpha,.42);
 assert.equal(item.image.depth,depth(482));assert.equal(item.colorImage.depth,depth(482)+.000001);
 assert.equal(item.image.visible,true);
});

test('enemy body and status strokes sort together on both sides of scenery',()=>{
 const {owner,actor}=street();const gfx=node({}),image=node({});gfx.y=400;gfx.x=530;
 actor.enemies.set(gfx,{image,art:{offset:12,size:36}});
 owner.sync();assert.equal(image.depth,depth(430));assert.equal(gfx.depth,image.depth+.000002);
 assert.ok(gfx.depth<depth(482));gfx.y=520;owner.sync();assert.ok(image.depth>depth(482));
 assert.equal(gfx.depth,image.depth+.000002);assert.equal(gfx.x,530);assert.equal(gfx.y,520);
 assert.equal(image.alpha,1,'ordering must not change gameplay visibility or threat intensity');
});

test('already-disposed enemies and owners do not acquire new presentation state',()=>{
 const {owner,actor}=street();const gfx=node({}),image=node({});gfx.active=false;
 actor.enemies.set(gfx,{image,art:{offset:0,size:42}});owner.sync();assert.equal(image.depth,0);assert.equal(gfx.depth,0);
 const d=actor.depth;owner.disposed=true;owner.scene.player.y=10;owner.sync();assert.equal(actor.depth,d);
});
