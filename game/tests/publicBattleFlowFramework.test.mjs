import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createDocument} from './helpers/publicShellHarness.mjs';import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {resolvePublicObjectiveGuidanceTarget} from '../src/systems/PublicObjectiveGuidance.mjs';
const api=await import('../src/utils/publicBattleFlow.mjs').catch(()=>({}));
function flow(s,options){assert.equal(typeof api.getPublicBattleFlow,'function','shared battle flow missing');return api.getPublicBattleFlow(s,options);}
function fixture({complete=false,ready=true,side=false,finale=null}={}){
 const s={battleData:{stageId:1,campaignChapterId:'opening',performerId:'enjo',practiceMode:false,defenseMode:false},_userCastPresentation:true,
  player:{active:true,x:500,y:1200,hp:5},time:{now:100},publicPerformerRun:{now:()=>100,canAct:()=>false},
  paintZone:{devices:[],currentZone:1,getPaintedCount:()=>complete?10:4,getTotalCount:()=>10,isComplete:()=>complete,
   getNearestObjective:()=>({id:'lamp',x:510,y:1150,sourceLabel:'灯箱',zone:1})},
  oldStreet:{config:{finaleLabel:'前往露天剧场'},finaleDestination:()=>({x:500,y:400})},publicStage1Encounter:{canEnterFinale:()=>ready},
  publicStage1Finale:{snapshot:()=>finale,advance(){throw Error('read model cannot advance finale');}},_isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false};
 if(side)s.paintZone.sideSet={snapshot:()=>({completed:2,total:4})};return s;
}
const boss=(phase,over={})=>({active:true,phase,complete:false,failed:false,weakPointCount:3,weakPointsResolved:1,remainingMs:20000,attackPattern:'captured-line',attackIndex:1,lastAttackOutcome:null,...over});
test('restoration counts and optional side progress derive one immutable current phase',()=>{
 assert.equal(flow(null),null);assert.equal(flow({}),null);
 const s=fixture(),m=flow(s);assert.equal(m.phase,'restore');assert.equal(m.headline,'街区设施 4/10');assert.deepEqual(m.facilities,{completed:4,total:10,complete:false});assert.equal(m.side,null);
 const side=flow(fixture({side:true}));assert.equal(side.headline,'设施 4/10 · 串场 2/4');assert.deepEqual(side.side,{completed:2,total:4});
});
test('completed facilities with real remaining blocker cannot tell HUD to travel while guidance says fight',()=>{
 const s=fixture({complete:true,ready:false});s._publicStage1ObjectiveDisruptor={active:true,x:520,y:1100};
 const m=flow(s);assert.equal(m.phase,'clear-pressure');assert.equal(m.finaleReady,false);assert.deepEqual(m.blockerRoles,['objective-disruptor']);assert.equal(m.headline,'街区恢复 · 解除舞台干扰');
 const target=resolvePublicObjectiveGuidanceTarget(s);assert.equal(target.state,'blocker');assert.equal(target.label,'清除干扰');
});
test('destination remains original when ready or no live known blocker exists; stale/dead pointers do not block',()=>{
 for(const ready of [true,false]){const s=fixture({complete:true,ready});s._publicStage1ObjectiveDisruptor={active:false,x:1,y:2};const m=flow(s);assert.equal(m.phase,'to-finale');assert.equal(m.headline,'前往露天剧场');assert.equal(resolvePublicObjectiveGuidanceTarget(s).state,'destination');}
 for(const stale of [{hp:0},{destroyed:true}]){
  const scene=fixture({complete:true,ready:false});scene._publicStage1SpotlightCaptain={active:true,x:1,y:2,...stale};
  assert.equal(flow(scene).phase,'to-finale');assert.equal(resolvePublicObjectiveGuidanceTarget(scene).state,'destination');
 }
 const s=fixture({complete:true,ready:true});s._publicStage1SpotlightCaptain={active:true,x:1,y:2};assert.equal(flow(s).phase,'to-finale');
});
test('real finale phases take precedence over facility/pressure states and share weak point counters',()=>{
 for(const [phase,expected,label]of [['attack','boss-attack','压轴返场 · 读招 2/3'],['weak-point','boss-weak-point','压轴返场 · 弱点 2/3'],['boss-recovery','boss-recovery','压轴返场 · 集中喷涂']]){
  const state=boss(phase),s=fixture({complete:true,ready:false,finale:state}),m=flow(s);assert.equal(m.phase,expected);assert.equal(m.headline,label);assert.equal(m.finale.phase,phase);assert.equal(m.finale.weakPointsResolved,1);assert.equal(m.finale.remainingMs,20000);assert.notEqual(m.finale,state);
 }
 for(const kind of ['complete','failed']){const s=fixture({complete:true,finale:boss(kind,{active:false,[kind]:true})});assert.equal(flow(s).phase,kind);assert.equal(flow(s).headline,null);assert.equal(resolvePublicObjectiveGuidanceTarget(s),null);}
});
test('flow never advances owners or retains live targets; copied primitives survive later owner changes',()=>{
 const state=boss('weak-point'),s=fixture({finale:state});s._publicStage1SpotlightCaptain={active:true,x:1,y:2};const m=flow(s);
 for(const v of [m,m.facilities,m.blockerRoles,m.finale])assert(Object.isFrozen(v));assert(!Object.hasOwn(m,'target'));assert(!Object.values(m).includes(s._publicStage1SpotlightCaptain));
 assert.throws(()=>m.finale.phase='attack');state.phase='attack';assert.equal(m.finale.phase,'weak-point');
 const supplied=boss('boss-recovery');s.publicStage1Finale.snapshot=()=>{throw Error('explicit caller state must not resample');};assert.equal(flow(s,{finaleState:supplied}).phase,'boss-recovery');
});
test('real HUD resolves the facility-complete/live-blocker conflict without changing the combat owner',()=>{
 const doc=createDocument(),wave=doc.createElement('div');wave.id='wave-text';doc.getElementById('hud').append(wave);
 const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},BattleScene=loadBattleScene({Phaser,document:doc});
 const s=Object.assign(Object.create(BattleScene.prototype),fixture({complete:true,ready:false}),{_syncPublicStage1FinaleHud:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,hpPips:[]});
 s._publicStage1ObjectiveDisruptor={active:true,x:520,y:1100};const before=JSON.stringify({player:s.player,data:s.battleData,blocker:s._publicStage1ObjectiveDisruptor});
 s._updateHUD();assert.equal(wave.textContent,'街区恢复 · 解除舞台干扰');assert.equal(JSON.stringify({player:s.player,data:s.battleData,blocker:s._publicStage1ObjectiveDisruptor}),before);
 s._userCastPresentation=false;s._updateHUD();assert.equal(wave.textContent,'前往露天剧场','legacy HUD keeps existing behavior');
});
test('malformed display metadata cannot leak mutable references or nonfinite counters into a flow',()=>{
 const s=fixture({complete:true});s.oldStreet.config.finaleLabel={text:'mutable'};const m=flow(s);assert.equal(m.headline,'前往露天剧场');
 const b=flow(fixture({finale:boss('weak-point',{weakPointCount:Infinity,weakPointsResolved:NaN,remainingMs:NaN,attackPattern:{live:true}})}));
 assert.equal(b.finale.weakPointCount,1);assert.equal(b.finale.weakPointsResolved,0);assert.equal(b.finale.remainingMs,0);assert.equal(b.finale.attackPattern,null);
});
test('current-owner pressure headline stays outside defense, practice and explicit challenge markers',()=>{
 const doc=createDocument(),wave=doc.createElement('div');wave.id='wave-text';doc.getElementById('hud').append(wave);
 const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},BattleScene=loadBattleScene({Phaser,document:doc});
 for(const data of [{defenseMode:true},{practiceMode:true},{publicFinaleTrial:null}]){
  const s=Object.assign(Object.create(BattleScene.prototype),fixture({complete:true,ready:false}),{_syncPublicStage1FinaleHud:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,hpPips:[]});Object.assign(s.battleData,data);
  s._publicStage1ObjectiveDisruptor={active:true,x:520,y:1100};s._updateHUD();assert.equal(wave.textContent,'前往露天剧场',JSON.stringify(data));
 }
});
test('actual active-finale HUD supplied snapshot adds no facility reads or redundant clock reads',()=>{
 const doc=createDocument();for(const id of ['wave-text','round-clock']){const el=doc.createElement('div');el.id=id;doc.getElementById('hud').append(el);}
 const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},BattleScene=loadBattleScene({Phaser,document:doc});
 const reads={now:0,complete:0,painted:0,total:0},s=Object.assign(Object.create(BattleScene.prototype),fixture({finale:boss('attack')}),{
  events:{once(){},off(){}},_publicStage1FinaleBoss:{active:true,hp:10,maxHp:20}});
 s.publicPerformerRun.now=()=>{reads.now++;return 100;};s.paintZone.isComplete=()=>{reads.complete++;return true;};s.paintZone.getPaintedCount=()=>{reads.painted++;return 10;};s.paintZone.getTotalCount=()=>{reads.total++;return 10;};
 assert.equal(s._syncPublicStage1FinaleHud(boss('attack')),true);assert.deepEqual(reads,{now:1,complete:0,painted:0,total:0});
 assert.equal(flow(s,{finaleState:boss('attack')}).facilities,null,'finale-only projection must not fabricate unobserved facility counts');
});
test('all three presentation consumers actually call the common snapshot',()=>{
 for(const file of ['src/scenes/BattleScene.js','src/systems/PublicObjectiveGuidance.mjs','src/systems/PublicBossPresentation.mjs'])assert(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').includes('getPublicBattleFlow('),file+' must consume the shared flow');
});
