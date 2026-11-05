import test from 'node:test';import assert from 'node:assert/strict';
import {PaintWorkQueue} from '../src/systems/PaintWorkQueue.mjs';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const surface=(blockers=()=>[])=>{
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){}},texture={context:ctx,refresh(){}};
 const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){}};
 return new StreetPaintSurface({textures:{createCanvas:()=>texture,exists:()=>true,remove(){}},add:{image:()=>image}},blockers,100,120);
};

test('accepted ground stroke queues its original blocker geometry and leaves input path free of pixel work',()=>{
 const blockers=[{footprint:{x:58,y:0,width:20,height:120}}],a=surface(()=>blockers),b=surface(()=>blockers),q=new PaintWorkQueue();
 a.stamp(40,60,40,0xff1122);b.stamp(40,60,40,0xff1122,null,q);
 assert.equal(q.pending,1);assert(!b.raster.pixels.some(v=>v>0));
 blockers[0].footprint.x=2;q.drain();
 assert.deepEqual(a.raster.pixels,b.raster.pixels);assert.deepEqual(a.raster.consumeDirty(),b.raster.consumeDirty());
 a.destroy();b.destroy();q.destroy();
});

test('facade geometry is accepted immediately but raster and visible texture change only when work completes',()=>{
 let shown=false;const data=()=>({data:new Uint8ClampedArray(80*80*4).fill(255)}),raster=new PropRestorationRaster(80,80,data(),data()),surface={raster,source:{width:80,height:80},texture:{context:{}},dirty:false};
 const street=Object.create(OldStreetScene.prototype);street.scene={};street.state={clearLine:()=>true};street.items=new Map([['test',{definition:{x:50,y:100,width:80,height:80,footprint:{x:10,y:60,width:80,height:40}},attackSurface:surface,image:{setVisible(){}},colorImage:{setVisible(v){shown=v;}}}]]);
 const q=new PaintWorkQueue();street.paintSurfaceAt({x:50,y:80},30,{x:50,y:120},q);
 assert.equal(q.pending,1);assert(!raster.coverage.some(v=>v));assert.equal(shown,false);
 q.drain();assert(raster.coverage.some(v=>v));assert(surface.dirty);assert(shown);
});

test('result settlement drains accepted paint then uploads ground and facade before freezing',()=>{
 const {PaintZoneSystem}=loadScenes().loadRuntime('systems/PaintZoneSystem.js');
 const events=[],z=Object.create(PaintZoneSystem.prototype);
 z.paintWork={drain(){events.push('drain');}};z.streetSurface={flush(){events.push('ground');}};z.scene={oldStreet:{flushPaintSurfaces(){events.push('facade');}}};
 z.settlePaint();assert.deepEqual(events,['drain','ground','facade']);
});

test('actual battle end settles color before finishing the run and freezing results',()=>{
 const {BattleScene}=loadScenes().loadRuntime('scenes/BattleScene.js');let settled=false;
 const stop=new Error('after settlement');
 const scene={paintZone:{settlePaint(){settled=true;}},publicPerformerRun:{finish(){assert(settled);throw stop;}}};
 assert.throws(()=>BattleScene.prototype._endBattle.call(scene,'victory'),e=>e===stop);
});
