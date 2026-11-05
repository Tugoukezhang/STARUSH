import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
// B247 UI contract for the rifle-only first-segment choice. Domain numbers/copy come from publicRunGoals/publicBuildContent.
const RIFLE='art/battle-controls-20261031/rifle.webp';
const ART={wide_brush:'art/formal-ui-20261016/nozzle.webp',relay:'art/formal-ui-20261016/relay.webp',tempo:'art/formal-ui-20261016/tempo.webp',
 echo:'art/formal-ui-20261016/echo.webp',overdrive:'art/formal-ui-20261016/overdrive.webp',recovery:'art/formal-ui-20261016/recovery.webp',fanfire:'art/choice-studio-20261104/fanfire.webp'};
function battle({id='sakura',number=1,choices=[],plannedChoice,owner=true,reject=false}={}){
 const e=loadScenes(),create=e.document.createElement.bind(e.document);
 e.document.createElement=(...args)=>{const n=create(...args),query=n.querySelector.bind(n);n.querySelector=s=>s==='.battle-visual-copy span'?query('.battle-visual-copy')?.querySelector('span'):query(s);return n;};
 const cast=e.loadRuntime('utils/userCast.mjs');cast.configureUserCast(owner);
 const {BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs'),content=e.loadRuntime('utils/publicBuildContent.mjs'),goals=e.loadRuntime('utils/publicRunGoals.mjs');
 const catalog=goals.getArrangementCatalog(id),options=number===1?catalog.first:catalog.second,build=content.getPublicBuildModel(null,id,choices),picked=[];
 const scene={battleData:{campaignChapterId:'opening'},publicPerformerRun:{getBuildSnapshot:()=>build},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null};
 const view=new BattleSurfaceView(scene,{mode:'choice',member:cast.getDisplayPerformer(id),number,choices,plannedChoice,options,onChoice:pick=>{picked.push(pick);return reject?false:undefined;},onLeave:()=>picked.push('leave')},e.document);
 return {e,scene,view,picked,build,content,options};
}

test('rifle first checkpoint renders four real native commands with an honest four-option group label',()=>{
 const f=battle(),rows=[...f.view.root.querySelectorAll('[data-choice]')];
 assert.deepEqual(rows.map(row=>row.dataset.choice),['wide_brush','relay','tempo','fanfire']);
 assert(rows.every(row=>row.tagName==='BUTTON'&&row.type==='button'));
 assert.equal(f.view.root.querySelector('.battle-choice-list').getAttribute('aria-label'),'本场编排 1：四选一');
 f.view.destroy();assert.equal(f.scene.input.enabled,true);assert.equal(f.scene.input.keyboard.enabled,true);
});

test('other roles and the second rifle segment keep their original three options',()=>{
 for(const [id,number,choices]of [['kai',1,[]],['enjo',1,[]],['sakura',2,['fanfire']],['sakura',2,['relay']]]){
  const f=battle({id,number,choices}),ids=[...f.view.root.querySelectorAll('[data-choice]')].map(row=>row.dataset.choice);
  assert.deepEqual(ids,number===1?['wide_brush','relay','tempo']:['echo','overdrive','recovery'],id+number);
  assert.equal(f.view.root.querySelector('.battle-choice-list').getAttribute('aria-label'),`本场编排 ${number}：三选一`);f.view.destroy();
 }
});

test('every owner-family choice uses reviewed AI raster art, never a code-drawn SVG pictogram',()=>{
 for(const [number,choices]of [[1,[]],[2,['fanfire']]]){
  const f=battle({number,choices});
  for(const row of f.view.root.querySelectorAll('[data-choice]')){
   const symbol=row.querySelector('.battle-choice-symbol'),img=symbol.querySelector('img.battle-choice-art');
   assert.equal(symbol.getAttribute('aria-hidden'),'true');assert.equal(symbol.querySelector('svg'),null,row.dataset.choice);
   assert(img,row.dataset.choice);assert.equal(img.src,ART[row.dataset.choice]);assert.equal(img.alt,'');assert.equal(img.draggable,false);
   assert.equal(img.width,img.height,'square source is not stretched');assert.equal(img.width,row.dataset.choice==='fanfire'?256:160);
  }
  f.view.destroy();
 }
 const legacy=battle({owner:false,id:'kai'});assert.equal(legacy.view.root.dataset.choiceFamily,'false');assert.equal(legacy.view.root.querySelectorAll('.battle-choice-art').length,3);legacy.view.destroy();
});

test('fanfire row shows the authoritative live consequence, distinct category and terminal selected state',()=>{
 const f=battle({plannedChoice:'fanfire'}),row=f.view.root.querySelector('[data-choice=fanfire]'),option=f.content.getPublicBuildOption(f.build,'fanfire');
 assert(option,'getPublicBuildOption must support fanfire for sakura');
 assert(row.querySelector('strong').textContent.startsWith('分轨齐射'));
 assert.equal(row.querySelector('.battle-choice-delta').textContent,option.delta);assert.equal(row.querySelector('.battle-choice-limit').textContent,option.detail);
 const categories=[...f.view.root.querySelectorAll('.battle-choice-category')].map(node=>node.textContent);assert.equal(new Set(categories).size,4);
 assert.match(row.getAttribute('aria-label'),/^分轨齐射。/);assert(row.getAttribute('aria-label').includes(option.delta));assert(row.getAttribute('aria-label').endsWith('本场方案预选'));
 assert.equal(row.dataset.plannedChoice,'true');
 const before=plain(f.e.profile.loadPublicProfile());row.click();assert.deepEqual(f.picked,[]);f.view.root.querySelector('[data-action=confirm-choice]').click();f.view.root.querySelector('[data-choice=relay]').click();
 assert.deepEqual(f.picked,['fanfire']);assert.equal(row.dataset.chosen,'true');assert.equal(f.view.root.querySelector('[data-choice=relay]').dataset.chosen,undefined);
 assert.equal(row.getAttribute('aria-pressed'),'true','selection is held while the terminal command is busy');
 assert.deepEqual(plain(f.e.profile.loadPublicProfile()),before);f.view.destroy();
});

test('a rejected onChoice leaves no stale selected state and allows another real choice',()=>{
 const f=battle({reject:true}),tempo=f.view.root.querySelector('[data-choice=tempo]');tempo.click();f.view.root.querySelector('[data-action=confirm-choice]').click();
 assert.equal(tempo.dataset.chosen,undefined);
 f.view.root.querySelector('[data-choice=fanfire]').click();f.view.root.querySelector('[data-action=confirm-choice]').click();assert.deepEqual(f.picked,['tempo','fanfire']);f.view.destroy();
});

test('fanfire copy explains one lane to three, 60/20/20 split, unchanged cadence and no wall bypass',()=>{
 const f=battle(),text=f.view.root.querySelector('[data-choice=fanfire]').textContent;
 for(const fact of [/3/,/60/,/20/,/射速|间隔|频率/,/墙|遮挡/])assert.match(text,fact);
 assert.doesNotMatch(text,/3\s*倍|三倍|更快通关/);f.view.destroy();
});

test('battle preload includes the fanfire raster alongside the six choice images',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {preloadPublicBattleUi}=e.loadRuntime('systems/BattleSurfaceView.mjs'),paths=[];
 const scene={load:{image:(key,path)=>paths.push(path),spritesheet(){}},textures:{exists:()=>false}};
 preloadPublicBattleUi(scene,{stageId:1,performerId:'sakura'});for(const path of Object.values(ART))assert(paths.includes(path),path);
});

