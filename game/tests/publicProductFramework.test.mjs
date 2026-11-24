import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {createRequire} from 'node:module';
const api=await import('../src/utils/publicProductModules.mjs').catch(()=>({}));
const build=await import('../scripts/check-product-framework.mjs').catch(()=>({}));
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const ready=()=>{assert.equal(typeof api.validatePublicProductFramework,'function','product framework registration must exist');return api;};
const copy=value=>JSON.parse(JSON.stringify(value));

test('product registration covers25 modules while distinguishing real owners from planned/service scope',()=>{
 const a=ready();assert.equal(a.PUBLIC_PRODUCT_MODULES.length,25);assert.deepEqual(a.validatePublicProductFramework(),[]);
 assert(a.PUBLIC_PRODUCT_MODULES.every(m=>Object.isFrozen(m)&&Object.isFrozen(m.dependencies)&&Object.isFrozen(m.pages)&&Object.isFrozen(m.owners)));
 for(const id of ['shell','save','chapter','story','encounter','kits','inventory','growth','challenge'])assert.equal(a.isPublicProductModuleAvailable(id),true,id);
 for(const id of ['cloud','social','platform']){
  const m=a.getPublicProductModule(id);assert.equal(m.runtime,false,id);assert.deepEqual(m.pages,[]);assert.equal(a.isPublicProductModuleAvailable(id),false);
 }
 for(const id of ['bonds','sideplay','events','recruit','venue']){const m=a.getPublicProductModule(id);assert.equal(m.runtime,true,id);assert.equal(m.pages.length,1,id);assert.equal(a.isPublicProductModuleAvailable(id),true,id);}
 assert.equal(a.getPublicProductModule('unknown'),null);assert.equal(a.isPublicProductModuleAvailable('unknown'),false);
});

test('existing and new21 real routes and5 roots have exactly one available module owner',async()=>{
 const a=ready(),nav=await import('../src/utils/publicShellNavigation.mjs');assert.equal(nav.PUBLIC_SHELL_ROUTES.length,21);assert.equal(nav.PUBLIC_SHELL_ROOTS.length,5);
 assert.deepEqual(a.validatePublicProductFramework({routes:nav.PUBLIC_SHELL_ROUTES}),[]);
 for(const route of nav.PUBLIC_SHELL_ROUTES){assert.equal(route.moduleId,a.getPublicPageModuleId(route.id));assert.equal(nav.getPublicShellRoute(route.id),route);assert(a.isPublicProductModuleAvailable(route.moduleId));}
 assert.equal(nav.getPublicShellRoute('venue').moduleId,'venue');assert.equal(nav.getPublicShellRoute('recruitment').moduleId,'recruit');assert.equal(nav.getPublicShellRoute('recruit'),null);
});

test('registration rejects unknown/cyclic/unavailable dependencies and duplicate or planned public page ownership',()=>{
 const a=ready(),base=a.PUBLIC_PRODUCT_MODULES;
 for(const change of [
  modules=>modules.find(m=>m.id==='shell').dependencies.push('missing'),
  modules=>modules.find(m=>m.id==='shell').dependencies.push('chapter'),
  modules=>modules.find(m=>m.id==='shell').dependencies.push('venue'),
  modules=>modules.find(m=>m.id==='inventory').pages.push('desk'),
  modules=>modules.find(m=>m.id==='venue').pages.push('venue'),
  modules=>modules.find(m=>m.id==='save').owners.splice(0),
  modules=>modules.find(m=>m.id==='shell').owners.push('../personal.txt'),
  modules=>modules.push({...modules[0]}),
 ]){const modules=copy(base);change(modules);assert(a.validatePublicProductFramework({modules}).length>0);}
 const modules=copy(base);modules.find(m=>m.id==='shell').dependencies=['venue'];assert.equal(a.isPublicProductModuleAvailable('shell',modules),false);assert.equal(a.getPublicPageModuleId('desk',modules),null);
});

test('a planned future module can be registered without publishing fake pages or changing existing roots',()=>{
 const a=ready(),modules=copy(a.PUBLIC_PRODUCT_MODULES);modules.push({id:'festival',name:'Festival',domainId:'operations',scope:'later',runtime:false,dependencies:['chapter','story'],owners:[],pages:[]});
 assert.deepEqual(a.validatePublicProductFramework({modules}),[]);assert.equal(a.getPublicPageModuleId('festival',modules),null);
 for(const bad of [null,{},[],[null]])assert(a.validatePublicProductFramework({modules:bad}).length>0);
});

