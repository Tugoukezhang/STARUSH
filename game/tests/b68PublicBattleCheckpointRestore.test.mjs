import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,storageFixture,plain} from './helpers/publicShellHarness.mjs';
// B68: capture/restore against the real run, round, encounter, finale, PaintZone and street-state owners.
// Only Phaser drawing (device redraw, gate graphic, street images) is replaced; all state transitions are real code.
function env(storage=storageFixture()){
  const e=loadScenes({storage});e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  return {e,storage,...e.loadRuntime('utils/publicBattleCheckpoint.mjs'),...e.loadRuntime('systems/PublicBattleCheckpoint.mjs'),
    timer:e.loadRuntime('utils/stage1PaintRound.mjs').STAGE1_PAINT_TIMER_MS};
}
function world(a,now){
  const L=p=>a.e.loadRuntime(p),battleData={performerId:'sakura',campaignChapterId:'opening',stageId:1,practiceMode:false,defenseMode:false};
  const completions=[],scene={battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,
    time:{now,delayedCall:()=>({remove(){}})},battleRecord:{playerHitCount:0},
    player:{x:500,y:1800,hp:5,maxHp:5,active:true,setPosition(x,y){this.x=x;this.y=y;return this;}},
    _specialCharge:100,_encoreCharge:0,_publicFeverActive:false,_publicRelightBurstPlayed:false,notices:[],
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,_beginPublicFever(){this._publicFeverActive=true;},
    _showPublicBattleNotice(text){this.notices.push(text);},_updateHUD(){}};
  scene.publicStage1Round=new (L('systems/PublicStage1RoundController.mjs').PublicStage1RoundController)(battleData);
  scene.publicStage1Encounter=new (L('systems/PublicStage1EncounterDirector.mjs').PublicStage1EncounterDirector)(battleData);
  scene.publicStage1Encounter.enableChapterPacing();
  scene.publicStage1Finale=new (L('systems/PublicStage1FinaleController.mjs').PublicStage1FinaleController)(battleData);
  scene.publicPerformerRun=new (L('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun)(scene);
  const street=L('utils/oldStreetMap.mjs');
  // Like OldStreetScene, every interactive prop owns one item.
  scene.oldStreet={state:new street.OldStreetState(street.OLD_STREET_PROPS),finaleAnnounced:false,storyOffered:false,
    items:new Map(street.OLD_STREET_PROPS.filter(p=>p.interaction).map(p=>[p.id,{id:p.id}])),
    opened:[],restore(d){if(d?.restores)this.state.restore(d.restores);},showOpened(item){this.opened.push(item);}};
  const side=new (L('utils/chapterSideSets.mjs').ChapterSideSet)('opening'),Z=L('systems/PaintZoneSystem.js').PaintZoneSystem;
  const defs=[...a.e.campaign.getBattleChapter(battleData).devices,...side.definitions];
  scene.paintZone=Object.assign(Object.create(Z.prototype),{scene,sideSet:side,chapterObjectives:null,currentZone:0,heat:0,burstUsed:0,
    gateOpen:false,complete:false,finaleMode:false,emits:0,
    devices:defs.map(d=>({...d,paint:0,paintMax:d.paintMax||100,complete:false,paintColor:null,sequenceIndex:0,publicStage1Suppressed:false})),
    _redrawDevice(){},clearGate(){this.gateCleared=true;},_emitProgress(){this.emits++;},onDeviceComplete:d=>completions.push(d.id)});
  return {scene,run:scene.publicPerformerRun,zone:scene.paintZone,enc:scene.publicStage1Encounter,completions};
}
function begin(a,w){const now=w.run.now();
  assert.ok(w.scene.publicStage1Round.begin({now,durationMs:a.timer}));assert.ok(w.enc.begin({now}));}
function played(a){
  const w=world(a,1000);begin(a,w);w.scene.time.now=21000;
  const req=w.zone.devices.filter(d=>d.required&&d.zone===0);
  for(const d of req.slice(0,2)){d.complete=true;d.paint=d.paintMax;}
  Object.assign(req[2],{paint:7,paintColor:'pink',sequenceIndex:1});
  const west=w.zone.devices.filter(d=>d.chapterSideSet&&d.zone===0&&d.sideBranch==='west');
  for(const d of west){d.complete=true;d.paint=d.paintMax;w.zone.sideSet.completed(d,w.zone.devices);}
  w.scene.oldStreet.state.restore('record-shop');
  const door=a.e.loadRuntime('utils/oldStreetMap.mjs').OLD_STREET_PROPS.find(p=>p.interaction).id;
  w.scene.oldStreet.state.opened.add(door);
  w.enc.advance(21000,{completed:2,total:10});w.scene._chapterStationGuards=new Set(['opening-guard-east']);
  assert.ok(w.enc.beginAuthoredRole('stage-cue-emitter'));assert.ok(w.enc.resolveAuthoredRole('stage-cue-emitter','painted'));
  assert.ok(w.run.growth.choose('relay'));Object.assign(w.run,{actions:2,impacts:5});w.run.choiceEffects.relay=1;
  Object.assign(w.scene.player,{x:480,y:1500,hp:3});w.scene._specialCharge=40;w.scene._encoreCharge=12;w.scene.battleRecord.playerHitCount=2;
  return {w,door,remaining:w.scene.publicStage1Round.endsAt-21000};
}

test('closed mid-battle run resumes the same run, progress, HP and clock without awards or closed time',()=>{
  const a=env(),{w,door,remaining}=played(a);
  const dto=a.capturePublicBattleCheckpoint(w.scene,{savedAt:5});assert.ok(dto);
  assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');
  const resume=a.resolvePublicBattleResume({...w.scene.battleData,publicBattleResume:{runId:w.run.runId}});
  assert.equal(resume.status,'ok');const cp=resume.checkpoint;
  const b=world(a,50);assert.notEqual(b.run.runId,w.run.runId);
  assert.ok(a.applyPublicBattleCheckpointRun(b.scene,cp));
  assert.equal(b.run.runId,w.run.runId);assert.deepEqual(plain(b.run.growth.choices),['relay']);
  assert.deepEqual([b.run.actions,b.run.impacts,b.run.choiceEffects.relay],[2,5,1]);
  assert.deepEqual([b.scene.player.x,b.scene.player.y,b.scene.player.hp],[480,1500,3],'no free heal');
  assert.deepEqual([b.scene._specialCharge,b.scene._encoreCharge,b.scene.battleRecord.playerHitCount],[40,12,2]);
  b.scene.time.now=3200;begin(a,b);assert.ok(a.applyPublicBattleCheckpointRound(b.scene,cp));
  assert.equal(b.scene.publicStage1Round.endsAt-3200,remaining);
  assert.equal(b.run.now()-b.run.startedAt,20000,'closed time and countdown are not elapsed');
  assert.equal(b.enc.snapshot(3200).elapsedMs,20000);
  assert.deepEqual(plain(b.enc.authoredRoles),{'stage-cue-emitter':{state:'resolved',outcome:'painted'}});
  assert.equal(b.enc.currentPhaseId,w.enc.currentPhaseId);assert.equal(b.enc.lastStageCueEmitterAtMs,w.enc.lastStageCueEmitterAtMs);
  const state=z=>z.devices.map(d=>[d.id,d.paint,d.paintColor,d.sequenceIndex,d.complete]);
  assert.deepEqual(state(b.zone),state(w.zone));assert.deepEqual(plain(b.zone.sideSet.selected),plain(w.zone.sideSet.selected));
  assert.equal(b.zone.getPaintedCount(),2);assert.deepEqual(b.completions,[],'restored completions never re-run award callbacks');
  assert.ok(b.scene.oldStreet.state.restored.has('record-shop'));assert.ok(b.scene.oldStreet.state.isOpen(door));
  assert.deepEqual(b.scene.oldStreet.opened.map(i=>i.id),[door]);assert.ok(b.zone.emits>0);
  assert.deepEqual([...b.scene._chapterStationGuards],['opening-guard-east'],'a met station guard is not spawned again');
  assert.ok(b.scene.notices.some(n=>n.includes('继续')));
});

test('normal public checkpoints reject impossible owners, but transient action and bullet beats remain saveable',()=>{
  const a=env(),{w}=played(a);assert.ok(a.capturePublicBattleCheckpoint(w.scene));
  const unstable=[[()=>{w.enc.authoredRoles['objective-disruptor']={state:'active',outcome:null};},()=>{delete w.enc.authoredRoles['objective-disruptor'];}],
    [()=>{w.scene.publicStage1Finale.active=true;},()=>{w.scene.publicStage1Finale.active=false;}],
    [()=>{w.zone.finaleMode=true;},()=>{w.zone.finaleMode=false;}],
    [()=>{w.scene._battleEnded=true;},()=>{w.scene._battleEnded=false;}],
    [()=>{w.scene._isFinaleTrialRound=()=>true;},()=>{w.scene._isFinaleTrialRound=()=>false;}],
    [()=>{w.run.rulesetId=null;},()=>{w.run.rulesetId=a.e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID;}]];
  for(const [make,undo] of unstable){make();assert.equal(a.capturePublicBattleCheckpoint(w.scene),null);undo();}
  w.run.timers.add({});w.scene._publicStage1StageCuePulse={active:true};assert.ok(a.capturePublicBattleCheckpoint(w.scene));
  w.run.timers.clear();w.scene._publicStage1StageCuePulse=null;
  assert.ok(a.capturePublicBattleCheckpoint(w.scene));
});

test('resume is rejected on run, performer, chapter or device mismatch without deleting the checkpoint',()=>{
  const a=env(),{w}=played(a),dto=a.capturePublicBattleCheckpoint(w.scene);a.writePublicBattleCheckpoint(dto);
  const data={...w.scene.battleData,publicBattleResume:{runId:w.run.runId}};
  assert.equal(a.resolvePublicBattleResume({...w.scene.battleData}).status,'fresh');
  for(const bad of [{...data,publicBattleResume:{runId:'other'}},{...data,performerId:'kai'},{...data,campaignChapterId:'neon'}])
    assert.equal(a.resolvePublicBattleResume(bad).status,'rejected');
  a.writePublicBattleCheckpoint({...dto,paint:{...dto.paint,devices:[...dto.paint.devices,{...dto.paint.devices[0],id:'harbor-meeting'}]}});
  assert.equal(a.resolvePublicBattleResume(data).status,'rejected');assert.ok(a.storage.getItem('starush.public-battle-checkpoint.v1'));
});

test('TitleScene resumes the original performer and chapter even after the lobby selection changed',()=>{
  const a=env(),{w}=played(a),dto=a.capturePublicBattleCheckpoint(w.scene);
  const h=a.e.harness(a.e.TitleScene);h.scene.create();assert.equal(h.scene._resumePublicBattle(),'none');assert.equal(h.starts.length,0);
  a.writePublicBattleCheckpoint(dto);a.e.profile.selectPublicPerformer('kai');
  assert.equal(h.scene._resumePublicBattle(),'ok');const [key,data]=h.starts.at(-1);
  assert.equal(key,'BattleScene');assert.deepEqual([data.performerId,data.characterId,data.campaignChapterId,data.team[0].id],['sakura','sakura','opening','sakura']);
  assert.deepEqual(plain(data.publicBattleResume),{runId:w.run.runId});assert.equal(data.practiceMode,false);
  a.writePublicBattleCheckpoint({...dto,battle:{...dto.battle,chapterId:'neon'}});assert.equal(h.scene._resumePublicBattle(),'locked');
  h.shutdown();
});

test('BattleScene wires the checkpoint at create, round start, pause, update and battle end',async()=>{
  const {readFileSync}=await import('node:fs'),src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const body=name=>src.slice(src.indexOf('\n  '+name+'('),src.indexOf('\n  }\n',src.indexOf('\n  '+name+'(')));
  const create=body('create'),round=body('_beginPublicPaintRound');
  assert.ok(create.indexOf('resolvePublicBattleResume(')>0&&create.indexOf('resolvePublicBattleResume(')<create.indexOf("this.events.once('shutdown'"));
  assert.ok(create.indexOf('applyPublicBattleCheckpointRun(')>create.indexOf('this._setupPublicPaintWorld()'));
  assert.ok(round.indexOf('applyPublicBattleCheckpointRound(')>round.indexOf('this.paintZone.start()'));
  assert.ok(round.indexOf('applyPublicBattleCheckpointRound(')<round.indexOf('this._paintRoundEndsAt ='));
  assert.match(body('_setBattlePaused'),/_publicBattleCheckpoint\?\.flush\('pause'\)/);
  assert.match(body('update'),/_publicBattleCheckpoint\?\.tick\(\)/);
  assert.match(body('_endBattle'),/_publicBattleCheckpoint\?\.finish\(this\._publicRunResult\)/);
});
