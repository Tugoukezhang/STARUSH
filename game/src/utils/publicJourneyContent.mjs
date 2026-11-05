import {PUBLIC_CHAPTERS,getNextPublicChapterId} from './publicCampaign.mjs';
import {USER_CAST} from './userCast.mjs';
import {getChapterBriefing} from './playerPreferences.mjs';
import {getChapterStory} from './publicStory.mjs';
const STEPS=Object.freeze({
 homecoming:[['沿线接通','码头集合灯→栈桥侧灯→器材间接线→调度亭接线→中段配电；下一站通电后才接收涂染。'],['双路汇流','接通调音区入口后，东西声部先后自由。两侧完成才开放帆顶左灯，再接右灯，无需校音停留。'],['收工加演','每区完成同线两站串场，十处主设施与四站串场全亮后前往帆顶。压轴留意移动预判与定点声浪。']],
 raincheck:[['两侧先通','接通同区东西支路，再为中央校音台涂色；每区选一条两站试听串场线。'],['串场供电','未供电时连续校音1.5秒；同区同线两站接通后，离开或遮挡保留进度，被压制仍清零。'],['雨后返场','十处主设施与四处串场站接通后，前往广播棚。首末段避开锁定线，中段留意移动预判。']],
 opening:[['沿街恢复','移动时会自动攻击，街面随攻击显色；演出设施涂满后才能接通。'],['选线串场','南北两区各完成同线两站；第一站完成就锁定西线或东线，同线先后自由。第3、7处主设施仍给本场编排。'],['完成压轴','十处设施与四处串场站接通后，接近露天舞台完成压轴；留意先预告、后发出的声浪。']],
 neon:[['先接两侧','先恢复试听店与咖啡亭，再处理街口中枢；北侧两店接通后开放双灯。'],['接力与联动','每区选西线或东线，按前站→后站完成串场；及时走近涂满干扰者，可取消未发声浪。'],['汇入广场','十处设施与四处串场站接通后进入压轴；沿当前通道与移动方向的预告，及时换位。']],
 encore:[['连接甲板','先接通两侧设施；每区选一条两站串场线，主灯仍需要两段蓄满。'],['靠近校准','舞台双灯与串场站涂满后，各自靠近累计校准1秒；离开会保留进度。'],['完成合奏','及时处理干扰可打断领舞尚未释放的落击；离开脚下预告圈，最后用停步、反向或换位应对压轴。']],
});
const RETRY=Object.freeze({
 homecoming:'再演从码头集合灯重新接线。北区东西声部可以换顺序，两区串场也可以选择另一条线。',
 raincheck:'再演会重新开始屋顶广播。接通同区两站串场，为中央台保留离开时的校音进度；压制仍会清零，已点亮的灯不受影响。',
 opening:'再演会从本章开场重新开始；先给移动留出通路，再靠近未完成的设施。',
 neon:'再演会重新选择本场编排；未接通的中枢先检查两侧店面，已发出的声浪仍需躲开。',
 encore:'再演会从本章开场重新开始；涂满后仍未接通的舞台灯，需要靠近完成校准。',
});
export function getPublicJourneyGuide(chapterId,memberId){
 const chapter=PUBLIC_CHAPTERS.find(c=>c.id===chapterId),member=USER_CAST.find(m=>m.id===memberId);
 if(!chapter||!member)return null;
 return {chapterId,member,place:chapter.subtitle,goal:getChapterBriefing(chapterId).goal,
  steps:STEPS[chapterId].map(([title,text])=>({title,text})),action:member.actionName+'：'+member.actionSummary,
  targeting:'自动攻击；轻点可涂染的设施或敌人可优先处理，再点同一目标或空处恢复自动。拖动仍用于移动。',retry:RETRY[chapterId]};
}
export function getPublicJourneyResult(run){
 const guide=getPublicJourneyGuide(run?.chapterId,run?.performerId);if(!guide)return null;
 if(run.victory!==true)return {title:'再演本站',text:'这场演出尚未完成，故事停在本章。',next:guide.retry};
 const beat=getChapterStory(run.chapterId,'outro',run.performerId),next=getNextPublicChapterId(run.chapterId);
 const durable=run.recorded===true&&run.persisted===true;
 return {title:'这一站之后',text:beat?.lines.find(l=>l.speaker==='旁白')?.text||'本场演出已结束。',
  next:!durable?'本场记录尚未保存，请先处理结果页的保存提示。':next
   ?'下一站 · '+PUBLIC_CHAPTERS.find(c=>c.id===next).name+'。'+getChapterBriefing(next).goal
   :'本轮巡演在回港加演后落幕。可以回看手记，或再演已通关的章节。'};
}
