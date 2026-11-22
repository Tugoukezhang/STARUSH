import {PRISM_VENUE,PRISM_CHAPTER} from '../utils/prismChapter.mjs';
import {loadPublicProfile, getRunChoice} from '../utils/publicRunProgression.mjs';
import {renderArrangementPlan} from './ArrangementPlanView.mjs';
import {UI_CAST as PUBLIC_PERFORMERS,getUiPerformer as getPublicPerformer,isUserCastEnabled} from '../utils/userCast.mjs';
import {getChapterEncounterSummary} from '../utils/chapterEncounterContent.mjs';
import {PUBLIC_EQUIPMENT,getPreparationEffects} from '../utils/publicPreparation.mjs';
import {getPublicEquipmentInventory} from '../utils/publicEquipmentInventory.mjs';
import {getPublicPerformanceRecord, formatPerformanceTime} from '../utils/publicPerformanceRecords.mjs';
import {PUBLIC_RULESET_ID,PUBLIC_RULESET_LABEL} from '../utils/releaseIdentity.mjs';
import {getUiPerformerArt} from './UiPerformerArt.mjs';
import {capturePublicRunGoal,describePublicRunGoal} from '../utils/publicRunGoals.mjs';
import {studyLobbyBackground} from './EnjoVisualStudy.mjs';
import {getChapterObjectiveSummary} from '../utils/chapterObjectives.mjs';
import {getPublicBuildModel} from '../utils/publicBuildContent.mjs';
import {getPublicTourReview} from '../utils/publicTourContent.mjs';
import {createPublicRoutePlan,normalizePublicRoutePlan,getPublicRouteReview} from '../utils/publicRoutePlan.mjs';
import {mountHomePortrait} from './HomePortraitPresentation.mjs';
import {mountMenuPortrait} from './MenuPortraitPresentation.mjs';
import {mountHomeConceptArt} from './HomeConceptArt.mjs';
import {getPublicBattleCheckpointAvailability} from '../utils/publicBattleCheckpoint.mjs';
import {mountChapterVenueArt} from './ChapterVenueArt.mjs';
import {mountEquipmentIcon} from './EquipmentIconArt.mjs';
import {mountInnerPageArt} from './InnerPageArt.mjs';
import {mountPortraitInteraction} from './HomePortraitInteraction.mjs';
import {renderCompactHome,renderCompactInventory,renderCompactPreflight} from './CompactMenuPages.mjs';

export const MOBILE_LOBBY_BACKGROUND='art/home-comic-backstage-20261022/backstage.webp';
export const HOME_DEMO_BACKGROUND='art/home-portrait-demo-20261022/backstage.webp';
const percent=value=>`${Math.round((value-1)*1000)/10}%`;
const HOME_LETTERING={start:'start',sakura:'rifle',kai:'sword',enjo:'hammer',
  preflight:'preflight',prepare:'training','story-journal':'journal','play-hub':'hub'};

// Decorative current-cast lettering; the parent's native label is clipped only after the raster loads.
function homeLettering(view,parent,key) {
  if(!isUserCastEnabled()||!HOME_LETTERING[key])return;
  const image=view.element('img','home-lettering',undefined,parent);
  image.alt='';image.setAttribute('aria-hidden','true');image.width=512;image.height=128;image.draggable=false;
  image.addEventListener('load',()=>{parent.dataset.lettering='loaded';});
  image.addEventListener('error',()=>{image.remove();delete parent.dataset.lettering;});
  image.src='art/home-lettering-20261022/'+HOME_LETTERING[key]+'.png';
}

function memberStrip(view,parent) {
  const strip=view.element('div','shell-member-strip',undefined,parent);
  strip.setAttribute('role','group');strip.setAttribute('aria-label','查看成员');
  for(const member of PUBLIC_PERFORMERS) {
    const button=view.button(strip,member.name,()=>{
      view.selection.previewMember(member.id);view.workshopMessage='';view.render(`[data-member="${member.id}"]`);
    },{className:'shell-member-option'});
    button.dataset.member=member.id;button.setAttribute('aria-pressed',String(member.id===view.selection.memberId));
    button.replaceChildren();view.mark(button,member);view.element('span','member-option-label',member.name,button);
  }
}

