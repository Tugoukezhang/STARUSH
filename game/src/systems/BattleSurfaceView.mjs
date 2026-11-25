import { equipPublicPerformer, getRunChoice } from '../utils/publicRunProgression.mjs';
import { getDisplayPerformer as getPublicPerformer, getActiveUserCastArt,isUserCastEnabled } from '../utils/userCast.mjs';
import {BLUE_ACADEMY_PORTRAIT,BLUE_ACADEMY_ART} from '../utils/blueAcademyArt.mjs';
import {RED_VALKYRIE_PORTRAIT} from '../utils/redValkyrieArt.mjs';
import {GREEN_WINDSONG_PORTRAIT,GREEN_WINDSONG_ART} from '../utils/greenWindsongArt.mjs';
import {getPublicJourneyResult} from '../utils/publicJourneyContent.mjs';
import { getPublicChapter,PUBLIC_CHAPTERS } from '../utils/publicCampaign.mjs';
import { releaseSessionInput, resumePlayerAudioFromGesture } from './PlayerSessionExperience.mjs';
import { shellIcons } from '../vendor/shellIcons.mjs';
import {gameplayIcons} from '../vendor/gameplayIcons.mjs';
import {getMenuAvatarArt} from './MenuPortraitAvatar.mjs';
import {getPortraitBase,portraitBaseMetrics} from './PortraitBaseRegistration.mjs';
import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';
import { getPreparationSnapshot, PUBLIC_EQUIPMENT } from '../utils/publicPreparation.mjs';
import { getChapterStory } from '../utils/publicStory.mjs';
import { getUiPerformerArt, uiPerformerAvatarCss } from './UiPerformerArt.mjs';
import { normalizePerformanceSample } from '../utils/publicPerformanceRecords.mjs';
import { evaluatePublicRunGoal, getPublicRunGoalHandoff } from '../utils/publicRunGoals.mjs';
import {visualStudyEnabled} from './EnjoVisualStudy.mjs';
import {loadPublicProfile} from '../utils/publicRunProgression.mjs';
import {getEarnedEquipmentHandoff} from '../utils/publicSessionContent.mjs';
import {getPublicBuildModel,getPublicBuildOption,getPublicChoiceReview} from '../utils/publicBuildContent.mjs';
import {getPublicTourReview} from '../utils/publicTourContent.mjs';
import {getFinaleResponseSummary} from '../utils/chapterFinaleContent.mjs';
import {getChapterEventReview} from '../utils/chapterEncounterEvents.mjs';
import {getChapterSideSetReview} from '../utils/chapterSideSets.mjs';
import {getPublicAttemptProgress} from '../utils/publicAttemptProgress.mjs';
import {getPublicRouteReview} from '../utils/publicRoutePlan.mjs';
import {PUBLIC_MENU_ART} from './PublicMenuArt.mjs';
import {getEquipmentIconArt} from './EquipmentIconArt.mjs';
import {RELAY_TRANSFER_ART} from './RelayInkTransfer.mjs';
import {evaluateRehearsal} from '../utils/publicRehearsal.mjs';
import {getArrangementPlanReview} from '../utils/publicArrangementPlan.mjs';
import {resolvePublicObjectiveGuidanceTarget} from './PublicObjectiveGuidance.mjs';
import {getPublicBattleFlow} from '../utils/publicBattleFlow.mjs';
import {getChapterBriefing} from '../utils/playerPreferences.mjs';
import {syncBattleHeader} from './BattleHeaderPresentation.mjs';
import {syncBattleHudStage} from './BattleHudStage.mjs';
import {PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS} from './PublicStage1SakuraActionContract.mjs';

const CHOICE_ICONS = Object.freeze({
  wide_brush:'settings-2', relay:'users', tempo:'clapperboard',
  echo:'route', overdrive:'play', recovery:'check',
});
const BATTLE_ICONS=Object.freeze({...shellIcons,...gameplayIcons});
// Owner family uses original AI raster art; fanfire shows its three actual paint paths.
const CHOICE_ART=Object.freeze({
 ...Object.fromEntries(Object.keys(CHOICE_ICONS).map(id=>[id,Object.freeze({src:PUBLIC_MENU_ART[id],size:160})])),
 fanfire:Object.freeze({src:'art/choice-studio-20261104/fanfire.webp',size:256}),
});
const CHOICE_THEMES=Object.freeze({
 wide_brush:{category:'覆盖范围',ink:'#76e0df'},relay:{category:'目标接力',ink:'#ff9ebc'},tempo:{category:'行动蓄能',ink:'#d9f743'},
 fanfire:{category:'弹道分轨',ink:'#ffb86b'},
 echo:{category:'延迟补色',ink:'#76e0df'},overdrive:{category:'主动强化',ink:'#ff9ebc'},recovery:{category:'设施续航',ink:'#d9f743'},
});
const OPTION_COUNT=['','一','二','三','四'];
const ROLE_ECHO_ART=Object.freeze({
 kai:{src:GREEN_WINDSONG_ART.weaponIcon,size:256,category:'风铃回响',ink:'#76e0bf'},
 enjo:{src:BLUE_ACADEMY_ART.weaponIcon,size:256,category:'星页回响',ink:'#8bbfff'},
});
// Owned full-body sources. head = crown-to-chin / source width; face = face centre as source fractions,
// so CSS renders every role with the same head height at the same anchor. Static art, not Live2D.
const RESULT_PORTRAITS=Object.freeze({
 sakura:RED_VALKYRIE_PORTRAIT,
 kai:GREEN_WINDSONG_PORTRAIT,
 enjo:BLUE_ACADEMY_PORTRAIT,
});
// Original AI lettering 公演完成; victory only, decorative beside the native h2.
const RESULT_TITLE_ART=Object.freeze({src:'art/result-stage-20261031/complete.webp',width:984,height:268});
const CONTINUATION_TEXT=Object.freeze({
 ready:'本场已保存。进入准备后确认成员与训练，再开演。',
 pending:'本场尚未保存，保存成功后才能前往。',
 blocked:'暂不可前往。请先处理保存，或返回巡演确认。',
});

export function preloadPublicBattleUi(scene, data = {}) {
  if (Number(data.stageId || 1) !== 1 || data.practiceMode === true) return;
  const art = getActiveUserCastArt(data.performerId);
  if (!art) return;
  const base = 'art/formal-ui-20261016/';
  const files = ['disc', 'disc-ready', `action-${art.id}`].map(id => `${base}${id}.webp`);
  files.push(...['panel','slip','title','primary','secondary'].map(id=>`art/playable-ui-20261018/${id}.webp`));
  files.push(...Object.values(CHOICE_ART).map(row=>row.src), art.avatar, art.portrait);
  if(ROLE_ECHO_ART[art.id])files.push(ROLE_ECHO_ART[art.id].src);
  files.push('art/choice-stage-b303/row.webp','art/choice-stage-b303/confirm.webp','art/choice-studio-20261104/heading.webp');
  files.push(...['guidance','phase','action','danger'].map(id=>'art/battle-signals-b293/'+id+'.webp'));
  const load = scene.load, previous = load.imageLoadType, hadOwn = Object.hasOwn(load, 'imageLoadType');
  if(!scene.textures.exists(RELAY_TRANSFER_ART.key))load.spritesheet(RELAY_TRANSFER_ART.key,RELAY_TRANSFER_ART.path,
    {frameWidth:RELAY_TRANSFER_ART.frameWidth,frameHeight:RELAY_TRANSFER_ART.frameHeight});
  // CSS and DOM images share browser resources; failures keep the existing scene retry owner.
  load.imageLoadType = 'HTMLImageElement';
  try {
    for (const path of new Set(files)) {
      const key = `public-ui:${path}`;
      if (!scene.textures.exists(key)) load.image(key, path);
    }
  } finally {
    if (hadOwn) load.imageLoadType = previous;
    else delete load.imageLoadType;
  }
}

