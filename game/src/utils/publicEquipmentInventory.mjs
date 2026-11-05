import {PUBLIC_EQUIPMENT,getPreparationSnapshot,getPreparationResources,getOwnedEquipment,isEquipmentCompatible} from './publicPreparation.mjs';

// Derived state only. Existing preparation commands remain the sole write path.
export function getPublicEquipmentInventory(profile,performerId){
 if(!profile||typeof profile!=='object'||Array.isArray(profile))return null;
 const preparation=getPreparationSnapshot(profile,performerId);if(!preparation)return null;
 const ownedIds=new Set(getOwnedEquipment(profile).map(item=>item.id));
 const items=Object.freeze(PUBLIC_EQUIPMENT.map(item=>{
  const owned=ownedIds.has(item.id),compatible=isEquipmentCompatible(item.id,performerId),equipped=preparation.equipmentId===item.id;
  return Object.freeze({...item,owned,compatible,equipped,canEquip:owned&&compatible,
   state:!owned?'locked':equipped?'equipped':'owned',
   source:Object.freeze(item.performerId?{kind:'performer-first-clear',id:item.performerId}:{kind:'chapter-first-clear',id:item.chapterId})});
 }));
 return Object.freeze({performerId,preparation:Object.freeze(preparation),resources:Object.freeze(getPreparationResources(profile)),
  items,compatibleItems:Object.freeze(items.filter(item=>item.compatible)),equippedItem:items.find(item=>item.equipped)||null});
}
