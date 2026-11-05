import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const pages=['playhub','library','growth','records','chapterArchive','finaleTrial','rehearsal'];
const setup=(owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);return e;};
const api=e=>fs.existsSync(new URL('../src/systems/SystemScreenFrame.mjs',import.meta.url))?e.loadRuntime('systems/SystemScreenFrame.mjs'):{};
function open(e,page){const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();return h;}

test('seven registered consumers mount one real shared frame without adding entries, changing root routes or writing a profile',()=>{
 const e=setup();for(const page of pages){const before=e.storage.getItem('starush.public-profile'),h=open(e,page),frame=h.query('.system-screen-frame');assert(frame,page);assert.equal(h.root.dataset.systemScreen,'true');assert.equal(frame.dataset.page,page);assert.equal(frame.dataset.member,'sakura');assert.equal(h.all('.system-screen-frame').length,1);assert.equal(h.query('.shell-navigation').querySelectorAll('[data-nav]').length,5);assert.equal(e.storage.getItem('starush.public-profile'),before);if(page==='playhub')assert.equal(h.all('.system-entry').length,11);h.shutdown();}
});

test('frame model is immutable, uses canonical page ownership and existing chapter/member assets, not invented modules',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.getSystemScreenFrameModel,'function');const h=open(e,'playhub'),m=e.loadRuntime('systems/PublicShellView.mjs').getPublicShellModel(),route=e.loadRuntime('utils/publicShellNavigation.mjs').getPublicShellRoute;
 for(const page of pages){const r=a.getSystemScreenFrameModel(page,m,{rehearsalChapterId:'opening'});assert(Object.isFrozen(r));assert.equal(r.id,page);assert.equal(r.moduleId,route(page).moduleId);assert.equal(r.title,route(page).title);assert.equal(r.memberId,m.member.id);assert.equal(r.chapterId,m.chapter.id);assert.equal(r.progressLabel,'已通关 0 / 3');assert(r.venueSrc.startsWith('art/'));assert(r.avatarSrc.startsWith('art/'));}
 for(const page of ['desk','tour','inventory','workshop','venue','recruit','toString','__proto__',null])assert.equal(a.getSystemScreenFrameModel(page,m),null);h.shutdown();
});

test('growth local preview is displayed honestly while library and other pages stay bound to confirmed preparation',()=>{
 const e=setup(),h=open(e,'growth'),before=e.storage.getItem('starush.public-profile');h.click('[data-growth-member=kai]');assert.equal(h.query('.system-screen-frame').dataset.member,'kai');assert.match(h.query('.system-frame-member-state').textContent,/预览/);assert.equal(h.root.querySelector('.shell-session-context').dataset.currentPerformer,'sakura');assert.equal(e.storage.getItem('starush.public-profile'),before);
 h.scene._publicShell.showPage('library');assert.equal(h.query('.system-screen-frame').dataset.member,'sakura');h.shutdown();
});

test('all three saved member identities and unlocked chapter contexts share the exact same composition, without changing data',()=>{
 const e=setup();e.seed(['opening','neon','encore']);for(const member of ['sakura','kai','enjo'])for(const chapter of ['opening','neon','encore']){e.profile.selectPublicPerformer(member);e.profile.selectPublicChapter(chapter);const before=e.storage.getItem('starush.public-profile'),h=open(e,'playhub');assert.equal(h.query('.system-screen-frame').dataset.member,member);assert.equal(h.query('.system-screen-frame').dataset.chapter,chapter);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();}
});

test('unrelated and legacy pages retain their original DOM and no framework art is appended',()=>{
 for(const owner of [true,false]){const e=setup(owner);for(const page of owner?['desk','inventory','workshop']:pages){const h=open(e,page);assert.equal(h.query('.system-screen-frame'),null);assert.equal(h.root.dataset.systemScreen,undefined);h.shutdown();}}
});

test('art failure leaves live identity copy and stale image events cannot resurrect a destroyed screen',()=>{
 const e=setup(),h=open(e,'playhub'),root=h.root,image=h.query('.system-frame-venue');assert(image);image.dispatchEvent({type:'error'});assert.equal(image.hidden,true);assert(h.query('.system-frame-context').textContent.includes('星光初演'));assert.equal(h.query('.system-screen-frame').dataset.art,'unavailable');h.shutdown();image.dispatchEvent({type:'load'});assert.equal(e.document.getElementById('public-shell'),null);assert.equal(root.querySelectorAll('.system-screen-frame').length,1);
});

