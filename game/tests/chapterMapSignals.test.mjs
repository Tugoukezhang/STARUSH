import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopCircuit } from '../src/systems/HarborCircuitPresentation.mjs';
import { getDevicePresentation } from '../src/systems/ChapterScenePresentation.mjs';
import { drawChapterCalibrationDial } from '../src/systems/ChapterCalibrationDial.mjs';
import { ChapterObjectiveContract, NEON_LINKS } from '../src/utils/chapterObjectives.mjs';
import { NEON_STREET_DEVICES } from '../src/utils/neonStreetMap.mjs';
import { getHomecomingCircuitState } from '../src/utils/homecomingCircuit.mjs';

test('the shop cables run between the actual two prerequisite lamps and each real hub',()=>{
  const nodes=NEON_STREET_DEVICES.map(d=>({...d}));
  const scene={add:{graphics:()=>({setDepth(){return this;}})}};
  const contract=new ChapterObjectiveContract('neon');
  const byId=new Map(nodes.map(d=>[d.id,d]));
  const circuit=createShopCircuit(scene,nodes);
  const expected=Object.entries(NEON_LINKS).flatMap(([to,sources])=>sources.map(from=>({from,to})));
  assert.deepEqual(circuit.routes.map(({from,to})=>({from,to})),expected);
  for(const route of circuit.routes){
    const {x,y}=byId.get(route.from),to=byId.get(route.to);
    assert.deepEqual(route.points[0],{x,y});
    assert.deepEqual(route.points.at(-1),{x:to.x,y:to.y});
  }
  const [left,right]=circuit.routes;
  const states=()=>[left,right].map(route=>getHomecomingCircuitState(route,nodes,0));
  contract.sync(nodes);assert.deepEqual(states(),['dormant','dormant']);
  byId.get(left.from).complete=true;contract.sync(nodes);
  assert.deepEqual(states(),['waiting','dormant']);
  byId.get(right.from).complete=true;contract.sync(nodes);
  assert.deepEqual(states(),['ready','ready']);
  assert.equal(getDevicePresentation(byId.get(left.from)).texture,'chapter-sign-headphones');
  assert.equal(getDevicePresentation(byId.get(right.from)).texture,'chapter-sign-cup');
});

test('standing marks share the calibration radius, show earned ticks, and leave when complete',()=>{
  const device={id:'harbor-stage-left',x:200,y:300,chapterCalibrationDurationMs:1000,
    chapterCalibrationRadius:112,chapterAwaitingCalibration:true};
  const marks=[];
  const pen={lineStyle(width,color){this.ink=color;return this;},lineBetween(...points){marks.push({ink:this.ink,points});return this;}};
  drawChapterCalibrationDial(pen,device,'calibrating',.5);
  assert.equal(marks.filter(m=>m.ink===0xffde84).length,6);
  assert.ok(marks.some(({points})=>points[1]===188 && points[3]===188),'north rim matches y-radius');
  marks.length=0;device.complete=true;
  drawChapterCalibrationDial(pen,device,'complete',1);
  assert.ok(marks.every(({points})=>Math.abs(points[1]-device.y)<30));
});
