const MEMBER_IDS = Object.freeze(['sakura', 'kai', 'venus', 'genya', 'enjo']);
const TOTAL_TRAINING_COST = Object.freeze([0, 0, 3, 9]);
const RETIRED_MEMBER_IDS = Object.freeze(['venus', 'genya']);

export const PUBLIC_EQUIPMENT = Object.freeze([
  {id:'wide_nozzle', name:'扩幅导流器', chapterId:'opening', unlock:'首通星光初演',
    description:'攻击涂染范围 +12', paintRadiusBonus:12},
  {id:'rhythm_sync', name:'节拍同步器', chapterId:'neon', unlock:'首通霓虹街口',
    description:'特殊行动充能 +15%', chargeMultiplier:1.15},
  {id:'focus_lens', name:'聚光镜', chapterId:'encore', unlock:'首通终场合奏',
    description:'主动行动涂染威力 +15%', actionPower:1.15},
  // Explicit content grant: ownership and the +3 chapter-item notes are derived, so saves that already cleared raincheck gain both on load.
  // behavior marks a chapter item whose effect is prose, not stats; it is not the runtime trigger.
  {id:'rain_relay', name:'雨后继电器', chapterId:'raincheck', unlock:'首通雨后返场',
    description:'安可释放后，向380范围内最近的最多两座可涂染设施各补色至多20点；不穿墙，不跳过校音与配色顺序。Boss阶段不触发。', behavior:true},
  {id:'travelling_nozzle',name:'随行喷头',performerId:'sakura',ownerName:'步枪手',art:'nozzle',
    unlock:'步枪手首次通关任意章节',description:'扫射每一拍从当前站位出手；朝向不重新锁定。'},
  {id:'return_edge',name:'回响风铃',performerId:'kai',ownerName:'翡翠风歌',art:'lens',
    unlock:'翡翠风歌首次通关任意章节',description:'突进结束后在起点追加一次回风；人不返回，不提供无敌。'},
  {id:'delayed_hammer',name:'回响书签',performerId:'enjo',ownerName:'蔚蓝魔法师',art:'tempo',
    unlock:'蔚蓝魔法师首次通关任意章节',description:'施法350ms后在原落点追加一次魔法回响；不跟随人物。'},
].map(Object.freeze));

export function isEquipmentCompatible(equipmentId,performerId) {
  const item=PUBLIC_EQUIPMENT.find(row=>row.id===equipmentId);
  return !!item&&(!item.performerId||item.performerId===performerId);
}

export function createPublicPreparation() {
  return {version:1,
    trainingLevels:Object.fromEntries(MEMBER_IDS.map(id=>[id,1])),
    equipmentByPerformer:Object.fromEntries(MEMBER_IDS.map(id=>[id,null]))};
}

export function getOwnedEquipment(profile) {
  return PUBLIC_EQUIPMENT.filter(item=>{
    const clears=item.performerId?profile?.clearsByPerformer?.[item.performerId]:profile?.campaign?.chapterClears?.[item.chapterId];
    return Number.isSafeInteger(clears)&&clears>0;
  });
}

export function getPreparationResources(profile) {
  const clears=Number.isSafeInteger(profile?.clears)&&profile.clears>=0?profile.clears:0;
  const earned=Math.min(Number.MAX_SAFE_INTEGER,clears*3+getOwnedEquipment(profile).filter(item=>!item.performerId).length*3);
  const spent=MEMBER_IDS.reduce((sum,id)=>sum+(TOTAL_TRAINING_COST[profile?.preparation?.trainingLevels?.[id]]||0),0);
  return {earned,spent,balance:Math.max(0,earned-spent)};
}

export function getChapterRewardPreview(profile,chapterId,performerId) {
  const after={...profile,clears:profile.clears+1,
    campaign:{...profile.campaign,chapterClears:{...profile.campaign.chapterClears,[chapterId]:profile.campaign.chapterClears[chapterId]+1}},
    clearsByPerformer:{...profile.clearsByPerformer,[performerId]:profile.clearsByPerformer[performerId]+1}};
  const owned=new Set(getOwnedEquipment(profile).map(item=>item.id));
  return {notes:getPreparationResources(after).earned-getPreparationResources(profile).earned,
    equipment:getOwnedEquipment(after).filter(item=>!owned.has(item.id))};
}

export function normalizePublicPreparation(value, profile) {
  if(value===undefined)return createPublicPreparation();
  if(!value||value.version!==1||!value.trainingLevels||!value.equipmentByPerformer)return null;
  const result=createPublicPreparation();
  const owned=new Set(getOwnedEquipment(profile).map(item=>item.id));
  for(const id of MEMBER_IDS) {
    const rank=value.trainingLevels[id], equipment=value.equipmentByPerformer[id];
    if(!Number.isInteger(rank)||rank<1||rank>3
      ||(equipment!==null&&(!owned.has(equipment)||!isEquipmentCompatible(equipment,id))))return null;
    result.trainingLevels[id]=rank;result.equipmentByPerformer[id]=equipment;
  }
  const resources=getPreparationResources({...profile,preparation:result});
  return resources.spent<=resources.earned?result:null;
}

