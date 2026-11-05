import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const Battle=loadBattleScene({Phaser:{Scene:class{},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}}});
const file=new URL('../src/utils/publicBattleAbilities.mjs',import.meta.url),api=e=>fs.existsSync(file)?e.loadRuntime('utils/publicBattleAbilities.mjs'):{};
function world(id='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const effects=[],timers=[],s=Object.assign(Object.create(Battle.prototype),{
  _userCastPresentation:true,_battlePaused:false,_battleEnded:false,_specialCharge:100,_encoreCharge:100,
  battleData:{stageId:1,practiceMode:false,defenseMode:false,performerId:id,characterId:id,team:[{characterId:id}],campaignChapterId:'opening'},
  player:{x:200,y:400,active:true,hp:5,maxHp:5},_battlePerformerContract:{publicActionOwnerId:id},
  publicStage1Round:{snapshot:()=>({phase:'active'}),getPerformerId:()=>id},_isPublicStage1Round:()=>true,
  paintZone:{burstRelight:(...v)=>effects.push(['paint',...v])},oldStreet:{clearLine:()=>true},enemyBullets:{getChildren:()=>[]},battleRecord:{},
  _spawnPaintEncoreBurst:(...v)=>effects.push(['cutin',...v]),_showRoundBanner:message=>effects.push(['banner',message]),
  time:{now:1000,delayedCall(ms,fn){const t={ms,fn,remove(){}};timers.push(t);return t;}},
 });
 for(const id of ['special-label','special-state','encore-state','special-fill','skill-special','skill-encore','ult-prompt']){const n=e.document.createElement(id.startsWith('skill')?'button':'span');n.id=id;e.document.body.append(n);}
 s.specialSkillEl=e.document.getElementById('skill-special');s.encoreSkillEl=e.document.getElementById('skill-encore');s.ultPromptEl=e.document.getElementById('ult-prompt');
 const Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun;s.publicPerformerRun=new Run(s);s._updateHUD=()=>e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud(s,e.document);
 return {e,s,r:s.publicPerformerRun,effects,timers};
}
const readyFacts={alive:true,playerPresent:true,playerReady:true,originReady:true,paintZoneReady:true,publicRound:true,performerId:'sakura',roundPerformerId:'sakura',ownerId:'sakura',specialCharge:100,encoreCharge:100};

test('one immutable availability policy preserves independent active/Encore charge and ownership gates',()=>{
 const e=loadScenes(),a=api(e);assert.equal(typeof a.evaluatePublicBattleAbilities,'function');const f={...readyFacts},r=a.evaluatePublicBattleAbilities(f);assert(Object.isFrozen(r)&&Object.isFrozen(r.action)&&Object.isFrozen(r.encore));assert(r.action.canRelease&&r.encore.canRelease);f.specialCharge=0;assert.equal(r.action.charge,100);
 for(const [patch,action,encore]of [[{specialCharge:99.9},false,true],[{encoreCharge:99.9},true,false],[{encoreCharge:'100'},true,false],[{roundPerformerId:'kai'},true,false],[{publicRound:false},true,false],[{encoreActive:true},true,false]]){const row=a.evaluatePublicBattleAbilities({...readyFacts,...patch});assert.equal(row.action.canRelease,action);assert.equal(row.encore.canRelease,encore);}
});

test('phases and invalid ownership/world/life produce no false ready or resource mutation',()=>{
 const e=loadScenes(),a=api(e);assert.equal(typeof a.evaluatePublicBattleAbilities,'function');for(const [patch,state]of [[{preparing:true},'preparing'],[{paused:true},'paused'],[{ended:true},'ended'],[{choiceOpen:true},'busy'],[{specialBusy:true},'busy'],[{ownerId:'kai'},'unavailable'],[{paintZoneReady:false},'unavailable'],[{alive:false},'unavailable']]){const f={...readyFacts,...patch},before=JSON.stringify(f),r=a.evaluatePublicBattleAbilities(f);assert.equal(r.action.state,state);assert.equal(r.encore.state,state);assert(!r.action.canRelease&&!r.encore.canRelease);assert.equal(JSON.stringify(f),before);}
 for(const value of [null,{},[],undefined]){const r=a.evaluatePublicBattleAbilities(value);assert(!r.action.canRelease&&!r.encore.canRelease);}
});

test('invalid nonfinite charge is never shown or accepted as full while valid active numeric strings remain compatible',()=>{
 const e=loadScenes(),a=api(e);assert.equal(typeof a.evaluatePublicBattleAbilities,'function');for(const value of [NaN,Infinity,-Infinity]){const r=a.evaluatePublicBattleAbilities({...readyFacts,specialCharge:value,encoreCharge:value});assert.equal(r.action.charge,0);assert.equal(r.encore.charge,0);assert(!r.action.canRelease&&!r.encore.canRelease);}assert(a.evaluatePublicBattleAbilities({...readyFacts,specialCharge:'100'}).action.canRelease);
});

