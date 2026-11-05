import test from 'node:test';import assert from 'node:assert/strict';
import {HOMECOMING_CIRCUIT_ROUTES as routes} from '../src/utils/homecomingCircuit.mjs';
test('different dependency states never overpaint the same cable span',()=>{
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){
  const a=routes[i].points,b=routes[j].points;
  for(let x=1;x<a.length;x++)for(let y=1;y<b.length;y++){
   const p=a[x-1],q=a[x],r=b[y-1],s=b[y];
   for(const axis of ['x','y']){const other=axis==='x'?'y':'x';
    if(p[axis]===q[axis]&&r[axis]===s[axis]&&p[axis]===r[axis]){
     const overlap=Math.min(Math.max(p[other],q[other]),Math.max(r[other],s[other]))-Math.max(Math.min(p[other],q[other]),Math.min(r[other],s[other]));
     assert(overlap<=0,`${routes[i].id} overlaps ${routes[j].id} by ${overlap}`);
    }
   }
  }
 }
});
