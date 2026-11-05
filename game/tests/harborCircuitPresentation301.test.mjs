import test from 'node:test';import assert from 'node:assert/strict';
import {HarborCircuitPresentation} from '../src/systems/HarborCircuitPresentation.mjs';
import {HARBOR_STAGE_DEVICES} from '../src/utils/harborStageMap.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {readFileSync} from 'node:fs';
test('circuit mounts only after fixtures and restored gates exist, not during street preview',()=>{
 const battle=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8'),street=readFileSync(new URL('../src/systems/OldStreetScene.mjs',import.meta.url),'utf8');
 const method=battle.slice(battle.indexOf('  _beginPublicPaintRound()'),battle.indexOf('  _beginPublicPaintRound()')+3000);
 assert(method.indexOf('new HarborCircuitPresentation')>method.indexOf('applyPublicBattleCheckpointRound'));
 assert(method.indexOf('applyPublicBattleCheckpointRound')>method.indexOf('this.paintZone.start()'));
 assert(!street.includes('new HarborCircuitPresentation'));
});
function fixture(){
 const nodes=[];const scene={add:{graphics(){const node={ops:[],clears:0,destroyed:false,setDepth(v){this.depth=v;return this;},clear(){this.ops=[];this.clears++;return this;},destroy(){this.destroyed=true;}};
 for(const name of ['lineStyle','beginPath','moveTo','lineTo','strokePath','fillStyle','fillCircle'])node[name]=function(...args){this.ops.push([name,...args]);return this;};nodes.push(node);return node;}}};
 const devices=HARBOR_STAGE_DEVICES.map(d=>({...d,complete:false,publicStage1Suppressed:false})),contract=new ChapterObjectiveContract('homecoming');contract.sync(devices);
 return{nodes,devices,contract,view:new HarborCircuitPresentation(scene)};
}
test('fixed pair of graphics sits below facilities and redraws static wires only on state change',()=>{
 const {view,nodes,devices,contract}=fixture();assert.equal(nodes.length,2);assert(nodes.every(n=>n.depth<1.6&&n.depth>.4));
 view.update(devices,0,0,true);const count=nodes[0].clears;assert(nodes[0].ops.length>0);assert.equal(nodes[1].ops.length,0);
 view.update(devices,0,500,true);assert.equal(nodes[0].clears,count);
 devices[0].complete=true;contract.sync(devices);view.update(devices,0,600,true);assert(nodes[0].clears>count);assert(nodes[1].ops.length>0);
 const before=JSON.stringify(nodes[1].ops);view.update(devices,0,800,true);assert.notEqual(JSON.stringify(nodes[1].ops),before);
});
test('suppression, pause, settlement and destruction do not leak animated current',()=>{
 const {view,nodes,devices,contract}=fixture();devices[0].complete=true;contract.sync(devices);view.update(devices,0,100,true);
 devices[1].publicStage1Suppressed=true;view.update(devices,0,200,true);assert.equal(nodes[1].ops.length,0);
 devices[1].publicStage1Suppressed=false;view.update(devices,0,300,false);assert.equal(nodes[1].ops.length,0);
 view.update(devices,0,400,true);assert(nodes[1].ops.length>0);view.freeze();assert.equal(nodes[1].ops.length,0);
 view.update(devices,0,500,true);assert.equal(nodes[1].ops.length,0);view.destroy();assert(nodes.every(n=>n.destroyed));
});
