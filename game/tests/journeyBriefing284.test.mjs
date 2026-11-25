// Integrated location: tests/journeyBriefing284.test.mjs (imports resolve from tests/).
import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

const CHAPTERS=['opening','neon','encore','raincheck','homecoming'],ACTORS=['sakura','kai','enjo'];
const SCENE_ART={opening:'art/chapter-journey-20261101/opening.webp',neon:'art/chapter-journey-20261101/neon.webp',encore:'art/chapter-journey-20261101/encore.webp',raincheck:'art/rooftop-20261103/landmark.webp',homecoming:'art/chapter-journey-20261101/encore.webp'};
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

// Test fixture unlocks prerequisite chapters through the harness seed; this is not earned progression.
function setup(chapter='opening',performerId='sakura',enabled=true){
 const e=loadScenes(),cast=e.loadRuntime('utils/userCast.mjs');cast.configureUserCast(enabled);
 const prerequisites=CHAPTERS.slice(0,CHAPTERS.indexOf(chapter));
 if(prerequisites.length)e.seed(prerequisites,chapter);
 const Session=e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
 const s={battleData:{stageId:1,campaignChapterId:chapter,performerId},_isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,
  _setBattlePaused(v){this._battlePaused=v;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},sound:{},_battleEnded:false};
 const ui=new Session(s,true);s._sessionExperience=ui;
 return {e,s,ui,guide:e.loadRuntime('utils/publicJourneyContent.mjs').getPublicJourneyGuide(chapter,performerId)};
}
const tabsOf=ui=>ui.root.querySelectorAll('[role=tab]');
const panelsOf=ui=>ui.root.querySelectorAll('[data-journey-step]');
const visibleSteps=ui=>panelsOf(ui).filter(panel=>panel.hidden!==true).map(panel=>panel.dataset.journeyStep);
const seen=e=>plain(e.loadRuntime('utils/playerPreferences.mjs').playerPreferences.read());
function assertSelected(ui,index){
 assert.deepEqual(plain(visibleSteps(ui)),[String(index)]);assert.equal(panelsOf(ui).length,3);
 for(const [i,tab]of tabsOf(ui).entries()){
  assert.equal(tab.getAttribute('aria-selected'),String(i===index));
  assert.equal(tab.getAttribute('tabindex'),i===index?'0':'-1');
 }
}
function press(target,key){const event={type:'keydown',key,bubbles:true};target.dispatchEvent(event);return event;}

test('all registered chapters and all 3 actors open one scene, one visible step and an unlocked start',()=>{
 for(const chapter of CHAPTERS)for(const actor of ACTORS){
  const {s,ui,guide}=setup(chapter,actor);ui.showBriefing(true);
  const label=chapter+'/'+actor,root=ui.root;
  assert.equal(root.dataset.journeyConsole,'284',label);assert.equal(root.dataset.mode,'first-briefing',label);assert.equal(s._battlePaused,true,label);
  assert.equal(root.querySelectorAll('.journey-scene-art').length,1,label);assert.equal(root.querySelector('.journey-scene-art').src,SCENE_ART[chapter],label);
  const goal=root.querySelector('.session-goal'),rules=root.querySelector('.journey-rules');
  assert.equal(goal.textContent,guide.goal,label);assert.equal(rules.contains(goal),false,label+': goal stays outside the collapsed rules');
  assert.match(root.querySelector('.session-performer').textContent,new RegExp(guide.member.name),label);
  assert.equal(tabsOf(ui).length,3,label);assertSelected(ui,0);
  for(const [i,panel]of panelsOf(ui).entries()){
   assert.equal(panel.querySelector('h3').textContent,guide.steps[i].title,label);
   assert.equal(panel.querySelector('p').textContent,guide.steps[i].text,label+': full step text is retained');
   assert.equal(panel.querySelector('.journey-step-count').textContent,(i+1)+' / 3',label);
  }
  const footer=root.querySelector('.session-footer');assert.equal(footer.querySelectorAll('button').length,2,label);
  assert.equal(root.querySelector('[data-action=entry-ready]').disabled,false,label+': no step visit is required');
  ui.destroy();
 }
});

test('tabs expose matching role, controls and panel labels',()=>{
 const {ui}=setup();ui.showBriefing(true);
 assert.equal(ui.root.querySelectorAll('[role=tablist]').length,1);
 for(const [i,tab]of tabsOf(ui).entries()){
  const panel=panelsOf(ui)[i];
  assert.equal(tab.tagName,'BUTTON');assert.equal(tab.getAttribute('aria-controls'),panel.id);
  assert.equal(panel.getAttribute('role'),'tabpanel');assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
 }
 ui.destroy();
});