export function getTrainingCost(rank) { return rank===1?3:rank===2?6:null; }

export function getRetiredTrainingRecovery(profile) {
  const preparation=normalizePublicPreparation(profile?.preparation,profile);
  const trainingLevels=Object.fromEntries(RETIRED_MEMBER_IDS.map(id=>[id,preparation?.trainingLevels[id]??1]));
  return {trainingLevels,notes:RETIRED_MEMBER_IDS.reduce((n,id)=>n+TOTAL_TRAINING_COST[trainingLevels[id]],0)};
}

export function getPreparationSnapshot(profile, performerId) {
  if(!MEMBER_IDS.includes(performerId))return null;
  const preparation=normalizePublicPreparation(profile?.preparation,profile)||createPublicPreparation();
  return {version:1,performerId,trainingLevel:preparation.trainingLevels[performerId],
    equipmentId:preparation.equipmentByPerformer[performerId]};
}

export function getPreparationEffects(snapshot, performerId) {
  const base={paintRadiusBonus:0,chargeMultiplier:1,actionPower:1};
  if(snapshot?.version!==1||snapshot.performerId!==performerId||!MEMBER_IDS.includes(performerId)
    ||!Number.isInteger(snapshot.trainingLevel)||snapshot.trainingLevel<1||snapshot.trainingLevel>3
    ||(snapshot.equipmentId!==null&&!isEquipmentCompatible(snapshot.equipmentId,performerId)))return base;
  const item=PUBLIC_EQUIPMENT.find(item=>item.id===snapshot.equipmentId);
  return {paintRadiusBonus:item?.paintRadiusBonus||0,chargeMultiplier:item?.chargeMultiplier||1,
    actionPower:(1+(snapshot.trainingLevel-1)*0.1)*(item?.actionPower||1)};
}

export function applyPreparationCommand(profile, command) {
  if(command.type==='recover-retired') {
    const expected=command.expectedRanks;
    if(!expected||Object.keys(expected).length!==RETIRED_MEMBER_IDS.length
      ||!RETIRED_MEMBER_IDS.every(id=>Number.isInteger(expected[id])&&expected[id]>=1&&expected[id]<=3))return 'invalid';
    const current=getRetiredTrainingRecovery(profile);
    if(!RETIRED_MEMBER_IDS.every(id=>expected[id]===current.trainingLevels[id]))return 'stale';
    if(current.notes===0)return 'unchanged';
    for(const id of RETIRED_MEMBER_IDS)profile.preparation.trainingLevels[id]=1;
    return 'recovered';
  }
  const id=command.performerId;
  if(!MEMBER_IDS.includes(id))return 'invalid';
  if(command.type==='plan') {
    const expected=command.expected,target=command.target,current=getPreparationSnapshot(profile,id);
    if(!expected||expected.version!==1||expected.performerId!==id||!target
      ||!Number.isInteger(target.trainingLevel)||target.trainingLevel<1||target.trainingLevel>3
      ||(target.equipmentId!==null&&!PUBLIC_EQUIPMENT.some(item=>item.id===target.equipmentId)))return 'invalid';
    if(target.equipmentId!==null&&!isEquipmentCompatible(target.equipmentId,id))return 'incompatible';
    if(expected.trainingLevel!==current.trainingLevel||expected.equipmentId!==current.equipmentId)return 'stale';
    if(target.trainingLevel<current.trainingLevel)return 'downgrade';
    if(target.equipmentId!==null&&!getOwnedEquipment(profile).some(item=>item.id===target.equipmentId))return 'locked';
    if(target.trainingLevel===current.trainingLevel&&target.equipmentId===current.equipmentId)return 'unchanged';
    const cost=TOTAL_TRAINING_COST[target.trainingLevel]-TOTAL_TRAINING_COST[current.trainingLevel];
    if(cost>getPreparationResources(profile).balance)return 'insufficient';
    profile.preparation.trainingLevels[id]=target.trainingLevel;
    profile.preparation.equipmentByPerformer[id]=target.equipmentId;
    return 'planned';
  }
  if(command.type==='train') {
    const rank=profile.preparation.trainingLevels[id];
    if(rank===3)return 'max-level';
    if(command.expectedRank!==rank)return 'stale';
    if(getPreparationResources(profile).balance<getTrainingCost(rank))return 'insufficient';
    profile.preparation.trainingLevels[id]=rank+1;
    return 'trained';
  }
  if(command.type==='equip') {
    if(command.equipmentId!==null&&!getOwnedEquipment(profile).some(item=>item.id===command.equipmentId))return 'locked';
    if(command.equipmentId!==null&&!isEquipmentCompatible(command.equipmentId,id))return 'incompatible';
    if(profile.preparation.equipmentByPerformer[id]===command.equipmentId)return 'unchanged';
    profile.preparation.equipmentByPerformer[id]=command.equipmentId;
    return 'equipped';
  }
  return 'invalid';
}
