import test from 'node:test';import assert from 'node:assert/strict';
import {nightlineActorBounds,layoutNightlineLabels} from '../src/systems/NightlineLabels384.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {NIGHTLINE_OPENING} from '../src/utils/nightlineOpening.mjs';
import {nightlineBodyMap} from '../src/utils/nightlineBody.mjs';
import {NIGHTLINE_FINALE} from '../src/utils/nightlineFinale.mjs';
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('visible frame bounds account for noncentral origin, flip and scale without using the whole transparent cell',()=>{
 const m={frameWidth:384,frameHeight:320,originX:240/384,originY:304/320,bounds:[[16,133,324,306]]},a={x:188,y:525,scaleX:.28,scaleY:.28,flipX:false};
 const normal=nightlineActorBounds(a,m,0);assert.equal(normal.x,188+(16-240)*.28-5);assert.equal(normal.width,308*.28+10);
 a.flipX=true;const flipped=nightlineActorBounds(a,m,0);assert.equal(flipped.x,188+(384-324-240)*.28-5);assert.equal(flipped.width,normal.width);assert.equal(flipped.y,normal.y);assert.equal(nightlineActorBounds(a,m,99),null);
});
test('all three actor frames at actual station contacts keep labels clear, inside the safe world and mutually separated',()=>{
 for(const map of [NIGHTLINE_OPENING,nightlineBodyMap('canopy'),nightlineBodyMap('freight'),NIGHTLINE_FINALE])for(const id of ['sakura','kai','enjo'])for(const frame of [6,12,14,15,16,17])for(const flipX of [false,true])for(const pos of [...map.stations,{x:188,y:525}]){
  const before=JSON.stringify(map),motion=getUserCastArt(id).motion,actor=nightlineActorBounds({...pos,scaleX:.28,scaleY:.28,flipX},motion,frame),sizes=map.stations.map(()=>({width:110,height:20})),rows=layoutNightlineLabels(map.stations,sizes,actor,map.walls);
  assert.equal(rows.length,map.stations.length);for(const [i,row]of rows.entries()){assert(!overlap(row.rect,actor),`${id}/${frame}/${flipX}/${pos.x},${pos.y}/${row.id}`);assert(row.rect.x>=25&&row.rect.x+row.rect.width<=350);assert(row.rect.y>=170&&row.rect.y+row.rect.height<=525);for(const other of rows.slice(0,i))assert(!overlap(row.rect,other.rect));}assert.equal(JSON.stringify(map),before);
 }
});
test('same snapshot has stable layout and unknown visible frame falls back to station/obstacle constraints',()=>{
 const map=nightlineBodyMap('freight'),sizes=map.stations.map(()=>({width:100,height:20}));assert.deepEqual(layoutNightlineLabels(map.stations,sizes,null,map.walls),layoutNightlineLabels(map.stations,sizes,null,map.walls));
});
