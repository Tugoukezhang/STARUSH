import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup={chapterId:'neon',focus:'action',choices:['tempo','overdrive']};
const env=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const api=e=>fs.existsSync(new URL('../src/utils/publicShellSceneEntry.mjs',import.meta.url))?e.loadRuntime('utils/publicShellSceneEntry.mjs'):{};
function open(e,Scene,data){const h=e.harness(Scene,data);h.scene.create();return h;}
function next(e,h){const [key,data]=h.starts.at(-1);h.shutdown();return open(e,e[key],data);}

test('actual rehearsal draft survives roster, tour and home Scene lifecycles without granting or saving choices',()=>{
 const e=env();e.seed(['opening','neon','encore']);let h=open(e,e.TitleScene);const before=e.storage.getItem('starush.public-profile');
 h.click('[data-action=play-hub]');h.click('[data-product-module=challenge]');h.click('[data-action=hub-rehearsal]');h.click('[data-rehearsal-chapter=neon]');h.click('[data-rehearsal-focus=action]');h.click('[data-rehearsal-choice=tempo]');h.click('[data-rehearsal-choice=overdrive]');
 for(const root of ['roster','tour','desk']){h.click('[data-nav='+root+']');h=next(e,h);assert.deepEqual(plain(h.scene._publicShell.rehearsalSetup),setup);}
 h.click('[data-action=play-hub]');h.click('[data-product-module=challenge]');h.click('[data-action=hub-rehearsal]');assert.equal(h.query('[data-rehearsal-focus=action]').getAttribute('aria-pressed'),'true');assert.equal(h.query('[data-rehearsal-choice=tempo]').getAttribute('aria-pressed'),'true');assert.equal(e.storage.getItem('starush.public-profile'),before);
 h.click('[data-action=rehearsal-start]');const [key,d]=h.starts.at(-1);assert.equal(key,'BattleScene');assert.deepEqual(plain(d.publicFinaleTrial.rehearsal),{chapterId:'neon',focus:'action'});assert.deepEqual(plain(d.publicFinaleTrial.choices),setup.choices);assert.equal(d.publicArrangementPlan,undefined);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});

test('one entry adapter maps every registered page to an existing owner and rejects unknown destinations',()=>{
 const e=env(),a=api(e),routes=e.loadRuntime('utils/publicShellNavigation.mjs').PUBLIC_SHELL_ROUTES;assert.equal(typeof a.createPublicShellSceneEntry,'function');
 for(const {id}of routes){const r=a.createPublicShellSceneEntry(id);assert.equal(r.key,id==='roster'?'IdolRosterScene':id==='tour'?'TourRouteScene':'TitleScene');assert.equal(r.data.suppressDebugAutoStart,true);assert.equal(r.data.openPage,['desk','roster','tour','workshop'].includes(id)?undefined:id);assert.equal(r.data.openPreparation,id==='workshop'?true:undefined);}
 for(const id of ['BattleScene','unknown-events','recruit','toString','__proto__',null,{}])assert.equal(a.createPublicShellSceneEntry(id),null);
});

test('menu handoff whitelists fields, copies canonical rehearsal draft and never admits hidden or resume payloads',()=>{
 const e=env(),a=api(e);assert.equal(typeof a.createPublicShellSceneEntry,'function');const source=structuredClone(setup),r=a.createPublicShellSceneEntry('workshop',{rehearsalSetup:source,shellReturnPage:'tour',publicBattleResume:{},publicFinaleTrial:{},debug:true,stageId:2,suppressDebugAutoStart:false});source.choices[0]='wide_brush';assert.deepEqual(plain(r.data),{suppressDebugAutoStart:true,openPreparation:true,rehearsalSetup:setup,shellReturnPage:'tour'});
 for(const returnPage of ['workshop','toString','unknown-events',null])assert.equal(a.createPublicShellSceneEntry('workshop',{shellReturnPage:returnPage}).data.shellReturnPage,undefined);
 assert.equal(a.createPublicShellSceneEntry('desk',{},true).data.selectionSaveFailed,true);assert.equal(a.createPublicShellSceneEntry('desk',{selectionSaveFailed:true}).data.selectionSaveFailed,undefined);
});

test('malformed and sparse rehearsal drafts cannot replace the original default or bypass locked chapter admission',()=>{
 const e=env(),a=api(e);assert.equal(typeof a.copyPublicRehearsalSetup,'function');
 for(const v of [null,[],{}, {...setup,extra:true},{...setup,focus:'constructor'},{...setup,chapterId:'missing'},{...setup,choices:Array(2)},{...setup,choices:['echo','tempo']}])assert.equal(a.copyPublicRehearsalSetup(v),null);
 const copied=a.copyPublicRehearsalSetup(setup);assert.deepEqual(plain(copied),setup);assert.notEqual(copied,setup);assert.notEqual(copied.choices,setup.choices);
 const h=open(e,e.TitleScene,{openPage:'rehearsal',rehearsalSetup:setup});assert(h.query('[data-action=rehearsal-start]').disabled);h.click('[data-action=rehearsal-start]');assert.equal(h.starts.length,0);h.shutdown();
});

test('all actual menu owners retain rehearsal draft through wallet training and back, without confirming previews',()=>{
 for(const [Scene,page]of [['TitleScene','desk'],['IdolRosterScene','roster'],['TourRouteScene','tour']]){const e=env();let h=open(e,e[Scene],{rehearsalSetup:setup});const before=e.storage.getItem('starush.public-profile');h.click('[data-nav=workshop]');assert.equal(h.starts.at(-1)[1].shellReturnPage,page);h=next(e,h);assert.deepEqual(plain(h.scene._publicShell.rehearsalSetup),setup);h.click('[data-action=back]');h=next(e,h);assert.equal(h.scene._publicShell.page,page);assert.deepEqual(plain(h.scene._publicShell.rehearsalSetup),setup);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();}
});

test('existing preparation plan returns locally from wallet training instead of inventing a second Scene restart',()=>{
 const e=env(),h=open(e,e.TitleScene);h.click('[data-action=home-preflight]');h.click('[data-action=preflight-library]');h.click('[data-action=plan-use]');const plan=plain(h.scene._publicShell.arrangementPlan);h.click('[data-nav=workshop]');const deep=next(e,h);deep.click('[data-action=confirm-preparation]');assert.equal(deep.scene._publicShell.page,'preflight');assert.equal(deep.starts.length,0);assert.deepEqual(plain(deep.scene._publicShell.arrangementPlan),plan);deep.shutdown();
});

test('external profile removal clears ephemeral drafts as well as original route and arrangement intent',()=>{
 const e=env(),h=open(e,e.TitleScene,{rehearsalSetup:setup});h.scene._publicShell.storageChanged({key:'starush.public-profile',newValue:null});assert.equal(h.scene._publicShell.rehearsalSetup,null);h.shutdown();
});
