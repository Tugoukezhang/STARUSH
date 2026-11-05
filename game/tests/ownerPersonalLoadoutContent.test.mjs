import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

const ids={sakura:'travelling_nozzle',kai:'return_edge',enjo:'delayed_hammer'};
function env(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;}
const win=(performerId,runId=performerId)=>({runId,performerId,chapterId:'opening',victory:true,durationMs:40000});
const snapshot=(id,equipmentId=ids[id])=>({version:1,performerId:id,trainingLevel:1,equipmentId});

test('personal first clear unlocks only its accessory; duplicate/defeat add no unlock or currency',()=>{
 const e=env(),p=e.loadRuntime('utils/publicPreparation.mjs');
 assert.equal(p.PUBLIC_EQUIPMENT.length,7);
 assert.deepEqual(plain(p.getOwnedEquipment(e.profile.loadPublicProfile())),[]);
 e.profile.recordPublicRun({...win('kai','loss'),victory:false});
 assert.deepEqual(plain(p.getOwnedEquipment(e.profile.loadPublicProfile())),[]);
 e.profile.recordPublicRun(win('sakura'));e.profile.recordPublicRun(win('sakura'));
 let profile=e.profile.loadPublicProfile();
 assert.deepEqual(plain(p.getOwnedEquipment(profile).map(row=>row.id)),['wide_nozzle',ids.sakura]);
 assert.deepEqual(plain(p.getPreparationResources(profile)),{earned:6,spent:0,balance:6});
 e.profile.recordPublicRun(win('kai'));e.profile.recordPublicRun(win('enjo'));
 profile=e.profile.loadPublicProfile();
 assert.deepEqual(plain(p.getPreparationResources(profile)),{earned:12,spent:0,balance:12});
 assert.deepEqual(plain(p.getOwnedEquipment(profile).map(row=>row.id)),['wide_nozzle',...Object.values(ids)]);
});

test('old saved member clears unlock retroactively without rewriting the save or inflating notes',()=>{
 const e=env(),p=e.loadRuntime('utils/publicPreparation.mjs');e.seed(['opening','neon','encore']);
 const before=e.storage.getItem('starush.public-profile'),profile=e.profile.loadPublicProfile();
 assert(p.getOwnedEquipment(profile).some(row=>row.id===ids.sakura));
 assert.equal(p.getPreparationResources(profile).earned,18);
 assert.equal(e.storage.getItem('starush.public-profile'),before);
});

test('one slot, member ownership and atomic stale-plan guards are shared by all real save commands',()=>{
 const e=env(),p=e.loadRuntime('utils/publicPreparation.mjs');for(const id of Object.keys(ids))e.profile.recordPublicRun(win(id));
 for(const id of Object.keys(ids)){
  assert.equal(e.profile.equipPublicPerformer(id,ids[id]).preparationStatus,'equipped');
  const profile=e.profile.loadPublicProfile(),own=p.getPreparationSnapshot(profile,id),raw=e.storage.getItem('starush.public-profile');
  const other=Object.keys(ids).find(row=>row!==id);
  assert.equal(e.profile.equipPublicPerformer(other,ids[id]).preparationStatus,'incompatible');
  assert.equal(e.profile.applyPublicPreparationPlan({...own,performerId:other},{trainingLevel:1,equipmentId:ids[id]}).preparationStatus,'incompatible');
  assert.equal(e.storage.getItem('starush.public-profile'),raw);
  const bad=plain(profile.preparation);bad.equipmentByPerformer[other]=ids[id];
  assert.equal(p.normalizePublicPreparation(bad,profile),null);
  assert.equal(e.profile.equipPublicPerformer(id,'wide_nozzle').preparationStatus,'equipped');
  assert.equal(e.profile.applyPublicPreparationPlan(own,{trainingLevel:2,equipmentId:ids[id]}).preparationStatus,'stale');
 }
});

test('wrong-owner runtime snapshots fail closed; every valid modified build keeps original scalar effects',()=>{
 const e=env(),p=e.loadRuntime('utils/publicPreparation.mjs'),b=e.loadRuntime('utils/publicBuildContent.mjs');
 for(const id of Object.keys(ids)){
  const build=b.getPublicBuildModel(snapshot(id),id,['wide_brush','overdrive']);
  assert(build);assert.equal(build.modification.id,ids[id]);assert.match(build.roleNote,/随行|回锋|余震/);
  assert.equal(build.effects.paintRadiusBonus,40);assert.equal(build.effects.actionPower,1.5);assert.equal(build.effects.chargeMultiplier,1);
  const other=Object.keys(ids).find(row=>row!==id);
  assert.equal(b.getPublicBuildModel(snapshot(other,ids[id]),other),null);
  assert.deepEqual(plain(p.getPreparationEffects(snapshot(other,ids[id]),other)),{paintRadiusBonus:0,chargeMultiplier:1,actionPower:1});
 }
});