export function renderMobileLobby(view,main,model) {
  if(view.root.dataset.uiPass==='hierarchy-v1')return renderCompactHome(view,main,model,{start:()=>beginHomePerformance(view),renderContinue:renderHomeContinue});
  const bg=view.element('img','lobby-background',undefined,main);
  bg.src=studyLobbyBackground()||(isUserCastEnabled()?'art/venue-shell-20261026/venue.webp':MOBILE_LOBBY_BACKGROUND);bg.alt='公演后台';bg.draggable=false;
  bg.addEventListener('error',()=>{bg.hidden=true;main.dataset.backgroundState='unavailable';});
  const shortcuts=view.element('div','lobby-shortcuts',undefined,main);
  for(const [label,detail,icon,action,callback] of [
    ['出战准备','确认成员、场地与目标','clapperboard','preflight',()=>view.showPage('preflight')],
    ['成员训练','阶位与已拥有配件','users','prepare',()=>view.navigate(view.options.onWorkshop)],
    ['巡演手记','章节故事与演出记录','route','story-journal',()=>view.scene._sessionExperience?.showStoryJournal()],
    ['巡演后台','成员、场馆与公演企划','book-open','play-hub',()=>view.showPage('backstage')],
  ]) {
    const button=view.button(shortcuts,label,callback,{className:'lobby-shortcut',icon,action});
    button.replaceChildren();view.icon(icon,button);
    const copy=view.element('span','lobby-shortcut-copy',undefined,button);
    view.element('strong','',label,copy);button.title=label;
    if(action!=='play-hub')homeLettering(view,copy,action);
    if(isUserCastEnabled()&&action!=='play-hub')mountHomeConceptArt(view,button,action);
  }
  if(isUserCastEnabled()){
    const spaces=view.element('nav','home-space-entrances',undefined,main);spaces.setAttribute('aria-label','陪伴与场馆');
    for(const [page,label,icon] of [['lounge','陪伴','users'],['venue','场馆','clapperboard']]){
      view.button(spaces,label,()=>view.showPage(page),{className:'home-space-entry',action:`home-open-${page}`,icon,lineIcon:true});
    }
  }
  const stage=view.element('div','lobby-stage',undefined,main);
  const member=view.button(stage,isUserCastEnabled()?`与${model.member.name}互动`:`更换出战成员：${model.member.name}`,()=>{if(!isUserCastEnabled())view.navigate(view.options.onRoster);},
    {className:'lobby-member-visual shell-current-member',action:isUserCastEnabled()?'portrait-interact':'choose-member'});
  member.dataset.performer=model.member.id;member.replaceChildren();
  const character=view.element('img','lobby-character',undefined,member);
  character.src=getUiPerformerArt(model.member.id).portrait;character.alt=model.member.name;character.draggable=false;
  if(isUserCastEnabled())view.homePortraitDispose=mountHomePortrait(view,member,model.member.id,character,bg);
  if(isUserCastEnabled())view.menuPortraitDispose=mountMenuPortrait(view,member,model.member.id,character,{animate:true,background:bg});
  if(isUserCastEnabled()){
    view.portraitInteractionDispose=mountPortraitInteraction(view,member,stage,model.member.id);
  }
  const identity=view.element('div','lobby-member-name',undefined,stage);
  identity.setAttribute('role','group');identity.setAttribute('aria-label',model.member.name+' · '+model.member.actionName);
  view.element('strong','',model.member.name,identity);view.element('span','',model.member.actionName,identity);
  homeLettering(view,identity,model.member.id);
  if(isUserCastEnabled())mountHomeConceptArt(view,identity,'name-'+model.member.id);
  const prepared=PUBLIC_EQUIPMENT.find(item=>item.id===model.preparation?.equipmentId);
  const values=view.element('div','shell-preparation-values lobby-preparation',undefined,main);
  view.element('span','',`阶位 ${model.preparation?.trainingLevel||1}`,values);
  view.element('span','',prepared?.name||'未装备配件',values);
  const selectedGoal=capturePublicRunGoal(loadPublicProfile());if(selectedGoal)view.element('p','lobby-goal',describePublicRunGoal(selectedGoal),main);
  const overview=view.element('details','lobby-details',undefined,main);
  const ownerHome=isUserCastEnabled(),warning=model.recovery?'recovery':model.hasPendingSave?'pending':'none';
  const newWarning=ownerHome&&warning!=='none'&&warning!==view.homeDetailsWarning;
  overview.dataset.homeDetails='true';
  overview.open=ownerHome
    ?view.homeDetailsExpanded===true||newWarning
    :view.homeDetailsExpanded===true||Boolean(model.recovery||model.hasPendingSave);
  const disclosure=view.element('summary','',undefined,overview);
  if(ownerHome){
    if(newWarning)view.homeDetailsExpanded=true;
    overview.dataset.saveWarning=warning;view.homeDetailsWarning=warning;overview.dataset.reveal='none';
    let lastOpen=overview.open;
    view.element('span','home-details-label','巡演进度与最近演出',disclosure);
    view.icon('book-open',disclosure,true).setAttribute('class','home-details-open-icon');
    view.icon('x',disclosure,true).setAttribute('class','home-details-close-icon');
    view.element('span','home-details-warning',warning==='recovery'?'需恢复':warning==='pending'?'待保存':'',disclosure);
    for(const selector of ['.shell-save-recovery','.shell-pending-save']){const warning=main.querySelector(selector);if(warning)overview.append(warning);}
    overview.append(values);
    // The full-product hub stays visible; progress details must not hide global modules.
    const goal=main.querySelector('.lobby-goal');if(goal)overview.append(goal);
    // Nonmodal native sheet: labels follow real open state; detached or disposed sheets never write view state.
    const live=()=>!view.disposed&&overview.isConnected;
    const sync=()=>{
      disclosure.title=(overview.open?'收起巡演进度与最近演出':'巡演进度与最近演出')+(warning==='none'?'':' · 存档需要处理 · '+(warning==='recovery'?'需恢复':'待保存'));
      disclosure.setAttribute('aria-label',disclosure.title);
    };
    sync();
    overview.addEventListener('toggle',()=>{
      if(!live())return;
      if(overview.open!==lastOpen){overview.dataset.reveal=overview.open?'open':'none';lastOpen=overview.open;}
      view.homeDetailsExpanded=overview.open;sync();
    });
    overview.addEventListener('keydown',event=>{
      if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||event.keyCode===229||!overview.open||!live())return;
      event.preventDefault();event.stopPropagation();
      overview.open=false;view.homeDetailsExpanded=false;sync();disclosure.focus();
    });
  }else{
    disclosure.textContent='巡演进度与最近演出';
    overview.addEventListener('toggle',()=>{view.homeDetailsExpanded=overview.open;});
  }
  const session=view.element('section','lobby-session-overview',undefined,overview);
  session.dataset.homeSession='true';
  const sessionCopy=view.element('div','lobby-session-copy',undefined,session);
  view.element('small','lobby-section-kicker','本场演出',sessionCopy);
  view.element('strong','',`${model.chapter.name} · ${model.member.name}`,sessionCopy);
  view.element('span','',`${model.member.actionName} · 阶位 ${model.preparation?.trainingLevel||1}`,sessionCopy);
  view.button(session,'检查配置',()=>view.showPage('preflight'),{className:'lobby-session-action',icon:'arrow-right',action:'home-preflight'});
  const mission=view.element('section','lobby-mission',undefined,main);
  const preview=view.map(mission,model.chapter,'shell-main-map');preview.setAttribute('aria-hidden','true');
  const detail=view.element('div','lobby-mission-copy',undefined,mission);
  view.element('small','',`巡演 ${String(model.chapter.ordinal).padStart(2,'0')} / 03`,detail);
  const chapterTitle=view.element('h2','',model.chapter.name,detail);view.element('p','',model.chapter.subtitle,detail);
  if(isUserCastEnabled())mountHomeConceptArt(view,chapterTitle,'chapter-'+model.chapter.id);
  view.button(mission,'查看巡演路线',()=>view.navigate(view.options.onTour),{icon:'arrow-right',iconOnly:true,action:'choose-chapter'});
  const progress=view.element('div','shell-progress lobby-progress',undefined,overview);
  view.element('span','',model.completed?'巡演已完成':`巡演进度 ${model.clearedCount} / ${model.chapters.length}`,progress);
  const route=view.button(progress,'选择巡演章节',()=>view.navigate(view.options.onTour),{className:'shell-progress-route'});
  route.replaceChildren();
  for(const chapter of model.chapters) {
    const step=view.element('span',`shell-progress-step${chapter.selected?' is-current':''}${chapter.cleared?' is-cleared':''}`,'',route);
    step.dataset.state=chapter.cleared?'cleared':chapter.unlocked?'available':'locked';
    view.element('b','',`0${chapter.ordinal}`,step);view.element('span','',chapter.name,step);
  }
  const review=getPublicTourReview(loadPublicProfile(),model.member.id);
  if(review){
    const next=view.element('section','lobby-tour-next',undefined,overview);
    view.element('h2','',review.recommendation,next);view.element('p','',review.reason,next);
    view.element('p','system-context',review.milestones.map(m=>m.label+' '+m.completed+'/'+m.total).join(' · '),next);
    if(review.replayTarget){
      view.element('p','system-context','推荐复演 · '+review.replayTarget.name,next);
      view.button(next,'准备这场复演',()=>view.previewTourReplay(review.replayTarget),
        {className:'shell-primary',icon:'route',action:'replay-proposal'});
    }
    view.button(next,review.completed?'选择复演场地':'查看下一站',()=>{
      view.selection.previewChapter(review.recommendedChapterId);view.showPage('tour');
    },{icon:'route',action:'home-next-destination'});
  }
  const recent=view.element('section','lobby-last-run',undefined,overview);
  recent.dataset.homeLastRun='true';
  view.element('small','lobby-section-kicker','最近演出',recent);
  if(model.lastRun) {
    const lastMember=PUBLIC_PERFORMERS.find(item=>item.id===model.lastRun.performerId);
    const lastChapter=model.chapters.find(item=>item.id===model.lastRun.chapterId);
    const summary=view.element('div','lobby-last-run-summary',undefined,recent);
    view.element('strong','',`${lastMember?.name||'成员'} · ${lastChapter?.name||'巡演场地'}`,summary);
    const facts=[model.lastRun.victory?'通关':'未完成',model.lastRun.durationMs?formatPerformanceTime(model.lastRun.durationMs):'用时未记录'];
    if(Number.isFinite(model.lastRun.performance?.hitCount))facts.push(`${model.lastRun.performance.hitCount} 次受击`);
    else facts.push('受击未记录');
    view.element('span','',facts.join(' · '),summary);
  } else {
    view.element('p','lobby-last-run-empty','完成第一场后，这里会显示真实通关、用时与受击记录。',recent);
  }
  view.button(recent,'查看演出档案',()=>view.showPage('records'),{className:'lobby-record-action',icon:'arrow-right',action:'home-records'});
  const footer=view.element('footer','shell-start lobby-start');
  const actions=view.element('div','lobby-primary-actions',undefined,footer);
  const hasResume=getPublicBattleCheckpointAvailability().available&&!!view.options.onResume;
  const start=view.button(actions,hasResume?'新公演':'开始公演',()=>beginHomePerformance(view),{className:hasResume?'shell-primary lobby-restart':'shell-primary',icon:'play',lineIcon:hasResume,action:'start'});
  if(!hasResume)homeLettering(view,start,'start');
  if(isUserCastEnabled())mountHomeConceptArt(view,start,'start');
  if(isUserCastEnabled()&&hasResume){start.setAttribute('aria-label','开始公演（新公演，确认后替换中途记录）');start.title='新公演：确认后替换中途记录';}
  renderHomeContinue(view,footer,actions,model);
  view.element('p','shell-record',model.lastRun?`${model.lastRun.victory?'上次通关':'上次未通关'} · ${model.lastRun.durationMs?formatPerformanceTime(model.lastRun.durationMs):'用时未记录'}`:'第一场公演',footer);
  if(view.scene.scene.settings.data?.selectionSaveFailed&&!model.persisted&&model.hasPendingSave)
    view.element('p','shell-save-notice','选择暂存于本次打开期间',footer);
}

