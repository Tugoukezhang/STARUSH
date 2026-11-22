import test from 'node:test';import assert from 'node:assert/strict';
import {HarborCircuitPresentation} from '../src/systems/HarborCircuitPresentation.mjs';
import {HARBOR_STAGE_DEVICES} from '../src/utils/harborStageMap.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {playerPreferences} from '../src/utils/playerPreferences.mjs';
function fixture(){const nodes=[];const scene={add:{graphics(){const g={ops:[],clears:0,destroyed:0,setDepth(){return this},clear(){this.ops=[];this.clears++;return this},destroy(){this.destroyed++}};for(const name of['lineStyle','beginPath','moveTo','lineTo','strokePath'])g[name]=function(...args){this.ops.push([name,...args]);return this};nodes.push(g);return g}}};const ds=HARBOR_STAGE_DEVICES.map(d=>({...d,complete:false})),contract=new ChapterObjectiveContract('homecoming');ds[0].complete=true;contract.sync(ds);return{nodes,ds,contract,view:new HarborCircuitPresentation(scene)}}
test('low decorative current is static and bounded, while native preference changes restore normal movement',()=>{
 const old=playerPreferences.value.reducedEffects;try{playerPreferences.value.reducedEffects=true;const{nodes,ds,view}=fixture(),before=JSON.stringify(ds);view.update(ds,0,0,true);assert(nodes[1].ops.length>0&&nodes[1].ops.length<15);const clears=nodes[1].clears,first=JSON.stringify(nodes[1].ops);for(let i=0;i<300;i++)view.update(ds,0,i*16,true);assert.equal(nodes[1].clears,clears);assert.equal(JSON.stringify(nodes[1].ops),first);assert.equal(JSON.stringify(ds),before);
 playerPreferences.value.reducedEffects=false;view.update(ds,0,100,true);const normal=JSON.stringify(nodes[1].ops);view.update(ds,0,200,true);assert.notEqual(JSON.stringify(nodes[1].ops),normal);
 view.motionPreference={matches:true};view.update(ds,0,300,true);const reduced=JSON.stringify(nodes[1].ops);view.update(ds,0,600,true);assert.equal(JSON.stringify(nodes[1].ops),reduced);
 }finally{playerPreferences.value.reducedEffects=old;}
});
test('suppression and pause remove static readiness; resume restores it; frozen/destroyed views never redraw',()=>{
 const{nodes,ds,view}=fixture();view.motionPreference={matches:true};view.update(ds,0,0,true);assert(nodes[1].ops.length);ds[1].publicStage1Suppressed=true;view.update(ds,0,100,true);assert.equal(nodes[1].ops.length,0);ds[1].publicStage1Suppressed=false;view.update(ds,0,200,false);assert.equal(nodes[1].ops.length,0);view.update(ds,0,300,true);assert(nodes[1].ops.length);view.freeze();view.update(ds,0,400,true);assert.equal(nodes[1].ops.length,0);view.destroy();view.destroy();const clears=nodes[1].clears;view.update(ds,0,500,true);assert.equal(nodes[1].clears,clears);assert(nodes.every(n=>n.destroyed===1));
});
