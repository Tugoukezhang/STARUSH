import test from 'node:test';import assert from 'node:assert/strict';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
const image=(n,r,alpha=255)=>({data:Uint8ClampedArray.from({length:n*4},(_,i)=>i%4===3?alpha:r+i%4*10)});

test('transparent source pixels never invoke the pure paint brush',()=>{
 const neutral=image(64,10,0),color=image(64,110),r=new PropRestorationRaster(8,8,neutral,color);let samples=0;
 const before=neutral.data.slice();assert.equal(r.paint(4,4,8,8,false,{sample(){samples++;return 1;}}),false);
 assert.equal(samples,0);assert.deepEqual(neutral.data,before);assert.equal(r.takeDirty(),null);
});

test('fully covered pixels cannot gain weight and do not resample the brush',()=>{
 const neutral=image(64,10),color=image(64,110),r=new PropRestorationRaster(8,8,neutral,color);let samples=0;
 r.restoreCoverage(new Uint8Array(64).fill(255));r.takeDirty();const before=neutral.data.slice();
 assert.equal(r.paint(4,4,8,8,false,{sample(){samples++;return .5;}}),false);
 assert.equal(samples,0);assert.deepEqual(neutral.data,before);assert.equal(r.takeDirty(),null);
});

test('only mutable opaque pixels sample while exact RGB alpha coverage and dirty bounds remain unchanged',()=>{
 const neutral=image(64,10),color=image(64,110),coverage=new Uint8Array(64);
 for(let p=0;p<64;p++){if(p%4===0)neutral.data[p*4+3]=0;if(p%4===1)color.data[p*4+3]=0;if(p%4===2)coverage[p]=255;}
 const alpha=neutral.data.filter((_,i)=>i%4===3),r=new PropRestorationRaster(8,8,neutral,color);r.restoreCoverage(coverage);r.takeDirty();let samples=0;
 assert(r.paint(4,4,8,8,false,{sample(){samples++;return .5;}}));assert.equal(samples,16);
 for(let p=0;p<64;p++){assert.equal(r.coverage[p],p%4===2?255:p%4===3?128:0);for(let c=0;c<3;c++)assert.equal(neutral.data[p*4+c],(p%4===2?110:p%4===3?60:10)+c*10);}
 assert.deepEqual(neutral.data.filter((_,i)=>i%4===3),alpha);assert.deepEqual(r.takeDirty(),{x:3,y:0,width:5,height:8});
});

test('brush coordinates retain original division order for fractional and clipped column strokes',()=>{
 for(const column of [false,true]){
  const neutral=image(35,10),color=image(35,110),r=new PropRestorationRaster(7,5,neutral,color),calls=[];
  const x=2.37,y=1.19,rx=3.71,ry=2.83;
  assert(r.paint(x,y,rx,ry,column,{sample(u,v){calls.push([u,v]);return .51;}}));
  const expected=[];
  for(let py=0;py<5;py++)for(let px=0;px<7;px++){
   if(px>Math.ceil(x+rx)||py>Math.ceil(y+ry))continue;
   const d=column?Math.abs((px+.5-x)/rx):Math.hypot((px+.5-x)/rx,(py+.5-y)/ry);
   if(d<1)expected.push([.5+(px+.5-x)/(2*rx),.5+(py+.5-y)/(2*ry)]);
  }
  // Contact-first ellipses change visitation order, not the exact sampled coordinates.
  if(!column){const order=(a,b)=>a[1]-b[1]||a[0]-b[0];calls.sort(order);expected.sort(order);}
  assert.deepEqual(calls,expected);r.destroy();
 }
});
