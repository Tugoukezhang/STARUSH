import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura',overrides={},equipmentIds=['wide_nozzle']){
 const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const api=env.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},sound:null,
  _userCastPresentation:true,battleData:{stageId:1,performerId:id,campaignChapterId:'opening'},publicPerformerRun:{runId:'curtain-fixture'}};
 const run={performerId:id,chapterId:'opening',victory:true,durationMs:65000,actions:4,choices:['wide_brush'],recorded:true,persisted:true,reward:{notes:6,equipmentIds}};
 scene._publicRunResult=run;
 const model=api.getPublicResultSurfaceModel({buttons:[{label:'Next',action:'campaign-next'},{label:'Retry',action:'retry'}]},run);
 Object.assign(model,{continuation:{chapterId:'neon',name:'霓虹街口',persisted:true,available:true},earnedEquipment:{id:'wide_nozzle'}},overrides);
 const actions=[],view=new api.BattleSurfaceView(scene,{mode:'result',model,onAction:a=>{actions.push(a);return false;}},env.document);
 return{view,model,actions,api,env,run};
}

test('three cast curtain calls show one chapter heading and no repeated outcome/action stack',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {view,model}=fixture(id),hero=view.root.querySelector('.battle-performance-header'),head=hero.querySelector('h2');
  assert.equal(head.textContent,model.chapter.name);assert.equal(head.getAttribute('aria-label'),model.chapter.name+'：公演完成');
  for(const text of ['演出记录','本场通关',model.member.actionName])assert(!hero.textContent.includes(text));
  assert.equal(hero.querySelector('.battle-visual-copy').textContent,model.member.name);
  const portrait=hero.querySelector('.result-hero-portrait'),ratio=Number(portrait.style['--portrait-head']);
  assert.equal(portrait.src,'art/cast-encounters-20261125/'+id+'-victory.webp');
  assert.equal(portrait.width,512);assert.equal(portrait.height,512);
  assert(ratio>.28&&ratio<.34,'half-body reaction anchor: '+id);view.destroy();
  const defeat=fixture(id,{victory:false}).view,other=defeat.root.querySelector('.result-hero-portrait');
  assert.equal(other.src,'art/cast-encounters-20261125/'+id+'-defeat.webp');
  assert.notEqual(other.style['--portrait-face-y'],portrait.style['--portrait-face-y']);
  defeat.destroy();
 }
});

test('compact reward icons and quantities remain visible; new equipment inspect is not buried',()=>{
 const {view,api,actions}=fixture(),root=view.root,reward=root.querySelector('.battle-result-reward'),summary=reward.querySelector('.battle-result-reward-summary'),details=reward.querySelector('.battle-result-reward-details');
 assert(summary.textContent.includes('练习笔记 +6'));assert(summary.textContent.includes('扩幅导流器'));
 assert.equal(summary.querySelectorAll('img').length,2);assert(summary.querySelector('[data-reward-id=wide_nozzle]').querySelector('img').src.endsWith('/wide_nozzle.png'));
 assert.equal(details.open,undefined);assert(details.querySelector('.battle-earned-equipment'));
 const inspect=root.querySelector('[data-result-action=earned-equipment]'),prepare=root.querySelector('[data-result-action=preparation]');
 assert.equal(inspect.parentNode,summary);assert(api.getBattleFocusable(root).includes(inspect));assert(!api.getBattleFocusable(root).includes(prepare));
 inspect.click();assert.deepEqual(actions,['earned-equipment']);details.open=true;assert(api.getBattleFocusable(root).includes(prepare));view.destroy();
});

test('two different first-clear rewards fit in place without counting the run twice',()=>{
 const ids=['wide_nozzle','travelling_nozzle'];
 const {view,env,run}=fixture('sakura',{},ids);env.seed(['opening']);
 const handoff=env.loadRuntime('utils/publicSessionContent.mjs').getEarnedEquipmentHandoff;
 const read=()=>env.profile.loadPublicProfile(),before=read();
 view.options.onAction=(action,id)=>{
  assert.equal(action,'earned-equipment');
  return view.inspectEarnedItem(handoff(run,read(),id));
 };
 const next=view.root.querySelector('[data-result-action=campaign-next]');
 for(const id of ids){
  const trigger=view.root.querySelector('[data-reward-id='+id+']');trigger.click();
  const preview=view.root.querySelector('#result-reward-fitting');
  assert.equal(preview.querySelector('img').src,trigger.querySelector('img').src);
  const equip=preview.querySelector('[data-action=equip-reward]');equip.click();
  assert.equal(equip.disabled,true);assert.equal(read().preparation.equipmentByPerformer.sakura,id);
  preview.querySelector('[data-action=close-reward]').click();
  assert.equal(view.root.querySelector('#result-reward-fitting'),null);assert.equal(trigger.getAttribute('aria-expanded'),'false');
 }
 assert.equal(view.root.querySelector('[data-result-action=campaign-next]'),next);assert.equal(next.disabled,false);
 assert.deepEqual(read().recordedRunIds,before.recordedRunIds);assert.equal(read().clears,before.clears);view.destroy();
});