function beginHomePerformance(view){
  const saved=getPublicBattleCheckpointAvailability();
  if(!['none','already-recorded','unavailable'].includes(saved.status)){
    view.newRunConfirmation={runId:saved.summary?.runId||null};view.render('[data-action=cancel-new-run]');return;
  }
  view.navigate(view.options.onStart);
}

function renderHomeContinue(view,footer,actions,model){
  const saved=getPublicBattleCheckpointAvailability();
  if(isUserCastEnabled()&&view.root.dataset.uiPass!=='hierarchy-v1'&&(!saved.available||!view.options.onResume)){
    const empty=view.button(actions,'继续演出：暂无中途记录',()=>{}, {className:'lobby-resume',icon:'history',lineIcon:true,action:'resume-empty'});
    empty.disabled=true;empty.title='暂无可继续的中途记录';empty.setAttribute('aria-disabled','true');mountHomeConceptArt(view,empty,'resume');
  }
  if(saved.available&&view.options.onResume){
    footer.dataset.hasResume='true';
    const resume=view.button(actions,'继续演出',()=>view.navigate(()=>{
      const status=view.options.onResume();
      if(status!=='ok'){
        view.navigating=false;view.homeResumeMessage='中途记录暂不可恢复，已完成进度未更改。';view.render('[data-action=start]');
      }
    }),{className:'lobby-resume',icon:'arrow-right',lineIcon:true,action:'resume-run'});
    if(isUserCastEnabled()&&view.root.dataset.uiPass!=='hierarchy-v1')mountHomeConceptArt(view,resume,'resume');
    const actor=getPublicPerformer(saved.summary.performerId),chapter=model.chapters.find(c=>c.id===saved.summary.chapterId);
    view.element('p','lobby-resume-summary',`${actor.name} · ${chapter?.name||'巡演'} · ${formatPerformanceTime(Math.round(saved.summary.elapsedMs))}`,footer);
  }
  const rejected=view.scene.scene.settings.data?.publicBattleResumeRejected;
  if(view.homeResumeMessage||rejected||['corrupt','incompatible'].includes(saved.status))
    view.element('p','lobby-resume-message',view.homeResumeMessage||'中途记录暂不可恢复，已完成进度未更改。',footer).setAttribute('role','status');
  renderNewRunConfirmation(view);
}