function action(id,equipmentId=ids[id],overrides={}){
 const e=env(),timers=[],stamps=[],painted=[],notices=[];
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id,publicPreparation:snapshot(id,equipmentId)},time:{now:100,
  delayedCall(delay,callback){const t={delay,callback,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}},
  player:{x:500,y:1500,hp:5,active:true,body:{velocity:{x:0,y:-250}}},
  _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,oldStreet:{clearLine:()=>true},
  enemies:{getChildren:()=>[]},paintZone:{devices:[],currentZone:0,applyPaintAt(...args){painted.push(args);return true;}},
  _stampGroundSplat(...args){stamps.push(args);},_paintPublicStage1TargetsAt:()=>false,
  _showRoundBanner(){},_showPublicBattleNotice(text){notices.push(text);},_updateHUD(){},...overrides};
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),r=new PublicStage1PerformerRun(s);
 s.publicPerformerRun=r;
 const flush=delay=>{for(const t of [...timers])if(t.delay===delay&&!t.removed){t.removed=true;t.callback();}};
 return {e,s,r,timers,stamps,painted,notices,flush};
}

test('Sakura travelling spray reads real movement on each beat; unequipped action stays frozen',()=>{
 for(const equipmentId of [ids.sakura,null]){
  const a=action('sakura',equipmentId);assert(a.r.triggerAction());assert.equal(a.s._specialCharge,0);
  a.flush(0);a.s.player.x=530;a.flush(100);a.s.player.x=560;a.flush(200);
  assert.equal(a.stamps.length,9);
  assert(Math.abs(a.stamps[4][0]-(equipmentId?530:500))<1e-8);
  assert(Math.abs(a.stamps[7][0]-(equipmentId?560:500))<1e-8);
  assert(a.painted.every(row=>row[2]===24&&row[3]===60));assert.equal(a.r.actions,1);
  assert.equal(a.r.getModificationReview()?.releases||0,equipmentId?3:0);a.r.destroy();
 }
});

test('Kai return edge paints original origin once after 160ms, never teleports or extends dash',()=>{
 const a=action('kai');assert(a.r.triggerAction());assert.equal(a.r.dash.endsAt,260);
 a.s.player.x=570;a.s.player.y=1440;a.flush(160);
 assert.equal(a.stamps.length,2);assert.deepEqual(a.stamps[1].slice(0,2),[500,1500]);
 assert.equal(a.painted[1][2],20);assert.equal(a.painted[1][3],72);
 assert.deepEqual([a.s.player.x,a.s.player.y],[570,1440]);assert.equal(a.r.actions,1);
 assert.equal(a.r.getModificationReview().releases,1);a.r.destroy();
 const base=action('kai',null);base.r.triggerAction();base.flush(160);assert.equal(base.stamps.length,1);base.r.destroy();
});

test('Enjo delayed hammer repeats at captured origin only once after 350ms, not at new player position',()=>{
 const a=action('enjo');a.r.triggerAction();assert.equal(a.stamps.length,1);
 a.s.player.x=600;a.s.player.y=1600;a.flush(350);
 assert.equal(a.stamps.length,2);assert.deepEqual(a.stamps[1].slice(0,2),[500,1500]);
 assert.equal(a.painted[1][2],52);assert.equal(a.painted[1][3],190);
 assert.equal(a.r.getModificationReview().releases,1);assert.equal(a.r.actions,1);a.r.destroy();
 const base=action('enjo',null);base.r.triggerAction();base.flush(350);assert.equal(base.stamps.length,1);base.r.destroy();
});

test('pending modification work clears on destroy/end/death and respects walls; hidden never consumes it',()=>{
 for(const id of Object.keys(ids))for(const reason of ['destroy','end','death','wall','hidden']){
  const a=action(id,ids[id],reason==='hidden'?{battleData:{stageId:1,practiceMode:true,performerId:id,publicPreparation:snapshot(id)}}:{});
  a.r.triggerAction();const before=a.stamps.length;
  if(reason==='destroy')a.r.destroy();if(reason==='end')a.s._battleEnded=true;
  if(reason==='death')a.s.player.hp=0;if(reason==='wall')a.s.oldStreet.clearLine=()=>false;
  for(const delay of [0,100,160,200,350])a.flush(delay);
  if(reason!=='hidden')assert.equal(a.stamps.length,before,id+':'+reason);
  else assert.equal(a.r.getModificationReview(),null);
  a.r.destroy();assert.equal(a.r.timers.size,0);
 }
});

