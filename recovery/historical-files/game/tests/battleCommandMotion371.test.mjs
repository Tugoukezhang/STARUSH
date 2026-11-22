import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {getBattleCommandMotion371 as sample,syncBattleCommandMotion371 as sync} from '../src/systems/BattleCommandMotion371.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function fixture(id='sakura'){
 const timers=[],paints=[];
 const s={battleData:{stageId:1,performerId:id},_userCastPresentation:true,time:{now:0,delayedCall(delay,fn){const t={delay,fn,remove(){}};timers.push(t);return t;}},player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},battleRecord:{playerHitCount:0},_battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,_encoreCharge:0,
 paintZone:{devices:[],currentZone:0,applyPaintAt(...a){paints.push(a);return true;}},enemies:{getChildren:()=>[]},oldStreet:{clearLine:()=>true},_stampGroundSplat(){},_paintPublicStage1TargetsAt:()=>false,_showRoundBanner(){},_updateHUD(){},actorPresentation:{direction:'left',userCastView:{state:'idle'}}};
 const run=s.publicPerformerRun=new PublicStage1PerformerRun(s);return {s,run,timers,paints};
}
for(const id of ['sakura','kai','enjo'])test(id+' real action timing, pause/resume and end use the owner without replaying paint',()=>{
 const {s,run,timers,paints}=fixture(id);assert.equal(sample(s,'special'),null);s.time.now=20;assert(run.triggerAction());
 const before={actions:run.actions,charge:s._specialCharge,paints:paints.length,timers:timers.length};
 assert.equal(sample(s,'special').phase,id==='enjo'?'recovery':'release');assert.equal(sample(s,'special').progress,0);
 s.time.now=120;run.pauseClock();s._battlePaused=true;const frozen=sample(s,'special');s.time.now=5120;assert.deepEqual(sample(s,'special'),frozen);
 run.resumeClock();s._battlePaused=false;assert.deepEqual(sample(s,'special'),frozen);s.time.now=5240;assert.equal(sample(s,'special').phase,'recovery');
 s.time.now=5340;assert.equal(sample(s,'special'),null);assert.deepEqual({actions:run.actions,charge:s._specialCharge,paints:paints.length,timers:timers.length},before);
 run.destroy();assert.equal(sample(s,'special'),null);
});
test('Encore remaining window uses same paused clock, clamps and expires exactly; hidden/end/death clear',()=>{
 const {s,run}=fixture();s._publicSakuraEncoreEndsAt=5000;s._isPublicSakuraEncoreWindowActive=now=>now<s._publicSakuraEncoreEndsAt;
 assert.equal(sample(s,'encore').caption,'返场5.0s');s.time.now=1234;assert.equal(sample(s,'encore').caption,'返场3.8s');assert.equal(sample(s,'encore').progress,3766/5000);
 run.pauseClock();const frozen=sample(s,'encore');s.time.now=9000;assert.deepEqual(sample(s,'encore'),frozen);run.resumeClock();s.time.now+=3766;assert.equal(sample(s,'encore'),null);
 s._publicSakuraEncoreEndsAt=run.now()+5000;for(const [key,value]of [['_battleEnded',true],['_userCastPresentation',false]]){const old=s[key];s[key]=value;assert.equal(sample(s,'encore'),null);s[key]=old} s.player.hp=0;assert.equal(sample(s,'encore'),null);run.destroy();
});
test('DOM presents stages separately from canonical charge/permission; pause caption wins and only one band mounts',()=>{
 const {s,run}=fixture('kai'),{document:doc}=loadScenes();const b=doc.createElement('button');b.id='skill-special';doc.body.append(b);const state=doc.createElement('span');state.id='special-state';b.append(state);run.triggerAction();s.time.now=80;
 const fact={state:'charging',charge:17};b.dataset.chargeState='charging';b.setAttribute('aria-disabled','true');b.style.setProperty('--charge-turn','.17turn');
 sync(s,doc,b,'special',run.member,fact);assert.equal(state.textContent,'突进中');assert.equal(b.dataset.commandPhase,'release');assert.equal(b.getAttribute('aria-disabled'),'true');assert.equal(b.style['--charge-turn'],'.17turn');assert.match(b.getAttribute('aria-label'),/充能 17%/);
 const width=b.querySelector('.battle-command-phase-fill').style.width;run.pauseClock();s._battlePaused=true;s.time.now=10000;state.textContent='已暂停';b.setAttribute('aria-label','已暂停');
 for(let i=0;i<10;i++)sync(s,doc,b,'special',run.member,{...fact,state:'paused'});assert.equal(state.textContent,'已暂停');assert.equal(b.querySelector('.battle-command-phase-fill').style.width,width);assert.equal(b.querySelectorAll('.battle-command-phase').length,1);
 s._battleEnded=true;sync(s,doc,b,'special',run.member,{...fact,state:'ended'});assert(b.querySelector('.battle-command-phase').hidden);assert.equal(b.dataset.commandPhase,'idle');run.destroy();
});
