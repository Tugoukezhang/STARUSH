import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
function win(e,chapterId,performerId='sakura',hitCount=2){
 return e.profile.recordPublicRun({runId:`${chapterId}-${performerId}-${hitCount}`,performerId,chapterId,victory:true,choices:['wide_brush','recovery'],durationMs:35000,performance:{hitCount,actions:4},rulesetId:e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID});
}
test('tour separates global completion, measured current-rules records and legacy without writes',()=>{
 const e=setup(),m=e.loadRuntime('utils/publicTourContent.mjs');
 let p=e.profile.loadPublicProfile(),r=m.getPublicTourReview(p);
 assert.equal(r.completed,false);assert.equal(r.recommendedChapterId,'opening');assert.equal(r.recordCount,0);assert.equal(r.members.length,3);
 win(e,'opening');win(e,'neon');win(e,'encore');assert.equal(m.getPublicTourReview(e.profile.loadPublicProfile()).completed,false);win(e,'raincheck');p=e.profile.loadPublicProfile();const before=e.storage.getItem('starush.public-profile');r=m.getPublicTourReview(p);
 assert(r.completed);assert.equal(r.recordCount,4);assert.equal(r.members.find(x=>x.id==='sakura').recordCount,4);assert.equal(r.members.find(x=>x.id==='kai').recordCount,0);
 assert.equal(m.getPublicTourReview(p,'kai').recommendedChapterId,'opening');assert.equal(e.storage.getItem('starush.public-profile'),before);
 const legacy={...p,performance:{version:1,records:p.performance.rulesets[e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID]}};
 assert.equal(m.getPublicTourReview(legacy).recordCount,0);assert(m.getPublicTourReview(legacy).completed);
 const pending=m.getPublicTourReview({...p,persisted:false,hasPendingSave:true});assert.equal(pending.recordCount,0);assert(pending.pending);assert(pending.members[0].chapters.some(c=>c.state==='pending'));
 assert.equal(m.getPublicTourReview(p,'venus'),null);
});
test('chapter previews describe actual objective and pressure contracts, not imaginary content',()=>{
 const e=setup(),m=e.loadRuntime('utils/publicTourContent.mjs');
 for(const id of ['opening','neon','encore']){const p=m.getPublicChapterPacing(id);assert(p);assert.equal(p.id,id);assert(p.objective.length>5);assert(p.pressure.length>5);assert.equal(p.steps.length,3);}
 assert.match(m.getPublicChapterPacing('neon').objective,/两侧|双侧/);assert.match(m.getPublicChapterPacing('encore').objective,/校准/);assert.equal(m.getPublicChapterPacing('unknown'),null);
});
test('home next destination previews locally without saving or launching',()=>{
 const e=setup();win(e,'opening');const before=e.storage.getItem('starush.public-profile');
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 assert.match(h.text,/下一站.*霓虹街口/);h.click('[data-action="home-next-destination"]');
 assert.equal(h.scene._publicShell.page,'tour');assert.equal(h.scene._publicShell.selection.chapterId,'neon');assert.equal(e.storage.getItem('starush.public-profile'),before);assert.equal(h.starts.length,0);h.shutdown();
});
test('tour confirms preview chapter before original goal selection and captures its own target',()=>{
 const e=setup();win(e,'opening');win(e,'neon');e.profile.selectPublicChapter('opening');
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'tour'});h.scene.create();
 h.click('[data-chapter="neon"]');assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'opening');
 assert.match(h.text,/两侧|双侧/);h.click('[data-action="chapter-goals"]');
 assert.equal(h.scene._publicShell.page,'goals');assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');
 h.click('[data-goal="steady"]');h.click('[data-action="confirm-goal"]');
 assert.equal(h.scene._publicShell.page,'preflight');const goal=e.loadRuntime('utils/publicRunGoals.mjs').capturePublicRunGoal(e.profile.loadPublicProfile());
 assert.equal(goal.chapterId,'neon');assert.equal(goal.target,2);assert.equal(goal.kind,'steady');assert.equal(h.starts.length,0);h.shutdown();
});
test('archive shows three members by four chapters without phantom clears',()=>{
 const e=setup();win(e,'opening');win(e,'neon');win(e,'encore');
 const before=e.storage.getItem('starush.public-profile'),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'records'});h.scene.create();
 assert.match(h.text,/实测纪录 3 \/ 12/);assert.equal(h.root.querySelectorAll('[data-tour-member]').length,3);assert.equal(h.root.querySelectorAll('[data-tour-cell]').length,12);
 assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});