function renderNewRunConfirmation(view){
  if(!view.newRunConfirmation)return;
  const expected=view.newRunConfirmation.runId;
  for(const child of view.root.children)child.inert=true;
  const overlay=view.element('section','home-start-confirmation');overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','home-start-title');
  const panel=view.element('div','home-start-panel',undefined,overlay);
  view.element('h2','','开始新的公演？',panel).id='home-start-title';
  view.element('p','','新公演的自动保存会替换现有中途记录，已完成的章节和训练不会改变。',panel);
  const row=view.element('div','home-start-actions',undefined,panel);
  const cancel=view.button(row,'保留记录',()=>{view.newRunConfirmation=null;view.render('[data-action=start]');},{action:'cancel-new-run',icon:'arrow-left',lineIcon:true});
  const confirm=view.button(row,'开始新公演',()=>{
    const latest=getPublicBattleCheckpointAvailability();
    if(expected&&latest.summary?.runId&&latest.summary.runId!==expected){view.newRunConfirmation={runId:latest.summary.runId};view.render('[data-action=cancel-new-run]');return;}
    view.newRunConfirmation=null;view.navigate(view.options.onStart);
  },{className:'shell-primary',action:'confirm-new-run',icon:'play',lineIcon:true});
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();cancel.click();}
    else if(event.key==='Tab'){
      const active=view.doc.activeElement;
      if(event.shiftKey&&active===cancel){event.preventDefault();confirm.focus();}
      else if(!event.shiftKey&&active===confirm){event.preventDefault();cancel.focus();}
    }
  });
}

function preflightDetails(view,main,key,label) {
  const details=view.element('details','archive-history',undefined,main);
  details.dataset.preflightSection=key;details.open=view.preflightExpanded?.[key]===true;
  view.element('summary','',label,details);
  details.addEventListener('toggle',()=>{(view.preflightExpanded??={})[key]=details.open;});
  return details;
}

