import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function checkpoint(ruleset){return {kind:'starush.public-battle-checkpoint',version:1,rulesetId:ruleset,savedAt:1700000000000,runId:'home-continue-run',
 battle:{performerId:'sakura',chapterId:'opening',preparation:null,runGoal:null,routePlan:null,arrangementPlan:null},
 run:{elapsedMs:20000.25,choices:[],shotCount:0,checkpoints:0,actions:2,impacts:5,modificationReleases:0,choiceEffects:{relay:0,echo:0,tempo:0,recovery:0},encounterEvent:null,goalMissedNotice:false},
 player:{x:480,y:900,hp:3,specialCharge:40,encoreCharge:10,hitCount:2,feverActive:false,relightBurstPlayed:false},round:{remainingMs:70000},
 encounter:{elapsedMs:20000,currentPhaseId:'movement-build',phaseEnteredAtMs:12000,northEntered:false,lastEmitterAtMs:18000,lastEmitterPhaseId:'movement-build',lastDisruptorAtMs:null,lastDisruptorPhaseId:null,captainClaimed:false,roles:{'stage-cue-emitter':'painted'},event:null},
 paint:{zone:0,heat:3,burstUsed:0,complete:false,sideSelected:[null,null],devices:[{id:'oldstreet-welcome',paint:52,color:'pink',sequenceIndex:0,complete:true,calibrating:false,calibrationMs:0}]},
 street:{opened:[],restored:[],finaleAnnounced:false,storyOffered:false,stationGuards:[]}};}
function home(saved=false,selected='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(selected);
 const cp=e.loadRuntime('utils/publicBattleCheckpoint.mjs');if(saved)assert.equal(cp.writePublicBattleCheckpoint(checkpoint(e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID)).status,'saved');
 const h=e.harness(e.TitleScene);h.scene.create();return {e,cp,h};
}
test('fresh home does not invent a usable continue button',()=>{const {h}=home();assert.equal(h.query('[data-action=resume-run]'),null);h.click('[data-action=start]');assert.equal(h.starts[0][0],'BattleScene');h.shutdown();});
test('real saved checkpoint offers continue with the saved actor/chapter, not current selection',()=>{
 const {h}=home(true,'kai');const resume=h.query('[data-action=resume-run]');assert(resume);assert.match(h.query('.lobby-resume-summary').textContent,/步枪手/);assert.match(h.query('.lobby-resume-summary').textContent,/星光初演/);assert.match(h.query('.lobby-resume-summary').textContent,/20.00秒/);assert.equal(h.query('[data-action=start]').textContent,'新公演');
 h.click('[data-action=resume-run]');assert.equal(h.starts[0][0],'BattleScene');assert.equal(h.starts[0][1].performerId,'sakura');assert.equal(h.starts[0][1].publicBattleResume.runId,'home-continue-run');h.shutdown();
});
test('new battle warns before replacing a midrun checkpoint; cancel keeps it byte-identical',()=>{
 const {h,cp}=home(true);const before=plain(cp.readPublicBattleCheckpoint().checkpoint);h.click('[data-action=start]');assert.equal(h.starts.length,0);assert(h.query('[data-action=confirm-new-run]'));h.click('[data-action=cancel-new-run]');assert.equal(h.starts.length,0);assert.deepEqual(plain(cp.readPublicBattleCheckpoint().checkpoint),before);
 h.click('[data-action=start]');h.click('[data-action=confirm-new-run]');assert.equal(h.starts[0][0],'BattleScene');assert(!h.starts[0][1].publicBattleResume);h.shutdown();
});
test('checkpoint disappearance between render and click reports a status without getting navigation stuck',()=>{
 const {h,cp}=home(true);assert.equal(cp.discardPublicBattleCheckpoint({expectedRunId:'home-continue-run'}).status,'discarded');h.click('[data-action=resume-run]');assert.equal(h.starts.length,0);assert.equal(h.scene._publicShell.navigating,false);assert(h.query('.lobby-resume-message'));h.shutdown();
});
