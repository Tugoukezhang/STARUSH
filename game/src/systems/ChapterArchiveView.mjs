import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';
import {loadPublicProfile,getPublicCampaignProgress,isPublicChapterUnlocked} from '../utils/publicRunProgression.mjs';
import {getChapterFieldReview} from '../utils/publicChapterReports.mjs';
import {getChapterObjectiveSummary} from '../utils/chapterObjectives.mjs';
import {getChapterEncounterSummary} from '../utils/chapterEncounterContent.mjs';
import {getReadableStoryEntries} from '../utils/publicStory.mjs';
import {getStoryReadingLabel,isOwnerStoryBeat} from '../utils/publicStoryPlayback.mjs';
import {playerPreferences} from '../utils/playerPreferences.mjs';
import {getDisplayPerformer,isUserCastEnabled} from '../utils/userCast.mjs';
import {mountChapterVenueArt} from './ChapterVenueArt.mjs';
import {formatPerformanceTime} from '../utils/publicPerformanceRecords.mjs';
import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';

const stopNumber=value=>String(value).padStart(2,'0');

export function renderChapterArchive(view,main,model){
 const profile=loadPublicProfile(),campaign=getPublicCampaignProgress(profile);
 const chapter=PUBLIC_CHAPTERS.find(c=>c.id===view.reportChapterId)||model.chapter;
 const unlocked=isPublicChapterUnlocked(chapter.id,profile),entry=profile.chapterReports?.chapters?.[chapter.id],review=getChapterFieldReview(entry);
 const chapterState=id=>campaign.clearedChapterIds.includes(id)?'cleared':isPublicChapterUnlocked(id,profile)?'open':'locked';
 // B289 journal: selector, venue band, story replays, then collapsed records. Static labels carry
 // data-archive-letter hosts (mounted by SecondaryUiArt); dynamic facts stay native.
 main.dataset.archiveStudio='289';main.dataset.archivePage='chapter';
 // Hidden by scoped CSS: the shell h1 already titles the page. Kept as the non-owner focus target.
 view.element('h2','shell-page-heading','章节现场档案',main).dataset.archiveLetter='chapterArchive';
 const tabs=view.element('div','chapter-report-tabs',undefined,main);tabs.setAttribute('role','group');tabs.setAttribute('aria-label','查阅章节');
 for(const c of PUBLIC_CHAPTERS){
  const b=view.button(tabs,c.name,()=>{view.reportChapterId=c.id;view.render(`[data-report-chapter="${c.id}"]`);},{className:'arrangement-option'});
  const state=chapterState(c.id);
  b.dataset.reportChapter=c.id;b.setAttribute('aria-pressed',String(chapter.id===c.id));
  b.dataset.chapterState=state;
  b.querySelector('span').dataset.archiveLetter='chapter-'+c.id;
  if(state!=='open')view.icon(state==='locked'?'lock':'check',b,true);
 }
 const title=view.element('header','chapter-report-heading',undefined,main);title.dataset.chapterState=chapterState(chapter.id);
 // Venue art names the place, not the story, so locked chapters keep it (CSS desaturates that state).
 if(isUserCastEnabled()){
  const venue=view.element('figure','shell-route-preview chapter-report-venue',undefined,title);
  venue.setAttribute('aria-hidden','true');view.icon('route',venue,true);mountChapterVenueArt(view,venue,chapter);
 }
 view.element('small','system-context','巡演 '+stopNumber(chapter.ordinal)+' / '+stopNumber(PUBLIC_CHAPTERS.length),title);view.element('h3','',chapter.name,title).dataset.archiveLetter='chapter-'+chapter.id;
 view.element('p','chapter-report-status',!unlocked?'尚未开放':campaign.clearedChapterIds.includes(chapter.id)?'本站已通关':'本站待完成',title);
 if(unlocked){
  const stories=view.element('section','chapter-report-stories',undefined,main);view.element('h3','','章节故事',stories).dataset.archiveLetter='journal';
  if(isUserCastEnabled()&&playerPreferences.pending)view.element('p','shell-save-notice story-save-notice','本机设置与阅读记录有未保存的修改。',stories);
  for(const beat of getReadableStoryEntries(profile).filter(b=>b.chapterId===chapter.id)){
   const reading=isUserCastEnabled()&&isOwnerStoryBeat(beat)?getStoryReadingLabel(beat.id,playerPreferences.read().storyProgress):null;
   const name=beat.label+' · '+(beat.eventTitle||beat.title),label=name+(reading?' · '+reading:'');
   const row=view.button(stories,label,()=>{const session=view.scene._sessionExperience;session?.showStory(beat.chapterId,beat.phase,{complete:()=>{
    session.close();if(!view.disposed&&view.page==='chapterArchive')view.render('[data-action=report-story-'+beat.phase+']');
   }});},{icon:'book-open',action:'report-story-'+beat.phase});
   // Short row: title and reading status as separate spans; the full label stays the accessible name.
   const text=row.querySelector('span');text.className='chapter-story-title';text.textContent=name;
   if(reading){
    const status=view.element('span','chapter-story-status',reading,row);
    row.dataset.storyState=reading==='已读'?'read':reading==='未读'?'unread':'resume';
    if(reading==='已读')view.icon('check',status,true);
   }
  }
  // The wrapper keeps the chapter binding; its one disclosure is the whole recent record.
  const recent=view.element('section','chapter-report-recent',undefined,main);recent.dataset.chapterReport=chapter.id;
  const field=view.element('details','archive-history chapter-report-field',undefined,recent);
  const fieldSummary=view.element('summary','',undefined,field);
  // The unsaved state lives on the summary so it stays visible while collapsed.
  const recentTitle=view.element('h3','',review&&!profile.persisted?'最近现场 · 尚未保存':'最近现场',fieldSummary);
  if(!review||profile.persisted)recentTitle.dataset.archiveLetter='field';
  // SecondaryUiArt only adds this cue to the goals disclosure; both rows need the same affordance.
  if(isUserCastEnabled()){const cue=view.element('img','archive-disclosure-glyph',undefined,fieldSummary);cue.src='art/archive-journal-20261104/chevron.webp';cue.alt='';cue.draggable=false;cue.setAttribute('aria-hidden','true');}
  if(review){
   view.element('p','chapter-report-result',getDisplayPerformer(entry.performerId).name+' · '+(entry.victory?'通关':'未完成')+' · '+formatPerformanceTime(entry.durationMs),field);
   if(entry.rulesetId!==PUBLIC_RULESET_ID)view.element('p','system-context','历史规则现场 · 不参与当前规则比较',field);
   view.element('p','chapter-report-field-label','现场经过',field);
   const facts=view.element('dl','chapter-report-facts',undefined,field);
   for(const [label,text]of [['串场路线',review.side],['联动经过',review.event],['压轴应对',review.finale]]){
    const row=view.element('div','',undefined,facts);view.element('dt','',label,row);view.element('dd','',text,row);
   }
   view.element('p','system-context','仅保留本站最近一次经过；未记录接触不代表全场无伤。',field);
  }else view.element('p','system-context',campaign.chapterClears[chapter.id]>0?'已有通关成绩，尚无现场记录。再次演出后可在此查阅。':'完成或结束本站演出后，记录实际经过。',field);
  const guide=view.element('details','archive-history chapter-report-guide',undefined,main);view.element('summary','','目标事件',guide).dataset.archiveLetter='events';
  const map=view.map(guide,chapter,'rehearsal-map chapter-report-map');map.setAttribute('aria-label',chapter.subtitle);
  view.element('p','',getChapterObjectiveSummary(chapter.id),guide);view.element('p','',getChapterEncounterSummary(chapter.id),guide);
 }else view.element('p','system-context chapter-report-locked','完成「'+PUBLIC_CHAPTERS[chapter.ordinal-2].name+'」后开放本章。',main);
 const footer=view.element('footer','shell-selection-footer');
 // Reuse the original explicit venue confirmation; merely reading a report never writes.
 const prepare=view.button(footer,'前往准备',()=>{
  if(!view.selection.previewChapter(chapter.id))return;
  view.showPage('tour');
 },{className:'shell-primary',icon:'route',action:'report-prepare'});
 prepare.querySelector('span').dataset.archiveLetter='prepare';
 prepare.disabled=!unlocked;
}