export function renderPreflight(view,main,model) {
  if(model.chapter.id==='prism'){
    const panel=view.element('section','prism-preview-entry',undefined,main);view.element('h2','','第七章 · 折光花庭',panel);
    const venue=view.element('img','nightline-formal-map',undefined,panel);venue.src=PRISM_VENUE;venue.alt='玻璃花庭棱镜与双园接光示意';venue.width=768;venue.height=512;
    view.element('h3','',model.member.name+' · '+model.member.actionName,panel);view.element('p','',PRISM_CHAPTER.briefing.goal,panel);view.element('p','',PRISM_CHAPTER.briefing.rule,panel);view.element('p','',PRISM_CHAPTER.briefing.progression,panel);
    view.button(panel,'进入花庭公演',()=>beginHomePerformance(view),{className:'prism-preview-start',action:'prism-formal-start'});renderNewRunConfirmation(view);return;
  }
  if(view.root.dataset.uiPass==='hierarchy-v1'){
    renderCompactPreflight(view,main,model,{start:()=>beginHomePerformance(view)});
    renderNewRunConfirmation(view);return;
  }
  const currentCast=isUserCastEnabled();
  const equipment=PUBLIC_EQUIPMENT.find(item=>item.id===model.preparation.equipmentId);
  if(currentCast){
    main.dataset.preflightPresentation='stage-v3';
    const hero=view.element('section','preflight-hero',undefined,main);
    hero.dataset.performer=model.member.id;hero.dataset.chapter=model.chapter.id;
    const scene=view.map(hero,model.chapter,'preflight-scene');scene.setAttribute('aria-hidden','true');
    const stage=view.element('div','preflight-portrait-stage',undefined,hero);
    view.mark(stage,model.member,true,{animate:true,background:scene.querySelector('.chapter-venue-art')});
    const copy=view.element('div','preflight-hero-copy',undefined,hero);
    view.element('small','','巡演 0'+model.chapter.ordinal+' / 03',copy);
    view.element('h2','',model.chapter.name,copy);
    view.element('p','',model.chapter.subtitle,copy);
  }
  if(!currentCast){
    const header=view.element('div','screen-heading',undefined,main);
    view.element('h2','shell-page-heading','开演前确认',header);
    view.element('p','',`${model.member.name} · ${model.chapter.name}`,header);
  }
  const manifest=view.element('section','preflight-manifest',undefined,main);
  manifest.dataset.preflightManifest='true';manifest.dataset.performerId=model.member.id;manifest.dataset.chapterId=model.chapter.id;
  manifest.setAttribute('aria-label','本场演出清单');
  if(currentCast){
    const preparation=view.element('section','preflight-team',undefined,manifest);
    preparation.dataset.preflightPreparation='true';
    preparation.dataset.performerId=model.member.id;view.mark(preparation,model.member);
    const teamCopy=view.element('div','preflight-team-copy',undefined,preparation);
    const performer=view.element('div','preflight-performer',undefined,teamCopy);
    view.element('strong','preflight-performer-name',model.member.name,performer);
    view.element('span','preflight-performer-action',model.member.actionName,performer);
    const loadout=view.element('div','preflight-loadout',undefined,teamCopy);
    view.element('span','preflight-loadout-rank',`阶位 ${model.preparation.trainingLevel}`,loadout);
    view.element('span','preflight-loadout-equipment',equipment?.name||'未装备配件',loadout);
  }else{
    const manifestCopy=view.element('div','preflight-manifest-copy',undefined,manifest);
    view.element('small','',`巡演 ${String(model.chapter.ordinal).padStart(2,'0')} / 03`,manifestCopy);
    view.element('strong','',`${model.member.name} · ${model.chapter.name}`,manifestCopy);
    view.element('span','',`${model.member.actionName} · ${model.chapter.subtitle}`,manifestCopy);
  }
  view.element('span','preflight-manifest-state',currentCast?'本场出战':'开演配置',manifest);
  view.element('p','preflight-goal',`本场目标 · ${describePublicRunGoal(capturePublicRunGoal(loadPublicProfile()))}`,main);
  let commands;
  if(currentCast){
    const data={stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id};
    const selected=normalizePublicRoutePlan(view.routeSelection,data);
    const route=view.element('section','preflight-route',undefined,main);route.setAttribute('aria-label','本场串场路线');
    view.element('h3','','本场串场路线',route);
    const commands=view.element('div','preflight-links',undefined,route);commands.setAttribute('role','group');commands.setAttribute('aria-label','选择路线编排');
    for(const [id,label]of [['auto','随行'],['west','西线'],['east','东线']]){
      const button=view.button(commands,label,()=>{
        view.routeSelection=createPublicRoutePlan(id,data);view.render('[data-route-choice='+id+']');
      },{icon:'route',lineIcon:true,action:'route-choice'});button.dataset.routeChoice=id;
      const chosen=(selected?.id||'auto')===id;button.setAttribute('aria-pressed',String(chosen));
      view.element('small','route-choice-state',chosen?'已选':'选择',button);
    }
    const review=getPublicRouteReview(selected,data);
    const detail=view.element('div','preflight-route-detail',undefined,route);detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
    const facts=view.element('dl','preflight-route-facts',undefined,detail);
    for(const [label,value]of [
      ['串场安排',review?.text||'南北各区首站完成后锁定该线；可在局内自由决定。'],
      ['压轴弹路',review?.finale||'压轴沿用本章原顺序。'],
    ]){
      const fact=view.element('div','',undefined,facts);
      view.element('dt','',label,fact);const content=view.element('dd','',undefined,fact);
      if(label==='压轴弹路'&&review){
        const sequence=view.element('ol','preflight-route-sequence',undefined,content);
        for(const step of review.finaleSteps)view.element('li','',step,sequence);
      }else content.textContent=value;
    }
    view.element('p','system-context','本场预选不写入存档；同一成员本站的合法路线共用个人纪录。',route);
  }
  if(currentCast&&!renderArrangementPlan(view,main,model,'[data-action=preflight-library]')){
    const empty=view.element('section','preflight-plan-empty',undefined,main);
    view.element('h3','','未预选编排',empty);
    view.button(empty,'选择编排方案',()=>view.showPage('library'),{icon:'book-open',lineIcon:true,action:'preflight-select-plan'});
  }
  const guide=currentCast?preflightDetails(view,main,'guide','场地目标与规则'):main;
  view.element('p','preflight-goal',getChapterObjectiveSummary(model.chapter.id),guide);
  if(currentCast)view.element('p','preflight-goal',getChapterEncounterSummary(model.chapter.id),guide);
  const preview=view.map(guide,model.chapter,'preflight-map');preview.setAttribute('aria-label',model.chapter.subtitle);
  if(currentCast){
    const tools=view.element('section','preflight-tools',undefined,main);tools.setAttribute('aria-label','调整出战配置');
    view.element('h3','','调整出战配置',tools);
    commands=view.element('div','preflight-links',undefined,tools);
  }
  const buildDetails=currentCast?preflightDetails(view,main,'build','行动与配装效果'):main;
  const identity=view.element('section','preflight-member',undefined,buildDetails);identity.dataset.performerId=model.member.id;view.mark(identity,model.member);
  const copy=view.element('div','',undefined,identity);
  view.element('h2','',model.member.name,copy);view.element('p','',model.member.actionName,copy);
  view.element('p','',model.member.actionSummary,copy);
  const effects=getPreparationEffects(model.preparation,model.member.id);
  const build=currentCast?getPublicBuildModel(model.preparation,model.member.id):null;
  const stats=view.element('dl','preflight-effects',undefined,buildDetails);
  for(const [label,value]of [['训练阶位',model.preparation.trainingLevel],['演出配件',equipment?.name||'未装备'],
    ['行动涂染加成',`+${percent(effects.actionPower)}`],['行动充能加成',`+${percent(effects.chargeMultiplier)}`],['涂染范围加成',`+${effects.paintRadiusBonus}`]]) {
    const field=view.element('div','',undefined,stats);view.element('dt','',label,field);view.element('dd','',String(value),field);
  }
  if(build)view.element('p','preflight-build-note',build.roleNote,buildDetails);
  commands ||= view.element('div','preflight-links',undefined,main);
  view.button(commands,'更换成员',()=>view.showPage('roster'),{icon:'users',lineIcon:currentCast,action:'preflight-member'});
  view.button(commands,'成员训练',()=>view.showPage('workshop'),{icon:'clapperboard',lineIcon:currentCast,action:'preflight-training'});
  view.button(commands,'演出配件',()=>view.showPage('inventory'),{icon:'settings-2',lineIcon:currentCast,action:'preflight-inventory'});
  view.button(commands,'更换场地',()=>view.showPage('tour'),{icon:'route',lineIcon:currentCast,action:'preflight-chapter'});
  view.button(commands,'演出目标',()=>view.showPage('goals'),{icon:'check',lineIcon:currentCast,action:'preflight-goals'});
  view.button(commands,'编排思路',()=>view.showPage('library'),{icon:'book-open',lineIcon:currentCast,action:'preflight-library'});
  const footer=view.element('footer','shell-selection-footer');
  const routeLabel=currentCast?' · '+({west:'西线',east:'东线'}[view.routeSelection?.id]||'随行'):'';
  view.element('p','preflight-confirmation',`${model.member.name} · ${model.chapter.name}${routeLabel}`,footer);
  view.button(footer,'确认开演',()=>view.navigate(view.options.onStart),{className:'shell-primary',icon:'play',lineIcon:currentCast,action:'start'});
}

