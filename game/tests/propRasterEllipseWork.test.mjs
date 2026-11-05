import test from 'node:test';
import assert from 'node:assert/strict';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
const image=n=>({data:new Uint8ClampedArray(n*4).fill(255)});
const make=(w,h)=>new PropRestorationRaster(w,h,image(w*h),image(w*h));

test('brush ellipse interiors do not compute a square root per pixel',()=>{
 const r=make(127,89),hypot=Math.hypot;let roots=0,samples=0;
 Math.hypot=(...a)=>{roots++;return hypot(...a);};
 try{assert(r.paint(63.27,44.31,61.21,42.19,false,{sample(){samples++;return .5;}}));}
 finally{Math.hypot=hypot;}
 assert(samples>7000);
 assert(roots<=4,'ellipse brush performed '+roots+' square roots');
});

test('brush inclusion and exact UV coordinates retain hypot semantics at fractional edges and near the unit circle',()=>{
 const samples=[];
 for(const [x,y,rx,ry] of [[3.37,2.19,3.71,2.83],[.5,.5,1,1],[.5,.5,Math.SQRT2,Math.SQRT2],[.5,.5,Math.SQRT2*(1+Number.EPSILON),Math.SQRT2],[.5,.5,Math.SQRT2*(1-Number.EPSILON),Math.SQRT2],[1e-200,.5,1e-200,1]]){
  const r=make(8,7),calls=[],expected=[];
  r.paint(x,y,rx,ry,false,{sample(u,v){calls.push([u,v]);return .4;}});
  for(let py=Math.max(0,Math.floor(y-ry));py<=Math.min(6,Math.ceil(y+ry));py++)
   for(let px=Math.max(0,Math.floor(x-rx));px<=Math.min(7,Math.ceil(x+rx));px++)
    if(Math.hypot((px+.5-x)/rx,(py+.5-y)/ry)<1)expected.push([.5+(px+.5-x)/(2*rx),.5+(py+.5-y)/(2*ry)]);
  const order=(a,b)=>a[1]-b[1]||a[0]-b[0];
  assert.deepEqual(calls.sort(order),expected.sort(order));samples.push(calls.length);
 }
 assert(samples.some(n=>n>10));
});
