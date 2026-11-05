import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_EQUIPMENT,getChapterRewardPreview,getOwnedEquipment,getPreparationEffects,getPreparationResources,
  getPreparationSnapshot,isEquipmentCompatible} from '../src/utils/publicPreparation.mjs';
import {PUBLIC_PROFILE_STORAGE_KEY as KEY,applyPublicPreparationPlan,equipPublicPerformer,loadPublicProfile} from '../src/utils/publicRunProgression.mjs';
import {getPublicBuildModel,getPublicBuildOption} from '../src/utils/publicBuildContent.mjs';
import {getPublicEquipmentInventory} from '../src/utils/publicEquipmentInventory.mjs';
import {getPreparationCatalog} from '../src/utils/publicPreparationCatalog.mjs';
import {PublicRunSettlement} from '../src/systems/PublicRunSettlement.mjs';

// Data, ownership and build-model contract only. The Encore trigger and fixture paint are tested by the runtime owner.
const ID='rain_relay';
const NAME='雨后继电器';
const DESCRIPTION='安可释放后，向380范围内最近的最多两座可涂染设施各补色至多20点；不穿墙，不跳过校音与配色顺序。Boss阶段不触发。';
const CAST=['sakura','kai','enjo'];
const MEMBERS=['sakura','kai','venus','genya','enjo'];
const item=()=>PUBLIC_EQUIPMENT.find(row=>row.id===ID);
const ownedIds=profile=>getOwnedEquipment(profile).map(row=>row.id);
const snapshot=(performerId,equipmentId,trainingLevel=1)=>({version:1,performerId,trainingLevel,equipmentId});

function memoryStorage(raw=null){
  const data=new Map(raw===null?[]:[[KEY,raw]]);
  return {writes:0,failWrites:false,
    getItem(key){return data.has(key)?data.get(key):null;},
    setItem(key,value){this.writes++;if(this.failWrites)throw new Error('quota');data.set(key,String(value));},
    removeItem(key){data.delete(key);}};
}

// Shape is the persisted v1 profile; every count satisfies the loader's sequential-clear rules.
function saveRaw({raincheck=0,encore=1,threeChapter=false,clearsByPerformer,trainingLevels={},equipment={}}={}){
  const chapterClears={opening:1,neon:1,encore,raincheck};
  if(threeChapter)delete chapterClears.raincheck;
  const clears=Object.values(chapterClears).reduce((sum,count)=>sum+count,0),performers=clearsByPerformer??{sakura:clears};
  return JSON.stringify({version:1,selectedId:'sakura',clears,attempts:clears,
    clearsByPerformer:Object.fromEntries(MEMBERS.map(id=>[id,performers[id]??0])),
    lastRun:null,recordedRunIds:[],
    campaign:{version:1,selectedChapterId:'opening',clearedChapterIds:[],chapterClears,completed:false},
    preparation:{version:1,trainingLevels:Object.fromEntries(MEMBERS.map(id=>[id,trainingLevels[id]??1])),
      equipmentByPerformer:Object.fromEntries(MEMBERS.map(id=>[id,equipment[id]??null]))}});
}
const reload=storage=>loadPublicProfile(memoryStorage(storage.getItem(KEY)));

// PublicRunSettlement takes no storage argument, so the real default-storage path is exercised.
function withDefaultStorage(storage,callback){
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});
  try{return callback();}
  finally{
    if(original)Object.defineProperty(globalThis,'localStorage',original);
    else delete globalThis.localStorage;
  }
}
const run=(runId,performerId='sakura',victory=true)=>({runId,performerId,chapterId:'raincheck',victory,choices:[],durationMs:1000});

test('catalog row is exactly the authored chapter item and has no stat or performer fields',()=>{
  assert.deepEqual({...item()},{id:ID,name:NAME,chapterId:'raincheck',unlock:'首通雨后返场',description:DESCRIPTION,behavior:true});
  assert(Object.isFrozen(item()));
  assert.equal(PUBLIC_EQUIPMENT.filter(row=>row.id===ID).length,1);
  assert.equal(PUBLIC_EQUIPMENT.filter(row=>row.chapterId==='raincheck').length,1,'tour reward lookup expects one item per chapter');
});