export function renderInventory(view,main,model) {
  if(view.root.dataset.uiPass==='hierarchy-v1')return renderCompactInventory(view,main,model);
  const profile=loadPublicProfile(),member=getPublicPerformer(view.selection.memberId);
  const inventory=getPublicEquipmentInventory(profile,member.id),snapshot=inventory.preparation;
  view.element('h2','shell-page-heading','成员配件',main);memberStrip(view,main);
  const context=view.element('p','inventory-context',undefined,main);
  view.element('strong','inventory-member-name',member.name,context);
  view.element('span','inventory-slot-count','1 个演出配件位',context);
  context.dataset.performer=member.id;
  const current=isUserCastEnabled();
  if(current){
    view.root.dataset.inventoryLayout='showcase';
    const equipped=inventory.equippedItem;
    const loadout=view.element('section','inventory-loadout',undefined,main);
    loadout.dataset.performer=member.id;loadout.dataset.equipment=equipped?.id||'none';
    loadout.setAttribute('aria-label',member.name+'当前装备');
    view.mark(loadout,member);
    const copy=view.element('div','inventory-loadout-copy',undefined,loadout);copy.append(context);
    const line=view.element('div','inventory-loadout-line',undefined,copy);
    view.element('small','inventory-loadout-label','当前装备',line);
    view.element('strong','inventory-loadout-name',equipped?.name||'未装备配件',line);
    const slot=view.element('span','equipment-art-slot inventory-loadout-equipment',undefined,loadout);
    const fallback=view.icon(equipped?'settings-2':'backpack',slot,true);
    if(equipped)mountEquipmentIcon(view,slot,equipped.id,fallback);
  }
  const workbench=view.element('div','inventory-workbench',undefined,main);
  const selected=inventory.items.find(item=>item.id===view.inventoryId)||inventory.items[0];
  const chooser=current?view.element('details','inventory-chooser',undefined,workbench):workbench;
  if(current){
    chooser.open=view.inventoryChooserOpen!==false;
    chooser.addEventListener('toggle',()=>{
      if(!view.disposed&&view.root.contains(chooser))view.inventoryChooserOpen=chooser.open;
    });
    const summary=view.element('summary','inventory-chooser-summary',undefined,chooser);summary.dataset.action='inventory-chooser';
    const slot=view.element('span','equipment-art-slot inventory-chooser-icon',undefined,summary);
    view.icon('backpack',slot,true);
    const copy=view.element('span','inventory-chooser-copy',undefined,summary);
    view.element('strong','inventory-chooser-title','配件目录',copy);
    view.element('small','inventory-chooser-count',`已拥有 ${inventory.items.filter(item=>item.owned).length} / ${inventory.items.length}`,copy);
    view.element('span','inventory-chooser-action','更换',summary);
    summary.title='配件目录';view.icon('arrow-right',summary,true);
  }
  const grid=view.element('div','inventory-grid',undefined,chooser);grid.setAttribute('role','group');grid.setAttribute('aria-label','演出配件');
  for(const [index,item]of inventory.items.entries()) {
    const button=view.button(grid,item.name,()=>{view.inventoryId=item.id;view.workshopMessage='';view.render(`[data-inventory-item="${item.id}"]`);},{className:'inventory-item'});
    button.dataset.inventoryItem=item.id;button.dataset.state=item.owned?'owned':'locked';
    button.dataset.compatible=String(item.compatible);
    button.setAttribute('aria-controls','inventory-detail');
    button.setAttribute('aria-pressed',String(selected.id===item.id));button.replaceChildren();
    const slot=current?view.element('span','equipment-art-slot',undefined,button):button;
    if(current)slot.dataset.equipment=item.id;
    const fallback=view.icon(['settings-2','clapperboard','route'][index%3],slot);
    if(current)mountEquipmentIcon(view,slot,item.id,fallback);
    view.element('strong',current?'inventory-item-name':'',item.name,button);
    const state=view.element('small',current?'inventory-item-state':'',!item.owned?'未解锁':item.equipped?'已装备':'已拥有',button);
    if(current){
      const equipped=item.equipped;
      button.dataset.equipped=String(equipped);
      state.id='inventory-state-'+item.id;button.setAttribute('aria-describedby',state.id);
      button.title=item.name+' · '+state.textContent+(selected.id===item.id?' · 正在查看':'')
        +(!item.compatible?' · '+item.ownerName+'专用':'');
      if(equipped)view.icon('check',button,true).classList.add('inventory-equipped-mark');
    }
  }
  const detail=view.element('section','inventory-detail',undefined,workbench);
  detail.id='inventory-detail';detail.dataset.item=selected.id;detail.setAttribute('aria-live','polite');
  if(current){detail.dataset.state=selected.state;detail.dataset.compatible=String(selected.compatible);}
  const heading=view.element('header','inventory-detail-heading',undefined,detail);
  const stage=current?view.element('div','inventory-object-stage',undefined,heading):heading;
  if(current)mountInnerPageArt(view,stage,'bay');
  const slot=current?view.element('span','equipment-art-slot',undefined,stage):heading;
  const fallback=view.art(selected.art||{wide_nozzle:'nozzle',rhythm_sync:'tempo',focus_lens:'lens'}[selected.id],slot,'menu-art inventory-detail-art');
  if(current)mountEquipmentIcon(view,slot,selected.id,fallback);
  const copy=view.element('div',current?'inventory-selection-copy':'',undefined,heading);
  view.element('small',current?'inventory-selection-status':'',current?(!selected.owned?'未解锁':selected.equipped?'已装备':'已拥有'):'选中配件',copy);
  view.element('h2',current?'inventory-selection-name':'',selected.name,copy);
  if(current)view.element('span','inventory-role',selected.performerId?selected.ownerName+'专用':'通用配件',copy);
  view.element('p','inventory-description',selected.description,detail);
  const compatible=selected.compatible;
  const candidate=isUserCastEnabled()?getPublicBuildModel({...snapshot,equipmentId:selected.id},member.id):null;
  if(candidate){
    view.element('h3','inventory-effects-heading','装备后效果',detail);
    const effects=view.element('dl','inventory-effects',undefined,detail);
    const effectIcons={'涂染半径加成':'settings-2','事件行动充能':'clapperboard','主动涂染倍率':'play'};
    for(const [index,row] of candidate.rows.entries()){
      const entry=view.element('div','inventory-effect-row',undefined,effects);entry.dataset.effectIndex=String(index);
      const label=view.element('dt','inventory-effect-label',undefined,entry);
      view.icon(effectIcons[row.label],label,true).classList.add('inventory-effect-icon');
      view.element('span','',row.label,label);view.element('dd','inventory-effect-value',row.value,entry);
    }
  }
  if(current)detail.append(chooser);
  view.element('p',current?'inventory-availability':'',selected.owned?`已拥有 · ${!compatible?'请切换至'+selected.ownerName:selected.equipped?'本成员已装备':'可装备'}`:selected.unlock,detail);
  const notes=view.element('details','inventory-notes',undefined,detail);
  view.element('summary','','作用与获取',notes);
  if(candidate)view.element('p','inventory-impact',candidate.roleNote,notes);
  if(selected.performerId)view.element('p','inventory-impact',selected.ownerName+'专用 · 占用唯一配件位，不叠加其他配件。',notes);
  view.element('p','',selected.unlock,notes);
  const catalog=view.button(detail,'配件对比与获取途径',()=>{view.growthContext=member.id;view.growthExpected={...snapshot};view.growthConfirmation=null;view.growthRank=snapshot.trainingLevel;view.growthEquipmentId=selected.id;view.showPage('growth');},{icon:'book-open',lineIcon:current,action:'inventory-catalog'});
  catalog.disabled=!compatible;
  const footer=view.element('footer','shell-selection-footer inventory-footer');
  const reason=current&&!selected.owned?selected.unlock:current&&!compatible?`请切换至${selected.ownerName}`:!model.persisted?'训练与装备需先保存记录。':`${member.name} · ${selected.name}`;
  const status=view.element('p','inventory-status',view.workshopMessage||reason,footer);
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const button=view.button(footer,selected.equipped?'卸下配件':`装备给${member.name}`,()=>{
    view.inventoryFeedback(member.id,selected.equipped?null:selected.id);
  },{className:'shell-primary',icon:'check',lineIcon:current,action:'equip-selected'});
  button.disabled=!selected.canEquip||!model.persisted;
  view.preparedPreflightButton(footer);
  if(current){const prepare=footer.querySelector('[data-action=prepared-preflight]');prepare.title=prepare.getAttribute('aria-label');}
}