function createBattleIcon(doc, name) {
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  for(const [tag,attrs] of BATTLE_ICONS[name]||[]){const node=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);}
  return svg;
}

export function getPublicResultSurfaceModel(config, run) {
  const build=run.build ? getPublicBuildModel(run.build.preparation,run.performerId,run.choices) : null;
  const review=run.modificationReview;
  // Encore is independent of special actions and remains active for one fixed window.
  const releaseLimit=build?.modification?.id==='rain_relay'
    ?2*(1+Math.floor(Math.max(0,Number(run.durationMs)||0)/PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS))
    :(Number(run.actions)||0)*3;
  const modificationReview=build?.modification&&review?.id===build.modification.id
    &&Number.isSafeInteger(review.releases)&&review.releases>=0&&review.releases<=releaseLimit
    ?{name:build.modification.name,releases:review.releases}:null;
  const seconds=Math.max(0,Math.floor((Number(run.durationMs)||0)/1000));
  const reward=run.recorded!==false&&run.reward ? {notes:Math.max(0,Number(run.reward.notes)||0),
    equipment:PUBLIC_EQUIPMENT.filter(item=>run.reward.equipmentIds?.includes(item.id))}:null;
  return { ...config, member:getPublicPerformer(run.performerId), chapter:getPublicChapter(run.chapterId),
    ...(run.runGoal ? {goalOutcome:evaluatePublicRunGoal(run.runGoal,run)} : {}),
    performance:normalizePerformanceSample(run.performance,Math.floor(run.durationMs)),
    performanceComparison:run.recorded!==false ? run.performanceComparison : null,
    victory:run.victory===true, duration:`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`,
    actions:Math.max(0,Number(run.actions)||0), choices:(run.choices||[]).map(id=>getRunChoice(id,run.performerId)).filter(Boolean),
    recorded:run.recorded!==false, persisted:run.persisted===true,
    earnedEquipment:getEarnedEquipmentHandoff(run,loadPublicProfile()),
    tourReview:run.recorded!==false&&run.persisted===true?getPublicTourReview(loadPublicProfile(),run.performerId):null,
    build,modificationReview,choiceReview:getPublicChoiceReview(build,run.choiceReview),goalHandoff:getPublicRunGoalHandoff(run,loadPublicProfile()),
    arrangementReview:isUserCastEnabled()?getArrangementPlanReview(run.arrangementPlan,{stageId:1,performerId:run.performerId,campaignChapterId:run.chapterId},run.choices):null,
    attemptReview:isUserCastEnabled()?getPublicAttemptProgress(run):null,
    routeReview:isUserCastEnabled()?getPublicRouteReview(run.publicRoutePlan,{stageId:1,performerId:run.performerId,campaignChapterId:run.chapterId}):null,
    finaleReview:getFinaleResponseSummary(run.finaleResponses),
    encounterReview:getChapterEventReview(run.encounterEvent,run.chapterId),
    sideSetReview:getChapterSideSetReview(run.chapterSideSet,run.chapterId),
    journeyReview:isUserCastEnabled()?getPublicJourneyResult(run):null,
    reward:reward && (reward.notes>0 || reward.equipment.length>0) ? reward : null };
}

// Presentation only: existing combat clocks, choice model and result commands own effects.
export function getBattleFocusable(root) {
  return [...root.querySelectorAll('*')].filter(node=>{
    if(!['BUTTON','SUMMARY'].includes(node.tagName)||node.disabled||node.hidden)return false;
    const ownDetails=node.tagName==='SUMMARY'?node.parentNode:null;
    for(let parent=node.parentNode;parent&&parent!==root;parent=parent.parentNode){
      if(parent.hidden||parent.tagName==='DETAILS'&&!parent.open&&parent!==ownDetails)return false;
    }
    return true;
  });
}