test('locked before a raincheck clear: no ownership, bonus, equip or plan',()=>{
  const raw=saveRaw(),storage=memoryStorage(raw),profile=loadPublicProfile(storage);
  assert.equal(profile.recovery,undefined);
  assert(!ownedIds(profile).includes(ID));
  assert.equal(getPreparationResources(profile).earned,18,'3 clears x3 plus 3 earlier chapter items x3');
  const row=getPublicEquipmentInventory(profile,'sakura').items.find(entry=>entry.id===ID);
  assert.equal(row.owned,false);assert.equal(row.canEquip,false);assert.equal(row.state,'locked');
  assert.equal(equipPublicPerformer('sakura',ID,storage).preparationStatus,'locked');
  assert.equal(applyPublicPreparationPlan(getPreparationSnapshot(profile,'sakura'),{trainingLevel:1,equipmentId:ID},storage).preparationStatus,'locked');
  assert.equal(storage.getItem(KEY),raw);assert.equal(storage.writes,0);
});

test('first and repeat previews report the item bonus once and leave the profile untouched',()=>{
  const first=loadPublicProfile(memoryStorage(saveRaw())),before=JSON.stringify(first);
  const sakura=getChapterRewardPreview(first,'raincheck','sakura');
  assert.equal(sakura.notes,6);assert.deepEqual(sakura.equipment.map(row=>row.id),[ID]);
  // Performer-first-clear items stack in the list, but only chapter items pay the +3.
  for(const [performerId,personal]of [['kai','return_edge'],['enjo','delayed_hammer']]){
    const preview=getChapterRewardPreview(first,'raincheck',performerId);
    assert.equal(preview.notes,6);assert.deepEqual(preview.equipment.map(row=>row.id),[ID,personal]);
  }
  const otherChapter=getChapterRewardPreview(first,'encore','sakura');
  assert.equal(otherChapter.notes,3);assert.deepEqual(otherChapter.equipment,[]);
  assert.equal(JSON.stringify(first),before);
  const repeat=getChapterRewardPreview(loadPublicProfile(memoryStorage(saveRaw({raincheck:1}))),'raincheck','sakura');
  assert.equal(repeat.notes,3);assert.deepEqual(repeat.equipment,[]);
});

test('settlement grants the item and +3 exactly once across commit retry, duplicate run and replay',()=>{
  const storage=memoryStorage(saveRaw());
  withDefaultStorage(storage,()=>{
    const settlement=new PublicRunSettlement(run('clear-1')),first=settlement.commit();
    assert.equal(first.settlement.status,'saved');
    assert.equal(first.reward.notes,6);assert.deepEqual(first.reward.equipmentIds,[ID]);
    const saved=storage.getItem(KEY);
    assert.equal(settlement.commit(),first);assert.equal(storage.getItem(KEY),saved);

    const duplicate=new PublicRunSettlement(run('clear-1')).commit();
    assert.equal(duplicate.reward.notes,0);assert.deepEqual(duplicate.reward.equipmentIds,[]);
    assert.equal(storage.getItem(KEY),saved);
    let profile=loadPublicProfile();
    assert.equal(profile.attempts,4);assert.equal(profile.clears,4);assert.equal(profile.campaign.chapterClears.raincheck,1);
    assert.equal(getPreparationResources(profile).earned,24);

    const replay=new PublicRunSettlement(run('clear-2')).commit();
    assert.equal(replay.reward.notes,3);assert.deepEqual(replay.reward.equipmentIds,[]);
    profile=loadPublicProfile();
    assert.equal(profile.campaign.chapterClears.raincheck,2);assert.equal(getPreparationResources(profile).earned,27);
  });
});

