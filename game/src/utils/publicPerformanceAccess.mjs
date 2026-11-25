import {loadPublicProfile,getPublicCampaignProgress,isPublicChapterUnlocked} from './publicRunProgression.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getChapterPrerequisiteIds} from './publicChapterContent.mjs';
import {getPublicProductMode} from './publicProductModules.mjs';

function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const labels={'ready':'已开放','locked':'未开放','save-required':'待保存','save-pending':'待保存','save-protected':'需处理存档','unavailable':'未开放'};
const knownChapter=id=>PUBLIC_CHAPTERS.some(c=>c.id===id);
export function getPublicPerformanceAccess(profile=loadPublicProfile(),options={}){
 const valid=options!==null&&typeof options==='object'&&!Array.isArray(options);
 const modeId=valid&&Object.hasOwn(options,'modeId')?options.modeId:valid?'campaign':null;
 const mode=getPublicProductMode(modeId),progress=getPublicCampaignProgress(profile);
 const chapterId=modeId==='finale-trial'?null:valid&&Object.hasOwn(options,'chapterId')?options.chapterId:progress.selectedChapterId;
 const registered=!!mode&&['campaign','rehearsal','finale-trial'].includes(modeId)&&(modeId==='finale-trial'||knownChapter(chapterId));
 const required=registered?(modeId==='finale-trial'?mode.requiredChapterIds:modeId==='rehearsal'?[chapterId]:getChapterPrerequisiteIds(chapterId)):[];
 const missing=(required||[]).filter(id=>!progress.clearedChapterIds.includes(id));
 let state='unavailable',reason='该内容尚未开放。',canStart=false;
 if(registered){
  if(modeId==='campaign'){
   canStart=isPublicChapterUnlocked(chapterId,profile);state=canStart?'ready':'locked';
   reason=canStart?'':`通关${missing.map(id=>PUBLIC_CHAPTERS.find(c=>c.id===id).name).join('、')}后开放。`;
  }else if(profile?.recovery){state='save-protected';reason='当前存档需恢复或受保护，请先处理存档状态。';}
  else if(profile?.hasPendingSave){state='save-pending';reason='有进度尚未保存，请先重试保存。';}
  else if(missing.length){state='locked';reason=modeId==='rehearsal'?'先通关「'+PUBLIC_CHAPTERS.find(c=>c.id===chapterId).name+'」并保存，即可排练。':'完成前三站巡演并保存后开放。';}
  else if(!profile||profile.persisted===false){state='save-required';reason='已满足通关条件，保存本机进度后开放。';}
  else{state='ready';reason='';canStart=true;}
 }
 return freeze({modeId:typeof modeId==='string'?modeId:null,chapterId:typeof chapterId==='string'?chapterId:null,entryPage:mode?.entryPage??null,
  registered,state,label:labels[state],canStart,reason,requiredChapterIds:[...(required||[])],missingChapterIds:missing,
  cleared:knownChapter(chapterId)&&progress.clearedChapterIds.includes(chapterId),clearedCount:progress.clearedChapterIds.length,chapterCount:PUBLIC_CHAPTERS.length});
}
export function getPublicPerformanceCatalog(profile=loadPublicProfile(),{chapterId}={}){
 const progress=getPublicCampaignProgress(profile),selected=chapterId===undefined?progress.selectedChapterId:chapterId;
 const chapters=PUBLIC_CHAPTERS.map(c=>getPublicPerformanceAccess(profile,{modeId:'campaign',chapterId:c.id}));
 const rehearsalChapter=chapters.find(c=>c.chapterId===selected&&c.cleared)?.chapterId||chapters.find(c=>c.cleared)?.chapterId||selected;
 const rehearsal=getPublicPerformanceAccess(profile,{modeId:'rehearsal',chapterId:rehearsalChapter});
 const availableChapterCount=PUBLIC_CHAPTERS.filter(c=>getPublicPerformanceAccess(profile,{modeId:'rehearsal',chapterId:c.id}).canStart).length;
 return freeze({selectedChapterId:typeof selected==='string'?selected:null,chapterCount:PUBLIC_CHAPTERS.length,clearedCount:progress.clearedChapterIds.length,
  chapters,modes:[getPublicPerformanceAccess(profile,{modeId:'campaign',chapterId:selected}),{...rehearsal,availableChapterCount},getPublicPerformanceAccess(profile,{modeId:'finale-trial'})]});
}