test('frame does not claim unsaved or protected data is saved and malformed contexts produce no made-up header',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.getSystemScreenFrameModel,'function');const m=e.loadRuntime('systems/PublicShellView.mjs').getPublicShellModel();assert.equal(a.getSystemScreenFrameModel('playhub',{...m,hasPendingSave:true}).saveState,'pending');assert.equal(a.getSystemScreenFrameModel('playhub',{...m,recovery:{}}).saveState,'protected');for(const value of [null,{}, {...m,member:{id:'missing'}},{...m,chapter:{id:'missing'}},{...m,clearedCount:NaN}])assert.equal(a.getSystemScreenFrameModel('playhub',value),null);
});

test('challenge frame follows its real rehearsal selection and continuous-trial starting venue, not an unrelated campaign selection',()=>{
 const e=setup();e.seed(['opening']);e.profile.selectPublicChapter('neon');let h=open(e,'rehearsal');assert.equal(h.query('.system-screen-frame').dataset.chapter,'opening');assert.match(h.query('.system-frame-place').textContent,/排练场地/);h.shutdown();
 e.seed(['opening','neon','encore']);e.profile.selectPublicChapter('encore');h=open(e,'rehearsal');h.click('[data-rehearsal-chapter=neon]');assert.equal(h.query('.system-screen-frame').dataset.chapter,'neon');h.shutdown();h=open(e,'finaleTrial');assert.equal(h.query('.system-screen-frame').dataset.chapter,'opening');assert.match(h.query('.system-frame-place').textContent,/连演起点/);h.shutdown();
});

test('an untouched new profile is not falsely marked as failed or pending just because no save exists yet',()=>{
 const e=setup(),a=api(e),m=e.loadRuntime('systems/PublicShellView.mjs').getPublicShellModel();assert.equal(m.persisted,false);assert.equal(m.hasPendingSave,false);assert.equal(a.getSystemScreenFrameModel('playhub',m).saveState,'local');const h=open(e,'playhub');assert.equal(h.query('.system-frame-save'),null);h.shutdown();
});

test('pending saved progress uses the same effective rehearsal default in frame, pressed tab and scene setup',()=>{
 const e=setup();e.seed(['opening','neon','encore']);e.profile.selectPublicChapter('neon');const original=e.storage.setItem;e.storage.setItem=(key,value)=>{if(key==='starush.public-profile')throw Error('quota');return original(key,value);};e.profile.selectPublicPerformer('kai');const m=e.loadRuntime('systems/PublicShellView.mjs').getPublicShellModel();assert(m.hasPendingSave);const before=e.storage.getItem('starush.public-profile'),h=open(e,'rehearsal');assert.equal(h.scene._publicShell.rehearsalSetup.chapterId,'opening');assert.equal(h.query('[data-rehearsal-chapter=opening]').getAttribute('aria-pressed'),'true');assert.equal(h.query('.system-screen-frame').dataset.chapter,'opening');assert.match(h.query('.system-screen-frame').getAttribute('aria-label'),/排练场地/);assert.equal(h.query('.system-frame-save').textContent,'有进度未保存');assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});

test('one registered page-scoped stylesheet owns composition, hidden/keyboard/reduced-motion rules and fixed media dimensions',()=>{
 const file=new URL('../src/styles/systemScreenFrame.css',import.meta.url);assert(fs.existsSync(file));const css=fs.readFileSync(file,'utf8'),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/src\/styles\/systemScreenFrame\.css/g)||[]).length,1);assert(css.includes('[data-system-screen=true]'));assert(css.includes('[hidden]'));assert(css.includes(':focus-visible'));assert(css.includes('prefers-reduced-motion'));assert(css.includes('.system-frame-venue'));assert(!/font-size\s*:[^;]*(?:vw|vh)/.test(css));assert(!/letter-spacing\s*:\s*-/.test(css));assert(!/gradient\(/.test(css));
});