test('empty archive does not claim lost results, and a revoked write authority cannot enter goals',()=>{
 const e=setup(),empty=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'records'});empty.scene.create();
 assert.match(empty.text,/实测纪录 0 \/ 12/);assert.doesNotMatch(empty.text,/本次有未保存记录/);empty.shutdown();
 win(e,'opening');const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'tour'});h.scene.create();
 h.click('[data-chapter="opening"]');const before=e.storage.getItem('starush.public-profile');
 e.profile.configurePublicProfileWriteAuthority(()=>false);h.click('[data-action="chapter-goals"]');
 assert.equal(h.scene._publicShell.page,'tour');assert.match(h.text,/场地未能保存或已不可用/);assert.equal(e.storage.getItem('starush.public-profile'),before);assert.equal(h.starts.length,0);h.shutdown();
});

test('failed chapter save stays on tour and pending evidence never enables a measured replay goal',()=>{
 const e=setup();win(e,'opening');win(e,'neon');e.profile.selectPublicChapter('opening');
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'tour'});h.scene.create();h.click('[data-chapter="neon"]');
 const before=e.storage.getItem('starush.public-profile'),set=e.storage.setItem;e.storage.setItem=()=>{throw Error('Synthetic quota failure');};
 h.click('[data-action="chapter-goals"]');assert.equal(h.scene._publicShell.page,'tour');assert.match(h.text,/场地未能保存或已不可用/);assert.equal(e.storage.getItem('starush.public-profile'),before);
 const pending=e.profile.loadPublicProfile();assert.equal(pending.persisted,false);assert.equal(e.loadRuntime('utils/publicTourContent.mjs').getPublicTourReview(pending).recordCount,0);
 assert.equal(e.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(pending).filter(g=>g.id!=='standard'&&g.available).length,0);
 e.storage.setItem=set;h.shutdown();
});

test('result completion review is based on durable actual evidence and absent on pending or diagnostic results',()=>{
 const e=setup();win(e,'opening');win(e,'neon');win(e,'encore');win(e,'raincheck');
 const m=e.loadRuntime('systems/BattleSurfaceView.mjs'),run={...e.profile.loadPublicProfile().lastRun,persisted:true,recorded:true};
 const model=m.getPublicResultSurfaceModel({buttons:[]},run);assert(model.tourReview.completed);assert.equal(model.tourReview.recordCount,4);
 assert.equal(m.getPublicResultSurfaceModel({buttons:[]},{...run,persisted:false}).tourReview,null);
 assert.equal(m.getPublicResultSurfaceModel({buttons:[]},{...run,performerId:'venus'}).tourReview,null);
 const view=new m.BattleSurfaceView({input:{enabled:true},events:{once(){},off(){}}},{mode:'result',model,onAction(){}},e.document);
 assert.match(view.root.textContent,/本轮巡演已通关/);assert.match(view.root.textContent,/当前规则实测纪录 4 \/ 4/);view.destroy();
});

test('standalone TourRoute hands goals back to the real TitleScene start owner',()=>{
 const e=setup();win(e,'opening');const tour=e.harness(e.TourRouteScene,{});tour.scene.create();
 tour.click('[data-chapter="opening"]');tour.click('[data-action="chapter-goals"]');
 assert.equal(tour.starts.length,1);assert.equal(tour.starts[0][0],'TitleScene');assert.equal(tour.starts[0][1].openPage,'goals');
 const data=tour.starts[0][1];tour.shutdown();const title=e.harness(e.TitleScene,data);title.scene.create();
 title.click('[data-goal="steady"]');title.click('[data-action="confirm-goal"]');title.click('[data-action="start"]');
 assert.equal(title.starts.length,1);assert.equal(title.starts[0][0],'BattleScene');assert.equal(title.starts[0][1].publicRunGoal.chapterId,'opening');title.shutdown();
});
