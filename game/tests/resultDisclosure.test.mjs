import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura',victory=true,flags={}) {
  const env=loadScenes(),doc=env.document;
  env.loadRuntime('utils/userCast.mjs').configureUserCast(!flags.legacy);
  const api=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
    player:{body:{setVelocity(){}}},_userCastPresentation:true,battleData:{performerId:id,stageId:1,...flags},sound:null};
  if(flags.trial)scene._isFinaleTrialRound=()=>true;
  if(flags.legacy)scene._userCastPresentation=false;
  const model=api.getPublicResultSurfaceModel({descriptionLines:['retained retrospective'],buttons:[{label:'Retry',action:'retry'}]},
    {performerId:id,chapterId:'opening',victory,durationMs:65000,actions:4,choices:['wide_brush','echo'],recorded:true,persisted:false});
  Object.assign(model,{build:{performerId:id,preparationLabel:'rank 1',rows:[{label:'paint',value:'+40'}],roleNote:'role',tactic:'tactic'},
    attemptReview:{phase:'finished',rows:['10/10'],next:'attempt review'},
    reward:{notes:4,equipment:[]},goalOutcome:{status:'met',label:'goal',actualLabel:'goal detail'},goalHandoff:{},
    arrangementReview:{matched:2,selected:2,rows:[]}});
  const actions=[];
  const view=new api.BattleSurfaceView(scene,{mode:'result',model,onAction:id=>{actions.push(id);return false;}},doc);
  return {env,doc,scene,model,actions,view,...api};
}

test('owner result retains outcome/save/reward first and groups ALL retrospective content together',()=>{
  const f=fixture(),{view}=f,detail=view.root.querySelector('.battle-result-details');
  for(const selector of ['[data-attempt-progress]','.battle-build-summary','.battle-run-goal','[data-result-action=goals]',
    '[data-arrangement-review]']) {
    const node=view.root.querySelector(selector);assert(node,selector);assert.equal(node.parentNode,detail,selector+' belongs to review');
  }
  // B248: the real chapter outro is its own first-level section, not generic review content.
  const storySection=view.root.querySelector('.battle-result-story-section');assert.equal(storySection.parentNode,view.content);
  for(const selector of ['[data-action=result-story]','#battle-result-story'])assert.equal(view.root.querySelector(selector).parentNode,storySection,selector);
  assert.equal(detail.querySelector('details'),null,'one disclosure level, build becomes an ordinary section');
  assert.equal(detail.querySelector('.battle-build-summary').tagName,'SECTION');
  assert.equal(view.root.querySelector('.battle-result-reward').parentNode,view.content);
  assert.equal(view.root.querySelector('.battle-result-stats').parentNode,view.content);
  assert.equal(view.resultStatus.parentNode,view.content);
  const retry=view.root.querySelector('[data-result-action=retry-save-result]');assert.equal(retry.parentNode,view.content);
  const children=view.content.children,index=children.indexOf(view.root.querySelector('.battle-performance-header'));
  assert.equal(children[index+1],view.resultStatus);assert.equal(children[index+2],retry);
  assert.equal(view.root.querySelectorAll('#battle-result-story').length,1);view.destroy();
});

test('closed review hides retrospective commands from focus; the story toggle stays directly reachable and paired',()=>{
  const f=fixture(),{view,getBattleFocusable}=f,detail=view.root.querySelector('.battle-result-details');
  const story=view.root.querySelector('[data-action=result-story]'),ending=view.root.querySelector('#battle-result-story');
  const goals=view.root.querySelector('[data-result-action=goals]');
  assert.equal(getBattleFocusable(view.root).includes(goals),false);
  assert.equal(getBattleFocusable(view.root).includes(story),true);
  assert.equal(getBattleFocusable(view.root).includes(detail.querySelector('summary')),true);
  detail.open=true;assert.equal(getBattleFocusable(view.root).includes(goals),true);
  story.click();assert.equal(ending.hidden,false);assert.equal(story.getAttribute('aria-expanded'),'true');
  assert.equal(ending.parentNode,story.parentNode);assert(!detail.contains(ending));story.click();assert.equal(ending.hidden,true);
  detail.open=false;assert.equal(getBattleFocusable(view.root).includes(goals),false);view.destroy();
});

test('failed chapter exposes actual progress and next attempt guidance without opening review',()=>{
  const {view}=fixture('sakura',false);
  const progress=view.root.querySelector('[data-attempt-progress]');
  assert(progress.parentNode===view.content,'unfinished objectives are not retrospective-only information');
  assert(progress.className.includes('battle-result-attempt'));
  assert(progress.textContent.includes('10/10'));
  assert(progress.textContent.includes('attempt review'));
  assert.equal(view.root.querySelectorAll('[data-attempt-progress]').length,1);
  view.destroy();
});

test('save retry stays visible and reusable while review is closed, errors do not open it',()=>{
  const {view,actions}=fixture(),detail=view.root.querySelector('.battle-result-details');
  const retry=view.root.querySelector('[data-result-action=retry-save-result]');
  retry.click();view.rejectResultSave();retry.click();assert.deepEqual(actions,['retry-save-result','retry-save-result']);
  assert.notEqual(detail.open,true);assert.equal(view.resultStatus.dataset.saveState,'pending');view.destroy();
});

