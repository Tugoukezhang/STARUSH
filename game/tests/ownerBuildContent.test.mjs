import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function env(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const create=e.document.createElement;
 // The existing tree fixture supports simple selectors, not this DOM descendant query.
 e.document.createElement=tag=>{
  const node=create(tag),query=node.querySelector.bind(node);
  node.querySelector=selector=>selector==='.battle-visual-copy span'?query('.battle-visual-copy')?.querySelector('span'):query(selector);
  return node;
 };
 return e;
}
const prep=id=>({version:1,performerId:id,trainingLevel:2,equipmentId:'focus_lens'});
test('nine legal plans for each current owner include the equipped/trained effects without writing or choosing',()=>{
 const e=env(),m=e.loadRuntime('utils/publicBuildContent.mjs'),before=e.storage.getItem('starush.public-profile');
 for(const id of ['sakura','kai','enjo'])for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
  const b=m.getPublicBuildModel(prep(id),id,[first,second]);assert(b);assert.equal(b.preparation.trainingLevel,2);
  assert(Math.abs(b.effects.actionPower-1.1*1.15*(second==='overdrive'?1.5:1))<1e-10);
  assert.equal(b.choices.length,2);assert(b.tactic.length>10);assert(b.roleNote.length>10);assert(b.rows.some(row=>row.label==='主动涂染倍率'));
 }
 assert.equal(e.storage.getItem('starush.public-profile'),before);
 for(const choices of [['echo'],['wide_brush','tempo'],['relay','echo','recovery'],['unknown']])assert.equal(m.getPublicBuildModel(prep('kai'),'kai',choices),null);
 assert.equal(m.getPublicBuildModel(prep('kai'),'sakura',[]),null);assert.equal(m.getPublicBuildModel({...prep('kai'),version:2},'kai',[]),null);
});
test('live option deltas use actual prepared multipliers and preserve the legal next pool',()=>{
 const e=env(),m=e.loadRuntime('utils/publicBuildContent.mjs');
 const p={...prep('kai'),equipmentId:'rhythm_sync'},b=m.getPublicBuildModel(p,'kai',[]),tempo=m.getPublicBuildOption(b,'tempo');
 assert(Math.abs(tempo.after.effects.chargeMultiplier-1.725)<1e-10);assert.match(tempo.delta,/1\.15.*1\.725/);assert.match(tempo.detail,/射速|安可/);
 assert.equal(m.getPublicBuildOption(b,'overdrive'),null);
 const wide=m.getPublicBuildModel({...p,equipmentId:'wide_nozzle'},'kai',['wide_brush']);
 assert.equal(wide.effects.paintRadiusBonus,52);assert.match(m.getPublicBuildOption(wide,'overdrive').detail,/普通射击/);
 const completed=m.getPublicBuildModel(p,'kai',['tempo','recovery']);assert.equal(m.getPublicBuildOption(completed,'echo'),null);
});
test('actual run freezes its build context, and current effects agree with the shared model',()=>{
 const e=env(),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const p=prep('kai'),s={_userCastPresentation:true,battleData:{stageId:1,performerId:'kai',publicPreparation:p},time:{now:0}};
 const r=new PublicStage1PerformerRun(s);r.growth.choose('tempo');r.growth.choose('overdrive');
 assert.equal(typeof r.getBuildSnapshot,'function');const snapshot=r.getBuildSnapshot();assert.deepEqual(plain(snapshot.effects),plain(r.effects()));
 p.trainingLevel=3;p.equipmentId='wide_nozzle';assert.equal(r.getBuildSnapshot().preparation.trainingLevel,2);assert.equal(r.getBuildSnapshot().preparation.equipmentId,'focus_lens');
 r.destroy();assert.equal(snapshot.choices.length,2);assert.equal(snapshot.preparation.trainingLevel,2);
 const old=new PublicStage1PerformerRun({...s,_userCastPresentation:false});assert.equal(old.getBuildSnapshot(),null);old.destroy();
});
test('choice and pause surfaces expose actual run context, with no auto-activation',()=>{
 const e=env(),m=e.loadRuntime('utils/publicBuildContent.mjs'),{BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const b=m.getPublicBuildModel({...prep('kai'),equipmentId:'rhythm_sync'},'kai',[]),member=e.loadRuntime('utils/userCast.mjs').getPlayablePerformer('kai'),calls=[];
 const s={battleData:{performerId:'kai'},publicPerformerRun:{getBuildSnapshot:()=>b},input:{enabled:true,keyboard:{enabled:true}},events:{once(){},off(){}}};
 const view=new BattleSurfaceView(s,{mode:'choice',member,number:1,choices:[],options:e.profile.PublicRunProgression?new e.profile.PublicRunProgression().getOptions():[],onChoice:id=>calls.push(id)},e.document);
 assert.match(view.root.querySelector('[data-choice=tempo]').textContent,/1\.15.*1\.725/);assert.deepEqual(calls,[]);view.destroy();
 const next=m.getPublicBuildModel(b.preparation,'kai',['tempo']);
 const second=new BattleSurfaceView({...s,publicPerformerRun:{getBuildSnapshot:()=>next}},
  {mode:'choice',member,number:2,choices:['tempo'],options:new e.profile.PublicRunProgression({choices:['tempo']}).getOptions(),onChoice:id=>calls.push(id)},e.document);
 assert.equal(second.root.querySelector('.battle-choice-history').textContent,'已选：节拍蓄能');
 assert.equal(second.root.textContent.split('已选：').length-1,1);second.destroy();
 const pause=new BattleSurfaceView(s,{mode:'pause',onResume(){},onSettings(){},onRetry(){},onLeave(){}},e.document);
 assert.match(pause.root.textContent,/节拍同步器/);assert.match(pause.root.textContent,/阶位 2/);assert.equal(s.input.enabled,false);pause.destroy();assert.equal(s.input.enabled,true);
});

test('324 current-cast builds match actual action footprint, paint, charge and recovery consumers',()=>{
 const e=env(),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const {BattleScene}=e.loadRuntime('scenes/BattleScene.js');let cases=0;
 for(const id of ['sakura','kai','enjo'])for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery'])
 for(const trainingLevel of [1,2,3])for(const equipmentId of [null,'wide_nozzle','rhythm_sync','focus_lens']){
  const stamps=[],contacts=[],timers=[],p={version:1,performerId:id,trainingLevel,equipmentId};
  const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id,publicPreparation:p},
   time:{now:100,delayedCall(delay,callback){const timer={delay,callback,remove(){}};timers.push(timer);return timer;}},
   player:{x:500,y:1500,hp:4,maxHp:5,body:{velocity:{x:0,y:-250}}},_battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,
   oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},paintZone:{devices:[],currentZone:0,applyPaintAt(...args){contacts.push(args);return true;}},
   _stampGroundSplat(...args){stamps.push(args);},_paintPublicStage1TargetsAt:()=>false,_showRoundBanner(){},_updateHUD(){},_isPublicStage1Round:()=>true,_addPublicEncoreCharge(){}};
  const r=new PublicStage1PerformerRun(s);s.publicPerformerRun=r;r.growth.choose(first);r.growth.choose(second);
  const power=(1+(trainingLevel-1)*.1)*(equipmentId==='focus_lens'?1.15:1)*(second==='overdrive'?1.5:1),bonus=(first==='wide_brush'?40:0)+(equipmentId==='wide_nozzle'?12:0);
  assert.deepEqual(plain(r.getBuildSnapshot().effects),plain(r.effects()));assert.equal(r.triggerAction(),true);timers.forEach(t=>t.callback());
  assert(Math.abs(stamps[0][3]-({sakura:60,kai:72,enjo:190}[id]+bonus)*Math.sqrt(power))<1e-9);
  assert(Math.abs(contacts[0][2]-{sakura:24,kai:20,enjo:52}[id]*power)<1e-9);assert.equal(contacts[0][3],stamps[0][3]);
  BattleScene.prototype._awardPublicSakuraActionCharge.call(s,'required-anchor');
  assert(Math.abs(s._specialCharge-22*(first==='tempo'?1.5:1)*(equipmentId==='rhythm_sync'?1.15:1))<1e-9);
  r.onAnchor();assert.equal(s.player.hp,second==='recovery'?5:4);r.destroy();cases++;
 }
 assert.equal(cases,324);
});

