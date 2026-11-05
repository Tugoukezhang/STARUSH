import test from 'node:test';import assert from 'node:assert/strict';import {loadScenes} from './helpers/publicShellHarness.mjs';
function fixture(){
 const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);const api=env.loadRuntime('systems/BattleSurfaceView.mjs'),actions=[];
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null,_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura'}};
 const model=api.getPublicResultSurfaceModel({buttons:[{label:'Next',action:'campaign-next'}]},{performerId:'sakura',chapterId:'opening',victory:true,durationMs:65000,actions:4,choices:[],recorded:true,persisted:false});
 const view=new api.BattleSurfaceView(scene,{mode:'result',model,onAction:id=>{actions.push(id);}},env.document),button=view.root.querySelector('[data-result-action=campaign-next]');
 const event=(type,fields={},target=button)=>target.dispatchEvent({type,bubbles:true,pointerId:1,isPrimary:true,button:0,clientX:68,clientY:571,detail:type==='click'?1:0,...fields});return{view,actions,button,event};
}
test('result rejects the real52px joystick drag captured on campaign-next, but permits the next deliberate tap',()=>{
 const f=fixture();f.event('pointerdown');for(const type of ['pointermove','pointerup','click'])f.event(type,{clientX:117,clientY:553});assert.deepEqual(f.actions,[]);assert.equal(f.view.busy,false);
 f.event('pointerdown');f.event('pointerup');f.event('click');assert.deepEqual(f.actions,['campaign-next']);f.view.destroy();
});
test('result rejects inherited release, cancelled gesture, secondary pointer, out-and-back and mismatched click',()=>{
 for(const sequence of [
  [['pointerup'],['click']],[['pointerdown'],['pointercancel'],['pointerup'],['click']],
  [['pointerdown'],['pointermove',{clientX:100}],['pointermove'],['pointerup'],['click']],
  [['pointerdown'],['pointerleave'],['pointerup'],['click']],
  [['pointerdown',{isPrimary:false}],['pointerup'],['click']],
  [['pointerdown'],['pointerup'],['click',{pointerId:2}]]
 ]){const f=fixture();for(const [type,fields]of sequence)f.event(type,fields);assert.deepEqual(f.actions,[],JSON.stringify(sequence));f.view.destroy();}
});
test('fresh small-motion nested-icon tap and non-hover touchleave commit once without a timer',()=>{
 const f=fixture();f.event('pointerdown',{},f.button.children[0]);f.event('pointerup',{clientX:74,clientY:575});f.event('pointerleave');f.event('click');f.button.click();assert.deepEqual(f.actions,['campaign-next']);f.view.destroy();
});
test('keyboard and assistive activation remain usable after an abandoned pointer drag and disposal blocks old controls',()=>{
 const f=fixture();f.event('pointerdown');f.event('pointermove',{clientX:117});f.event('click',{detail:0,pointerId:-1});assert.deepEqual(f.actions,['campaign-next']);f.view.destroy();f.button.click();assert.deepEqual(f.actions,['campaign-next']);
});
test('save retry remains immediately repeatable and does not become a terminal transition',()=>{
 const f=fixture(),save=f.view.root.querySelector('[data-result-action=retry-save-result]');save.click();save.click();assert.deepEqual(f.actions,['retry-save-result','retry-save-result']);assert.equal(f.view.busy,false);f.view.destroy();
});
