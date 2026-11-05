import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';

const brush={mergeOpaque:true,preserveSubstrate:true,sample:(u,v,ink)=>ink?0:Number(Math.hypot(u-.5,v-.5)<.35),tone:()=>.6};
function sweep(raster,solidFootprint,blockers=[]){
  for(let radius=12;radius<=96;radius+=12)for(const angle of [0,Math.PI]){
    const fan={x:121,y:121,radius,innerRadius:radius-12,angle,halfAngle:Math.PI/2,solidFootprint};
    const points=[{x:121,y:121},...Array.from({length:21},(_,i)=>({x:121+Math.cos(angle-Math.PI/2+i*Math.PI/20)*radius,y:121+Math.sin(angle-Math.PI/2+i*Math.PI/20)*radius}))];
    raster.fan(fan,points,0xff8844,blockers);
  }
}
test('solid ground echo fills its swept disk without circular-brush holes or half-fan seams',()=>{
  const raster=new StreetPigmentRaster(242,242,null,1,brush);
  sweep(raster,true);
  let inside=0,covered=0;
  for(let y=0;y<121;y++)for(let x=0;x<121;x++)if(Math.hypot(x*2+1-121,y*2+1-121)<94){
    inside++;if(raster.pixels[(y*121+x)*4+3]===255)covered++;
  }
  assert(covered/inside>.995,`Only ${covered}/${inside} interior pixels covered`);
});
test('solid footprint still excludes buildings and leaves the ordinary authored fan unchanged',()=>{
  const raster=new StreetPigmentRaster(242,242,null,1,brush);
  sweep(raster,true,[{footprint:{x:150,y:100,width:20,height:40}}]);
  assert.equal(raster.pixels[(60*121+80)*4+3],0);
  assert.equal(raster.pixels[(60*121+95)*4+3],0,'No paint behind the wall');
  const ordinary=new StreetPigmentRaster(242,242,null,1,brush);sweep(ordinary,false);
  assert.equal(ordinary.pixels[(60*121+60)*4+3],0);
  assert(ordinary.pixels.some(value=>value>0));
});