test('result retains the actual finished configuration without adding a persistent save field',()=>{
 const e=env(),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),surface=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening',publicPreparation:prep('sakura')},time:{now:0}};
 const r=new PublicStage1PerformerRun(s);r.growth.choose('wide_brush');r.growth.choose('overdrive');s.time.now=1000;
 const result=r.finish(true);r.destroy();assert.equal(result.build.preparation.equipmentId,'focus_lens');assert.equal(result.build.effects.paintRadiusBonus,40);
 assert.equal(Object.hasOwn(e.profile.loadPublicProfile().lastRun,'build'),false);
 const m=surface.getPublicResultSurfaceModel({buttons:[]},result);assert.equal(m.build.preparation.trainingLevel,2);
 assert.equal(surface.getPublicResultSurfaceModel({buttons:[]},{...result,build:undefined}).build,null);
 const view=new surface.BattleSurfaceView({input:{enabled:true},events:{once(){},off(){}}},{mode:'result',model:m,onAction(){}},e.document);
 assert.match(view.root.textContent,/聚光镜/);assert.match(view.root.textContent,/重新选择编排/);view.destroy();
});

test('actual library includes preparation while remaining read-only and can return to preflight',()=>{
 const e=env();e.seed(['opening']);e.profile.selectPublicPerformer('kai');
 const before=e.storage.getItem('starush.public-profile');
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'library'});h.scene.create();
 for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
  h.click(`[data-arrangement="${first}"]`);h.click(`[data-arrangement="${second}"]`);
  assert.match(h.text,/机甲剑士.*阶位 1/);assert.match(h.text,/主动涂染倍率/);
 }
 assert.equal(e.storage.getItem('starush.public-profile'),before);h.click('[data-action="library-preflight"]');assert.match(h.text,/出战准备/);assert.match(h.query('[data-action="start"]').textContent,/确认开演/);h.shutdown();
});