export class BattleSurfaceView {
  constructor(scene, options, doc=globalThis.document) {
    this.scene=scene;this.options=options;this.doc=doc;this.disposed=false;this.busy=false;this.pendingChoice=null;
    this.previousFocus=doc.activeElement;
    this.inputEnabled=scene.input?.enabled;this.keyboardEnabled=scene.input?.keyboard?.enabled;
    releaseSessionInput(scene);
    if(scene.input)scene.input.enabled=false;
    if(scene.input?.keyboard)scene.input.keyboard.enabled=false;
    this.host=doc.getElementById('game-container');this.touchAction=this.host?.style.touchAction;
    if(this.host)this.host.style.touchAction='pan-y';
    this.root=this.element('section','battle-surface');
    const performer=options.model?.member?.id||options.member?.id||scene.publicPerformerRun?.member?.id;
    if(performer==='enjo'&&visualStudyEnabled())this.root.dataset.visualStudy='enjo';
    this.root.id=options.mode==='choice'?'run-choice':options.mode==='result'?'battle-result':'battle-pause';
    this.root.dataset.mode=options.mode;
    const member=options.mode==='result'?options.model?.member:options.member;
    if(member){
      this.root.dataset.performer=member.id;
      this.root.style.setProperty('--performer-color',`#${member.colorHex.toString(16).padStart(6,'0')}`);
    }
    this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    this.root.setAttribute('aria-labelledby',`${this.root.id}-heading`);
    for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','keyup'])this.root.addEventListener(type,e=>e.stopPropagation());
    this.root.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(scene._sessionExperience?.isBlocking())return;
      if(e.key==='Escape'&&this.rewardPreview){e.preventDefault();this.closeRewardPreview(true);return;}
      if(e.key==='Escape'&&options.mode==='pause'){
        e.preventDefault();
        resumePlayerAudioFromGesture(scene.sound);
        options.onResume();return;
      }
      if(e.key!=='Tab')return;
      const buttons=getBattleFocusable(this.root);
      const index=buttons.indexOf(doc.activeElement);
      if((e.shiftKey&&index<=0)||(!e.shiftKey&&(index<0||index===buttons.length-1))){e.preventDefault();(e.shiftKey?buttons.at(-1):buttons[0])?.focus();}
    });
    scene._publicBattleDialog=this;
    this.content=this.element('div','battle-surface-content');this.root.append(this.content);
    if(options.mode==='result')this.result(options.model);
    else if(options.mode==='choice')this.choice(options);
    else this.pause(options);
    this.host?.append(this.root);
    const initialFocus=options.mode==='pause'?this.root.querySelector('button'):this.content.querySelector('h2');
    if(options.mode!=='pause')initialFocus?.setAttribute('tabindex','-1');
    initialFocus?.focus({preventScroll:true});
    this.shutdown=()=>this.destroy(false);scene.events?.once?.('shutdown',this.shutdown);
  }
  element(tag,className,text){const el=this.doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  icon(name){return createBattleIcon(this.doc,name);}
  heading(kicker,title,parent=this.content){parent.append(this.element('p','battle-eyebrow',kicker));const h=this.element('h2',null,title);h.id=`${this.root.id}-heading`;parent.append(h);}
  buildSummary(build,parent=this.content,expanded=false) {
    if(!build)return;
    const section=this.element(expanded?'section':'details','battle-build-summary');parent.append(section);
    section.dataset.buildPerformer=build.performerId;
    section.append(this.element(expanded?'h3':'summary',null,'本场配置 · '+build.preparationLabel));
    const stats=this.element('dl','battle-build-values');section.append(stats);
    for(const row of build.rows){const item=this.element('div');item.append(this.element('dt',null,row.label),this.element('dd',null,row.value));stats.append(item);}
    section.append(this.element('p',null,build.roleNote),this.element('p',null,build.tactic));
  }
  performerVisual(member,parent=this.content) {
    const art=getUiPerformerArt(member.id);if(!art)return;
    const visual=this.element('div','battle-performer-visual');visual.dataset.performer=member.id;
    visual.style.setProperty('--member-color',`#${member.colorHex.toString(16).padStart(6,'0')}`);
    const compact=this.options.mode==='choice';
    const menuChoice=compact&&this.root.dataset.choiceFamily==='true',avatar=menuChoice?getMenuAvatarArt(member.id):null;
    const state=this.options.mode==='result'?(this.options.model?.victory?'victory':'defeat'):'portrait';
    const portrait=this.element('img');portrait.src=menuChoice?avatar.src:compact?art.avatar:art[state];portrait.alt='';
    portrait.width=menuChoice?avatar.width:compact?128:art.width;portrait.height=menuChoice?avatar.height:compact?128:art.height;portrait.draggable=false;portrait.decoding='async';
    const copy=this.element('div','battle-visual-copy');
    copy.append(this.element('strong',null,member.name),this.element('span',null,member.actionName));
    visual.append(portrait,copy);parent.append(visual);
  }
  choiceActivation(button){
    let gesture=null;
    const moved=e=>Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>12;
    button.addEventListener('pointerdown',e=>{
      if(gesture?.active){gesture.valid=false;return;}
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY,active:true,complete:false,
        valid:e.isPrimary!==false&&e.button===0};
    });
    button.addEventListener('pointermove',e=>{
      if(gesture?.active&&e.pointerId===gesture.id&&moved(e))gesture.valid=false;
    });
    button.addEventListener('pointerup',e=>{
      if(!gesture?.active)return;
      gesture.valid=gesture.valid&&e.pointerId===gesture.id&&!moved(e);
      gesture.active=false;gesture.complete=true;
    });
    for(const type of ['pointercancel','pointerleave'])button.addEventListener(type,()=>{
      if(gesture?.active){gesture.valid=false;gesture.active=false;}
    });
    return e=>{
      // Keyboard/assistive activation has no pointing-device gesture to validate.
      const allowed=!(e.detail>0)||(gesture?.complete&&gesture.valid
        &&(!Number.isInteger(e.pointerId)||e.pointerId===gesture.id));
      gesture=null;return allowed;
    };
  }
  command(parent,label,callback,{primary=false,icon=null,data=null,terminal=true}={}){
    const b=this.element('button',primary?'battle-primary':'battle-secondary');b.type='button';
    if(icon)b.append(this.icon(icon));b.append(this.element('span',null,label));
    if(data)Object.assign(b.dataset,data);
    const canActivate=['choice','result'].includes(this.options.mode)?this.choiceActivation(b):()=>true;
    b.addEventListener('click',e=>{
      if(this.disposed||this.busy||b.disabled||!this.root.isConnected||this.scene._sessionExperience?.isBlocking())return;
      if(!canActivate(e))return;
      resumePlayerAudioFromGesture(this.scene.sound);
      if(terminal)this.busy=true;
      const accepted=callback();if(accepted===false)this.busy=false;
    });parent.append(b);return b;
  }
  choice(o){
    const family=isUserCastEnabled()&&['sakura','kai','enjo'].includes(o.member.id);
    this.root.dataset.choiceFamily=String(family);
    this.root.dataset.choiceNumber=String(o.number);
    this.root.dataset.choiceReading='true';
    this.root.dataset.buildContext=String(!!this.scene.publicPerformerRun?.getBuildSnapshot?.());
    if(family){
      this.root.dataset.choiceStudio='303';
      // Loading and external image errors are visible; the game never silently substitutes finished artwork.
      this.root.dataset.choiceTicket='pending';
      const ticket=this.element('img'),settle=state=>()=>{if(!this.disposed)this.root.dataset.choiceTicket=state;};
      ticket.addEventListener('load',settle('ready'),{once:true});
      ticket.addEventListener('error',()=>{if(this.disposed)return;this.root.dataset.choiceTicket='unavailable';const error=this.element('p','battle-choice-art-error','编排底图加载失败');error.setAttribute('role','status');this.content.prepend(error);},{once:true});
      ticket.src='art/choice-stage-b303/row.webp';
    }
    const chapter=getPublicChapter(this.scene.battleData?.campaignChapterId);
    const context=this.element('p','battle-choice-context',chapter.name);
    if(!family)this.root.append(context);
    const header=this.element('header','battle-choice-header');this.content.append(header);
    if(family){const venue=this.element('img','battle-choice-venue');venue.src=CHAPTER_VENUE_ART[chapter.id];venue.width=768;venue.height=512;venue.alt='';venue.draggable=false;header.append(venue,context);}
    this.heading(`本场编排 ${o.number} / 2`,'公演编排',header);
    if(family){
      // The native h2 keeps the name; generated lettering only replaces its look once it has loaded.
      const title=header.querySelector('h2'),text=this.element('span','battle-choice-title-text','公演编排'),lettering=this.element('img','battle-choice-lettering');
      lettering.alt='';lettering.setAttribute('aria-hidden','true');lettering.draggable=false;lettering.decoding='async';
      lettering.addEventListener('load',()=>{title.dataset.lettering='ready';},{once:true});
      lettering.addEventListener('error',()=>{if(this.disposed)return;lettering.remove();const error=this.element('p','battle-choice-art-error','编排标题加载失败');error.setAttribute('role','status');header.append(error);},{once:true});
      lettering.src='art/choice-studio-20261104/heading.webp';
      title.replaceChildren(text,lettering);
    }
    this.performerVisual(o.member,header);
    const prior=(o.choices||[]).map(id=>getRunChoice(id,o.member.id)?.label).filter(Boolean);
    if(!family&&this.root.dataset.buildContext==='true'&&prior.length){
      const context=this.content.querySelector('.battle-visual-copy span');
      if(context)context.textContent=`已选：${prior.join(' / ')}`;
    }
    if(!family)this.content.append(this.element('p','battle-lead',prior.length?`已选：${prior.join(' / ')}`:'本场尚无编排'));
    else if(prior.length)this.content.append(this.element('p','battle-choice-history',`已选：${prior.join(' / ')}`));
    const planned=o.options.some(row=>row.id===o.plannedChoice)?o.plannedChoice:null;
    const rows=this.element('div','battle-choice-list');this.content.append(rows);
    rows.setAttribute('role','group');rows.setAttribute('aria-label',`本场编排 ${o.number}：${OPTION_COUNT[o.options.length]}选一`);
    // Owner family: a row only previews and the footer confirm owns the terminal command. Local to this dialog.
    const choiceRows=new Map(),detail=family?this.element('section','battle-choice-detail'):null;
    let confirm=null;
    const previewChoice=id=>{
      if(this.pendingChoice===id)return;
      this.pendingChoice=id;
      for(const [rowId,row]of choiceRows){
        const selected=rowId===id;
        row.button.setAttribute('aria-pressed',String(selected));row.mark.style.visibility=selected?'visible':'hidden';
      }
      const row=choiceRows.get(id);
      detail.replaceChildren(this.element('strong',null,'选后变化'),this.element('span',null,row.delta),...(row.detail?[this.element('small',null,row.detail)]:[]));
      detail.id='choice-current-preview';
      for(const option of choiceRows.values())option.button.removeAttribute('aria-describedby');
      row.button.setAttribute('aria-describedby',detail.id);
      rows.insertBefore(detail,row.button.nextElementSibling||null);
      confirm.disabled=false;
    };
    for(const option of o.options){
      const consequence=getPublicBuildOption(this.scene.publicPerformerRun?.getBuildSnapshot?.(),option.id);
      const label=consequence?consequence.label:option.label;
      const roleArt=family&&option.id==='echo'?ROLE_ECHO_ART[o.member.id]:null;
      const button=this.command(rows,label,family?()=>previewChoice(option.id):()=>{
        button.dataset.chosen='true';
        const accepted=o.onChoice(option.id);if(accepted===false)delete button.dataset.chosen;
        return accepted;
      },{terminal:!family,data:{choice:option.id}});
      button.className='battle-choice-row';
      if(option.id===planned)button.dataset.plannedChoice='true';
      const symbol=this.element('span','battle-choice-symbol');
      symbol.setAttribute('aria-hidden','true');
      if(family){
        const art=roleArt||CHOICE_ART[option.id],image=this.element('img','battle-choice-art');symbol.dataset.art=roleArt?`echo-${o.member.id}`:option.id;
        image.addEventListener('error',()=>{if(this.disposed)return;symbol.dataset.artState='unavailable';symbol.removeAttribute('aria-hidden');const error=this.element('span','battle-choice-icon-error','图标加载失败');error.setAttribute('role','status');symbol.replaceChildren(error);},{once:true});
        image.src=art.src;image.alt='';image.width=art.size;image.height=art.size;image.draggable=false;image.decoding='async';symbol.append(image);
      }else{
        symbol.dataset.icon=CHOICE_ICONS[option.id]||'clapperboard';
        if(CHOICE_ICONS[option.id]){
          const image=this.element('img','battle-choice-art');image.src=PUBLIC_MENU_ART[option.id];
          image.alt='';image.width=64;image.height=64;image.draggable=false;symbol.append(image);
        }else symbol.append(this.icon(symbol.dataset.icon));
      }
      const copy=this.element('span','battle-choice-copy');
      if(family){const theme=roleArt||CHOICE_THEMES[option.id];button.style.setProperty('--choice-ink',theme.ink);copy.append(this.element('small','battle-choice-category',theme.category));}
      copy.append(this.element('strong',null,label),this.element('span',consequence?'battle-choice-delta':null,consequence?.delta||option.description));
      button.setAttribute('aria-label',consequence?`${label}。${consequence.delta}。${consequence.detail}`:`${label}。${option.description}`);
      if(consequence)copy.append(this.element('small','battle-choice-limit',consequence.detail));
      if(option.id===planned){copy.querySelector('strong').append(this.element('span','battle-choice-plan-tag',' · 预选'));button.setAttribute('aria-label',button.getAttribute('aria-label')+'。本场方案预选');}
      // An arrow would promise navigation; the family mark is a non-colour selected cue that keeps its layout slot.
      const mark=this.icon(family?'check':'arrow-right');
      if(family){
        mark.style.visibility='hidden';button.setAttribute('aria-pressed','false');
        choiceRows.set(option.id,{button,mark,label,delta:consequence?.delta||option.description,detail:consequence?.detail||null});
      }
      button.replaceChildren(symbol,copy,mark);
    }
    if(family){detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');this.content.append(detail);}
    const footer=this.element('footer','battle-surface-footer');this.root.append(footer);
    const leave=this.command(footer,'结束本次公演',()=>o.onLeave(),{data:{action:'leave-choice'}});
    if(family){
      leave.classList.add('battle-choice-exit');leave.setAttribute('title','结束本次公演');leave.setAttribute('aria-label','结束本次公演');
      // log-out is only named in the Lucide licence text; BATTLE_ICONS has no nodes for it and would draw nothing.
      leave.replaceChildren(this.icon('arrow-left'));
      confirm=this.command(footer,'确认编排',()=>{
        const id=this.pendingChoice,selected=choiceRows.get(id)?.button;
        if(!selected)return false;
        selected.dataset.chosen='true';
        const accepted=o.onChoice(id);if(accepted===false)delete selected.dataset.chosen;
        return accepted;
      },{primary:true,data:{action:'confirm-choice'}});
      confirm.disabled=true;
    }
  }
  result(m){
    this.root.dataset.outcome=m.victory?'victory':'defeat';
    const combatFlow=this.scene._userCastPresentation===true&&['sakura','kai','enjo'].includes(m.member.id)
      &&this.scene.battleData?.defenseMode!==true&&this.scene.battleData?.practiceMode!==true
      &&this.scene._isFinaleTrialRound?.()!==true;
    if(combatFlow){
      this.root.dataset.combatFlow='true';
      const runId=this.scene.publicPerformerRun?.runId;
      if(typeof runId==='string'&&runId&&this.scene._resultMotionRunId!==runId){
        this.root.dataset.motion='enter';this.scene._resultMotionRunId=runId;
      }
    }
    const stage=combatFlow;
    const header=this.element('header','battle-performance-header');this.content.append(header);
    if(stage){
      this.root.dataset.resultStage='chapter';
      const art=RESULT_PORTRAITS[m.member.id],gate=(img,source,state,label,onFail)=>{
        const failed=()=>{
          if(this.disposed)return;
          img.remove();header.dataset[state]='unavailable';
          const message=this.element('p','result-art-error',label+'加载失败');message.setAttribute('role','status');header.append(message);
          onFail?.();
        };
        header.dataset[state]='loading';
        img.addEventListener('load',()=>{
          if(this.disposed)return;
          if(img.naturalWidth!==source.width||img.naturalHeight!==source.height){failed();return;}
          img.hidden=false;header.dataset[state]='ready';
        },{once:true});
        img.addEventListener('error',failed,{once:true});
      };
      const text=this.element('div','result-hero-text');
      // The h2 names the chapter; the outcome is the title art, or real text when no art can carry it.
      const outcome=m.victory?'公演完成':'本场未完成',showOutcome=()=>text.replaceChildren(this.element('p','battle-eyebrow',outcome),...text.children);
      const venue=this.element('img','result-hero-venue');venue.alt='';venue.hidden=true;venue.setAttribute('aria-hidden','true');
      venue.width=768;venue.height=512;venue.draggable=false;venue.decoding='async';gate(venue,{width:768,height:512},'venueState','场景素材');
      venue.src=CHAPTER_VENUE_ART[m.chapter.id];header.append(venue);
      const portrait=this.element('img','result-hero-portrait');portrait.alt='';portrait.hidden=true;
      portrait.width=art.width;portrait.height=art.height;portrait.draggable=false;portrait.decoding='async';
      portrait.style.setProperty('--portrait-head',String(art.head));portrait.style.setProperty('--portrait-face-x',String(art.faceX));portrait.style.setProperty('--portrait-face-y',String(art.faceY));
      gate(portrait,art,'portraitState','角色展示');portrait.src=art.src;header.append(portrait);
      if(m.victory){
        const title=this.element('img','result-hero-title-art');title.alt='';title.setAttribute('aria-hidden','true');title.hidden=true;
        title.width=RESULT_TITLE_ART.width;title.height=RESULT_TITLE_ART.height;title.draggable=false;
        gate(title,RESULT_TITLE_ART,'titleState','标题素材',showOutcome);title.src=RESULT_TITLE_ART.src;header.append(title);
      }
      header.append(text);
      const chapterHeading=this.element('h2',null,m.chapter.name);chapterHeading.id=`${this.root.id}-heading`;
      chapterHeading.setAttribute('aria-label',`${m.chapter.name}：${outcome}`);
      const copy=this.element('div','battle-visual-copy');copy.append(this.element('strong',null,m.member.name));
      text.append(chapterHeading,copy);
      if(!m.victory)showOutcome();
    }else{
      this.heading(`ST☆RUSH · ${m.victory?'演出记录':'本场记录'}`,m.victory?'本场通关':'本场未完成',header);
      header.append(this.element('p','battle-result-chapter',m.chapter.name));
      this.performerVisual(m.member,header);
    }
    // The chapter hero already names the member; its hidden Q avatar would still be fetched.
    const identity=stage?null:this.element('div','battle-result-member');
    if(identity){
      const mark=this.element('b','battle-member-mark',m.member.identityMark);mark.style.color=`#${m.member.colorHex.toString(16).padStart(6,'0')}`;
      const memberArt=getUiPerformerArt(m.member.id);
      if(memberArt){
        mark.textContent='';mark.className+=' has-portrait';
        const portrait=this.element('img');portrait.src=memberArt.avatar;portrait.alt='';
        portrait.width=128;portrait.height=128;portrait.draggable=false;mark.append(portrait);
      }
      identity.append(mark,this.element('div',null,`${m.member.name} · ${m.member.actionName}`));identity.hidden=true;this.content.append(identity);
    }
    const stats=this.element('dl','battle-result-stats');
    for(const [label,value]of [['公演用时',m.duration],['主动演出',`${m.actions} 次`],['本场编排',`${m.choices.length} / 2`],
      ...(m.performance ? [['受击',`${m.performance.hitCount} 次`]] : [])]){const item=this.element('div');item.append(this.element('dt',null,label),this.element('dd',null,value));stats.append(item);}this.content.append(stats);
    if(m.performanceComparison && m.victory) {
      const record=this.element('section','battle-performance-record');
      record.append(this.element('h3',null,`${m.member.name} · 本站个人纪录`));
      const c=m.performanceComparison, lines=[c.firstRecord?'建立个人成绩':null,
        c.newBestTime?'刷新个人用时':null,c.newFewestHits?'刷新最少受击':null,
        c.noHit?'无伤通关':null].filter(Boolean);
      record.append(this.element('p',null,lines.join(' · ')||'个人纪录保持 · 可再演挑战'));
      this.content.append(record);
    }
    const causes={
      health:['生命耗尽','横移避开预警，再绕到设施旁出手。'],
      'route-timeout':['场地计时结束','沿箭头先恢复本区设施，再完成串场。'],
      'finale-timeout':['压轴计时结束','避开声浪，在破绽出现时集中攻击。'],
    };
    const cause=stage&&!m.victory&&causes[m.defeatCause];
    const failure=cause?this.element('section','result-failure-cause'):null;
    if(failure){
      failure.append(this.element('h3',null,cause[0]),this.element('p',null,cause[1]));
      this.content.insertBefore(failure,this.content.children[1]||null);
    }
    const attempt=this.attemptProgress(m.attemptReview);
    if(combatFlow&&!m.victory&&attempt)attempt.classList.add('battle-result-attempt');
    this.routeReview(m.routeReview);
    this.buildSummary(m.build,this.content,combatFlow);
    if(m.arrangementReview){
      const review=this.element('section','battle-tour-review');review.dataset.arrangementReview='true';
      review.append(this.element('h3',null,'本场方案执行'),this.element('p',null,'按方案选择 '+m.arrangementReview.matched+'/2 · 实际已选 '+m.arrangementReview.selected+'/2'));
      for(const row of m.arrangementReview.rows){const line=this.element('p',null,(row.number===1?'第一段':'第二段')+' · 预选 '+row.planned+' · 实际 '+row.actual+' · '+{matched:'按方案',changed:'临场调整',pending:'未选择'}[row.state]);line.dataset.planState=row.state;line.dataset.planNumber=String(row.number);review.append(line);}
      this.content.append(review);
    }
    if(m.choiceReview?.length){
      const review=this.element('section','battle-tour-review');review.dataset.choiceReview='true';
      review.append(this.element('h3',null,'编排实际效果'));
      for(const row of m.choiceReview){const line=this.element('p',null,row.label+' · '+row.text);line.dataset.choiceEffect=row.id;review.append(line);}
      this.content.append(review);
    }
    if(m.modificationReview){const review=this.element('p','battle-build-next',
      m.modificationReview.name+(m.build.modification.id==='rain_relay'
        ?' · 本场补色 '+m.modificationReview.releases+' 处'
        :' · 本场效果释放 '+m.modificationReview.releases+' 次'+(m.build.modification.id==='travelling_nozzle'?'（扫射按拍计）':'')));
      review.dataset.modificationReview='true';this.content.append(review);}
    if(m.journeyReview){
      const review=this.element('section','battle-tour-review');review.dataset.journeyResult=m.chapter.id;
      review.append(this.element('h3',null,m.journeyReview.title),this.element('p',null,m.journeyReview.text),this.element('p',null,m.journeyReview.next));this.content.append(review);
    }
    if(m.encounterReview){const event=this.element('section','battle-tour-review');event.dataset.encounterEvent=m.encounterReview.id;
      event.append(this.element('h3',null,m.encounterReview.label),this.element('p',null,m.encounterReview.text));this.content.append(event);}
    if(m.sideSetReview){const review=this.element('section','battle-tour-review');review.dataset.sideSetReview='true';
      review.append(this.element('h3',null,m.sideSetReview.label),this.element('p',null,m.sideSetReview.text));this.content.append(review);}
    if(m.build)this.content.append(this.element('p','battle-build-next','再演时重新选择编排；训练和配件使用最新已保存配置。'));
    const build=this.element('section','battle-result-build');build.append(this.element('h3',null,'本场编排'));
    if(m.goalOutcome){const goal=this.element('section','battle-run-goal');goal.dataset.status=m.goalOutcome.status;
      goal.append(this.element('h3',null,m.goalOutcome.label),this.element('strong',null,{met:'目标达成',missed:'目标未达成',unmeasured:'尚无有效判定'}[m.goalOutcome.status]),
        this.element('p',null,m.goalOutcome.actualLabel));this.content.append(goal);}
    if(m.goalHandoff)this.command(this.content,'调整本站目标并准备',()=>this.options.onAction('goals'),{
      icon:'route',data:{resultAction:'goals'}});
    if(m.reward) {
      const reward=this.element('section','battle-result-reward');reward.append(this.element('h3',null,'本场收获'));
      // Chapter stage: amounts and names stay visible; descriptions and commands sit behind the disclosure.
      let rewardBody=reward;
      if(stage){
        const summary=this.element('div','battle-result-reward-summary');
        if(m.reward.notes>0){
          const notes=this.element('span','result-reward-item'),icon=this.element('img','result-reward-icon');
          icon.src=PUBLIC_MENU_ART.notes;icon.alt='';icon.width=40;icon.height=40;
          notes.append(icon,this.element('strong',null,`练习笔记 +${m.reward.notes}`));summary.append(notes);
        }
        this.rewardTriggers=new Map();
        for(const item of m.reward.equipment){
          const handoffReady=m.earnedEquipment!=null;
          const label=item.name;
          const earned=handoffReady
            ? this.command(summary,label,()=>this.options.onAction('earned-equipment',item.id),{terminal:false,data:{resultAction:'earned-equipment',rewardId:item.id}})
            : this.element('span',null,label);
          earned.className='result-reward-item result-gear';
          if(handoffReady){
            earned.setAttribute('aria-label','查看'+item.name);
            earned.setAttribute('aria-expanded','false');
            this.rewardTriggers.set(item.id,earned);
          }else summary.append(earned);
          const icon=this.element('img','result-reward-icon');
          icon.src=getEquipmentIconArt(item.id).src;icon.alt='';icon.width=40;icon.height=40;
          earned.replaceChildren(icon,this.element('span',null,label));
        }
        rewardBody=this.element('details','battle-result-reward-details');rewardBody.append(this.element('summary',null,'收获详情'));
        reward.append(summary,rewardBody);
      }else reward.append(this.element('strong',null,`练习笔记 +${m.reward.notes}`));
      for(const item of m.reward.equipment){
        const earned=this.element('p','battle-earned-equipment');earned.dataset.equipment=item.id;
        earned.append(this.element('strong',null,`配件解锁 · ${item.name}`),this.element('span',null,item.description));
        rewardBody.append(earned);
      }
      this.command(rewardBody,'整理收获',()=>this.requestResultAction('preparation'),{icon:'settings-2',data:{resultAction:'preparation'}});
      if(!stage&&m.earnedEquipment&&m.reward.equipment.length)this.command(reward,'查看新配件',()=>this.options.onAction('earned-equipment'),{
        icon:'backpack',data:{resultAction:'earned-equipment'}});
      if(stage)reward.dataset.ownerUiBand='ledger';
      this.content.append(reward);
    }
    // Inline state only; the footer campaign-next command names the chapter and owns save and transition.
    const continuation=stage&&m.victory?m.continuation:null;
    if(continuation){
      const state=!continuation.persisted?'pending':continuation.available?'ready':'blocked';
      const next=this.element('p','battle-result-continuation-state',CONTINUATION_TEXT[state]);
      next.hidden=state==='ready';
      next.id=`${this.root.id}-continuation-state`;next.dataset.chapter=continuation.chapterId;next.dataset.continuationState=state;
      this.content.append(next);this.resultContinuation=next;
    }
    if(!m.choices.length)build.append(this.element('p','battle-muted','未完成编排'));
    for(const choice of m.choices)build.append(this.element('p',null,choice.label));this.content.append(build);
    let storySection=null;
    if(m.victory){
      const beat=getChapterStory(m.chapter.id,'outro',m.member.id);
      const ending=this.element('section','battle-story-ending');ending.id='battle-result-story';ending.hidden=true;
      ending.append(this.element('h3',null,beat.title));
      for(const line of beat.lines)ending.append(this.element('p',line.speaker==='旁白'?'story-narration':'story-dialogue',line.speaker==='旁白'?line.text:`${line.speaker}：${line.text}`));
      // The chapter stage gives the real outro its own section instead of the generic review.
      const storyParent=stage?this.element('section','battle-result-story-section'):this.content;
      if(stage){storySection=storyParent;storyParent.append(this.element('p','battle-result-story-kicker','本站尾声 · '+beat.title));this.content.append(storyParent);}
      const toggle=this.command(storyParent,'查看本场故事',()=>{
        ending.hidden=!ending.hidden;toggle.setAttribute('aria-expanded',String(!ending.hidden));
      },{icon:'clapperboard',terminal:false,data:{action:'result-story'}});
      toggle.setAttribute('aria-controls',ending.id);toggle.setAttribute('aria-expanded','false');
      storyParent.append(ending);
    }
    if(m.climaxLine)this.content.append(this.element('p','battle-highlight',m.climaxLine));
    if(m.finaleReview){
      const review=m.finaleReview;
      this.content.append(this.element('p','battle-result-next',`压轴弹路 ${review.resolved} / 3 · 记录到接触 ${review.contacts} 段 · 未接触 ${review.uncontacted} 段`),
        this.element('p','battle-muted',review.beats.map(b=>`${b.index+1}. ${b.label}：${b.description}`).join('；')));
    }
    if(m.victory&&m.tourReview){
      const review=m.tourReview,section=this.element('section','battle-tour-review');
      section.append(this.element('h3',null,review.completed?'本轮巡演已通关':`巡演通关 ${review.clearedCount} / ${PUBLIC_CHAPTERS.length}`),
        this.element('p',null,`${m.member.name} · 当前规则实测纪录 ${review.member.recordCount} / ${PUBLIC_CHAPTERS.length}`),
        this.element('p',null,review.recommendation),this.element('p',null,review.reason));
      this.content.append(section);
    }
    for(const line of m.descriptionLines||[])this.content.append(this.element('p','battle-result-next',line));
    const save=this.element('p',m.persisted?'battle-save':'battle-save is-warning',m.persisted?'记录已保存在本机':m.recorded?'本次记录未能保存在本机，关闭页面可能丢失。':'本场结果未能记入进度。');
    save.dataset.saveState=m.persisted?'saved':m.recorded?'pending':'unrecorded';
    save.setAttribute('role','status');save.setAttribute('aria-live','polite');this.content.append(save);this.resultStatus=save;
    if(!m.persisted&&m.recorded)this.command(this.content,'重试保存本场结果',()=>this.options.onAction('retry-save-result'),{
      icon:'check',terminal:false,data:{resultAction:'retry-save-result'}});
    if(combatFlow){
      const detail=this.element('details','battle-result-details');
      detail.append(this.element('summary',null,'演出明细'));
      const retrySave=this.content.querySelector('[data-result-action=retry-save-result]');
      const reward=this.content.querySelector('.battle-result-reward');
      const summaryNodes=new Set([header,identity,stats,save,retrySave,reward,failure,this.resultContinuation,storySection,...(!m.victory&&attempt?[attempt]:[])]);
      for(const node of [...this.content.children]){
        // Keep each review control with its content, including the hidden story it toggles.
        if(summaryNodes.has(node))continue;
        detail.append(node);
      }
      const children=[...this.content.children];
      const saveAnchor=m.persisted?stats:header;
      this.content.replaceChildren(...children.flatMap(node=>node===saveAnchor?[node,save,...(retrySave?[retrySave]:[])]:node===save||node===retrySave?[]:[node]));
      if(detail.children.length>1)this.content.append(detail);
    }
    const footer=this.element('footer','battle-surface-footer');this.root.append(footer);
    m.buttons.forEach((b,index)=>{
      const namedNext=continuation&&b.action==='campaign-next';
      const button=this.command(footer,namedNext?`下一站 · ${continuation.name}`:b.label,()=>this.requestResultAction(b.action),{primary:index===0,icon:b.action==='campaign-next'?'arrow-right':b.action==='campaign-tour'?'route':'play',
        data:{resultAction:b.action,...(stage?{resultSkin:index===0?'primary':'secondary'}:{})}});
      if(stage&&b.action==='campaign-next'&&m.continuation)button.disabled=!m.continuation.available;
      if(namedNext)button.setAttribute('aria-describedby',this.resultContinuation.id);
    });
  }
  inspectEarnedItem({memberId,equipmentId}){
    const trigger=this.rewardTriggers?.get(equipmentId);
    const item=PUBLIC_EQUIPMENT.find(row=>row.id===equipmentId);
    if(!trigger||!item)return false;
    this.closeRewardPreview();
    const panel=this.element('section','reward-fitting');
    this.rewardPreview={trigger,panel};
    panel.id='result-reward-fitting';
    trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',panel.id);
    const title=this.element('h3',null,item.name);title.setAttribute('tabindex','-1');
    const status=this.element('p','reward-equipped-status');status.setAttribute('role','status');
    const art=this.element('img','reward-fitting-art');art.alt='';art.src=getEquipmentIconArt(item.id).src;
    panel.append(art,title,this.element('p','reward-effect',item.description),status);
    const update=profile=>{
      const current=getPreparationSnapshot(profile,memberId)?.equipmentId;
      equip.disabled=current===item.id;
      equip.querySelector('span').textContent=equip.disabled?'已装备':'装备给'+this.options.model.member.name;
      const worn=PUBLIC_EQUIPMENT.find(row=>row.id===current);
      status.textContent=profile.preparationStatus==='storage-error'||!profile.persisted
        ? '保存未完成，请重试。' : worn?'当前装备 · '+worn.name:'当前配件位为空';
    };
    const equip=this.command(panel,'装备给'+this.options.model.member.name,()=>{
      const profile=loadPublicProfile();
      if(!getEarnedEquipmentHandoff(this.scene._publicRunResult,profile,equipmentId)){
        status.textContent='本机记录已变化，请重新查看背包。';equip.disabled=true;return;
      }
      update(equipPublicPerformer(memberId,equipmentId));
    },{primary:true,terminal:false,data:{action:'equip-reward'}});
    this.command(panel,'收起',()=>this.closeRewardPreview(true),{terminal:false,data:{action:'close-reward'}});
    const summary=trigger.parentNode;summary.parentNode.insertBefore(panel,summary.nextElementSibling||null);
    update(loadPublicProfile());
    title.focus({preventScroll:true});panel.scrollIntoView?.({block:'nearest'});return true;
  }
  closeRewardPreview(focus=false){
    if(!this.rewardPreview)return;
    const {trigger,panel}=this.rewardPreview;panel.remove();
    trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');
    this.rewardPreview=null;if(focus)trigger.focus();
  }
  requestResultAction(action){
    const m=this.options.model;
    if(this.root.dataset.resultStage!=='chapter'||!m.recorded||m.persisted||!['retry','campaign-tour','preparation'].includes(action))return this.options.onAction(action);
    this.resultLeaveConfirmation?.remove();
    const panel=this.element('section','battle-result-leave-confirm');panel.setAttribute('role','alert');
    panel.append(this.element('p',null,'本场尚未保存。离开后，本场记录和收获可能无法恢复。'));
    const keep=this.command(panel,'保留本页',()=>{
      panel.remove();this.resultLeaveConfirmation=null;this.root.querySelector(`[data-result-action=${action}]`).focus();
    },{primary:true,terminal:false,data:{action:'result-keep'}});
    this.command(panel,'仍然离开',()=>this.options.onAction(action),{data:{action:'result-discard'}});
    this.resultLeaveConfirmation=panel;this.content.insertBefore(panel,this.content.children[0]);
    panel.scrollIntoView?.({block:'start'});keep.focus();return false;
  }
  pause(o){
    const family=isUserCastEnabled()&&this.scene._userCastPresentation===true&&this.scene._isPublicStage1Round?.()===true
      &&this.scene.battleData?.practiceMode!==true&&this.scene.battleData?.defenseMode!==true&&this.scene._isFinaleTrialRound?.()!==true;
    this.root.dataset.pauseFamily=String(family);
    if(family){
      const header=this.element('header','battle-pause-header');this.content.append(header);this.heading('演出控制','公演暂停',header);
      const heading=header.querySelector('h2'),text=this.element('span','battle-pause-title-text','公演暂停'),image=this.element('img','battle-pause-lettering');
      image.dataset.ready='false';image.addEventListener('load',()=>{image.dataset.ready='true';},{once:true});
      image.src='art/battle-reading-20261024/pause-title.png';image.alt='';image.width=2054;image.height=617;image.draggable=false;
      image.addEventListener('error',()=>image.remove(),{once:true});heading.replaceChildren(text,image);
      const member=getPublicPerformer(this.scene.publicPerformerRun?.member?.id||this.scene.battleData?.performerId);
      header.append(this.element('p','battle-pause-context',getPublicChapter(this.scene.battleData?.campaignChapterId).name+' · '+member.name));
    }else this.heading('ST☆RUSH','公演暂停');
    const progressNow=this.scene.publicPerformerRun?.getAttemptProgress?.();
    const flow=family?getPublicBattleFlow(this.scene):null;
    const destination=flow?resolvePublicObjectiveGuidanceTarget(this.scene):null;
    const left=flow?.facilities?Math.max(0,flow.facilities.total-flow.facilities.completed):null;
    const remaining=left>0?'还需接通 '+left+' 处设施':null;
    const current=[destination?.label,remaining||flow?.headline].filter(Boolean).join(' · ');
    const cue=current||progressNow?.next||(family?getChapterBriefing(this.scene.battleData.campaignChapterId).goal:null);
    this.content.append(this.element('p','battle-lead',cue||'本次演出保留在原处。'));
    this.command(this.content,'继续公演',o.onResume,{primary:true,icon:'play',data:{pauseAction:'resume'}});
    const context=this.element('div','battle-pause-scroll');this.content.append(context);
    this.command(context,'声音与演出设置',o.onSettings,{icon:'settings-2',terminal:false,data:{pauseAction:'settings'}});
    this.command(context,'重新开始',o.onRetry,{icon:'repeat-2',data:{pauseAction:'retry'}});
    this.command(context,'返回制作台',o.onLeave,{icon:'arrow-left',data:{pauseAction:'title'}});
    this.attemptProgress(progressNow,context);
    if(isUserCastEnabled())this.routeReview(getPublicRouteReview(this.scene.battleData?.publicRoutePlan,this.scene.battleData),context);
    this.buildSummary(this.scene.publicPerformerRun?.getBuildSnapshot?.(),context);
    const progress=this.scene.publicPerformerRun?.getGoalProgress?.();
    if(progress){
      const goal=this.element('section','battle-run-goal');goal.dataset.liveGoal=progress.status;
      goal.append(this.element('h3',null,progress.label),this.element('p',null,progress.detail));context.append(goal);
    }
  }
  routeReview(review,parent=this.content){
    if(!review)return;
    const section=this.element('section','battle-tour-review');section.dataset.routeReview=review.id;
    section.append(this.element('h3',null,review.title),this.element('p',null,review.text),this.element('p',null,review.finale));
    parent.append(section);
  }
  attemptProgress(review,parent=this.content){
    if(!review)return;
    const section=this.element('section','battle-tour-review');section.dataset.attemptProgress=review.phase;
    section.append(this.element('h3',null,'本场推进'));
    const retry=this.options.mode==='result'&&this.options.model?.victory===false;
    section.append(this.element('p','attempt-next',retry?'再演提示 · '+review.next:review.next));
    for(const line of review.rows)section.append(this.element('p',null,line));
    parent.append(section);return section;
  }
  rejectResultSave(){
    if(this.disposed||this.options.mode!=='result')return;
    this.resultStatus.textContent='本场仍未保存；请保留本页并恢复存储后重试。若存档已在别处重置，不会自动补回旧结果。';
    this.resultStatus.className='battle-save is-warning';this.resultStatus.dataset.saveState='pending';
    this.resultStatus.scrollIntoView?.({block:'center'});
  }
  rejectGoalHandoff(){
    if(this.disposed||this.options.mode!=='result')return;
    this.resultStatus.textContent='成员、记录或存储状态已变化，未进入目标准备。请恢复保存后重试，或返回巡演确认。';
    this.resultStatus.className='battle-save is-warning';this.resultStatus.dataset.saveState='blocked';
    this.root.querySelector('[data-result-action=goals]')?.focus();
    this.resultStatus.scrollIntoView?.({block:'center'});
  }
  rejectNextChapter({retryable=false}={}){
    if(this.disposed||this.options.mode!=='result')return;
    this.resultStatus.textContent=retryable?'下一站场地尚未保存，仍停留在本场结果。请恢复存储后再点下一站，或返回巡演处理保存。'
      :'本机存档已发生变化或本场尚未保存，下一站暂不可进入。可以处理保存、再演本场，或返回巡演确认。';
    this.resultStatus.className='battle-save is-warning';
    this.resultStatus.dataset.saveState='blocked';
    if(this.resultContinuation){this.resultContinuation.hidden=false;this.resultContinuation.dataset.continuationState='blocked';this.resultContinuation.textContent=retryable?'暂未进入下一站，请重试或返回巡演确认。':CONTINUATION_TEXT.blocked;}
    const next=this.root.querySelector('[data-result-action=campaign-next]');if(next)next.disabled=!retryable;
    (retryable?next:this.root.querySelector('[data-result-action=retry]'))?.focus();
    this.resultStatus.scrollIntoView?.({block:'center'});
  }
  destroy(restoreControls=true){
    if(this.disposed)return;this.disposed=true;this.pendingChoice=null;
    this.root.remove();this.scene.events?.off?.('shutdown',this.shutdown);
    // Phaser may already have destroyed its display list during shutdown.
    if(restoreControls){
      releaseSessionInput(this.scene);
    }
    // Plugin flags survive Scene shutdown and must be returned for a later restart.
    if(this.scene.input)this.scene.input.enabled=this.inputEnabled;
    if(this.scene.input?.keyboard)this.scene.input.keyboard.enabled=this.keyboardEnabled;
    if(this.host)this.host.style.touchAction=this.touchAction;
    if(this.scene._publicBattleDialog===this)this.scene._publicBattleDialog=null;
    if(restoreControls&&this.previousFocus?.isConnected)this.previousFocus.focus?.({preventScroll:true});
  }
}

