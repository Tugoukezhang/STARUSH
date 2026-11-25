import {UI_CAST,isUserCastEnabled} from './userCast.mjs';
import {getChapterEncounterSummary} from './chapterEncounterContent.mjs';
import {getOwnedEquipment} from './publicPreparation.mjs';
import {previewPublicArrangement} from './publicRunGoals.mjs';

export const PUBLIC_ARRANGEMENT_STUDIES=Object.freeze([
  {id:'wide-recovery',name:'稳步铺色',first:'wide_brush',second:'recovery',
    detail:'扩大攻击覆盖，完成设施时恢复生命。恢复不等于护盾，满生命时也不会积存。'},
  {id:'relay-echo',name:'接力回响',first:'relay',second:'echo',
    detail:'相邻设施之间接力涂染，再用攻击回响补色。附近没有另一处有效目标时，接力不会凭空发生。'},
  {id:'tempo-overdrive',name:'行动爆发',first:'tempo',second:'overdrive',
    detail:'更快获得主动行动，再集中涂染。行动仍需主动释放，不能替代移动和站位。'},
].map(Object.freeze));
// Role-bound studies only appear for the member whose real pool contains every choice.
export const PUBLIC_ROLE_ARRANGEMENT_STUDIES=Object.freeze([
  {id:'fanfire-echo',name:'分轨回响',first:'fanfire',second:'echo',performerId:'sakura',
    detail:'普通射击分成三列，中路60%、两翼各20%涂染。两翼真实命中的目标也计入第三次有效命中；空落点不计，回响仍在原落点补色，不会再分三列。射击间隔不变，不穿墙。'},
].map(Object.freeze));

export function getPublicArrangementStudies(memberId){
  return [...PUBLIC_ARRANGEMENT_STUDIES,...PUBLIC_ROLE_ARRANGEMENT_STUDIES.filter(row=>row.performerId===memberId)];
}

const memberNotes={
  sakura:'扇面扫射覆盖前方。先朝向还未完成的区域，再释放行动；背后和遮挡后的设施不会自动补齐。',
  kai:'突进会改变落脚位置，但没有无敌，途中仍会受伤。给终点留出空间，不要向墙角硬冲。',
  enjo:'魔法集中涂染近身区域。先靠近目标再施法；远处设施不会因为威力提高而自动完成。',
};
const chapterNotes={
  opening:'从唱片店沿通路推进到剧场。涂染范围和接力都不替代绕过遮挡、寻找射击角度。',
  neon:'两侧店面需要各自完成，路口才会响应；编排不能跳过连锁依赖。',
  encore:'两侧调音亭恢复后，仍需靠近灯位完成校准。行动威力不能代替校准停留。',
  raincheck:'屋顶校音需要连续驻留1.5秒，先清开附近干扰。编排不能代替校音，也不能穿过两侧排水沟。',
  homecoming:'南区顺序接线；北区两侧调音亭都通电后再接左右台灯。行动与编排不能跳过线路依赖，本章无需驻点校音。',
};

export function getPublicArrangementGuide(first,second,memberId,chapterId){
  const preview=previewPublicArrangement(first,second,memberId);
  return {...preview,study:getPublicArrangementStudies(memberId).find(row=>row.first===first&&row.second===second)||null,
    memberNote:memberNotes[memberId]||'',chapterNote:(chapterNotes[chapterId]||'')
      +(isUserCastEnabled()?` ${getChapterEncounterSummary(chapterId)}`:'')};
}

export function getEarnedEquipmentHandoff(run,profile,equipmentId){
  if(!run?.victory||run.recorded!==true||run.persisted!==true||profile?.persisted!==true
    ||!UI_CAST.some(member=>member.id===run.performerId))return null;
  const items=getOwnedEquipment(profile).filter(item=>
    (item.performerId===run.performerId||item.chapterId===run.chapterId)
    &&Array.isArray(run.reward?.equipmentIds)&&run.reward.equipmentIds.includes(item.id));
  const earned=equipmentId===undefined ? items.find(item=>item.performerId===run.performerId)||items[0]
    : items.find(item=>item.id===equipmentId);
  return earned?{memberId:run.performerId,equipmentId:earned.id}:null;
}
