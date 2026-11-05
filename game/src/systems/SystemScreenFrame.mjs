import {getPublicShellRoute} from '../utils/publicShellNavigation.mjs';
import {USER_CAST,isUserCastEnabled} from '../utils/userCast.mjs';
import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';
import {getUiPerformerArt} from './UiPerformerArt.mjs';
import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';

const sections=Object.freeze({playhub:'演出事务',library:'本场编排',growth:'成员培养',records:'演出留声',chapterArchive:'现场手记',finaleTrial:'连续压轴',rehearsal:'单站排练'});
export function getSystemScreenFrameModel(page,model,{previewMemberId,rehearsalChapterId}={}){
  if(!Object.hasOwn(sections,page)||!getPublicShellRoute(page)||!model)return null;
  const confirmed=USER_CAST.find(row=>row.id===model.member?.id),selected=PUBLIC_CHAPTERS.find(row=>row.id===model.chapter?.id);
  if(!confirmed||!selected||!Number.isSafeInteger(model.clearedCount)||model.clearedCount<0||model.clearedCount>PUBLIC_CHAPTERS.length)return null;
  const chapter=page==='finaleTrial'?PUBLIC_CHAPTERS[0]:page==='rehearsal'?PUBLIC_CHAPTERS.find(row=>row.id===rehearsalChapterId):selected;
  if(!chapter)return null;
  const member=page==='growth'?USER_CAST.find(row=>row.id===previewMemberId)||confirmed:confirmed;
  return Object.freeze({id:page,moduleId:getPublicShellRoute(page).moduleId,title:getPublicShellRoute(page).title,kicker:sections[page],
    memberId:member.id,memberName:member.name,memberState:member.id===confirmed.id?'本场出战':'预览成员',
    chapterId:chapter.id,chapterName:chapter.name,chapterLabel:page==='rehearsal'?'排练场地':page==='finaleTrial'?'连演起点':'当前巡演场地',venueSrc:CHAPTER_VENUE_ART[chapter.id],avatarSrc:getUiPerformerArt(member.id).avatar,
    progressLabel:`已通关 ${model.clearedCount} / ${PUBLIC_CHAPTERS.length}`,
    saveState:model.recovery?'protected':model.hasPendingSave?'pending':'local'});
}

export function mountSystemScreenFrame(view,parent,model){
  delete view.root.dataset.systemScreen;
  if(!isUserCastEnabled()||view.disposed||!parent)return null;
  const frame=getSystemScreenFrameModel(view.page,model,{previewMemberId:view.selection.memberId,rehearsalChapterId:view.rehearsalSetup?.chapterId});if(!frame)return null;
  view.root.dataset.systemScreen='true';
  const band=view.element('header','system-screen-frame',undefined,parent);band.dataset.page=frame.id;band.dataset.member=frame.memberId;band.dataset.chapter=frame.chapterId;
  band.setAttribute('aria-label',frame.title+' · '+frame.chapterLabel+'与成员');band.dataset.art='loading';
  const venue=view.element('img','system-frame-venue',undefined,band);venue.alt='';venue.draggable=false;venue.width=768;venue.height=512;venue.setAttribute('aria-hidden','true');
  const owned=()=>!view.disposed&&venue.parentNode===band&&view.root.contains(band);
  const ready=()=>{if(owned()&&venue.naturalWidth>0){venue.hidden=false;band.dataset.art='ready';}};
  venue.addEventListener('load',ready,{once:true});venue.addEventListener('error',()=>{if(owned()){venue.hidden=true;band.dataset.art='unavailable';}},{once:true});venue.src=frame.venueSrc;
  if(venue.complete&&venue.naturalWidth>0)ready();
  view.element('span','system-frame-kicker',frame.kicker,band);view.element('span','system-frame-progress',frame.progressLabel,band);
  const context=view.element('div','system-frame-context',undefined,band),place=view.element('div','system-frame-place',undefined,context);
  view.element('small','',frame.chapterLabel,place);view.element('h2','system-frame-title',frame.chapterName,place);
  const member=view.element('div','system-frame-member',undefined,context),avatar=view.element('img','system-frame-avatar',undefined,member);
  avatar.src=frame.avatarSrc;avatar.alt='';avatar.width=40;avatar.height=40;avatar.draggable=false;
  const copy=view.element('div','system-frame-member-copy',undefined,member);view.element('small','system-frame-member-state',frame.memberState,copy);view.element('strong','',frame.memberName,copy);
  if(frame.saveState!=='local')view.element('p','system-frame-save',frame.saveState==='pending'?'有进度未保存':'存档待核对',band);
  return band;
}