test('saved result keeps stats first; only unsaved results prioritize warning and retry before stats',()=>{
  const {view,model,scene,doc,BattleSurfaceView}=fixture();view.destroy();model.persisted=true;
  const saved=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},doc);
  const children=saved.content.children,index=children.indexOf(saved.root.querySelector('.battle-result-stats'));
  assert.equal(children[index+1],saved.resultStatus);assert.equal(saved.root.querySelector('[data-result-action=retry-save-result]'),null);saved.destroy();
});

for(const id of ['sakura','kai','enjo'])test(id+' victory and defeat retain all existing content/actions without duplicate nodes',()=>{
  for(const victory of [true,false]){
    const {view,actions,model}=fixture(id,victory),detail=view.root.querySelector('.battle-result-details');
    assert.equal(view.root.dataset.combatFlow,'true');assert(detail.textContent.includes('retained retrospective'));
    assert.equal(view.root.querySelector('h2').textContent,model.chapter.name);
    assert.equal(view.root.querySelector('h2').getAttribute('aria-label'),model.chapter.name+'：'+(victory?'公演完成':'本场未完成'));
    assert.equal(view.root.querySelectorAll('[data-result-action=retry]').length,1);
    assert.equal(view.root.querySelectorAll('[data-result-action=preparation]').length,1);
    assert.equal(view.root.querySelector('[data-result-action=preparation]').parentNode,view.root.querySelector('.battle-result-reward-details'));
    assert.equal(view.root.querySelector('.battle-visual-copy').querySelector('strong').textContent,model.member.name);
    detail.open=true;view.root.querySelector('[data-result-action=goals]').click();assert.deepEqual(actions,['goals']);
    view.destroy();assert.equal(view.scene.input.enabled,true);assert.equal(view.scene.events.listenerCount('shutdown'),0);
  }
});

test('legacy, practice, defense and trial results keep existing non-combat-flow build disclosure',()=>{
  for(const flags of [{legacy:true},{practiceMode:true},{defenseMode:true},{trial:true}]){
    const {view}=fixture('sakura',true,flags);assert.equal(view.root.dataset.combatFlow,undefined);
    assert.equal(view.root.querySelector('.battle-result-details'),null);
    assert.equal(view.root.querySelector('.battle-build-summary').tagName,'DETAILS');view.destroy();
  }
});

test('unrecorded warning remains above stats without manufacturing a save retry',()=>{
  const f=fixture();f.view.destroy();f.model.persisted=false;f.model.recorded=false;
  const view=new f.BattleSurfaceView(f.scene,{mode:'result',model:f.model,onAction(){}},f.doc);
  assert.equal(view.resultStatus.dataset.saveState,'unrecorded');assert.equal(view.content.children[1],view.resultStatus);
  assert.equal(view.root.querySelector('[data-result-action=retry-save-result]'),null);view.destroy();
});

test('all review text and actions survive grouping exactly once compared with legacy rendering',()=>{
  const f=fixture();f.view.destroy();
  Object.assign(f.model,{routeReview:{id:'west',title:'route',text:'route text',finale:'route finale'},
    choiceReview:[{id:'echo',label:'choice',text:'choice effect'}],modificationReview:{name:'modification',releases:2},
    journeyReview:{title:'journey',text:'journey text',next:'journey next'},encounterReview:{id:'event',label:'event',text:'event text'},
    sideSetReview:{label:'side',text:'side text'},climaxLine:'climax',
    finaleReview:{resolved:3,contacts:1,uncontacted:2,beats:[{index:0,label:'finale',description:'finale detail'}]},
    performanceComparison:{firstRecord:true},earnedEquipment:{equipmentId:'wide_nozzle'}});
  f.model.build.modification={id:'travelling_nozzle'};
  const view=new f.BattleSurfaceView(f.scene,{mode:'result',model:f.model,onAction(){}},f.doc);
  const detail=view.root.querySelector('.battle-result-details');
  for(const value of ['route text','choice effect','modification','journey text','event text','side text','climax','finale detail','建立个人成绩']){
    assert(detail.textContent.includes(value),value);
  }
  const leaves=root=>root.querySelectorAll('*').filter(n=>n.children.length===0).map(n=>n.tagName+':'+n.textContent).sort();
  const commands=root=>root.querySelectorAll('button').map(n=>n.dataset.action||n.dataset.resultAction).sort();
  const beforeCommands=commands(view.root),beforeLeaves=leaves(view.root);view.destroy();
  f.scene._userCastPresentation=false;
  const legacy=new f.BattleSurfaceView(f.scene,{mode:'result',model:f.model,onAction(){}},f.doc);
  assert.deepEqual(commands(legacy.root),beforeCommands);
  // Flattening changes only the build heading tag and adds the single review summary. B248: the chapter stage
  // swaps image sources (owned portrait/venue instead of Q art), drops the hidden duplicate identity line and labels the outro section.
  const identityLeaf='DIV:'+f.model.member.name+' · '+f.model.member.actionName;
  const presentationLeaves=new Set(['SUMMARY:演出明细','SUMMARY:收获详情','P:ST☆RUSH · 演出记录','H2:本场通关','H2:'+f.model.chapter.name,'P:'+f.model.chapter.name,'SPAN:'+f.model.member.actionName]);
  const normalize=xs=>xs.filter(x=>!presentationLeaves.has(x)&&!x.startsWith('IMG:')&&x!==identityLeaf&&!x.startsWith('P:本站尾声 · '))
    .map(x=>x.startsWith('SUMMARY:本场配置')?x.replace('SUMMARY:','H3:'):x).sort();
  assert.deepEqual(normalize(leaves(legacy.root)),normalize(beforeLeaves));legacy.destroy();
});