export function syncPublicBattleHud(scene,doc=globalThis.document){
  if(scene._isPublicStage1Round?.()!==true)return;
  const set=(id,text)=>{const el=doc.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;};
  const course=scene._isFinaleTrialRound?.()?evaluateRehearsal(scene.battleData?.publicFinaleTrial?.rehearsal,{hitCount:scene.battleRecord?.playerHitCount||0,actions:scene.publicPerformerRun?.actions||0}):null;
  const progress=course?{compact:`排练课题 · ${course.label} · ${course.progress}`,status:course.state==='missed'?'missed':'active',label:course.label,detail:course.progress}:scene.publicPerformerRun?.getGoalProgress?.(),goal=doc.getElementById('run-goal'),hud=doc.getElementById('hud');
  const stageHud=scene._userCastPresentation===true&&hud?.dataset.layout==='stage-v2';
  if(hud?.dataset)hud.dataset.runGoal=String(!!progress);
  if(goal){
    goal.hidden=!progress;set('run-goal',progress?.compact||'');
    if(goal.dataset)goal.dataset.status=progress?.status||'none';
    if(progress)goal.setAttribute('aria-label',progress.label+'。'+progress.detail);
    else goal.removeAttribute?.('aria-label');
  }
  const percent=n=>Math.floor(Math.max(0,Math.min(100,Number(n)||0)));
  const member=scene.publicPerformerRun?.member||getPublicPerformer(scene.battleData?.performerId);
  const name=doc.querySelector?.('.mihoyo-name');if(name)name.textContent=member.name;
  if(scene._userCastPresentation){
    set('special-label',{sakura:'扫射',kai:'突进',enjo:'绽放'}[member.id]||member.actionName);
    const portrait=doc.querySelector?.('.mihoyo-portrait');
    if(portrait&&!stageHud){portrait.textContent='';portrait.style.backgroundImage=uiPerformerAvatarCss(member.id,doc.baseURI);}
  }
  const host=doc.getElementById('game-container');
  if(host?.dataset && host.style?.setProperty && member.id && host.dataset.uiPerformer!==member.id){
    host.style.setProperty('--ui-actor-avatar',uiPerformerAvatarCss(member.id,doc.baseURI));
    host.dataset.uiPerformer=member.id;
  }
  const preparing=scene.publicStage1Round?.snapshot?.().phase==='idle';
  const active=scene._isPublicSakuraEncoreWindowActive?.()===true;
  const abilities=scene.publicPerformerRun?.getAbilityState?.();
  const special=abilities?abilities.action.canRelease:!preparing&&scene.publicPerformerRun?.canAct()===true;
  const encore=abilities?abilities.encore.canRelease:!preparing&&Number(scene._encoreCharge)>=100&&!active&&!scene._battlePaused&&!scene._battleEnded;
  const blocked=scene._battleEnded?'ended':preparing?'preparing':scene._battlePaused?'paused':null;
  const specialState=abilities?.action.state||(blocked||(special?'ready':'charging'));
  const encoreState=abilities?.encore.state||(blocked||(active?'active':encore?'ready':'charging'));
  const specialCharge=abilities?.action.charge??percent(scene._specialCharge);
  const encoreCharge=abilities?.encore.charge??percent(scene._encoreCharge);
  const captions={preparing:'待开演',paused:'已暂停',ended:'已结束',active:'返场中',ready:'就绪',busy:'暂不可用',unavailable:'未就绪'};
  const specialText=captions[specialState]||`${specialCharge}%`;
  const encoreText=captions[encoreState]||`${encoreCharge}%`;
  if(abilities){
    doc.getElementById('skill-special')?.classList.toggle('ready',abilities.action.canRelease);
    doc.getElementById('skill-encore')?.classList.toggle('ready',abilities.encore.canRelease);
    doc.getElementById('ult-prompt')?.classList.toggle('show',abilities.encore.canRelease);
  }
  set('hp-value',`${Math.max(0,scene.player?.hp||0)} / ${scene.player?.maxHp||5}`);
  const hpMeter=doc.getElementById('public-hp-meter');
  if(hpMeter){
    const max=scene.player?.maxHp||5,hp=Math.max(0,Math.min(max,scene.player?.hp||0));
    for(const [key,value]of Object.entries({role:'meter','aria-label':`${member.name}生命值`,'aria-valuemin':'0','aria-valuemax':String(max),'aria-valuenow':String(hp),'aria-valuetext':`${hp} / ${max}`}))hpMeter.setAttribute(key,value);
  }
  set('battle-chapter',getPublicChapter(scene.battleData?.campaignChapterId).name);
  set('special-state',specialText);
  const fill=doc.getElementById('special-fill');if(fill)fill.style.width=`${preparing?0:specialCharge}%`;
  set('encore-state',encoreText);
  doc.getElementById('skill-special')?.setAttribute('aria-disabled',String(specialState!=='ready'));
  doc.getElementById('skill-special')?.setAttribute('aria-label',`${member.name}：${member.actionName}，${specialState==='charging'?'充能 ':''}${specialText}`);
  doc.getElementById('skill-encore')?.setAttribute('aria-disabled',String(encoreState!=='ready'));
  doc.getElementById('skill-encore')?.setAttribute('aria-label',`安可，${encoreState==='charging'?'充能 ':''}${encoreText}`);
  if(stageHud){
    syncBattleHudStage(scene,doc,member,{charge:specialCharge,state:specialState},{charge:encoreCharge,state:encoreState});
    return;
  }
  for(const [id,name] of [['skill-special','clapperboard'],['skill-encore','play']]){
    const button=doc.getElementById(id);if(!button)continue;
    if(id==='skill-special'&&scene._userCastPresentation&&['sakura','kai','enjo'].includes(member.id)){
      let image=button.querySelector('img');
      if(!image){image=doc.createElement('img');image.className='battle-action-art';image.alt='';image.width=32;image.height=32;image.draggable=false;button.append(image);}
      const src=`art/formal-ui-20261016/action-${member.id}.webp`;
      if(image.getAttribute('src')!==src)image.src=src;
      button.dataset.art='weapon';
    }else if(!button.querySelector('svg'))button.append(createBattleIcon(doc,name));
    button.setAttribute('title',button.getAttribute('aria-label'));
    const state=id==='skill-special'?specialState:encoreState;
    if(button.getAttribute('data-charge-state')!==state)button.setAttribute('data-charge-state',state);
  }
  if(scene._userCastPresentation)syncBattleHeader(scene,doc,member);
}