test('all menus expose truthful ownership, personal eligibility and saved preflight without auto-switch',()=>{
 const e=env();for(const id of Object.keys(ids))e.profile.recordPublicRun(win(id));
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory'});h.scene.create();
 h.click('[data-inventory-item=return_edge]');assert.equal(h.query('[data-action=equip-selected]').disabled,true);
 assert.match(h.text,/机甲剑士专用/);h.click('[data-member=kai]');
 assert.equal(h.query('[data-action=equip-selected]').disabled,false);h.click('[data-action=equip-selected]');
 assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer.kai,ids.kai);
 assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');
 h.click('[data-action=inventory-catalog]');assert.match(h.text,/回锋/);assert.equal(h.query('[data-growth-equipment=travelling_nozzle]'),null);
 assert.equal(e.loadRuntime('utils/publicPreparationCatalog.mjs').getPreparationCatalog(e.profile.loadPublicProfile(),'kai').member.name,'机甲剑士');
 h.shutdown();
});

test('earned result prefers its actual personal unlock and strips action review from saved run',()=>{
 const a=action('enjo');a.r.triggerAction();a.flush(350);a.s.time.now=40000;
 const result=a.r.finish(true),profile=a.e.profile.loadPublicProfile(),handoff=a.e.loadRuntime('utils/publicSessionContent.mjs').getEarnedEquipmentHandoff(result,profile);
 assert.deepEqual(plain(result.reward.equipmentIds),['wide_nozzle',ids.enjo]);assert.equal(result.reward.notes,6);
 assert.equal(result.modificationReview.releases,1);
 assert.deepEqual(plain(handoff),{memberId:'enjo',equipmentId:ids.enjo});
 assert.equal(Object.hasOwn(profile.lastRun,'modificationReview'),false);
 const surface=a.e.loadRuntime('systems/BattleSurfaceView.mjs'),model=surface.getPublicResultSurfaceModel({buttons:[]},result);
 assert.deepEqual(plain(model.modificationReview),{name:'余震锤芯',releases:1});
 assert.equal(surface.getPublicResultSurfaceModel({buttons:[]},{...result,modificationReview:{id:ids.enjo,releases:999}}).modificationReview,null);
 const view=new surface.BattleSurfaceView({input:{enabled:true},events:{once(){},off(){}}},
  {mode:'result',model,onAction(){}},a.e.document);
 assert.match(view.root.querySelector('[data-modification-review]').textContent,/余震锤芯.*1 次/);view.destroy();
 assert.equal(a.r.finish(true).reward.notes,6);a.r.destroy();
});

test('new personal gear write failures leave training, item slot and earned notes untouched',()=>{
 const e=env();e.profile.recordPublicRun(win('kai'));const before=e.storage.getItem('starush.public-profile');
 const expected=e.loadRuntime('utils/publicPreparation.mjs').getPreparationSnapshot(e.profile.loadPublicProfile(),'kai');
 e.storage.setItem=()=>{throw Error('quota');};
 assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:2,equipmentId:ids.kai}).preparationStatus,'storage-error');
 assert.equal(e.profile.equipPublicPerformer('kai',ids.kai).preparationStatus,'storage-error');
 assert.equal(e.storage.getItem('starush.public-profile'),before);
});

test('a modified footprint that finishes battle is counted before synchronous result settlement',()=>{
 for(const id of Object.keys(ids)){
  const a=action(id);let during=null;
  a.s.paintZone.applyPaintAt=()=>{
   if((id==='sakura'||a.stamps.length===2)&&during===null){during=a.r.getModificationReview().releases;a.s._battleEnded=true;}
   return true;
  };
  a.r.triggerAction();a.flush(id==='sakura'?0:id==='kai'?160:350);
  assert.equal(during,1,id+' settled before its actual release receipt');a.r.destroy();
 }
});

test('new personal gear cards use existing exported bitmap art, never line-icon fallbacks',()=>{
 const e=env(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory'});h.scene.create();
 for(const id of Object.values(ids)){
  const button=h.query('[data-inventory-item='+id+']');
  assert(button.querySelector('img.menu-art'),id+' fell back to program-drawn art');
  assert.equal(button.querySelector('svg'),null);
 }
 h.shutdown();
});