test('choice stylesheet frames raster art without stretching and keeps four rows scrollable above the footer',()=>{
 const css=fs.readFileSync(new URL('../src/styles/performanceChoicesV2.css',import.meta.url),'utf8'),scope='#game-container #run-choice.battle-surface[data-choice-family=true][data-choice-reading=true]';
 const rule=selector=>{const start=css.indexOf(scope+' '+selector+' {');assert(start>=0,selector);return css.slice(start,css.indexOf('}',start));};
 assert.match(rule('.battle-choice-art'),/object-fit:contain/);assert.match(rule('.battle-choice-row:nth-child(4)'),/animation-delay/);
 assert.match(rule('.battle-choice-row[data-chosen=true]'),/border-color/);assert.match(rule('.battle-surface-content'),/overflow-y:auto/);assert.match(rule('.battle-surface-footer'),/flex:none/);
 assert(!css.includes('gradient('));
});

function shell(selected='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(selected);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'library'});h.scene.create();return {e,h,v:h.scene._publicShell};
}
const switchMember=(h,id)=>{h.scene._publicShell.showPage('roster');h.click('[data-action=actor-switch]');h.click(`[data-member=${id}]`);h.click('[data-action=confirm-member]');h.scene._publicShell.showPage('library');};

test('rifle library requests the rifle catalog, shows fanfire art and a rifle-only echo study',()=>{
 const {e,h}=shell('sakura'),raw=e.storage.getItem('starush.public-profile');
 assert.deepEqual([...h.all('[data-arrangement]')].map(b=>b.dataset.arrangement),['wide_brush','relay','tempo','fanfire','echo','overdrive','recovery']);
 assert.equal(h.query('[data-arrangement=fanfire]').querySelector('img').src,RIFLE);
 h.click('[data-arrangement-study=fanfire-echo]');
 assert.equal(h.query('[data-arrangement=fanfire]').getAttribute('aria-pressed'),'true');assert.equal(h.query('[data-arrangement=echo]').getAttribute('aria-pressed'),'true');
 assert.match(h.query('.library-preview').textContent,/分轨齐射/);
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});

