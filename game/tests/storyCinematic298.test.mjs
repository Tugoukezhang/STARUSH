import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function setup(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const scene={battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},_isPublicStage1Round:()=>true,_setBattlePaused(v){this._battlePaused=v;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},sound:{},_battleEnded:false,oldStreet:{storyReady:()=>true}};
 const {PlayerSessionExperience}=e.loadRuntime('systems/PlayerSessionExperience.mjs');
 const ui=new PlayerSessionExperience(scene,true);ui.showStory('opening','intro');
 return {e,ui,click:a=>ui.root.querySelector(`[data-action=${a}]`).click()};
}
test('history contains only encountered lines, resumes and resets with the reader',()=>{
 const {e,ui,click}=setup();
 try{
  assert.equal(ui.root.querySelector('.story-transcript'),null);
  click('story-history');let rows=ui.root.querySelector('.story-history-lines').children;
  assert.equal(rows.length,1);assert.equal(ui.root.querySelector('.story-history').hidden,false);
  click('story-history-close');click('story-next');
  const speaker=ui.root.querySelector('.performance-story-speaker').textContent;
  click('story-history');
  assert.equal(ui.root.querySelector('.story-history-lines').children[1].querySelector('strong').textContent,speaker);
  assert.equal(ui.root.querySelector('.story-history-lines').children.length,2);
  click('story-history-close');click('story-close');ui.showStory('opening','intro');click('story-history');
  assert.equal(ui.root.querySelector('.story-history-lines').children.length,2);
  click('story-restart');assert.equal(ui.root.dataset.storyLine,'0');click('story-history');
  assert.equal(ui.root.querySelector('.story-history-lines').children.length,1);
  assert.equal(e.loadRuntime('utils/playerPreferences.mjs').playerPreferences.read().storyProgress[0].read,false);
 }finally{ui.destroy();}
});
test('auto pauses on history, manual advance, hidden document and storage failure',()=>{
 const {e,ui,click}=setup();
 try{
  click('story-auto');assert.equal(ui.root.dataset.storyAuto,'true');
  click('story-history');assert.equal(ui.root.dataset.storyAuto,'false');click('story-history-close');
  click('story-auto');click('story-next');assert.equal(ui.root.dataset.storyAuto,'false');
  click('story-auto');e.document.hidden=true;e.document.dispatchEvent({type:'visibilitychange'});assert.equal(ui.root.dataset.storyAuto,'false');
  e.document.hidden=false;e.document.dispatchEvent({type:'visibilitychange'});assert.equal(ui.root.dataset.storyAuto,'false');
  click('story-auto');e.storage.setItem=()=>{throw Error('quota');};click('story-next');assert.equal(ui.root.dataset.storyAuto,'false');assert.equal(ui.root.dataset.storySaved,'false');
 }finally{ui.destroy();}
});
test('history traps navigation keys locally and stale controls cannot reopen it',()=>{
 const {ui,click}=setup();
 try{
  click('story-history');const old=ui.root.querySelector('[data-action=story-history]');
  const history=ui.root.querySelector('.story-history');history.dispatchEvent({type:'keydown',key:'Escape',bubbles:true});
  assert.equal(history.hidden,true);assert.equal(ui.root.dataset.storyLine,'0');
  ui.showSettings();old.click();assert.equal(ui.root.dataset.mode,'settings');
 }finally{ui.destroy();}
});
test('menu narration uses the selected actor, while spoken dialogue uses the speaker',()=>{
 for(const actor of ['enjo','kai']){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(actor);
  const {PlayerSessionExperience}=e.loadRuntime('systems/PlayerSessionExperience.mjs');
  const ui=new PlayerSessionExperience({input:{keyboard:{resetKeys(){}},resetPointers(){}},sound:{}});
  try{ui.showStory('opening','intro');assert.equal(ui.root.dataset.performer,actor);ui.root.querySelector('[data-action=story-next]').click();assert.equal(ui.root.dataset.performer,'sakura');}finally{ui.destroy();}
 }
});