test('actual mode context consumes the same immutable three-mode policies without changing challenge or save semantics',()=>{
 const a=ready(),e=loadScenes(),runtime=e.loadRuntime('utils/publicProductModules.mjs'),context=e.loadRuntime('utils/publicRunContext.mjs'),trial=e.loadRuntime('utils/publicFinaleTrial.mjs');
 const base={stageId:1,practiceMode:false,defenseMode:false,performerId:'enjo',characterId:'enjo',team:[{characterId:'enjo'}],campaignChapterId:'opening'},profile={version:1,clears:3,campaign:{version:1,selectedChapterId:'opening',chapterClears:{opening:1,neon:1,encore:1},completed:true}};
 for(const[data,id,save]of [[base,'campaign',true],[trial.createFinaleTrialData(base,['wide_brush','echo'],profile),'finale-trial',false],[trial.createRehearsalData(base,['tempo','overdrive'],profile,{chapterId:'neon',focus:'clean'}),'rehearsal',false]]){
  const value=context.resolvePublicRunContext(data);assert.equal(value.modeId,id);assert.equal(value.policy,runtime.getPublicProductMode(id).policy);assert(Object.isFrozen(value.policy));assert.equal(value.policy.checkpoint,save);assert.equal(value.policy.profileResult,save);
 }
 assert.equal(a.getPublicProductMode('venue'),null);assert.equal(context.resolvePublicRunContext({...base,publicFinaleTrial:{}}),null);
});

test('all current storage domains identify existing owners rather than new writers or duplicated DTO versions',async()=>{
 const a=ready();assert.deepEqual(a.PUBLIC_PRODUCT_STORES.map(s=>s.id),['profile','preferences','battle-checkpoint','battle-visual','backstage']);
 const result=await build.assertProductFramework(root);assert.equal(result.modules,25);assert.equal(result.pages,21);assert.equal(result.modes,3);assert.equal(result.stores,5);assert.equal(result.primaryKeys,4);
 assert.equal(a.PUBLIC_PRODUCT_STORES.find(s=>s.id==='battle-visual').parentId,'battle-checkpoint');
});

test('build guard rejects absent owner sources, mismatched routes, bad policies and missing key exports before build output',async()=>{
 const a=ready();assert.equal(typeof build.assertProductFramework,'function');
 await assert.rejects(()=>build.assertProductFramework(root,{exists:()=>false}),/Missing product owner/);
 const nav=await import('../src/utils/publicShellNavigation.mjs');const routes=copy(nav.PUBLIC_SHELL_ROUTES);routes[0].moduleId='venue';
 assert(a.validatePublicProductFramework({routes}).some(e=>e.field==='route-owner'));
 const modes=copy(a.PUBLIC_PRODUCT_MODES);modes[0].policy.checkpoint='true';assert(a.validatePublicProductFramework({modes}).length>0);
 const stores=copy(a.PUBLIC_PRODUCT_STORES);stores[0].keyExport='UNKNOWN_KEY';await assert.rejects(()=>build.assertProductFramework(root,{stores}),/Missing product key export/);
});

test('real shell navigation exposes registered module identity without new roots or profile writes',()=>{
 ready();const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();const shell=h.scene._publicShell,before=e.storage.getItem('starush.public-profile'),a=e.loadRuntime('utils/publicProductModules.mjs');
 const rootPages=['desk','roster','tour','inventory'];
 const routes=e.loadRuntime('utils/publicShellNavigation.mjs').PUBLIC_SHELL_ROUTES;
 for(const {id} of routes){
  shell.showPage(id);
  assert.equal(shell.root.dataset.moduleId,a.getPublicPageModuleId(id),id);
  const bars=shell.root.querySelectorAll('.shell-navigation');
  assert.equal(bars.length,rootPages.includes(id)?1:0,id);
  if(bars.length)assert.deepEqual([...bars[0].querySelectorAll('[data-nav]')].map(button=>button.dataset.nav),rootPages,id);
 }
 assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});

test('bootstrap and both build paths validate the actual route registry, not a disconnected report',()=>{
 ready();const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),vite=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
 assert(main.includes('validatePublicProductFramework({routes:PUBLIC_SHELL_ROUTES})'));assert(main.indexOf('validatePublicProductFramework({routes:PUBLIC_SHELL_ROUTES})')<main.indexOf('new Phaser.Game'));
 assert.equal((vite.match(/productFrameworkGuard\(\)/g)||[]).length,2,'ordinary and Q builds use same guard');
});

test('malformed route collections and cyclic parents return authoring errors without crashing or publishing a route',async()=>{
 const a=ready(),nav=await import('../src/utils/publicShellNavigation.mjs');
 for(const value of [[null,...nav.PUBLIC_SHELL_ROUTES],[...nav.PUBLIC_SHELL_ROUTES,undefined]]){
  let errors;assert.doesNotThrow(()=>{errors=a.validatePublicProductFramework({routes:value});});assert(errors.length>0);
 }
 const routes=copy(nav.PUBLIC_SHELL_ROUTES);routes.find(r=>r.id==='desk').parentId='roster';
 assert(a.validatePublicProductFramework({routes}).some(e=>e.field==='route-cycle'));
});

test('framework guard can be bundled through the existing CommonJS Vite config without top-level await',()=>{
 ready();const {buildSync}=createRequire(import.meta.url)('esbuild');
 assert.doesNotThrow(()=>buildSync({absWorkingDir:root,entryPoints:['vite.config.js'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent'}));
});