test('non-rifle library and hub never show fanfire or its study and keep the old nine pairs',()=>{
 const {h,v}=shell('kai');
 assert.equal(h.query('[data-arrangement=fanfire]'),null);assert.equal(h.query('[data-arrangement-study=fanfire-echo]'),null);
 h.shutdown();
});

test('play hub library entry counts the selected member real pairs',()=>{
 for(const [id,count]of [['kai',9],['enjo',9],['sakura',12]]){
  const {e,h,v}=shell(id),{renderPlayHub}=e.loadRuntime('systems/GameSystemScreens.mjs'),main=e.document.createElement('main');
  renderPlayHub(v,main,e.model());const entry=main.querySelector('[data-action=hub-library]');assert(entry,id);assert.match(entry.textContent,new RegExp(count+' 种'));h.shutdown();
 }
});

test('switching role makes a local fanfire draft explicitly invalid; no substitution, no save until valid',()=>{
 const {e,h,v}=shell('sakura');
 h.click('[data-arrangement=fanfire]');h.click('[data-action=plan-use]');
 assert.deepEqual(plain(v.arrangementPlan.choices),['fanfire','echo']);
 v.showPage('library');h.click('[data-arrangement=wide_brush]');assert.deepEqual(plain(v.arrangementPlan.choices),['fanfire','echo'],'local draft never rewrites the saved plan');
 h.click('[data-arrangement=fanfire]');
 switchMember(h,'kai');
 assert.equal(v.arrangementFirst,'fanfire','draft is not silently converted');
 const notice=h.query('[data-arrangement-invalid]');assert(notice,'invalid draft notice');assert.equal(notice.getAttribute('role'),'status');assert.match(notice.textContent,/分轨齐射/);
 assert.equal([...h.all('[data-arrangement]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.arrangement).join(),'echo');
 assert.equal(h.query('[data-library-stage=first]').querySelector('strong').textContent,'需重选');
 const use=h.query('[data-action=plan-use]');assert.equal(use.disabled,true);use.click();assert.equal(v.arrangementPlan,null);
 h.click('[data-arrangement=relay]');assert.equal(h.query('[data-arrangement-invalid]'),null);assert.equal(h.query('[data-action=plan-use]').disabled,false);
 h.click('[data-action=plan-use]');assert.deepEqual(plain(v.arrangementPlan.choices),['relay','echo']);assert.equal(v.arrangementPlan.performerId,'kai');
 void e;h.shutdown();
});
