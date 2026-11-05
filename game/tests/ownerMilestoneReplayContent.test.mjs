import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain,storageFixture} from './helpers/publicShellHarness.mjs';
function setup(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 e.rules=e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID;
 e.tour=e.loadRuntime('utils/publicTourContent.mjs');return e;
}
function clear(e,owner='sakura',chapter='opening',rules=e.rules){
 return e.profile.recordPublicRun({runId:owner+chapter+rules,performerId:owner,chapterId:chapter,victory:true,durationMs:50000,performance:{hitCount:1,actions:2},rulesetId:rules});
}
function finish(e){for(const c of ['opening','neon','encore'])clear(e,'sakura',c);}
test('milestones reflect durable campaign, member first clears and current-rule coverage separately',()=>{
 const e=setup();finish(e);let p=e.profile.loadPublicProfile(),r=e.tour.getPublicTourReview(p);
 assert.deepEqual(plain(r.milestones.map(m=>[m.id,m.completed,m.total])),[['campaign',3,3],['members',1,3],['records',3,9]]);
 assert.deepEqual(plain(r.replayTarget),{performerId:'kai',chapterId:'opening',name:'机甲剑士 · 星光初演'});
 const raw=e.storage.getItem('starush.public-profile');
 for(let n=0;n<3;n++)e.tour.getPublicTourReview(p);assert.equal(e.storage.getItem('starush.public-profile'),raw);
 const pending=e.tour.getPublicTourReview({...p,persisted:false,hasPendingSave:true});
 assert(pending.milestones.every(m=>m.completed===0&&m.state==='pending'));assert.equal(pending.replayTarget,null);
});
test('legacy records do not falsely complete current coverage; full coverage ends recommendation',()=>{
 const e=setup();for(const c of ['opening','neon','encore'])clear(e,'sakura',c,'older-rule');
 let r=e.tour.getPublicTourReview(e.profile.loadPublicProfile());assert.equal(r.milestones[0].completed,3);
 assert.equal(r.milestones[2].completed,0);assert.equal(r.replayTarget.performerId,'sakura');
 for(const m of ['sakura','kai','enjo'])for(const c of ['opening','neon','encore'])clear(e,m,c);
 r=e.tour.getPublicTourReview(e.profile.loadPublicProfile());assert.equal(r.replayTarget,null);assert(r.milestones.every(m=>m.completed===m.total));
 e.loadRuntime('utils/userCast.mjs').configureUserCast(false);assert.equal(e.tour.getPublicTourReview(e.profile.loadPublicProfile()),null);
});
test('atomic replay confirmation changes both selection fields in exactly one write without rewards',()=>{
 const e=setup();finish(e);const before=e.profile.loadPublicProfile(),writes=[];
 const set=e.storage.setItem;e.storage.setItem=(k,v)=>{writes.push([k,v]);set(k,v);};
 assert.equal(typeof e.profile.selectPublicReplaySession,'function');
 const after=e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},{performerId:before.selectedId,chapterId:before.campaign.selectedChapterId});
 assert.equal(after.sessionStatus,'selected');assert.equal(writes.length,1);assert.equal(after.selectedId,'kai');assert.equal(after.campaign.selectedChapterId,'opening');
 assert.equal(after.clears,before.clears);assert.deepEqual(plain(after.preparation),plain(before.preparation));
 assert.deepEqual(plain(after.recordedRunIds),plain(before.recordedRunIds));
});
test('quota failure never half-switches or queues a surprise selection; fresh explicit retry works',()=>{
 const e=setup();finish(e);const before=e.profile.loadPublicProfile(),raw=e.storage.getItem('starush.public-profile'),set=e.storage.setItem;
 const expected={performerId:before.selectedId,chapterId:before.campaign.selectedChapterId};
 assert.equal(typeof e.profile.selectPublicReplaySession,'function');
 e.storage.setItem=()=>{throw Error('quota');};
 assert.equal(e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},expected).sessionStatus,'storage-error');
 assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(e.profile.loadPublicProfile().selectedId,before.selectedId);
 assert.equal(e.profile.loadPublicProfile().hasPendingSave,false);e.storage.setItem=set;
 assert.equal(e.profile.retryPublicProfileSave().selectedId,before.selectedId);
 assert.equal(e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},expected).sessionStatus,'selected');
});
test('stale, invalid, locked and lost-authority selections cannot overwrite saved context',()=>{
 const e=setup();clear(e);const p=e.profile.loadPublicProfile(),expected={performerId:p.selectedId,chapterId:p.campaign.selectedChapterId};
 assert.equal(typeof e.profile.selectPublicReplaySession,'function');
 const raw=e.storage.getItem('starush.public-profile');
 for(const t of [{performerId:'unknown',chapterId:'opening'},{performerId:'kai',chapterId:'encore'}])
 assert.notEqual(e.profile.selectPublicReplaySession(t,expected).sessionStatus,'selected');
 assert.equal(e.storage.getItem('starush.public-profile'),raw);
 assert.equal(e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},{...expected,performerId:'enjo'}).sessionStatus,'stale');
 e.profile.configurePublicProfileWriteAuthority(()=>false);
 assert.equal(e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},expected).sessionStatus,'write-denied');
 assert.equal(e.storage.getItem('starush.public-profile'),raw);
});
test('home proposal and archive milestones use real consumer, cancel is read-only and confirm enters correct preflight',()=>{
 const e=setup();finish(e);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 assert(h.query('[data-action=replay-proposal]'));const raw=e.storage.getItem('starush.public-profile');
 h.click('[data-action=replay-proposal]');assert(h.query('[data-replay-proposal]'));assert.match(h.text,/机甲剑士/);
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.click('[data-action=replay-cancel]');assert.equal(e.storage.getItem('starush.public-profile'),raw);
 h.click('[data-action=replay-proposal]');h.click('[data-action=replay-confirm]');
 assert.equal(h.scene._publicShell.page,'preflight');const p=e.profile.loadPublicProfile();assert.equal(p.selectedId,'kai');assert.equal(p.campaign.selectedChapterId,'opening');
 assert.equal(h.query('[data-preflight-manifest]').dataset.performerId,'kai');h.shutdown();
});
test('new replay commands consume existing bitmap icons and primary button surfaces',()=>{
 const e=setup();finish(e);const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 const proposal=h.query('[data-action=replay-proposal]');assert(proposal.className.includes('shell-primary'));
 assert(proposal.querySelector('img.menu-art'));assert.equal(proposal.querySelectorAll('svg').length,0);
 h.click('[data-action=replay-proposal]');
 assert(h.query('[data-action=replay-confirm]').querySelector('img.menu-art'));
 assert(h.query('[data-action=replay-cancel]').querySelector('img.menu-art'));h.shutdown();
});
