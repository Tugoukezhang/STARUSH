import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
function api(e){assert(fs.existsSync(new URL('../src/utils/publicRoutePlan.mjs',import.meta.url)),'Missing real route-plan contract');return e.loadRuntime('utils/publicRoutePlan.mjs');}
const data=(chapter='opening',owner='sakura')=>({stageId:1,performerId:owner,campaignChapterId:chapter});
test('route plan freezes actual owner/chapter/rules and rejects malformed, stale and hidden requests',()=>{
 const e=setup(),a=api(e),d=data(),p=a.createPublicRoutePlan('east',d);assert(Object.isFrozen(p));assert.equal(p.id,'east');
 assert.notEqual(a.normalizePublicRoutePlan(p,d),p);
 for(const patch of [{version:2},{id:'invented'},{chapterId:'neon'},{performerId:'kai'},{rulesetId:'owner-three-chapter-v6'}])assert.equal(a.normalizePublicRoutePlan({...p,...patch},d),null);
 for(const patch of [{practiceMode:true},{defenseMode:true},{stageId:2},{performerId:'venus'},{campaignChapterId:'invented'}])assert.equal(a.normalizePublicRoutePlan(p,{...d,...patch}),null);
 assert.equal(a.createPublicRoutePlan('auto',d),null);
});
test('actual preparation buttons are preview-only and Title freezes their choice only on start',()=>{
 const e=setup(),h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');const raw=e.storage.getItem('starush.public-profile');
 assert.equal(h.all('[data-route-choice]').length,3);h.click('[data-route-choice=east]');
 assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(h.query('[data-route-choice=east]').getAttribute('aria-pressed'),'true');
 const east=h.query('[data-route-choice=east]');
 assert.equal(east.querySelector('.route-choice-state')?.textContent,'已选');
 assert(east.querySelector('img.menu-art'),'Route option must use approved bitmap, not line-icon fallback');
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert.match(css,/\.preflight-route button\[aria-pressed=true\][^}]*background:#d5ef40[^}]*border-color:#202b30/);
 assert.match(h.text,/东线/);assert.match(h.text,/压轴/);h.click('[data-action=start]');
 const p=h.starts.at(-1)[1].publicRoutePlan;assert.equal(p.id,'east');assert.equal(p.performerId,'sakura');
 assert.equal(p.chapterId,'opening');assert.equal(p.rulesetId,e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID);
});
test('changing saved owner/chapter never silently carries a previous preview into a new battle',()=>{
 const e=setup(),h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');h.click('[data-route-choice=west]');
 e.profile.selectPublicPerformer('kai');const built=h.scene._buildRecommendedBattleData(new URLSearchParams());assert.equal(built.publicRoutePlan,undefined);
});
test('both route presets select real stations in all chapters; opposite branches cannot be painted',()=>{
 const e=setup(),a=api(e),{ChapterSideSet:C}=e.loadRuntime('utils/chapterSideSets.mjs');
 for(const chapter of ['opening','neon','encore'])for(const branch of ['west','east']){
  const s=new C(chapter,branch),ds=s.definitions.map(d=>({...d,complete:false}));assert.deepEqual(plain(s.selected),[branch,branch]);
  assert.equal(s.snapshot(ds).completed,0);
  for(const d of ds.filter(d=>d.sideBranch!==branch))assert.equal(s.canReceive(d,ds),false);
  for(const d of ds.filter(d=>d.sideBranch===branch)){assert(s.canReceive(d,ds));d.complete=true;s.completed(d,ds);}
  assert.equal(s.snapshot(ds).completed,4);assert(s.zoneComplete(0,ds));assert(s.zoneComplete(1,ds));s.destroy();assert(s.disposed);
  const d=data(chapter),p=a.createPublicRoutePlan(branch,d),{PaintZoneSystem:Z}=e.loadRuntime('systems/PaintZoneSystem.js');
  const z=new Z({_userCastPresentation:true,oldStreet:{},battleData:{...d,publicRoutePlan:p}});
  assert.deepEqual(plain(z.sideSet.selected),[branch,branch]);
 }
 const automatic=new C('opening');assert.deepEqual(plain(automatic.selected),[null,null]);
});
test('real Finale controller consumes exact route order, preserving three original attacks and hidden isolation',()=>{
 const e=setup(),a=api(e),{PublicStage1FinaleController:F}=e.loadRuntime('systems/PublicStage1FinaleController.mjs');
 const old=e.loadRuntime('utils/chapterFinaleContent.mjs');
 for(const chapter of ['opening','neon','encore'])for(const owner of ['sakura','kai','enjo']){
  const d=data(chapter,owner),base=plain(old.getChapterFinalePatterns(chapter)),east=[base[1],base[0],base[2]];
  for(const [id,want]of [['west',base],['east',east]]){
   const p=a.createPublicRoutePlan(id,d),f=new F({...d,publicRoutePlan:p});assert.deepEqual(plain(f.attackPatterns),want);assert.equal(f.attackPatterns.length,3);
  }
  assert.deepEqual(plain(new F(d).attackPatterns),base);
 }
 assert.equal(a.normalizePublicRoutePlan(a.createPublicRoutePlan('east',data()),{...data(),practiceMode:true}),null);
});
test('retry retains an independent valid plan; next chapter removes it without changing saved member',()=>{
 const e=setup(),a=api(e),flow=e.loadRuntime('utils/publicCampaignResult.mjs'),d=data(),p=a.createPublicRoutePlan('east',d),input={...d,publicRoutePlan:p};
 e.profile.recordPublicRun({runId:'clear',performerId:'sakura',chapterId:'opening',victory:true});
 const retry=flow.getRetryCampaignBattleData(input);assert.equal(retry.publicRoutePlan.id,'east');assert.notEqual(retry.publicRoutePlan,p);
 const next=flow.getNextCampaignBattleData({chapterId:'opening',victory:true},input);assert.equal(next.campaignChapterId,'neon');assert.equal(next.publicRoutePlan,undefined);
 assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');assert.equal(flow.getRetryCampaignBattleData({...input,publicRoutePlan:{...p,performerId:'kai'}}).publicRoutePlan,undefined);
});
test('route result and pause use validated transient context, not a new permanent save field',()=>{
 const e=setup(),a=api(e),d=data(),p=a.createPublicRoutePlan('east',d),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const scene={_userCastPresentation:true,battleData:{...d,publicRoutePlan:p},time:{now:0}},r=new R(scene);scene.publicPerformerRun=r;scene.time.now=10000;
 const result=r.finish(false);assert.equal(result.publicRoutePlan.id,'east');assert(!JSON.stringify(e.profile.loadPublicProfile()).includes('publicRoutePlan'));
 const {getPublicResultSurfaceModel:model,BattleSurfaceView:V}=e.loadRuntime('systems/BattleSurfaceView.mjs'),m=model({buttons:[]},result);
 assert.match(m.routeReview.title,/东线/);const h=e.harness(e.TitleScene);Object.assign(h.scene,scene);
 const v=new V(h.scene,{mode:'result',model:m,onAction(){}},e.document);assert.match(v.root.textContent,/预选东线/);
 assert.equal(v.content.children[0].className,'battle-performance-header','Outcome heading must precede route review');v.destroy();
 const pause=new V(h.scene,{mode:'pause',onResume(){},onRetry(){},onLeave(){},onSettings(){}},e.document);assert.match(pause.root.textContent,/预选东线/);pause.destroy();
});
test('unknown chapter never accepts a preselected branch as an empty completed route',()=>{
 const e=setup(),{ChapterSideSet:C}=e.loadRuntime('utils/chapterSideSets.mjs'),s=new C('unknown','west');
 assert.equal(s.zoneComplete(0,[]),false);assert.deepEqual(plain(s.selected),[null,null]);
});
test('rules7 keeps original rules6 history and old progression without converting it to a current score',()=>{
 const e=setup(),id=e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID;assert.equal(id,'owner-three-chapter-v14');
 e.profile.recordPublicRun({runId:'historic',performerId:'sakura',chapterId:'opening',victory:true,durationMs:40000,performance:{hitCount:2,actions:1},rulesetId:'owner-three-chapter-v6'});
 const before=e.storage.getItem('starush.public-profile'),records=e.loadRuntime('utils/publicPerformanceRecords.mjs');
 assert(records.getPublicPerformanceRecord(e.profile.loadPublicProfile(),'opening','sakura','owner-three-chapter-v6'));
 assert.equal(records.getPublicPerformanceRecord(e.profile.loadPublicProfile(),'opening','sakura',id),null);
 assert.equal(e.profile.loadPublicProfile().clears,1);assert.equal(e.storage.getItem('starush.public-profile'),before);
});
