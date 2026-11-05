import {PUBLIC_PERFORMERS,isPublicChapterUnlocked} from './publicRunProgression.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getDisplayPerformer} from './userCast.mjs';
import {getPreparationEffects,getTrainingCost} from './publicPreparation.mjs';
import {getPublicEquipmentInventory} from './publicEquipmentInventory.mjs';

// This is a read model: preparation commands remain owned by the existing save pipeline.
export function getPreparationCatalog(profile,performerId,options={}) {
 const known=PUBLIC_PERFORMERS.find(row=>row.id===performerId);if(!known||!profile)return null;
 const member=getDisplayPerformer(performerId);
 const inventory=getPublicEquipmentInventory(profile,performerId);if(!inventory)return null;
 const snapshot=inventory.preparation,resources=inventory.resources;
 const training=[];
 for(let level=1;level<=16;level++){
  const costToNext=getTrainingCost(level);
  training.push({level,costToNext,state:level<snapshot.trainingLevel?'completed':level===snapshot.trainingLevel?'current':'future',
   effects:getPreparationEffects({...snapshot,trainingLevel:level,equipmentId:null},performerId)});
  if(costToNext===null)break;
 }
 const level=options.trainingLevel??snapshot.trainingLevel,equipmentId=options.equipmentId===undefined?snapshot.equipmentId:options.equipmentId;
 if(!training.some(row=>row.level===level)||(equipmentId!==null&&!inventory.compatibleItems.some(item=>item.id===equipmentId)))return null;
 const equipment=inventory.compatibleItems.map(item=>({...item,
  chapter:PUBLIC_CHAPTERS.find(row=>row.id===item.chapterId),sourceUnlocked:isPublicChapterUnlocked(item.chapterId,profile),
  effects:getPreparationEffects({...snapshot,equipmentId:item.id},performerId)}));
 let cost=0;for(let rank=snapshot.trainingLevel;rank<level;rank++)cost+=getTrainingCost(rank);
 return {member,resources,training,equipment,current:{...snapshot,effects:getPreparationEffects(snapshot,performerId)},
  preview:{trainingLevel:level,equipmentId,cost,owned:equipmentId===null||inventory.items.some(item=>item.id===equipmentId&&item.owned),
   applied:level===snapshot.trainingLevel&&equipmentId===snapshot.equipmentId,
   effects:getPreparationEffects({...snapshot,trainingLevel:level,equipmentId},performerId)}};
}
