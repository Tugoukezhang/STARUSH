import assert from 'node:assert/strict';
import test from 'node:test';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

test('all public pages retain saved member/chapter context while a candidate is previewed',()=>{
 for(const [type,data]of [['TitleScene',{}],['TourRouteScene',{}],['IdolRosterScene',{}],['TitleScene',{openPreparation:true}]]){
  const e=loadScenes();e.seed(['opening'],'neon');e.profile.selectPublicPerformer('venus');
  const h=e.harness(e[type],{suppressDebugAutoStart:true,...data});h.scene.create();
  const context=h.query('.shell-session-context');assert(context,'Persistent current-run context is required');
  assert.equal(context.dataset.currentPerformer,'venus');assert.equal(context.dataset.currentChapter,'neon');
  assert.match(context.textContent,/金星/);assert.match(context.textContent,/霓虹街口/);
  if(h.query('[data-member=kai]')){h.click('[data-member=kai]');assert.equal(h.query('.shell-session-context').dataset.currentPerformer,'venus');assert.equal(e.model().member.id,'venus');}
  h.shutdown();
 }
});

test('desk and candidate roster expose the actual independent preparation snapshot',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore']);e.profile.trainPublicPerformer('sakura',1);e.profile.equipPublicPerformer('sakura','focus_lens');
 const h=e.harness(e.TitleScene);h.scene.create();
 const values=h.query('.shell-preparation-values');assert(values);assert.match(values.textContent,/阶位 2/);assert.match(values.textContent,/聚光镜/);h.shutdown();
 const roster=e.harness(e.IdolRosterScene);roster.scene.create();
 assert.match(roster.query('.shell-member-preparation').textContent,/聚光镜/);
 roster.click('[data-member=kai]');assert.equal(roster.query('.shell-member-preparation').dataset.performer,'kai');
 assert.match(roster.query('.shell-member-preparation').textContent,/阶位 1/);assert.match(roster.query('.shell-member-preparation').textContent,/未装备/);assert.equal(e.model().member.id,'sakura');roster.shutdown();
});

test('workshop preview remains local until explicit deploy; training and return do not silently deploy',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening']);const h=e.harness(e.TitleScene,{openPreparation:true,suppressDebugAutoStart:true});h.scene.create();
 h.click('[data-member=kai]');assert.equal(h.query('.workshop-member-context').dataset.selection,'candidate');
 assert.match(h.query('.workshop-member-context').textContent,/尚未出战/);
 h.click('[data-action=train]');assert.equal(e.profile.loadPublicProfile().preparation.trainingLevels.kai,2);assert.equal(e.model().member.id,'sakura');
 assert.match(h.query('[data-action=confirm-preparation]').textContent,/确认翡翠风歌出战/);
 h.click('[data-action=confirm-preparation]');assert.equal(e.model().member.id,'kai');assert.equal(h.starts[0][0],'IdolRosterScene');
 assert.equal(h.starts.length,1);h.shutdown();
 const [scene,data]=h.starts[0];const returned=e.harness(e[scene],data);returned.scene.create();const snapshot=returned.query('.shell-member-preparation');assert.equal(snapshot.dataset.performer,'kai');assert.match(snapshot.textContent,/阶位 2/);returned.shutdown();
});

test('failed explicit workshop deployment is not reported as a saved selection',()=>{
 const e=loadScenes();const h=e.harness(e.TitleScene,{openPreparation:true,suppressDebugAutoStart:true});h.scene.create();h.click('[data-member=genya]');
 e.storage.setItem=()=>{throw Error('denied');};h.click('[data-action=confirm-preparation]');
 assert.equal(h.starts.length,0);assert.equal(h.scene._publicShell.page,'workshop');
 assert.match(h.query('.workshop-status').textContent,/未能保存/);assert.equal(e.storage.getItem('starush.public-profile'),null);h.shutdown();
});

test('tour reward preview distinguishes replay from first-clear, without awarding or unlocking',()=>{
 const e=loadScenes();e.seed(['opening'],'opening');const before=plain(e.profile.loadPublicProfile()),h=e.harness(e.TourRouteScene);h.scene.create();
 let reward=h.query('.shell-tour-reward');assert(reward);assert.equal(reward.dataset.rewardChapter,'opening');assert.match(reward.textContent,/通关收获 · 练习笔记 \+3/);assert.doesNotMatch(reward.textContent,/首通解锁/);
 h.click('[data-chapter=neon]');reward=h.query('.shell-tour-reward');assert.equal(reward.dataset.rewardChapter,'neon');assert.match(reward.textContent,/通关收获 · 练习笔记 \+6/);assert.match(reward.textContent,/首通解锁 · 节拍同步器/);
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});

test('result identifies the earned equipment effect, not just its name; choices retain effect rules',()=>{
 const e=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null};
 const surface=new BattleSurfaceView(scene,{mode:'result',model:getPublicResultSurfaceModel({buttons:[{label:'再演',action:'retry'}]},{performerId:'kai',chapterId:'opening',victory:true,recorded:true,persisted:true,reward:{notes:6,equipmentIds:['wide_nozzle']}}),onAction(){}},e.document);
 const item=surface.root.querySelector('.battle-earned-equipment');assert(item);assert.equal(item.dataset.equipment,'wide_nozzle');assert.match(item.textContent,/攻击涂染范围 \+12/);surface.destroy();
 const choice=new BattleSurfaceView(scene,{mode:'choice',member:e.profile.PUBLIC_PERFORMERS[0],number:2,choices:['wide_brush'],options:['echo','overdrive','recovery'].map(id=>e.profile.getRunChoice(id)),onChoice(){},onLeave(){}},e.document);
 assert.equal(choice.root.querySelector('.battle-choice-list').getAttribute('aria-label'),'本场编排 2：三选一');
 assert.match(choice.root.querySelector('[data-choice=recovery]').textContent,/恢复1生命，上限5/);choice.destroy();
});