test('settlement reward for another performer lists both unlocks; a defeat grants nothing',()=>{
  withDefaultStorage(memoryStorage(saveRaw()),()=>{
    const reward=new PublicRunSettlement(run('kai-clear','kai')).commit().reward;
    assert.equal(reward.notes,6);assert.deepEqual(reward.equipmentIds,[ID,'return_edge']);
  });
  withDefaultStorage(memoryStorage(saveRaw()),()=>{
    const result=new PublicRunSettlement(run('loss','sakura',false)).commit();
    assert.equal(result.settlement.status,'saved');
    assert.equal(result.reward.notes,0);assert.deepEqual(result.reward.equipmentIds,[]);
    assert(!ownedIds(loadPublicProfile()).includes(ID));
  });
});

test('failed save keeps one captured reward, blocks equip until saved, and retry does not double grant',()=>{
  const storage=memoryStorage(saveRaw());
  withDefaultStorage(storage,()=>{
    storage.failWrites=true;
    const settlement=new PublicRunSettlement(run('pending-clear')),pending=settlement.commit();
    assert.equal(pending.settlement.status,'pending');
    assert.equal(pending.reward.notes,6);assert.deepEqual(pending.reward.equipmentIds,[ID]);
    assert.equal(equipPublicPerformer('sakura',ID,storage).preparationStatus,'save-required');
    storage.failWrites=false;
    const saved=settlement.commit();
    assert.equal(saved,pending);assert.equal(saved.settlement.status,'saved');
    assert.equal(saved.reward.notes,6);assert.deepEqual(saved.reward.equipmentIds,[ID]);
    const profile=loadPublicProfile();
    assert.equal(profile.attempts,4);assert.equal(profile.campaign.chapterClears.raincheck,1);
    assert.equal(getPreparationResources(profile).earned,24);
    assert.equal(equipPublicPerformer('sakura',ID,storage).preparationStatus,'equipped');
  });
});

test('pre-existing raincheck save gains item and +3 as a derived grant, with no write or reset',()=>{
  const raw=saveRaw({raincheck:1,trainingLevels:{sakura:3},equipment:{sakura:'wide_nozzle'}}),storage=memoryStorage(raw);
  const profile=loadPublicProfile(storage);
  assert.equal(profile.recovery,undefined);
  assert(ownedIds(profile).includes(ID));
  assert.deepEqual(getPreparationResources(profile),{earned:24,spent:9,balance:15});
  assert.deepEqual(getPreparationSnapshot(profile,'sakura'),snapshot('sakura','wide_nozzle',3),'existing loadout is not replaced');
  assert.equal(storage.getItem(KEY),raw);assert.equal(storage.writes,0);
});

test('three-chapter save stays locked after expansion, while forged out-of-order clears grant nothing',()=>{
  const expanded=loadPublicProfile(memoryStorage(saveRaw({threeChapter:true})));
  assert.equal(expanded.recovery,undefined);assert.equal(expanded.campaign.chapterClears.raincheck,0);
  assert(!ownedIds(expanded).includes(ID));
  assert.deepEqual(getChapterRewardPreview(expanded,'raincheck','sakura').equipment.map(row=>row.id),[ID]);

  const raw=saveRaw({encore:0,raincheck:1}),storage=memoryStorage(raw),forged=loadPublicProfile(storage);
  assert.equal(forged.recovery?.kind,'corrupt');
  assert(!ownedIds(forged).includes(ID));
  assert.notEqual(equipPublicPerformer('sakura',ID,storage).preparationStatus,'equipped');
  assert.equal(storage.getItem(KEY),raw);
});

