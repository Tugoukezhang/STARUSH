import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {createDocument} from './helpers/publicShellHarness.mjs';import {syncPublicBossPresentation} from '../src/systems/PublicBossPresentation.mjs';
test('Boss explicitly distinguishes protected body, real weak point and open body without changing HP',()=>{
 const doc=createDocument();let now=1000;const boss={active:true,hp:60,maxHp:60,publicStage1EnemyState:'windup'};
 const s={battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening'},_userCastPresentation:true,_isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,events:new EventEmitter(),_publicStage1FinaleBoss:boss,publicPerformerRun:{now:()=>now}};
 const state={active:true,phase:'attack',attackPattern:'captured-line',weakPointCount:3,weakPointsResolved:0};
 const text=()=>doc.querySelector('.public-boss-instruction')?.textContent;
 syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'防护中 · 先闪避');boss.publicBlockedHitAt=900;syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'攻击被挡 · 先闪避');now=1600;syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'防护中 · 先闪避');
 state.phase='weak-point';syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'等待弱点 · 自由移动');s._publicStage1FinaleWeakPoint={active:true};syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'弱点开放 · 瞄准标记');state.phase='boss-recovery';boss.publicStage1EnemyState='recovery';syncPublicBossPresentation(s,state,{doc});assert.equal(text(),'本体开放 · 集中攻击');assert.equal(boss.hp,60);
 s.events.emit('shutdown');assert.equal(doc.querySelector('.public-boss-strip'),null);
});