export function renderArchive(view,main) {
  const profile=loadPublicProfile(),member=getPublicPerformer(view.selection.memberId);
  view.element('h2','shell-page-heading','成员成绩',main);memberStrip(view,main);
  view.element('p','archive-summary',`${member.name} · 通关 ${profile.clearsByPerformer[member.id]} 次`,main);
  if(isUserCastEnabled())view.element('p','archive-summary archive-rules-label',`当前规则 · ${PUBLIC_RULESET_LABEL}`,main);
  const current=isUserCastEnabled();
  if(!current)renderTourCoverage(view,main,getPublicTourReview(profile,member.id));
  const records=view.element('section','archive-current-records',undefined,main);records.setAttribute('aria-label',member.name+(current?'当前规则成绩':'成绩'));
  for(const chapter of view.archiveChapters) {
    const row=view.element('section','archive-record',undefined,records);row.dataset.recordChapter=chapter.id;
    if(current){
      const venue=view.element('figure','shell-route-preview archive-record-venue',undefined,row);
      venue.setAttribute('aria-hidden','true');view.icon('route',venue,true);mountChapterVenueArt(view,venue,chapter);
    }
    view.element('h2','',chapter.name,row);
    const record=getPublicPerformanceRecord(profile,chapter.id,member.id,isUserCastEnabled()?PUBLIC_RULESET_ID:null);
    if(current)row.dataset.recordState=record?'measured':'empty';
    if(record) {
      if(current){
        const facts=view.element('dl','archive-record-stats',undefined,row);
        for(const[label,value]of[['最快通关',formatPerformanceTime(record.bestTime.durationMs)],['最少受击',`${record.bestHits.hitCount} 次${record.bestHits.hitCount===0?' · 无伤通关':''}`]]){
          const fact=view.element('div','',undefined,facts);view.element('dt','',label,fact);view.element('dd','',value,fact);
        }
      }else{
        view.element('p','',`最快 ${formatPerformanceTime(record.bestTime.durationMs)}`,row);
        view.element('p','',`最少受击 ${record.bestHits.hitCount} 次${record.bestHits.hitCount===0?' · 无伤通关':''}`,row);
      }
    } else view.element('p','archive-empty','本成员暂无实测通关成绩',row);
    if(isUserCastEnabled()){
      const histories=[null,...Object.keys(profile.performance?.rulesets||{}).filter(id=>id!==PUBLIC_RULESET_ID)]
        .map(id=>({id,record:getPublicPerformanceRecord(profile,chapter.id,member.id,id)})).filter(row=>row.record);
      if(histories.length){
        const history=view.element('details','archive-history',undefined,row);
        view.element('summary','','历史纪录 · 不参与当前挑战',history);
        for(const {id,record}of histories){
          const label=id===null?'无版本历史':id==='owner-three-chapter-v1'?'三人三章 · 规则 1':id==='owner-three-chapter-v2'?'三人三章 · 规则 2':`历史规则 · ${id}`;
          view.element('p','',`${label} · 最快 ${formatPerformanceTime(record.bestTime.durationMs)} · 最少受击 ${record.bestHits.hitCount} 次`,history);
        }
      }
    }
  }
  if(current){
    const overview=view.element('details','archive-history archive-overview',undefined,main);overview.open=view.archiveOverviewExpanded===true;
    overview.addEventListener('toggle',()=>{view.archiveOverviewExpanded=overview.open;});
    view.element('summary','','全队覆盖与巡演里程碑',overview);renderTourCoverage(view,overview,getPublicTourReview(profile,member.id));
  }
  if(profile.lastRun) {
    const last=view.element('section','archive-last-run',undefined,main);
    view.element('h2','',`最近演出 · ${getPublicPerformer(profile.lastRun.performerId).name}`,last);
    const choices=profile.lastRun.choices.map(id=>getRunChoice(id,profile.lastRun.performerId)?.label).filter(Boolean);
    view.element('p','',`${profile.lastRun.victory?'通关':'未完成'} · ${formatPerformanceTime(profile.lastRun.durationMs)}`,last);
    if(isUserCastEnabled())view.element('p','',profile.lastRun.rulesetId===PUBLIC_RULESET_ID?'当前规则':'历史版本 · 不与当前规则比较',last);
    view.element('p','',choices.join(' / ')||'无编排记录',last);
  }
  view.button(main,'章节现场档案',()=>view.showPage('chapterArchive'),{icon:'route',action:'archive-chapters'});
  const footer=view.element('footer','shell-selection-footer');
  view.button(footer,'巡演手记',()=>view.scene._sessionExperience?.showStoryJournal(),{className:'shell-primary',icon:'route',action:'story-journal'});
}