test('compatible for all current performers at once, in the shared single slot',()=>{
  const storage=memoryStorage(saveRaw({raincheck:1,equipment:{sakura:'wide_nozzle'}}));
  for(const performerId of CAST){
    assert.equal(isEquipmentCompatible(ID,performerId),true);
    const row=getPublicEquipmentInventory(loadPublicProfile(storage),performerId).items.find(entry=>entry.id===ID);
    assert.equal(row.compatible,true);assert.equal(row.canEquip,true);
    assert.equal(row.performerId,undefined);assert.equal(row.ownerName,undefined);
    assert.deepEqual({...row.source},{kind:'chapter-first-clear',id:'raincheck'});
    assert.equal(equipPublicPerformer(performerId,ID,storage).preparationStatus,'equipped');
  }
  const saved=reload(storage);
  for(const performerId of CAST)assert.equal(getPreparationSnapshot(saved,performerId).equipmentId,ID);
  assert(!Object.values(saved.preparation.equipmentByPerformer).includes('wide_nozzle'),'the one slot is replaced, not stacked');
});

test('unequipped and equipped snapshots persist through real commands and a byte reload',()=>{
  const storage=memoryStorage(saveRaw({raincheck:1}));
  const before=loadPublicProfile(storage),resources=getPreparationResources(before);
  assert.deepEqual(getPreparationSnapshot(before,'kai'),snapshot('kai',null));
  assert.equal(equipPublicPerformer('kai',ID,storage).preparationStatus,'equipped');
  assert.deepEqual(getPreparationSnapshot(reload(storage),'kai'),snapshot('kai',ID));
  assert.equal(equipPublicPerformer('kai',ID,storage).preparationStatus,'unchanged');
  assert.deepEqual(getPreparationResources(reload(storage)),resources,'equipping neither pays nor charges notes');
  assert.equal(equipPublicPerformer('kai',null,storage).preparationStatus,'equipped');
  assert.deepEqual(getPreparationSnapshot(reload(storage),'kai'),snapshot('kai',null));
  const expected=getPreparationSnapshot(loadPublicProfile(storage),'kai');
  assert.equal(applyPublicPreparationPlan(expected,{trainingLevel:1,equipmentId:ID},storage).preparationStatus,'planned');
  assert.deepEqual(getPreparationSnapshot(reload(storage),'kai'),snapshot('kai',ID));
});

test('build model shows the effect under modification and roleNote for every performer',()=>{
  for(const performerId of CAST){
    const base=getPublicBuildModel(snapshot(performerId,null),performerId);
    const build=getPublicBuildModel(snapshot(performerId,ID),performerId);
    assert.equal(base.modification,null);
    assert.deepEqual({...build.modification},{id:ID,name:NAME,description:DESCRIPTION});
    assert(Object.isFrozen(build.modification));
    assert.equal(build.roleNote,base.roleNote+' '+NAME+'：'+DESCRIPTION);
    assert.equal(build.preparationLabel,'阶位 1 · '+NAME);
    const after=getPublicBuildOption(build,'wide_brush').after;
    assert.equal(after.modification.id,ID,'a run choice keeps the equipped behavior');
    assert(after.roleNote.endsWith(NAME+'：'+DESCRIPTION));
  }
  const fanfire=getPublicBuildModel(snapshot('sakura',ID),'sakura',['fanfire']);
  assert(fanfire.roleNote.includes('普通射击三列'));assert(fanfire.roleNote.endsWith(NAME+'：'+DESCRIPTION));
});

test('classification regression: stat items stay out of modification, performer items stay in',()=>{
  for(const id of ['wide_nozzle','rhythm_sync','focus_lens']){
    const build=getPublicBuildModel(snapshot('sakura',id),'sakura');
    assert.equal(build.modification,null);
    assert.equal(build.roleNote,getPublicBuildModel(snapshot('sakura',null),'sakura').roleNote);
  }
  for(const [performerId,id]of [['sakura','travelling_nozzle'],['kai','return_edge'],['enjo','delayed_hammer']]){
    const build=getPublicBuildModel(snapshot(performerId,id),performerId);
    assert.equal(build.modification.id,id);
    assert(build.roleNote.endsWith(PUBLIC_EQUIPMENT.find(row=>row.id===id).description));
  }
});