test('actual Run has one read-only snapshot and rejects preparing action just as the HUD does',()=>{
 const f=world(),before=JSON.stringify([f.s._specialCharge,f.s._encoreCharge,f.r.actions,f.r.getContext()]);assert.equal(typeof f.r.getAbilityState,'function');const state=f.r.getAbilityState();assert(state.action.canRelease&&state.encore.canRelease);f.s.publicStage1Round.snapshot=()=>({phase:'idle'});assert.equal(f.r.canAct(),false);f.s._updateHUD();assert.equal(f.e.document.getElementById('special-state').textContent,'待开演');assert.equal(f.timers.length,0);assert.equal(JSON.stringify([f.s._specialCharge,f.s._encoreCharge,f.r.actions,f.r.getContext()]),before);
});

test('real HUD Encore refusal agrees with real entry while a legacy release is busy',()=>{
 const f=world();f.r.sakuraCombat={specialBusy:true};f.s._updateHUD();assert.equal(f.e.document.getElementById('skill-encore').getAttribute('aria-disabled'),'true');assert.equal(f.s._triggerPublicRelightBurst(),false);assert.equal(f.s._encoreCharge,100);assert.deepEqual(f.effects,[]);
});

test('three actual Run/Scene/HUD consumers agree for blocked and current ordinary states',()=>{
 for(const id of ['sakura','kai','enjo'])for(const mutate of [s=>s._battlePaused=true,s=>s._battleEnded=true,s=>s.player.hp=0,s=>s.player.active=false,s=>s.paintZone=null,s=>s._battlePerformerContract.publicActionOwnerId='other']){const f=world(id);mutate(f.s);assert.equal(typeof f.r.getAbilityState,'function');const state=f.r.getAbilityState(),before=[f.s._specialCharge,f.s._encoreCharge];assert(!state.action.canRelease&&!state.encore.canRelease);f.s._updateHUD();assert.equal(f.e.document.getElementById('skill-special').getAttribute('data-charge-state'),state.action.state);assert.equal(f.e.document.getElementById('skill-encore').getAttribute('data-charge-state'),state.encore.state);assert.equal(f.s._triggerPublicRelightBurst(),false);assert.deepEqual([f.s._specialCharge,f.s._encoreCharge],before);assert.deepEqual(f.effects,[]);}
});

test('real accepted Encore keeps original cost, five-second window, relight and cutin once, then HUD is active rather than ready',()=>{
 for(const id of ['sakura','kai','enjo']){const f=world(id);assert.equal(f.s._triggerPublicRelightBurst(),true);assert.equal(f.s._specialCharge,100);assert.equal(f.s._encoreCharge,0);assert.equal(f.s._publicSakuraEncoreEndsAt,6000);assert.equal(f.effects.filter(r=>r[0]==='paint').length,1);assert.equal(f.effects.filter(r=>r[0]==='cutin').length,1);assert.equal(f.e.document.getElementById('skill-encore').getAttribute('data-charge-state'),'active');assert.equal(f.e.document.getElementById('skill-encore').classList.contains('ready'),false);assert.equal(f.s._triggerPublicRelightBurst(),false);assert.equal(f.effects.filter(r=>r[0]==='paint').length,1);}
});

test('real HUD ready classes and original prompt consume the same availability snapshot',()=>{
 const f=world();f.s._updateHUD();assert(f.s.specialSkillEl.classList.contains('ready'));assert(f.s.encoreSkillEl.classList.contains('ready'));assert(f.s.ultPromptEl.classList.contains('show'));f.r.choiceOpen=true;f.s._updateHUD();assert.equal(f.s.specialSkillEl.classList.contains('ready'),false);assert.equal(f.s.encoreSkillEl.classList.contains('ready'),false);assert.equal(f.s.ultPromptEl.classList.contains('show'),false);assert.equal(f.s._triggerPublicRelightBurst(),false);assert.equal(f.s._encoreCharge,100);
});

test('missing player cannot advertise or enter either ability and cannot spend or schedule effects',()=>{
 for(const id of ['sakura','kai','enjo']){const f=world(id);delete f.s.player;const a=f.r.getAbilityState();assert(!a.action.canRelease&&!a.encore.canRelease);f.s._updateHUD();assert.equal(f.s.specialSkillEl.getAttribute('aria-disabled'),'true');assert.equal(f.s.encoreSkillEl.getAttribute('aria-disabled'),'true');assert.equal(f.r.triggerAction(),false);assert.equal(f.s._triggerPublicRelightBurst(),false);assert.deepEqual([f.s._specialCharge,f.s._encoreCharge],[100,100]);assert.equal(f.timers.length,0);assert.deepEqual(f.effects,[]);}
});

test('Encore finite-origin policy agrees with its original release guard without broadening Action coordinate gates',()=>{
 for(const key of ['x','y'])for(const value of [NaN,Infinity,-Infinity,undefined]){const f=world();f.s.player[key]=value;const a=f.r.getAbilityState();assert.equal(a.action.canRelease,true);assert.equal(a.encore.canRelease,false);f.s._updateHUD();assert.equal(f.s.encoreSkillEl.getAttribute('aria-disabled'),'true');assert.equal(f.s.ultPromptEl.classList.contains('show'),false);assert.equal(f.s._triggerPublicRelightBurst(),false);assert.equal(f.s._encoreCharge,100);assert.equal(f.timers.length,0);assert.deepEqual(f.effects,[]);}
});
