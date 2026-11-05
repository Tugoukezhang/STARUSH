import test from 'node:test';import assert from 'node:assert/strict';
import {PaintWorkQueue,finishPaintWork} from '../src/systems/PaintWorkQueue.mjs';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {capturePublicBattleWorld} from '../src/systems/PublicBattleWorldCheckpoint.mjs';
import {PublicBattleCheckpointAutosave} from '../src/systems/PublicBattleCheckpoint.mjs';

test('cooperative paint budget yields without reordering or dropping work; urgent drain collects all',()=>{
 let now=0;const q=new PaintWorkQueue({clock:()=>now,budgetMs:4}),events=[];
 function* task(id){for(let n=0;n<5;n++){events.push(id+n);now+=2;yield;}return id;}
 q.add(task('a'));q.add(task('b'));assert.equal(events.length,0);
 q.step();assert.deepEqual(events,['a0','a1']);assert.equal(q.pending,2);
 q.drain();assert.deepEqual(events,['a0','a1','a2','a3','a4','b0','b1','b2','b3','b4']);
 assert.equal(q.pending,0);assert.equal(finishPaintWork((function*(){yield;return 42;})()),42);
});

test('dispose cancels suspended raster jobs without executing their remaining writes',()=>{
 const q=new PaintWorkQueue({clock:(()=>{let n=0;return()=>n++;})(),budgetMs:1}),events=[];
 q.add((function*(){try{events.push(1);yield;events.push(2);}finally{events.push('closed');}})());
 q.step();q.destroy();q.step();q.drain();assert.deepEqual(events,[1,'closed']);assert.equal(q.pending,0);
 assert.equal(q.add((function*(){events.push(3);})()),false);
});

test('ground row work and synchronous stamp have exact pixels, owners and dirty bounds',()=>{
 const brush={sample:(u,v,ink)=>ink?.1:(u>=0&&u<1&&v>=0&&v<1?.8:0),tone:()=>.6};
 const a=new StreetPigmentRaster(100,120,null,.9,brush),b=new StreetPigmentRaster(100,120,null,.9,brush);
 a.stamp(50,60,38,0x12abcc,[]);
 const it=b.stampWork(50,60,38,0x12abcc,[]);assert.equal(it.next().done,false);
 assert(b.pixels.some(v=>v>0));finishPaintWork(it);
 assert.deepEqual(a.pixels,b.pixels);assert.deepEqual(a.paintColors,b.paintColors);assert.deepEqual(a.consumeDirty(),b.consumeDirty());
});

test('building row work preserves synchronous coverage and alpha through an interrupted job',()=>{
 const image=()=>({data:new Uint8ClampedArray(80*60*4).fill(255)}),a=new PropRestorationRaster(80,60,image(),image()),b=new PropRestorationRaster(80,60,image(),image());
 const brush={sample:(u,v)=>u*v};a.paint(40.7,30.2,36.3,27.9,false,brush);
 const it=b.paintWork(40.7,30.2,36.3,27.9,false,brush);assert.equal(it.next().done,false);finishPaintWork(it);
 assert.deepEqual(a.output.data,b.output.data);assert.deepEqual(a.coverage,b.coverage);assert.deepEqual(a.takeDirty(),b.takeDirty());
});

test('world capture drains every accepted visual stroke before reading old save layers',()=>{
 let drained=false;const pixels=new Uint8ClampedArray(4),paintColors=new Uint32Array(1);
 const scene={paintZone:{paintWork:{drain(){drained=true;pixels.set([1,2,3,255]);paintColors[0]=0x010203;}},streetSurface:{raster:{pixels,paintColors,pixelWidth:1,pixelHeight:1}}}};
 const layers=capturePublicBattleWorld(scene);assert(drained);assert.deepEqual([...layers[0].bytes],[1,2,3,255]);assert.equal(layers.length,2);
});

test('background autosave defers while painting; explicit flush still captures synchronously',()=>{
 let busy=true,captures=0,writes=0;const a=new PublicBattleCheckpointAutosave({
  scene:{paintZone:{paintWork:{get pending(){return busy?1:0;}}}},capture:()=>{captures++;return{};},write:()=>{writes++;return{status:'saved'};},
  clock:()=>10000,documentTarget:null,windowTarget:null,encodeVisual:null
 });
 assert.equal(a.tick(),'painting');assert.equal(captures,0);
 assert.equal(a.flush(),'saved');assert.equal(writes,1);
 busy=false;a.lastAt=-Infinity;assert.equal(a.tick(),'saved');assert.equal(writes,2);a.destroy();
});

test('overload applies FIFO backpressure at 64 jobs without losing accepted work',()=>{
 const q=new PaintWorkQueue(),done=[];
 for(let n=0;n<100;n++){q.add((function*(){yield;done.push(n);})());assert(q.pending<=64);}
 assert(q.pressureFlushes>0);q.drain();assert.deepEqual(done,Array.from({length:100},(_,i)=>i));
});

for(const fail of ['timeout','error'])test('background encoder '+fail+' still defers capture during queued paint',()=>{
 let now=0,busy=false,done,captures=0,writes=0;
 const a=new PublicBattleCheckpointAutosave({scene:{paintZone:{paintWork:{get pending(){return busy?1:0;}}}},capture:()=>{captures++;return{worldVisual:[]};},write:()=>{writes++;return{status:'saved'};},clock:()=>now,documentTarget:null,windowTarget:null,encodeVisual:(_layers,cb)=>{done=cb;return()=>{};}});
 assert.equal(a.tick(),'saving');busy=true;now=5000;
 if(fail==='error')done(Error('test encoder failed'));else assert.equal(a.tick(),'painting');
 assert.equal(captures,1);assert.equal(writes,0);busy=false;assert.equal(a.tick(),'saved');assert.equal(writes,1);a.destroy();
});

test('continuous drawing cannot starve automatic save beyond its explicit four-second deferral',()=>{
 let now=0,busy=true,drains=0,writes=0;
 const a=new PublicBattleCheckpointAutosave({scene:{paintZone:{paintWork:{get pending(){return busy?1:0;},drain(){drains++;busy=false;}}}},capture:()=>({}),write:()=>{writes++;return{status:'saved'};},clock:()=>now,documentTarget:null,windowTarget:null,encodeVisual:null});
 assert.equal(a.tick(),'painting');now=4001;assert.equal(a.tick(),'saved');assert.equal(drains,1);assert.equal(writes,1);a.destroy();
});
