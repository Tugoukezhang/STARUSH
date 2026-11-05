import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import postcss from 'postcss';import {loadScenes,storageFixture} from './helpers/publicShellHarness.mjs';
const PREFIX='#game-container #public-shell[data-core-journey=true][data-home-demo=true][data-page=desk]';
const sheet=()=>postcss.parse(fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8'));
function rule(suffix){let found;sheet().walkRules(r=>{if(r.selector===PREFIX+' '+suffix&&r.parent.type==='root')found=Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));});return found||{};}
function home(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();return h;}
test('reference home keeps brand over a full-bleed stage rather than an opaque stacked header',()=>{
 assert.equal(rule('.shell-header').position,'absolute');assert.equal(rule('.shell-header').background,'transparent');
 assert.equal(rule('.shell-content').position,'relative');assert.equal(rule('.lobby-stage').position,'absolute');
 assert.equal(rule('.lobby-background')['z-index'],'0');
});
test('three illustrated home commands remain primary while the fourth hub is a named compact utility',()=>{
 const h=home();for(const action of ['preflight','prepare','story-journal','play-hub'])assert(h.query('[data-action='+action+']'));
 assert.equal(rule('.lobby-shortcuts').display,'contents');
 assert.equal(rule('.lobby-shortcut[data-action=play-hub]').width,'44px');
 assert.equal(rule('.lobby-shortcut[data-action=play-hub]').right,'12px');h.shutdown();
});
test('progress disclosure has a native summary, readable name and library icon, not a permanent text band',()=>{
 const h=home(),summary=h.query('.lobby-details').querySelector('summary');
 assert.equal(summary.getAttribute('aria-label'),'巡演进度与最近演出');assert(summary.querySelector('svg'));
 assert.equal(summary.querySelector('.home-details-label').textContent,'巡演进度与最近演出');
 assert.equal(rule('.lobby-details').position,'absolute');assert.equal(rule('.lobby-details > summary').width,'44px');
 assert.equal(h.query('.lobby-details').open,false);h.shutdown();
});
test('preparation values are retained in the accessible progress drawer without floating across the face',()=>{
 const h=home(),details=h.query('.lobby-details'),values=h.query('.lobby-preparation');
 assert.equal(values.parentNode,details);assert.match(values.textContent,/阶位 1/);assert.match(values.textContent,/未装备配件/);
 assert.equal(rule('.lobby-details .lobby-preparation').position,'static');h.shutdown();
});
test('new composition keeps native primary action, layered home only and existing navigation',()=>{
 const h=home();assert(h.query('.home-portrait-rig'));assert(h.query('[data-action=start]'));
 h.click('[data-action=preflight]');assert.equal(h.root.dataset.page,'preflight');h.click('[data-action=back]');
 h.click('[data-action=play-hub]');assert.equal(h.root.dataset.page,'playhub');h.shutdown();
});
test('motion preferences and fixed hit targets survive the layout revision',()=>{
 const css=sheet().toString();assert(css.includes('@media (prefers-reduced-motion:reduce)'));
 assert(!/font-size:[^;]*vw/.test(css));assert.equal(rule('.lobby-shortcut').height,'70px');
 assert.equal(rule('.lobby-mission').position,'absolute');assert.equal(rule('.lobby-member-name')['pointer-events'],'none');
});
test('short-screen shortcuts clear the saved-run nameplate without shrinking below44px',()=>{
 let top,height;sheet().walkRules(r=>{if(r.parent.params!=='(max-height:620px)')return;const d=Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
  if(r.selector===PREFIX+' .lobby-shortcut[data-action=story-journal]')top=parseFloat(d.top);
  if(r.selector===PREFIX+' .lobby-shortcut')height=parseFloat(d.height);
 });assert(height>=44);assert(top+height<=256,'observed320 saved-run nameplate starts265; reserve9px');
});
test('transparent header intercepts only its real controls, never the top of the game-hub target',()=>{
 assert.equal(rule('.shell-header')['pointer-events'],'none');assert.equal(rule('.shell-header button')['pointer-events'],'auto');
});
for(const kind of ['corrupt','pending'])test('home foreground drawer preserves operable '+kind+' save controls',()=>{
 const storage=storageFixture(),e=loadScenes({storage});e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 if(kind==='corrupt')storage.setItem('starush.public-profile','{broken');
 else{e.profile.selectPublicPerformer('sakura');storage.setItem=()=>{throw Error('quota fixture');};e.profile.recordPublicRun({runId:'b70-unsaved',performerId:'sakura',chapterId:'opening',victory:true});}
 const h=e.harness(e.TitleScene);h.scene.create();const panel=h.query(kind==='corrupt'?'.shell-save-recovery':'.shell-pending-save'),details=h.query('.lobby-details');
 assert(panel);assert.equal(panel.parentNode,details);assert.equal(details.open,true);
 assert(h.query(kind==='corrupt'?'[data-action=recover-save]':'[data-action=retry-save]'));h.shutdown();
});
