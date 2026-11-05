import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(){
 const env=loadScenes(),events=new EventEmitter();
 const scene={events,input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},_userCastPresentation:true,battleData:{performerId:'sakura',stageId:1},
  _sessionExperience:{isBlocking:()=>false},sound:null};
 return {env,scene,doc:env.document};
}
test('entry has a dedicated noninteractive channel and leaves input ownership untouched',()=>{
 const {env,scene,doc}=fixture(),{PublicCombatFeedbackView}=env.loadRuntime('systems/PublicCombatFeedbackView.mjs');
 const view=new PublicCombatFeedbackView(scene,doc);view.entry('3',100);
 assert.equal(view.entryNode.textContent,'3');assert.equal(view.entryNode.hidden,false);
 assert.equal(view.root.getAttribute('aria-hidden'),'true');assert.equal(scene.input.enabled,true);
 assert.equal(view.entry('not-a-countdown',150),false);view.update(999);assert.equal(view.entryNode.hidden,false);
 view.update(1000);assert.equal(view.entryNode.hidden,true);view.destroy();
});
test('damage reports only an accepted loss with truthful remaining life and never a heal or duplicate',()=>{
 const {env,scene,doc}=fixture(),{PublicCombatFeedbackView}=env.loadRuntime('systems/PublicCombatFeedbackView.mjs');
 const view=new PublicCombatFeedbackView(scene,doc);
 assert.equal(view.hit(5,5,5,10),false);assert.equal(view.hit(3,4,5,10),false);
 assert.equal(view.hit(5,4,5,10),true);assert.match(view.hitNode.textContent,/-1/);assert.match(view.hitNode.textContent,/4 \/ 5/);
 assert.equal(view.hit(1,0,5,10),false);assert.equal(view.hit(NaN,2,5,10),false);
 view.update(150,{blocked:true});assert.equal(view.hitNode.hidden,true);
 view.update(150,{blocked:false});assert.equal(view.hitNode.hidden,false);
 view.update(1510);assert.equal(view.hitNode.hidden,true);view.destroy();
});
test('independent entry and damage channels expire from supplied run time and shutdown is idempotent',()=>{
 const {env,scene,doc}=fixture(),{PublicCombatFeedbackView}=env.loadRuntime('systems/PublicCombatFeedbackView.mjs');
 const view=new PublicCombatFeedbackView(scene,doc);view.entry('开演',50);view.hit(3,2,5,100);
 assert.equal(view.hitNode.dataset.critical,'true');view.update(200,{blocked:true});
 assert.equal(view.entryNode.hidden,true);view.update(200);assert.equal(view.entryNode.hidden,false);
 scene.events.emit('shutdown');assert.equal(doc.getElementById('combat-feedback'),null);
 assert.equal(scene.events.listenerCount('shutdown'),0);assert.doesNotThrow(()=>{view.update(0);view.entry('3',0);view.hit(5,4,5,0);view.destroy();});
});
test('actual Scene countdown uses the owner channel, not the tactical queue, and legacy stays unchanged',()=>{
 const {env,doc}=fixture(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
 const scene=Object.assign(Object.create(BattleScene.prototype),{_userCastPresentation:true,battleData:{stageId:1},
  _isPublicStage1Round:()=>true,events:new EventEmitter(),time:{now:100},publicPerformerRun:{now:()=>100},
  _showPublicBattleNotice:()=>{throw Error('countdown must not enter tactical queue');}});
 scene._showRoundBanner('3');assert.equal(doc.getElementById('combat-entry').textContent,'3');
 scene._combatFeedback.destroy();scene._combatFeedback=null;scene._userCastPresentation=false;
 let seen;scene._showPublicBattleNotice=label=>seen=label;scene._showRoundBanner('3');assert.equal(seen,'3');
 assert.equal(doc.getElementById('combat-feedback'),null);
});
test('unsaved ordinary results prioritize save status and retain secondary text and all commands',()=>{
 const {env,scene,doc}=fixture(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
 const model=getPublicResultSurfaceModel({descriptionLines:['retained detail'],buttons:[{label:'Retry',action:'retry'}]},
  {performerId:'sakura',chapterId:'opening',victory:false,durationMs:5000,actions:1,choices:[],recorded:true,persisted:false});
 let action;const view=new BattleSurfaceView(scene,{mode:'result',model,onAction:id=>{action=id;return false;}},doc);
 assert.equal(view.root.dataset.combatFlow,'true');
 const children=view.content.children,header=children.findIndex(n=>n.className==='battle-performance-header');
 assert.equal(children[header+1],view.resultStatus);assert.equal(view.resultStatus.dataset.saveState,'pending');
 assert.equal(children[header+2],view.root.querySelector('[data-result-action=retry-save-result]'));
 const detail=view.root.querySelector('.battle-result-details');assert(detail.textContent.includes('retained detail'));
 assert.equal(detail.querySelector('button'),null);assert.notEqual(detail.open,true,'secondary records start collapsed');
 view.root.querySelector('[data-result-action=retry-save-result]').click();assert.equal(action,'retry-save-result');
 view.rejectResultSave();assert.equal(view.resultStatus.dataset.saveState,'pending');view.destroy();
});
test('focus traversal includes summaries but excludes controls inside closed or hidden branches',()=>{
 const {env,doc}=fixture(),{getBattleFocusable}=env.loadRuntime('systems/BattleSurfaceView.mjs');
 const root=doc.createElement('section'),button=doc.createElement('button'),details=doc.createElement('details'),summary=doc.createElement('summary'),inside=doc.createElement('button');
 root.append(button,details);details.append(summary,inside);details.open=false;
 assert.deepEqual(Array.from(getBattleFocusable(root)),[button,summary]);details.open=true;
 assert.deepEqual(Array.from(getBattleFocusable(root)),[button,summary,inside]);details.hidden=true;
 assert.deepEqual(Array.from(getBattleFocusable(root)),[button]);
});
