import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('pause keeps resume outside the scrollable secondary context with existing callbacks',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const {BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs');let calls=[];
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},_sessionExperience:{isBlocking:()=>false},publicPerformerRun:{getAttemptProgress:()=>({phase:'first',rows:['首站进行中'],next:'继续完成本站'}),getBuildSnapshot:()=>({preparationLabel:'阶位 1',rows:[{label:'涂染',value:'+0'}],roleNote:'重锤',tactic:'近身'})}};
 const view=new BattleSurfaceView(scene,{mode:'pause',onResume:()=>calls.push('resume'),onSettings:()=>calls.push('settings'),onRetry(){},onLeave(){}},e.document);
 const body=view.root.querySelector('.battle-pause-scroll');assert(body,'secondary context needs an independent scroll area');
 const resume=view.root.querySelector('[data-pause-action=resume]');assert(!body.contains(resume));assert.equal(resume.parentNode,view.content);
 assert(body.contains(view.root.querySelector('[data-pause-action=settings]')));assert(body.contains(view.root.querySelector('[data-attempt-progress]')));assert(body.contains(view.root.querySelector('.battle-build-summary')));
 assert.equal(e.document.activeElement,resume);body.querySelector('[data-pause-action=settings]').click();resume.click();assert.deepEqual(calls,['settings','resume']);view.destroy();assert.equal(scene.input.enabled,true);
});

test('current cast separates configuration from run choices and starts the selected route',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell;v.showPage('preflight');
 const tools=h.query('.ui-preflight-tools'),plans=h.query('.ui-preflight-plans');
 assert.equal(tools.getAttribute('aria-label'),'演出配置');
 assert.equal(plans.getAttribute('aria-label'),'本场选择');
 assert.deepEqual(tools.querySelectorAll('button').map(button=>button.dataset.action),['preflight-member','preflight-equipment','preflight-training']);
 assert.deepEqual(plans.querySelectorAll('button').map(button=>button.dataset.action),['preflight-route','preflight-arrangement','preflight-goals']);
 for(const [action,page] of [['preflight-equipment','inventory'],['preflight-goals','goals']]){
  const button=h.query('[data-action='+action+']');button.focus();button.click();assert.equal(v.page,page);
  v.backPage();assert.equal(v.page,'preflight');assert.equal(e.document.activeElement,h.query('[data-action='+action+']'));
 }
 h.click('[data-action=preflight-route]');h.click('[data-route-choice=east]');h.click('[data-action=start]');
 assert.equal(h.starts.at(-1)[1].publicRoutePlan.id,'east');h.shutdown();
});

test('legacy preparation keeps existing route-free presentation',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(false);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');assert.equal(h.query('.preflight-tools'),null);assert.equal(h.all('[data-action=preflight-training]').length,1);h.shutdown();
});
