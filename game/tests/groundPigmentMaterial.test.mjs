import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
const brush={sample:(_u,_v,ink=false)=>ink?0:1};
const substrate=(width,height)=>{const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(x<width/2?[40,40,40,255]:[200,200,200,255],(y*width+x)*4);return{width,height,data};};
const rgb=(r,x,y)=>Array.from(r.pixels.slice((y*r.pixelWidth+x)*4,(y*r.pixelWidth+x)*4+3));
test('bounded multiply retains stronger authored joint variation without losing painted restoration',()=>{
 const r=new StreetPigmentRaster(80,40,null,1,brush,substrate(40,20));r.stamp(40,20,40,0xffcc66);
 assert.deepEqual(rgb(r,10,10),[137,109,55]);assert.deepEqual(rgb(r,30,10),[225,180,90]);
 assert(rgb(r,30,10)[0]-rgb(r,10,10)[0]>=85,'retain more structure than old56-level washed material');
});
test('white material returns original tint and dark material keeps a visible pigment floor',()=>{
 const s=substrate(40,20);s.data.fill(255);s.data.set([0,0,0,255],(10*40+10)*4);
 const r=new StreetPigmentRaster(80,40,null,.9,brush,s);r.stamp(40,20,40,0x00ced1);
 assert.deepEqual(rgb(r,10,10),[11,95,96]);assert.deepEqual(rgb(r,30,10),[25,211,214]);
});
test('material changes RGB only: coverage, clipped fan geometry and blocker holes stay exact',()=>{
 const a=new StreetPigmentRaster(120,80,null,.9,brush),b=new StreetPigmentRaster(120,80,null,.9,brush,substrate(60,40));
 const fan={x:22,y:40,radius:90,angle:0,halfAngle:.5},points=attackPaintPolygon(fan),blocks=[{footprint:{x:70,y:25,width:10,height:30}}];
 for(const r of [a,b]){r.stamp(30,40,25,0xff69b4,blocks);r.fan(fan,points,0x00ced1,blocks);}
 assert.deepEqual(a.pixels.filter((_,i)=>i%4===3),b.pixels.filter((_,i)=>i%4===3));assert.deepEqual(a.dirty,b.dirty);
 for(let y=13;y<27;y++)assert.equal(b.pixels[(y*60+36)*4+3],0);
});
test('same pigment replay remains byte-identical, does not darken and produces no upload work',()=>{
 const r=new StreetPigmentRaster(80,40,null,.9,brush,substrate(40,20));r.stamp(40,20,30,0xffcc66);r.consumeDirty();const before=r.pixels.slice();
 for(let i=0;i<20;i++)assert.equal(r.stamp(40,20,30,0xffcc66),false);
 assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
});
test('legacy without substrate and authored black-ink attenuation keep their existing contracts',()=>{
 const a=new StreetPigmentRaster(80,40,null,.9,brush);a.stamp(40,20,40,0x00ced1);assert.deepEqual(rgb(a,10,10),[25,211,214]);
 const s=substrate(40,20),inkBrush={sample:(_u,_v,ink=false)=>1};
 const b=new StreetPigmentRaster(80,40,null,1,inkBrush,s);b.stamp(40,20,40,0xffcc66);
 assert.deepEqual(rgb(b,30,10),[124,99,50]);assert.equal(b.pixels[(10*40+30)*4+3],255);
});
test('yellow on mid-gray road remains visibly golden instead of the rejected olive candidate',()=>{
 const s=substrate(40,20);for(let i=0;i<s.data.length;i+=4)s.data.set([130,130,130,255],i);
 const r=new StreetPigmentRaster(80,40,null,.9,brush,s);r.stamp(40,20,40,0xffd700);
 const [red,green,blue]=rgb(r,10,10);assert(red>=180&&green>=150&&blue<=30);assert(.2126*red+.7152*green+.0722*blue>=145);
});
test('orange on mid-gray road retains orange value and color separation',()=>{
 const s=substrate(40,20);for(let i=0;i<s.data.length;i+=4)s.data.set([130,130,130,255],i);
 const r=new StreetPigmentRaster(80,40,null,.9,brush,s);r.stamp(40,20,40,0xff8c00);
 const [red,green,blue]=rgb(r,10,10);assert(red>=180&&green>=105&&blue<=30);assert(red-green>=65);
});