test('no stat change at any training rank, in effects, rows or the growth catalog',()=>{
  for(const key of ['paintRadiusBonus','chargeMultiplier','actionPower'])
    assert.equal(Object.hasOwn(item(),key),false,'the compact inventory hides the description when a stat key exists');
  assert.deepEqual(getPreparationEffects(snapshot('sakura',ID),'sakura'),{paintRadiusBonus:0,chargeMultiplier:1,actionPower:1});
  const profile=loadPublicProfile(memoryStorage(saveRaw({raincheck:1})));
  for(const performerId of CAST){
    for(const rank of [1,2,3]){
      assert.deepEqual(getPreparationEffects(snapshot(performerId,ID,rank),performerId),getPreparationEffects(snapshot(performerId,null,rank),performerId));
      const equipped=getPublicBuildModel(snapshot(performerId,ID,rank),performerId),empty=getPublicBuildModel(snapshot(performerId,null,rank),performerId);
      assert.deepEqual(equipped.effects,empty.effects);assert.deepEqual(equipped.rows,empty.rows);
    }
    const catalog=getPreparationCatalog(profile,performerId,{equipmentId:ID});
    assert.deepEqual(catalog.preview.effects,catalog.current.effects);
    assert.equal(catalog.preview.owned,true);assert.equal(catalog.preview.cost,0);
    const row=catalog.equipment.find(entry=>entry.id===ID);
    assert.equal(row.chapter.id,'raincheck');assert.equal(row.description,DESCRIPTION);
  }
});

test('invalid and foreign items are rejected without writing',()=>{
  const raw=saveRaw({raincheck:1,clearsByPerformer:{sakura:3,kai:1}}),storage=memoryStorage(raw),profile=loadPublicProfile(storage);
  const expected=getPreparationSnapshot(profile,'sakura');
  // The equip command checks ownership first, so an unknown id reports locked; the plan command reports invalid.
  assert.equal(equipPublicPerformer('sakura','rain_relay_x',storage).preparationStatus,'locked');
  assert.equal(applyPublicPreparationPlan(expected,{trainingLevel:1,equipmentId:'rain_relay_x'},storage).preparationStatus,'invalid');
  assert.equal(equipPublicPerformer('ghost',ID,storage).preparationStatus,'invalid');
  assert(ownedIds(profile).includes('return_edge'));
  assert.equal(equipPublicPerformer('sakura','return_edge',storage).preparationStatus,'incompatible');
  assert.equal(applyPublicPreparationPlan(expected,{trainingLevel:1,equipmentId:'return_edge'},storage).preparationStatus,'incompatible');
  assert.equal(storage.getItem(KEY),raw);assert.equal(storage.writes,0);

  for(const id of ['RAIN_RELAY','rain_relay ','constructor','__proto__',null,undefined,7])assert.equal(isEquipmentCompatible(id,'sakura'),false);
  assert.equal(getPublicBuildModel(snapshot('kai',ID),'sakura'),null,'foreign snapshot');
  assert.equal(getPublicBuildModel(snapshot('sakura','rain_relay_x'),'sakura'),null);
  assert.equal(getPublicBuildModel(snapshot('sakura',ID,9),'sakura'),null);
  assert.equal(getPublicBuildModel(snapshot('venus',ID),'venus'),null,'retired member has no build model');
  assert.deepEqual(getPreparationEffects(snapshot('kai',ID,3),'sakura'),{paintRadiusBonus:0,chargeMultiplier:1,actionPower:1});
});

test('tampered save with the item equipped before any raincheck clear is protected',()=>{
  const raw=saveRaw({equipment:{sakura:ID}}),storage=memoryStorage(raw),profile=loadPublicProfile(storage);
  assert.equal(profile.recovery?.kind,'corrupt');
  assert.equal(getPreparationSnapshot(profile,'sakura').equipmentId,null);
  assert.equal(storage.getItem(KEY),raw);assert.equal(storage.writes,0);
});
