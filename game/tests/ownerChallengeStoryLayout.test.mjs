import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function setup(page='finaleTrial',earned=true,current=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(current);if(earned)e.seed(['opening','neon','encore']);const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();return {e,h,v:h.scene._publicShell};}
const raw=e=>e.storage.getItem('starush.public-profile');
function session(earned=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);if(earned)e.seed(['opening','neon','encore']);const Session=e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience,s={battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},_isPublicStage1Round:()=>true,_setBattlePaused(v){this._battlePaused=v;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},sound:{},_battlePaused:true};const ui=new Session(s,true);return {e,s,ui};}

test('challenge scope applies to exactly three current pages and never previous modules or legacy',()=>{
 for(const key of ['goals','finaleTrial','rehearsal','desk','inventory','records','library']){const {h}=setup(key);assert.equal(h.root.dataset.challengePreparation,String(['goals','finaleTrial','rehearsal'].includes(key)));h.shutdown();}
 const {h}=setup('goals',false,false);assert.equal(h.root.dataset.challengePreparation,'false');h.shutdown();
});
test('trial keeps all four original options in two stages with a persistent footer command',()=>{
 const {e,h}=setup(),before=raw(e),stages=h.query('.challenge-stages');assert(stages);assert.equal(stages.querySelectorAll('[data-trial-choice]').length,4);assert.equal(stages.querySelectorAll('.arrangement-pool').length,2);assert.equal(h.query('[data-action=trial-start]').parentNode.className,'shell-selection-footer challenge-command-footer');
 assert.match(h.text,/生命跨站继承/);assert.match(h.text,/退出或刷新/);assert.equal(raw(e),before);h.shutdown();
});
test('all four trial pairs and three members retain original handoff and no profile writes',()=>{
 for(const id of ['sakura','kai','enjo'])for(const first of ['wide_brush','tempo'])for(const second of ['echo','overdrive']){const {e,h}=setup();e.profile.selectPublicPerformer(id);h.scene._publicShell.render();const before=raw(e);h.click('[data-trial-choice='+first+']');h.click('[data-trial-choice='+second+']');h.click('[data-action=trial-start]');const [scene,d]=h.starts.at(-1);assert.equal(scene,'BattleScene');assert.equal(d.performerId,id);assert.deepEqual(plain(d.publicFinaleTrial.choices),[first,second]);assert.equal(raw(e),before);h.shutdown();}
});
test('all four rehearsal pairs reach the original BattleScene for each current member',()=>{
 for(const id of ['sakura','kai','enjo'])for(const first of ['wide_brush','tempo'])for(const second of ['echo','overdrive']){const {e,h}=setup('rehearsal');e.profile.selectPublicPerformer(id);h.scene._publicShell.render();const before=raw(e);h.click('[data-rehearsal-chapter=neon]');h.click('[data-rehearsal-focus=action]');h.click('[data-rehearsal-choice='+first+']');h.click('[data-rehearsal-choice='+second+']');h.click('[data-action=rehearsal-start]');const [scene,d]=h.starts.at(-1);assert.equal(scene,'BattleScene');assert.equal(d.performerId,id);assert.deepEqual(plain(d.publicFinaleTrial.choices),[first,second]);assert.deepEqual(plain(d.publicFinaleTrial.rehearsal),{chapterId:'neon',focus:'action'});assert.equal(raw(e),before);h.shutdown();}
});
test('rehearsal course and both original stages precede the expandable map and descriptions',()=>{
 const {e,h}=setup('rehearsal'),before=raw(e),main=h.query('.shell-content'),focus=h.query('.rehearsal-focus'),stages=h.query('.challenge-stages'),guide=h.query('.challenge-guide');assert(stages&&guide);assert(guide.querySelector('.rehearsal-map'));assert(main.children.indexOf(focus)<main.children.indexOf(stages));assert(main.children.indexOf(stages)<main.children.indexOf(guide));assert.equal(stages.querySelectorAll('[data-rehearsal-choice]').length,4);assert.equal(h.query('[data-action=rehearsal-start]').disabled,false);assert.equal(raw(e),before);h.shutdown();
});
test('compact choices retain accessible descriptions and real non-reward boundaries',()=>{
 for(const page of ['finaleTrial','rehearsal']){const {h}=setup(page),attr=page==='finaleTrial'?'data-trial-choice':'data-rehearsal-choice';const choice=h.query('['+attr+'=tempo]');assert.match(choice.getAttribute('aria-label'),/节拍蓄能.+1.5/);assert.match(h.query('.challenge-guide').textContent,/事件.*1.5/);assert.match(h.text,/不改.*通关|不改变通关/);h.shutdown();}
});
test('goal draft is distinguished from confirmed goal and stays transient',()=>{
 const {e,h}=setup('goals'),api=e.loadRuntime('utils/publicRunGoals.mjs'),before=raw(e);h.click('[data-goal=standard]');assert(h.query('.challenge-selection'));assert.match(h.query('.challenge-selection').textContent,/预选.*标准演出/);assert.equal(api.capturePublicRunGoal(e.profile.loadPublicProfile()),null);assert.equal(raw(e),before);h.click('[data-action=confirm-goal]');assert.equal(h.root.dataset.page,'preflight');assert.equal(raw(e),before);h.shutdown();
});
test('fresh trial/rehearsal gates stay closed and opening journal does not leak future story',()=>{
 for(const page of ['finaleTrial','rehearsal']){const {e,h}=setup(page,false),before=raw(e);if(page==='finaleTrial')assert.equal(h.query('[data-action=trial-start]'),null);else assert(h.query('[data-action=rehearsal-start]').disabled);assert.equal(raw(e),before);h.shutdown();}
 const {e,ui}=session(false),before=raw(e);ui.showStoryJournal();assert.equal(ui.root.querySelectorAll('[data-story-id]').length,1);assert.equal(raw(e),before);ui.destroy();
});
test('reading starts at its heading and directory returns to the original story without releasing pause',()=>{
 const {e,s,ui}=session(),before=raw(e);ui.showStoryJournal();assert.equal(e.document.activeElement.id,'player-session-heading');const source=ui.root.querySelector('[data-story-id="encore:ending"]')||ui.root.querySelectorAll('[data-story-id]').at(-1),id=source.dataset.storyId;source.click();assert.equal(ui.root.dataset.mode,'story');assert.equal(e.document.activeElement.id,'player-session-heading');ui.root.querySelector('[data-action=story-directory]').click();assert.equal(ui.root.dataset.mode,'story-journal');assert.equal(e.document.activeElement.dataset.storyId,id);assert.equal(s._battlePaused,true);assert.equal(raw(e),before);ui.close();assert.equal(s._battlePaused,true);ui.destroy();
});
test('reading scope leaves settings and mandatory briefing contracts untouched',()=>{
 const {e,ui}=session();ui.showStoryJournal();assert.equal(ui.root.dataset.reading,'true');ui.showSettings();assert.equal(ui.root.dataset.reading,'false');ui.showBriefing(true);assert.equal(ui.root.dataset.mode,'first-briefing');assert.equal(e.document.activeElement.id,'player-session-heading');ui.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root.dataset.mode,'first-briefing');ui.destroy();
});
test('a reading chain opened while running restores the original running and input state',()=>{
 const {e,s,ui}=session(),before=raw(e);s._battlePaused=false;ui.showStoryJournal();assert.equal(s._battlePaused,true);ui.root.querySelector('[data-story-id="opening:intro"]').click();ui.root.querySelector('[data-action=story-directory]').click();ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root,null);assert.equal(s._battlePaused,false);assert.equal(s.input.enabled,true);assert.equal(raw(e),before);ui.destroy();
});
test('first briefing to intro and back cannot bypass readiness using Escape',()=>{
 const {e,s,ui}=session(),before=raw(e);s._battlePaused=false;ui.showBriefing(true);ui.root.querySelector('[data-action=entry-story]').click();assert.equal(ui.root.dataset.mode,'story');ui.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root.dataset.mode,'story');assert.equal(s._battlePaused,true);ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root.dataset.mode,'first-briefing');assert.equal(s._battlePaused,true);ui.root.querySelector('[data-action=entry-ready]').click();assert.equal(ui.root.dataset.performanceStory,'true');ui.root.querySelector('[data-action=story-close]').click();assert.equal(ui.root,null);assert.equal(s._battlePaused,false);assert.equal(raw(e),before);ui.destroy();
});
test('formal stylesheet has dedicated challenge and reading scopes rather than changing old page rules',()=>{
 const css=readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');assert.match(css,/\[data-challenge-preparation=true\]/);assert.match(css,/#player-session-dialog\[data-reading=true\]/);
});