test('clicking a tab changes the visible step and keeps every step in the DOM',()=>{
 const {s,ui}=setup('neon','kai');ui.showBriefing(true);
 for(const index of [2,1,0]){tabsOf(ui)[index].click();assertSelected(ui,index);}
 assert.equal(s._battlePaused,true);assert.equal(ui.root.dataset.mode,'first-briefing');ui.destroy();
});

test('Left, Right, Home and End move selection and focus with wraparound',()=>{
 const {e,ui}=setup();ui.showBriefing(true);
 const expectFocus=(key,index)=>{
  const event=press(e.document.activeElement,key);
  assert.equal(event.defaultPrevented,true,key);assertSelected(ui,index);assert.equal(e.document.activeElement,tabsOf(ui)[index],key);
 };
 tabsOf(ui)[0].focus();
 expectFocus('ArrowRight',1);expectFocus('ArrowRight',2);expectFocus('ArrowRight',0);
 expectFocus('ArrowLeft',2);expectFocus('Home',0);expectFocus('End',2);
 const other=press(tabsOf(ui)[2],'a');assert.notEqual(other.defaultPrevented,true);assertSelected(ui,2);
 ui.destroy();
});

test('collapsed 本场规则 holds the real route, action, targeting and save copy',()=>{
 for(const id of ['west','east'])for(const actor of ACTORS){
  const {e,s,ui,guide}=setup('opening',actor),routes=e.loadRuntime('utils/publicRoutePlan.mjs');
  s.battleData.publicRoutePlan=routes.createPublicRoutePlan(id,s.battleData);
  const review=routes.getPublicRouteReview(s.battleData.publicRoutePlan,s.battleData);assert(review);
  ui.showBriefing(true);
  const rules=ui.root.querySelector('.journey-rules');
  assert.equal(rules.tagName,'DETAILS');assert.notEqual(rules.open,true);
  const summaries=rules.querySelectorAll('summary');assert.equal(summaries.length,1);assert.equal(summaries[0].textContent,'本场规则');
  assert.equal(rules.querySelector('.session-route').textContent,review.title+' · '+review.text+'\n'+review.finale);
  assert.equal(rules.querySelector('.session-member').textContent,guide.action);
  assert.equal(rules.querySelector('.session-targeting').textContent,guide.targeting);
  assert.match(rules.querySelector('.session-save-note').textContent,/自动暂存.*存储失败.*最近暂存/);
  ui.destroy();
 }
 const {ui}=setup();ui.showBriefing(true);
 assert.equal(ui.root.querySelector('.session-route'),null,'No invented route without a real plan');
 assert(ui.root.querySelector('.journey-rules').querySelector('.session-targeting'));ui.destroy();
});

test('story return keeps first-briefing mode, pause and input, and marks nothing seen',()=>{
 const {e,s,ui}=setup();ui.showBriefing(true);
 const profile=e.storage.getItem('starush.public-profile');
 ui.root.querySelector('[data-action=entry-story]').click();
 assert.equal(ui.root.dataset.mode,'story');assert.equal(ui.root.dataset.journeyConsole,undefined,'Story must not inherit the entry skin');
 assert.equal(s._battlePaused,true);assert.equal(s.input.enabled,false);assert.equal(s.input.keyboard.enabled,false);
 ui.root.querySelector('[data-action=story-close]').click();
 assert.equal(ui.root.dataset.mode,'first-briefing');assert.equal(ui.root.dataset.journeyConsole,'284');assertSelected(ui,0);
 assert.equal(s._battlePaused,true);assert.equal(s.input.enabled,false);assert.equal(s.input.keyboard.enabled,false);
 assert.deepEqual(seen(e).seenChapters,[]);assert.deepEqual(seen(e).seenStoryIntros,[]);
 assert.equal(e.storage.getItem('starush.public-profile'),profile);
 ui.destroy();
});