test('one next-station command names its destination and retains all three persistence states',()=>{
 for(const [persisted,available,state]of [[true,true,'ready'],[false,false,'pending'],[true,false,'blocked']]){
  const {view}=fixture('sakura',{persisted,continuation:{chapterId:'neon',name:'霓虹街口',persisted,available}});
  const button=view.root.querySelector('[data-result-action=campaign-next]');assert.equal(button.textContent,'下一站 · 霓虹街口');
  assert.equal(button.disabled,!available);assert.equal(view.root.querySelector('.battle-result-continuation'),null);
  assert.equal(button.getAttribute('aria-describedby'),view.resultContinuation.id);assert.equal(view.resultContinuation.dataset.continuationState,state);view.destroy();
 }
});

test('unsaved warning and retry precede stats; rejection never loses status or command',()=>{
 const {view}=fixture('kai',{persisted:false,continuation:{chapterId:'neon',name:'霓虹街口',persisted:false,available:false}});
 assert.equal(view.content.children[1],view.resultStatus);assert.equal(view.content.children[2].dataset.resultAction,'retry-save-result');
 view.rejectResultSave();assert.equal(view.resultStatus.dataset.saveState,'pending');
 view.rejectNextChapter({retryable:false});assert.equal(view.resultStatus.dataset.saveState,'blocked');assert.equal(view.resultContinuation.dataset.continuationState,'blocked');
 assert(view.root.querySelector('[data-result-action=campaign-next]').disabled);view.destroy();
});

test('defeat names the chapter but visibly states the loss; no victory art or story',()=>{
 const {view}=fixture('enjo',{victory:false,continuation:null,buttons:[{label:'Retry',action:'retry'}]});
 assert.equal(view.root.querySelector('h2').textContent,'星光初演');assert.equal(view.root.querySelector('.battle-eyebrow').textContent,'本场未完成');
 assert.equal(view.root.querySelector('.result-hero-title-art'),null);assert.equal(view.root.querySelector('[data-action=result-story]'),null);view.destroy();
});

test('outro disclosure toggles real chapter lines without issuing a navigation command',()=>{
 const {view,actions}=fixture(),toggle=view.root.querySelector('[data-action=result-story]'),story=view.root.querySelector('#battle-result-story');
 assert(story.hidden);toggle.click();assert(!story.hidden);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert(story.textContent.length>30);
 toggle.click();assert(story.hidden);assert.deepEqual(actions,[]);view.destroy();
});

test('title load failure remains explicit and preserves the visible victory outcome',()=>{
 const {view}=fixture();view.root.querySelector('.result-hero-title-art').dispatchEvent({type:'error'});
 assert.equal(view.root.querySelector('.battle-performance-header').dataset.titleState,'unavailable');
 assert(view.root.querySelector('.result-art-error'));assert.equal(view.root.querySelector('.battle-eyebrow').textContent,'公演完成');view.destroy();
});

test('unsaved retry or leave requires an explicit loss decision; cancelling retains the result',()=>{
 for(const action of ['retry','campaign-tour','preparation']){
  const {view,actions}=fixture('sakura',{persisted:false,buttons:[{label:'Leave',action}]});
  view.root.querySelector('[data-result-action='+action+']').click();
  assert.deepEqual(actions,[]);const panel=view.root.querySelector('.battle-result-leave-confirm');assert(panel);
  const keep=panel.querySelector('[data-action=result-keep]');assert.equal(view.doc.activeElement,keep);
  keep.click();assert.equal(view.root.querySelector('.battle-result-leave-confirm'),null);assert.deepEqual(actions,[]);
  view.root.querySelector('[data-result-action='+action+']').click();
  view.root.querySelector('[data-action=result-discard]').click();assert.deepEqual(actions,[action]);view.destroy();
 }
});