export function renderTourCoverage(view,parent,review){
  if(!review)return;
  const section=view.element('section','tour-coverage',undefined,parent);
  view.element('h2','',`实测纪录 ${review.recordCount} / ${review.members.length*view.archiveChapters.length}`,section);
  view.element('p','system-context',review.pending?'仅统计本机已保存的当前规则成绩；未保存数据不计入。'
    :'巡演通关与成员纪录分开计数；仅统计当前规则的本机已保存成绩。',section);
  const table=view.element('table','tour-coverage-table',undefined,section);
  const caption=view.element('caption','', '成员与章节实测纪录',table);
  caption.className='tour-coverage-caption';
  const head=view.element('thead','',undefined,table),titles=view.element('tr','',undefined,head);
  const corner=view.element('th','','成员',titles);corner.setAttribute('scope','col');
  for(const c of view.archiveChapters){const th=view.element('th','',c.name,titles);th.setAttribute('scope','col');}
  const body=view.element('tbody','',undefined,table);
  for(const member of review.members){
    const row=view.element('tr','',undefined,body);row.dataset.tourMember=member.id;
    const th=view.element('th','',member.name,row);th.setAttribute('scope','row');
    for(const c of member.chapters){
      const cell=view.element('td','',{recorded:'已记录',pending:'待保存',locked:'未开放',unmeasured:'未记录'}[c.state],row);
      cell.dataset.tourCell=member.id+':'+c.id;cell.dataset.state=c.state;
    }
  }
  const milestones=view.element('table','tour-coverage-table',undefined,section);milestones.dataset.tourMilestones='true';
  const title=view.element('caption','','巡演里程碑',milestones);title.className='tour-coverage-caption';
  const rows=view.element('tbody','',undefined,milestones);
  for(const m of review.milestones){
    const row=view.element('tr','',undefined,rows);row.dataset.milestone=m.id;row.dataset.state=m.state;
    const name=view.element('th','',m.label,row);name.setAttribute('scope','row');
    view.element('td','',m.completed+' / '+m.total,row);
    view.element('td','',m.state==='pending'?'待保存':m.state==='complete'?'已完成':'进行中',row);
  }
  view.element('p','system-context','章节通关与三人初演保留跨版本进度；演出纪录只计本版。里程碑自动记录，不追加奖励。',section);
  if(review.replayTarget){
    view.element('p','system-context','推荐复演 · '+review.replayTarget.name,section);
    view.button(section,'准备这场复演',()=>view.previewTourReplay(review.replayTarget),
      {className:'shell-primary',icon:'route',action:'replay-proposal'});
  }
}