test('entry-ready plays the intro, then completes the chapter intro and releases the pause',()=>{
 for(const chapter of ['opening','raincheck']){
  const {e,s,ui}=setup(chapter);ui.showBriefing(true);
  ui.root.querySelector('[data-action=entry-ready]').click();
  assert.equal(ui.root.dataset.mode,'story',chapter);assert.equal(ui.root.dataset.performanceStory,'true',chapter);assert.equal(ui.root.dataset.journeyConsole,undefined,chapter);assert.equal(s._battlePaused,true,chapter);
  assert.deepEqual(seen(e).seenChapters,[],chapter);
  ui.root.querySelector('[data-action=story-close]').click();
  assert.equal(ui.root,null,chapter);assert.equal(s._battlePaused,false,chapter);
  assert.deepEqual(seen(e).seenChapters,[chapter]);assert.deepEqual(seen(e).seenStoryIntros,[chapter]);
  ui.destroy();
 }
});

test('rules mode returns from story to rules and from rules to settings without releasing a borrowed pause',()=>{
 const {e,s,ui}=setup('encore','enjo');s._battlePaused=true;ui.showSettings();
 assert.equal(ui.root.dataset.journeyConsole,undefined);
 ui.root.querySelector('[data-action=settings-rules]').click();
 assert.equal(ui.root.dataset.mode,'rules');assert.equal(ui.root.dataset.journeyConsole,'284');
 ui.root.querySelector('[data-action=entry-story]').click();ui.root.querySelector('[data-action=story-close]').click();
 assert.equal(ui.root.dataset.mode,'rules');assert.equal(s._battlePaused,true);
 ui.root.querySelector('[data-action=entry-ready]').click();
 assert.equal(ui.root.dataset.mode,'settings');assert.equal(ui.root.dataset.journeyConsole,undefined);assert.equal(s._battlePaused,true);
 assert.deepEqual(seen(e).seenChapters,[]);
 ui.close();assert.equal(s._battlePaused,true);ui.destroy();
});

test('terminal copy is 本轮巡演 and no chapter promises a three-stop tour',()=>{
 for(const chapter of CHAPTERS){
  const {ui}=setup(chapter);ui.showBriefing(true);
  const note=ui.root.querySelector('.session-save-note').textContent;
  assert.match(note,chapter==='homecoming'?/通关后完成本轮巡演/:/通关后解锁下一站/,chapter);
  assert.doesNotMatch(ui.root.textContent,/三站/,chapter);ui.destroy();
 }
});

test('the legacy cast briefing does not receive the console skin',()=>{
 const {ui}=setup('opening','sakura',false);ui.showBriefing(true);
 assert.equal(ui.root.dataset.journeyConsole,undefined);assert.equal(ui.root.querySelector('.journey-ticket'),null);ui.destroy();
});

// The harness rejects comma selectors, so Tab wrapping itself needs a real-browser check. This only gates the patch.
test('open() carries the required dataset reset and focus trap patch',()=>{
 const code=source('../src/systems/PlayerSessionExperience.mjs');
 assert.match(code,/delete this\.root\.dataset\.journeyConsole/);
 assert.match(code,/querySelectorAll\('button, input, summary'\)/);
 assert.match(code,/getAttribute\('tabindex'\)!=='-1'/);
});

test('stylesheet stays scoped and uses only original shipped art',()=>{
 const css=source('../src/styles/journeyBriefing284.css').replace(/\/\*[\s\S]*?\*\//g,'').trim();
 assert(css.startsWith("#game-container #player-session-dialog[data-journey-console='284'][data-reading-family=true]{"));
 let depth=0;for(const [i,char]of [...css].entries()){if(char==='{')depth++;if(char==='}'){depth--;if(depth===0)assert.equal(i,css.length-1,'Rule escapes the scoped block');}}
 assert.equal(depth,0);
 assert.doesNotMatch(css,/gradient|<svg|data:image/);
 assert.deepEqual([...css.matchAll(/url\('([^']+)'\)/g)].map(m=>m[1]).sort(),['/art/preflight-console-20261103/choice.webp','/art/thin-ui-20261101/primary.webp']);
 for(const [,size]of css.matchAll(/font-size:(\d+)px/g))assert(Number(size)>=14&&Number(size)<=18,'font-size '+size);
 for(const [,radius]of css.matchAll(/border-radius:([^;}]+)/g))assert.equal(radius,'0');
 const payload=source('../scripts/runtime-payload.mjs');
 for(const file of [...Object.values(SCENE_ART),'art/preflight-console-20261103/choice.webp','art/thin-ui-20261101/primary.webp']){
  assert(existsSync(new URL('../public/'+file,import.meta.url)),file);
  const parts=file.split('/'),name=parts.pop();
  assert(payload.includes("'"+parts.join('/')+"/'")&&payload.includes("'"+name+"'"),file+' must be in the release payload');
 }
});
