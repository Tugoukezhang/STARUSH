import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture(){
 const uploads=[],queue=[],events=[];
 const node=visible=>({visible,setVisible(v){this.visible=v;return this;}});
 const raster={output:{data:new Uint8ClampedArray(40000)},dirty:null,closed:false,
  *paintWork(){try{for(let x=48;x<52;x++){this.dirty={x,y:49,width:1,height:2};events.push('compute');yield;}return true;}finally{this.closed=true;}},
  takeDirty(){const r=this.dirty;this.dirty=null;return r;}};
 const item={definition:{id:'test',x:50,y:100,width:100,height:100,footprint:{x:0,y:0,width:100,height:100}},
  image:node(true),colorImage:node(false),attackSurface:{source:{width:100,height:100},raster,dirty:false,
   texture:{context:{putImageData(...args){uploads.push(args.slice(3));}},refresh(){events.push('upload');}}}};
 const scene={_battlePaused:false,_battleEnded:false},owner=Object.create(OldStreetScene.prototype);
 Object.assign(owner,{disposed:false,scene,items:new Map([['test',item]]),state:{clearLine:()=>true}});
 owner.paintSurfaceAt({x:50,y:50},10,{x:50,y:70},{add:w=>queue.push(w)});
 return{owner,item,raster,uploads,events,work:queue[0]};
}
test('a building uploads and becomes visible during the first yielded contact, not at completion',()=>{
 const f=fixture();assert.equal(f.item.colorImage.visible,false);
 assert.equal(f.work.next().done,false);f.owner.flushPaintSurfaces();
 assert.equal(f.item.image.visible,false);assert.equal(f.item.colorImage.visible,true);
 assert.deepEqual(f.uploads,[[48,49,1,2]]);assert.equal(f.raster.closed,false);
 f.owner.flushPaintSurfaces();assert.equal(f.uploads.length,1,'no idle duplicate upload');
 assert.equal(f.work.next().done,false);f.owner.flushPaintSurfaces();assert.deepEqual(f.uploads[1],[49,49,1,2]);
});
test('cancelling scene paint closes the underlying generator and produces no later publication',()=>{
 const f=fixture();f.work.next();f.owner.flushPaintSurfaces();f.work.return();
 assert(f.raster.closed);assert.equal(f.work.next().done,true);f.owner.flushPaintSurfaces();assert.equal(f.uploads.length,1);
});
test('disposed street does not upload a queued contact',()=>{
 const f=fixture();f.work.next();f.owner.disposed=true;f.owner.flushPaintSurfaces();assert.equal(f.uploads.length,0);f.work.return();
});
test('an unchanged generator does not reveal or upload the building',()=>{
 const f=fixture();f.raster.paintWork=function*(){yield;return false;};
 f.work.next();f.work.next();f.owner.flushPaintSurfaces();assert.equal(f.uploads.length,0);assert.equal(f.item.colorImage.visible,false);
});
