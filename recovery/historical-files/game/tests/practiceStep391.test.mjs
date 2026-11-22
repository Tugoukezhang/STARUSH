import test from 'node:test';import assert from 'node:assert/strict';
import {getPublicPracticeStep,createPublicPracticeStep} from '../src/systems/PublicPracticeStepView.mjs';
import {ChapterChaserMotion} from '../src/utils/chapterChaserContent.mjs';
import {ChapterSideSet} from '../src/utils/chapterSideSets.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';
function fixture(id='opening'){
 const sideSet=new ChapterSideSet(id),devices=[{id:'fixture',label:'门灯',x:120,y:100,paint:14,paintMax:52,required:true,zone:0},...sideSet.definitions.map(d=>({...d,complete:false}))];
 return {_userCastPresentation:true,battleData:{campaignChapterId:id},publicPerformerRun:{context:{modeId:'campaign'},member:{id:'kai'},alive:()=>true,now:()=>1000},
 player:{x:100,y:100,hp:5},publicStage1Round:{phase:'active'},_specialCharge:100,oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},
 paintZone:{devices,currentZone:0,sideSet,chapterObjectives:new ChapterObjectiveContract(id),getObjectiveProgress:()=>({completed:0,total:10})}};
}
test('single live facility reading never writes paint, counters, ordering or score; native disclosure only changes DOM',()=>{
 const s=fixture(),before=JSON.stringify(s),doc=createDocument();const step=getPublicPracticeStep(s);assert.equal(step.key,'facility');assert.match(step.evidence,/14 \/ 52/);
 const root=createPublicPracticeStep(doc,s);assert(root);assert.equal(root.tagName,'DETAILS');root.open=true;root.open=false;assert.equal(JSON.stringify(s),before);
 s.paintZone.devices[0].paint=26;assert.match(getPublicPracticeStep(s).evidence,/26 \/ 52/);assert.equal(step.evidence.includes('14 / 52'),true,'old snapshot does not mutate');
});
test('short rush uses actual matching motion, visible proximity and full gauge; paused input gate is not confused with empty gauge',()=>{
 const s=fixture('neon'),m=new ChapterChaserMotion('neon'),e={x:150,y:100,hp:20,active:true,publicStage1EnemyRole:'unlit-chaser',chapterChaserMotion:m,publicStage1EnemyState:'windup'};m.state='windup';s.enemies.getChildren=()=>[e];s._battlePaused=true;s.publicPerformerRun.getAbilityState=()=>({action:{canRelease:false}});
 assert.equal(getPublicPracticeStep(s).key,'chaser-tell');assert.match(getPublicPracticeStep(s).evidence,/槽已满/);s._specialCharge=99;assert.match(getPublicPracticeStep(s).evidence,/不等待技能/);
 m.recover(800);e.publicStage1EnemyState='recovery';assert.equal(getPublicPracticeStep(s).key,'chaser-recovery');assert.match(getPublicPracticeStep(s).evidence,/0.5秒/);
 s.oldStreet.clearLine=()=>false;assert.equal(getPublicPracticeStep(s).key,'facility');s.oldStreet.clearLine=()=>true;e.x=500;assert.equal(getPublicPracticeStep(s).key,'facility');
 e.x=150;e.chapterChaserMotion={...m};assert.equal(getPublicPracticeStep(s).key,'facility');
});
test('real rooftop pending station takes priority and real same-zone side completion changes the advice',()=>{
 const s=fixture('raincheck'),d=s.paintZone.devices[0];Object.assign(d,{id:'rooftop-south-center',paint:52,chapterAwaitingCalibration:true});
 assert.equal(getPublicPracticeStep(s).key,'calibration');assert.match(getPublicPracticeStep(s).action,/先接通本区同线两站/);
 s.paintZone.devices.filter(d=>d.chapterSideSet&&d.zone===0&&d.sideBranch==='west').forEach(d=>d.complete=true);
 assert.match(getPublicPracticeStep(s).action,/已有两站储备/);d.publicStage1Suppressed=true;assert.equal(getPublicPracticeStep(s).key,'pressure');
});
test('finale only calls an actual capture a tell, distinguishes in-flight pulse, and never labels an empty gap recovery',()=>{
 const s=fixture();s.paintZone.finaleMode=true;let phase='attack';s.publicStage1Finale={snapshot:()=>({phase})};s._publicStage1FinaleBoss={};
 assert.equal(getPublicPracticeStep(s).key,'finale-wait');s._publicStage1FinaleBoss.publicStage1FinaleAttackTimer={};assert.equal(getPublicPracticeStep(s).key,'finale-tell');
 delete s._publicStage1FinaleBoss.publicStage1FinaleAttackTimer;s._publicStage1FinaleBoss.publicStage1CuePulse={active:true};assert.equal(getPublicPracticeStep(s).key,'finale-pulse');
 phase='weak-point';assert.equal(getPublicPracticeStep(s),null);s._publicStage1FinaleWeakPoint={active:true};assert.equal(getPublicPracticeStep(s).key,'finale-weak');phase='boss-recovery';assert.equal(getPublicPracticeStep(s).key,'finale-recovery');
});
test('foreign mode, dead owner, pre-countdown and nightline never receive incompatible steps',()=>{
 for(const change of [s=>s.publicPerformerRun.context.modeId='rehearsal',s=>s.publicPerformerRun.alive=()=>false,s=>s.publicStage1Round.phase='ready',s=>s.battleData.campaignChapterId='nightline',s=>s._userCastPresentation=false]){const s=fixture();change(s);assert.equal(getPublicPracticeStep(s),null);}
});
