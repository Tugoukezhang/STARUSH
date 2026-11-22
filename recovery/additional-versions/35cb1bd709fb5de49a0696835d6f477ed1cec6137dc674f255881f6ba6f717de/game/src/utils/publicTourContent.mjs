import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getPublicCampaignProgress,isPublicChapterUnlocked} from './publicRunProgression.mjs';
import {getPublicPerformanceRecord} from './publicPerformanceRecords.mjs';
import {UI_CAST,isUserCastEnabled} from './userCast.mjs';
import {PUBLIC_RULESET_ID} from './releaseIdentity.mjs';
import {getChapterObjectiveSummary} from './chapterObjectives.mjs';
import {getChapterEncounterSummary} from './chapterEncounterContent.mjs';
import {getChapterContent} from './publicChapterContent.mjs';

export function getPublicChapterPacing(id){
 const content=getChapterContent(id);if(!content)return null;
 return {id,objective:getChapterObjectiveSummary(id),pressure:getChapterEncounterSummary(id),steps:[...content.pacingSteps]};
}

// Read existing durable evidence only; global clears are not member-specific measurements.
export function getPublicTourReview(profile,memberId=profile?.selectedId){
 if(!isUserCastEnabled()||!UI_CAST.some(m=>m.id===memberId))return null;
 const campaign=getPublicCampaignProgress(profile);
 const pending=profile?.hasPendingSave===true||(profile?.persisted!==true
  &&(profile?.recovery!=null||profile?.attempts!==0||profile?.clears!==0));
 const members=UI_CAST.map(member=>{
  const chapters=PUBLIC_CHAPTERS.map(chapter=>{
   const unlocked=isPublicChapterUnlocked(chapter.id,profile);
   const measured=getPublicPerformanceRecord(profile,chapter.id,member.id,PUBLIC_RULESET_ID);
   return {id:chapter.id,name:chapter.name,unlocked,cleared:campaign.clearedChapterIds.includes(chapter.id),
    state:!unlocked?'locked':measured?(pending?'pending':'recorded'):'unmeasured',record:!pending?measured:null};
  });
  return {id:member.id,name:member.name,chapters,recordCount:chapters.filter(c=>c.state==='recorded').length};
 });
 const member=members.find(m=>m.id===memberId),next=PUBLIC_CHAPTERS.find(c=>!campaign.clearedChapterIds.includes(c.id));
 const missing=member.chapters.find(c=>c.unlocked&&c.state==='unmeasured');
 const destination=next?.id||missing?.id||campaign.selectedChapterId;
 const recordCount=members.reduce((n,m)=>n+m.recordCount,0);
 const milestone=(id,label,count,total)=>({id,label,completed:pending?0:count,total,
  state:pending?'pending':count===total?'complete':'active'});
 const milestones=[
  milestone('campaign','巡演旅程',campaign.clearedChapterIds.length,PUBLIC_CHAPTERS.length),
  milestone('members','三人初演',members.filter(m=>Number.isSafeInteger(profile?.clearsByPerformer?.[m.id])
    &&profile.clearsByPerformer[m.id]>0).length,members.length),
  milestone('records','本版演出纪录',recordCount,members.length*PUBLIC_CHAPTERS.length),
 ];
 const ordered=[member,...members.filter(m=>m!==member)];
 const replayMember=!pending&&campaign.completed?ordered.find(m=>m.chapters.some(c=>c.state==='unmeasured'&&c.unlocked)):null;
 const replayChapter=replayMember?.chapters.find(c=>c.state==='unmeasured'&&c.unlocked);
 const replayTarget=replayChapter?{performerId:replayMember.id,chapterId:replayChapter.id,name:replayMember.name+' · '+replayChapter.name}:null;
 return {completed:campaign.completed,clearedCount:campaign.clearedChapterIds.length,pending,members,member,milestones,replayTarget,
  recordCount:members.reduce((n,m)=>n+m.recordCount,0),recommendedChapterId:destination,
  recommendation:next?`下一站 · ${next.name}`:missing?`建立本站纪录 · ${missing.name}`:'各站已通关 · 自选复演',
  reason:next?'已完成的章节保持开放，可继续巡演或返回复演。':missing?`${member.name}在本站尚无当前规则的已保存实测纪录。`
   :'现有巡演到此结束；可换成员、调整编排，或挑战自己的用时与受击纪录。'};
}
