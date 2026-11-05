import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

test('current three-character stories are authored independently and keep unlock gates',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const story=env.loadRuntime('utils/publicStory.mjs');
  const speakers=new Set(['旁白','步枪手','机甲剑士','重锤手']);
  for(const id of ['sakura','kai','enjo']){
    const d=story.getCharacterDossier(id);
    assert.match(d.motive+d.relationship,/喷|通路|音箱/);
    assert.doesNotMatch(JSON.stringify(d),/绯樱|苍海|金星|幻夜|炎上/);
    for(const chapter of ['opening','neon','encore'])for(const phase of ['intro','midpoint','outro']){
      const beat=story.getChapterStory(chapter,phase,id);
      assert.equal(beat.id,`${chapter}:${phase}`);
      assert.ok(beat.lines.every(l=>speakers.has(l.speaker)));
      assert.ok(beat.lines.some(l=>l.speaker===d.name));
    }
  }
  assert.match(story.getChapterStory('neon','midpoint','sakura').lines.map(l=>l.text).join(''),/两边|两家/);
  assert.match(story.getChapterStory('encore','midpoint','enjo').lines.map(l=>l.text).join(''),/校准/);
  assert.equal(story.getReadableStoryEntries(env.profile.loadPublicProfile()).length,1);
  env.seed(['opening']);
  assert.equal(story.canReadStoryBeat(env.profile.loadPublicProfile(),'neon','outro'),false);
  env.loadRuntime('utils/userCast.mjs').configureUserCast(false);
  assert.equal(story.getCharacterDossier('sakura').name,'绯樱');
  assert.ok(story.getChapterStory('encore','intro','kai').lines.some(l=>l.speaker==='苍海'));
});

test('arrangement studies use real pools/effects and previews never write',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const content=env.loadRuntime('utils/publicSessionContent.mjs');
  const goals=env.loadRuntime('utils/publicRunGoals.mjs'),catalog=goals.getArrangementCatalog();
  assert.equal(content.PUBLIC_ARRANGEMENT_STUDIES.length,3);
  for(const row of content.PUBLIC_ARRANGEMENT_STUDIES){
    assert.ok(catalog.first.some(c=>c.id===row.first));assert.ok(catalog.second.some(c=>c.id===row.second));
    const guide=content.getPublicArrangementGuide(row.first,row.second,'kai','encore');
    assert.deepEqual(plain(guide.effects),plain(goals.previewPublicArrangement(row.first,row.second).effects));
    assert.match(guide.memberNote,/受伤|无敌/);assert.match(guide.chapterNote,/校准/);
  }
  const shell=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPage:'library'});shell.scene.create();
  const before=env.storage.getItem('starush.public-profile');
  shell.click('[data-arrangement-study="relay-echo"]');
  assert.equal(shell.query('[data-arrangement="relay"]').getAttribute('aria-pressed'),'true');
  assert.equal(shell.query('[data-arrangement="echo"]').getAttribute('aria-pressed'),'true');
  assert.equal(env.storage.getItem('starush.public-profile'),before);
  shell.click('[data-arrangement="tempo"]');
  assert.equal(shell.query('[data-arrangement-study="relay-echo"]').getAttribute('aria-pressed'),'false');shell.shutdown();
});

test('earned handoff requires durable ownership and matching reward chapter',()=>{
  const env=loadScenes();const {getEarnedEquipmentHandoff}=env.loadRuntime('utils/publicSessionContent.mjs');
  env.seed(['opening']);const profile=env.profile.loadPublicProfile();
  const run={performerId:'kai',chapterId:'opening',victory:true,recorded:true,persisted:true,reward:{equipmentIds:['wide_nozzle']}};
  assert.deepEqual(plain(getEarnedEquipmentHandoff(run,profile)),{memberId:'kai',equipmentId:'wide_nozzle'});
  for(const change of [{persisted:false},{recorded:false},{victory:false},{performerId:'unknown'},{chapterId:'neon'},
    {reward:{equipmentIds:['rhythm_sync']}},{reward:{equipmentIds:[]}}])assert.equal(getEarnedEquipmentHandoff({...run,...change},profile),null);
  assert.equal(getEarnedEquipmentHandoff(run,{...profile,persisted:false}),null);
  assert.equal(getEarnedEquipmentHandoff(run,{...profile,campaign:{chapterClears:{}}}),null);
});

test('inventory handoff stays local and explicit equip does not change deployment',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);env.seed(['opening']);
  const before=env.storage.getItem('starush.public-profile');
  const shell=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment:{memberId:'kai',equipmentId:'wide_nozzle'}});
  shell.scene.create();
  assert.equal(shell.scene._publicShell.selection.memberId,'kai');
  assert.equal(shell.scene._publicShell.inventoryId,'wide_nozzle');assert.match(shell.text,/机甲剑士/);
  assert.equal(env.storage.getItem('starush.public-profile'),before);
  shell.click('[data-action="equip-selected"]');const after=env.profile.loadPublicProfile();
  assert.equal(after.selectedId,'sakura');assert.equal(after.preparation.equipmentByPerformer.kai,'wide_nozzle');
  assert.equal(after.preparation.equipmentByPerformer.sakura,null);shell.shutdown();
});

test('locked or invalid inventory context is ignored',()=>{
  for(const earnedEquipment of [{memberId:'kai',equipmentId:'rhythm_sync'},{memberId:'unknown',equipmentId:'wide_nozzle'},null]){
    const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
    const shell=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment});shell.scene.create();
    assert.equal(shell.scene._publicShell.selection.memberId,'sakura');assert.notEqual(shell.scene._publicShell.inventoryId,'rhythm_sync');shell.shutdown();
  }
});

test('result command only offers durable reward and handler rechecks before navigating',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);env.seed(['opening']);
  const {BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const run={performerId:'kai',chapterId:'opening',durationMs:12000,victory:true,recorded:true,persisted:true,choices:[],reward:{notes:6,equipmentIds:['wide_nozzle']}};
  const config={buttons:[]},events=[],h=env.harness(env.TitleScene);
  const view=new BattleSurfaceView(h.scene,{mode:'result',model:getPublicResultSurfaceModel(config,run),onAction:action=>events.push(action)},env.document);
  const button=view.root.querySelector('[data-result-action="earned-equipment"]');assert.ok(button);button.click();assert.deepEqual(events,['earned-equipment']);view.destroy();
  const pending=new BattleSurfaceView(h.scene,{mode:'result',model:getPublicResultSurfaceModel(config,{...run,persisted:false}),onAction:()=>{}},env.document);
  assert.equal(pending.root.querySelector('[data-result-action="earned-equipment"]'),null);pending.destroy();
  const {BattleScene}=env.loadRuntime('scenes/BattleScene.js');const starts=[],releases=[];
  const scene={_publicRunResult:run,scene:{start:(...args)=>starts.push(args)},_releaseBattleRuntimeObjects:r=>releases.push(r)};
  BattleScene.prototype._handleBattleResultAction.call(scene,'earned-equipment');
  assert.deepEqual(plain(starts),[['TitleScene',{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment:{memberId:'kai',equipmentId:'wide_nozzle'}}]]);
  assert.deepEqual(releases,['earned-equipment']);
  assert.equal(BattleScene.prototype._handleBattleResultAction.call({...scene,_battleResultNavigating:false,_publicRunResult:{...run,persisted:false}},'earned-equipment'),false);
  assert.equal(starts.length,1);
});
