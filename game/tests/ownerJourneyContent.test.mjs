import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function setup(chapter='opening',cleared=[]){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);if(cleared.length)e.seed(cleared);
 const Session=e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
 const s={battleData:{stageId:1,campaignChapterId:chapter,performerId:'sakura'},_isPublicStage1Round:()=>true,
  _setBattlePaused(v){this._battlePaused=v;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},oldStreet:{config:{chapterId:chapter},storyReady:()=>true},sound:{},_battleEnded:false};
 const ui=new Session(s,true);s._sessionExperience=ui;return {e,s,ui};
}
test('entry is concise, optional intro returns to the same borrowed pause and does not mark seen',()=>{
 const {e,s,ui}=setup();ui.showBriefing(true);
 assert.equal(ui.root.querySelector('.story-passage'),null,'Full story must not precede the first goal');
 const story=ui.root.querySelector('[data-action=entry-story]');assert(story,'Missing optional story command');
 assert.equal(ui.root.querySelectorAll('[data-journey-step]').length,3);assert.equal(s._battlePaused,true);
 const before=e.storage.getItem('starush.public-profile');story.click();assert(ui.root.querySelector('.story-passage'));assert.equal(s.input.enabled,false);
 ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root.dataset.mode,'first-briefing');assert.equal(s._battlePaused,true);
 assert.deepEqual(plain(e.loadRuntime('utils/playerPreferences.mjs').playerPreferences.read().seenChapters),[]);
 assert.equal(e.storage.getItem('starush.public-profile'),before);
 ui.root.querySelector('[data-action=entry-ready]').click();assert.equal(ui.root.dataset.performanceStory,'true');assert.equal(s._battlePaused,true);ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root,null);assert.equal(s._battlePaused,false);
 assert.deepEqual(plain(e.loadRuntime('utils/playerPreferences.mjs').playerPreferences.read().seenChapters),['opening']);ui.destroy();
});
test('guides cover all current chapter/member pairs with strict input and actual grammar',()=>{
 const {e}=setup(),api=e.loadRuntime('utils/publicJourneyContent.mjs');assert.equal(typeof api.getPublicJourneyGuide,'function');
 for(const chapter of ['opening','neon','encore'])for(const id of ['sakura','kai','enjo']){
  const g=api.getPublicJourneyGuide(chapter,id);assert.equal(g.chapterId,chapter);assert.equal(g.steps.length,3);assert.equal(g.member.id,id);assert(g.goal&&g.retry);assert(g.action.includes(g.member.actionName));
 }
 assert.equal(api.getPublicJourneyGuide('unknown','sakura'),null);assert.equal(api.getPublicJourneyGuide('opening','venus'),null);
 assert.match(api.getPublicJourneyGuide('opening','kai').action,/受伤/);
 assert.match(api.getPublicJourneyGuide('encore','enjo').steps.map(s=>s.text).join(''),/校准/);
});
test('journal shows chapter gates without leaking locked dialogue; directory preserves pause',()=>{
 const {e,s,ui}=setup('opening');ui.showStoryJournal();
 assert.equal(ui.root.querySelectorAll('[data-journal-chapter]').length,4);
 assert.equal(ui.root.querySelectorAll('[data-story-id]').length,1);assert.match(ui.root.textContent,/尚未开放|通关后/);
 assert.doesNotMatch(ui.root.textContent,/三张节目单被风吹/);
 ui.root.querySelector('[data-story-id="opening:intro"]').click();assert(ui.root.querySelector('[data-action=story-directory]'));
 ui.root.querySelector('[data-action=story-directory]').click();assert.equal(ui.root.dataset.mode,'story-journal');assert.equal(s._battlePaused,true);
 ui.close();ui.destroy();
});
test('settings journal can return to settings without releasing an existing battle pause',()=>{
 const {s,ui}=setup();s._battlePaused=true;ui.showSettings();ui.root.querySelector('[data-action=settings-journal]').click();
 ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root.dataset.mode,'settings');assert.equal(s._battlePaused,true);
 ui.close();assert.equal(s._battlePaused,true);ui.destroy();
});
test('only current-cast cleared same-chapter public replay skips automatic midpoint',()=>{
 const {e,s,ui}=setup('opening',['opening']);assert.equal(typeof ui.shouldSkipLiveStory,'function');assert(ui.shouldSkipLiveStory('opening'));
 assert.equal(ui.shouldSkipLiveStory('neon'),false);assert(ui.showStory('opening','midpoint'),'Explicit review remains readable');
 ui.close();s.battleData.practiceMode=true;s._isPublicStage1Round=()=>false;assert.equal(ui.shouldSkipLiveStory('opening'),false);
 s._isPublicStage1Round=()=>true;s.battleData.practiceMode=false;e.loadRuntime('utils/userCast.mjs').configureUserCast(false);assert.equal(ui.shouldSkipLiveStory('opening'),false);ui.destroy();
 const fresh=setup();assert.equal(fresh.ui.shouldSkipLiveStory('opening'),false);fresh.ui.destroy();
});
test('result narrative never promotes pending or failed outcomes to next chapter',()=>{
 const {e}=setup(),api=e.loadRuntime('utils/publicJourneyContent.mjs');assert.equal(typeof api.getPublicJourneyResult,'function');
 const r={performerId:'sakura',chapterId:'opening',victory:true,recorded:true,persisted:true};
 assert.match(api.getPublicJourneyResult(r).next,/霓虹/);
 for(const patch of [{persisted:false},{recorded:false}]){const review=api.getPublicJourneyResult({...r,...patch});assert.doesNotMatch(review.next,/已解锁/);assert.match(review.next,/保存|记录/);}
 const lost=api.getPublicJourneyResult({...r,victory:false});assert.match(lost.next,/重新|再演/);assert.doesNotMatch(lost.text,/干扰退去/);
 assert.match(api.getPublicJourneyResult({...r,chapterId:'encore'}).next,/雨后返场/);assert.equal(api.getPublicJourneyResult({...r,performerId:'unknown'}),null);
 const {getPublicResultSurfaceModel,BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs'),model=getPublicResultSurfaceModel({buttons:[]},{...r,durationMs:10000,choices:[],actions:0});
 assert(model.journeyReview);const h=e.harness(e.TitleScene),v=new BattleSurfaceView(h.scene,{mode:'result',model,onAction(){}},e.document);assert(v.root.querySelector('[data-journey-result]'));v.destroy();h.shutdown();
});
test('actual street sync skips cleared replay modal but still offers a first witnessed midpoint',()=>{
 for(const cleared of [[],['opening']]){
  const {e,s,ui}=setup('opening',cleared),Street=e.loadRuntime('systems/OldStreetScene.mjs').OldStreetScene;
  Object.assign(s.player,{x:480,y:1400});
  const street=Object.assign(Object.create(Street.prototype),{scene:s,config:{chapterId:'opening'},items:new Map(),storyOffered:false,
   disposed:false,storyReady:()=>true,nearestInteraction:()=>null});
  Street.prototype.sync.call(street);assert.equal(street.storyOffered,true);
  assert.equal(Boolean(ui.root),cleared.length===0);if(ui.root)assert.equal(ui.root.dataset.mode,'story');
  ui.destroy();
 }
});
