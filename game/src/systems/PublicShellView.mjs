import {mountShowbillMenu} from './ShowbillMenus.mjs';
import { PUBLIC_CHAPTERS } from '../utils/publicCampaign.mjs';
import {getChapterContent} from '../utils/publicChapterContent.mjs';
import { loadPublicProfile, getPublicCampaignProgress,
  resolvePublicChapterId, isPublicChapterUnlocked, selectPublicChapter, selectPublicPerformer,
  trainPublicPerformer, equipPublicPerformer, applyPublicPreparationPlan, recoverRetiredPublicTraining,
  retryPublicProfileSave, recoverPublicProfile, selectPublicReplaySession } from '../utils/publicRunProgression.mjs';
import { PUBLIC_EQUIPMENT, getPreparationResources, getPreparationSnapshot, getPreparationEffects, getOwnedEquipment, getTrainingCost, getRetiredTrainingRecovery, getChapterRewardPreview } from '../utils/publicPreparation.mjs';
import {getPublicEquipmentInventory} from '../utils/publicEquipmentInventory.mjs';
import {openHierarchySheet} from './HierarchySheets.mjs';
import { shellIcons } from '../vendor/shellIcons.mjs';
import { battleCommandIcons } from '../vendor/battleCommandIcons.mjs';
import { resumePlayerAudioFromGesture } from './PlayerSessionExperience.mjs';
import { getCharacterDossier } from '../utils/publicStory.mjs';
import { OLD_STREET_PROPS } from '../utils/oldStreetMap.mjs';
import { NEON_STREET_PROPS, NEON_STREET_ART } from '../utils/neonStreetMap.mjs';
import { HARBOR_STAGE_PROPS, HARBOR_STAGE_ART } from '../utils/harborStageMap.mjs';
import { STREET_RESTORATION_ART } from './StreetRestorationSurface.mjs';
import { getChapterGroundArt } from './ChapterGroundArt.mjs';
import { oldStreetMaterialPath } from './StreetMaterialPresentation.mjs';
import { getUiPerformerArt } from './UiPerformerArt.mjs';
import {visualStudyEnabled} from './EnjoVisualStudy.mjs';
import { getPublicPerformanceRecord, formatPerformanceTime } from '../utils/publicPerformanceRecords.mjs';
import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
import { renderMobileLobby, renderNewRunConfirmation, renderPreflight, renderInventory, renderArchive } from './MobileGameScreens.mjs';
import {getPublicChapterPacing,getPublicTourReview} from '../utils/publicTourContent.mjs';
import {renderPlayHub,renderRunGoals,renderArrangementLibrary,renderGrowthCatalog} from './GameSystemScreens.mjs';
import {UI_CAST as PUBLIC_PERFORMERS,getUiPerformer as getPublicPerformer,isUserCastEnabled} from '../utils/userCast.mjs';
import {PUBLIC_MENU_ART,PUBLIC_TITLE_ART,getPublicMenuIcon} from './PublicMenuArt.mjs';
import {renderFinaleTrial} from './FinaleTrialMenu.mjs';
import {getPublicPerformanceCatalog} from '../utils/publicPerformanceAccess.mjs';
import {renderRehearsal,getRehearsalMenuSetup} from './RehearsalMenu.mjs';
import {normalizeArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {normalizePublicRoutePlan} from '../utils/publicRoutePlan.mjs';
import {renderChapterArchive} from './ChapterArchiveView.mjs';
import {mountHomeConceptArt} from './HomeConceptArt.mjs';
import {mountChapterVenueArt} from './ChapterVenueArt.mjs';
import {mountInnerPageArt} from './InnerPageArt.mjs';
import {mountMenuPortrait} from './MenuPortraitPresentation.mjs';
import {mountHomePortrait} from './HomePortraitPresentation.mjs';
import {mountCompanionRig} from './CompanionRigPresentation.mjs';
import {mountEnjoContinuousPortrait} from './EnjoContinuousPortrait.mjs';
import {mountKaiContinuousPortrait} from './KaiContinuousPortrait.mjs';
import {getCompanionRig} from './CompanionRigRegistry.mjs';
import {mountMenuAvatar,setMemberPickerAvatar} from './MenuPortraitAvatar.mjs';
import {PUBLIC_SHELL_ROUTES,PUBLIC_SHELL_ROOTS,getPublicShellRoute,getPublicShellRootId,isPublicShellPage as validPage} from '../utils/publicShellNavigation.mjs';
import {copyPublicRehearsalSetup,createPublicShellSceneEntry} from '../utils/publicShellSceneEntry.mjs';
import {mountSystemScreenFrame} from './SystemScreenFrame.mjs';
import {renderProductModuleScreen} from './ProductModuleScreens.mjs';
import {mountOwnerGeneratedUi} from './OwnerGeneratedUi.mjs';
import {compactHierarchyPage,renderHierarchyNavigation} from './MenuHierarchy.mjs';
import {mountHierarchyUi} from './HierarchyUiArt.mjs';
import {composeSecondaryScene} from './SecondarySceneComposition.mjs';
import {mountSecondaryUi} from './SecondaryUiArt.mjs';

import {ROOFTOP_PROPS} from '../utils/rooftopMap.mjs';
const SCENE_ART = 'art/phase16/p16-068-scenes/';
const PAGE_NAMES=Object.freeze(Object.fromEntries(PUBLIC_SHELL_ROUTES.map(row=>[row.id,row.title])));
const hex = color => `#${color.toString(16).padStart(6, '0')}`;

export function getPublicShellModel(profile = loadPublicProfile()) {
  const campaign = getPublicCampaignProgress(profile);
  const selected = resolvePublicChapterId(campaign.selectedChapterId, profile);
  const chapters = PUBLIC_CHAPTERS.map(chapter => ({ ...chapter,
    unlocked: isPublicChapterUnlocked(chapter.id, profile),
    cleared: campaign.clearedChapterIds.includes(chapter.id), selected: chapter.id === selected }));
  return { member: getPublicPerformer(profile.selectedId), chapter: chapters.find(c => c.selected),
    chapters, clearedCount: campaign.clearedChapterIds.length, completed: campaign.completed,
    clears: profile.clears, lastRun: profile.lastRun, persisted: profile.persisted, attempts: profile.attempts,
    recovery: profile.recovery, hasPendingSave: profile.hasPendingSave === true,
    resources:getPreparationResources(profile),preparation:getPreparationSnapshot(profile,getPublicPerformer(profile.selectedId).id),
    performance:getPublicPerformanceCatalog(profile,{chapterId:selected}) };
}

// Preview is local to a screen. Only explicit confirmation changes the next run.
export class PublicShellSelection {
  constructor(storage) {
    this.storage = storage;
    const model = getPublicShellModel(loadPublicProfile(storage));
    this.memberId = model.member.id;
    this.chapterId = model.chapter.id;
  }
  previewMember(id) {
    if (!PUBLIC_PERFORMERS.some(member => member.id === id)) return false;
    this.memberId = id;return true;
  }
  previewChapter(id) {
    if (!isPublicChapterUnlocked(id, loadPublicProfile(this.storage))) return false;
    this.chapterId = id;return true;
  }
  confirmMember() { return selectPublicPerformer(this.memberId, this.storage); }
  confirmChapter() {
    if (!isPublicChapterUnlocked(this.chapterId, loadPublicProfile(this.storage))) return null;
    const profile = selectPublicChapter(this.chapterId, this.storage);
    return profile.campaign.selectedChapterId === this.chapterId ? profile : null;
  }
}

export class PublicShellView {
  constructor(scene, options, doc = document) {
    this.scene = scene;this.options = options;this.doc = doc;
    this.page = validPage(options.page) ? options.page : 'desk';this.originPage=this.page;
    this.returnPage=validPage(options.returnPage)&&options.returnPage!==this.page?options.returnPage:null;
    this.selection = new PublicShellSelection();
    const earned=options.earnedEquipment;
    if(this.page==='inventory'&&earned&&PUBLIC_PERFORMERS.some(member=>member.id===earned.memberId)
      &&getOwnedEquipment(loadPublicProfile()).some(item=>item.id===earned.equipmentId)){
      this.selection.previewMember(earned.memberId);this.inventoryId=earned.equipmentId;
      this.pendingInventoryDetailId=earned.equipmentId;
    }
    this.pageHistory=[];
    this.arrangementPlan=options.arrangementPlan||null;
    this.routeSelection=options.routePlan||null;
    this.rehearsalSetup=copyPublicRehearsalSetup(options.rehearsalSetup);
    this.pageSnapshots=new Map();
    this.archiveChapters=PUBLIC_CHAPTERS;
    this.disposed = false;this.navigating = false;
    this.previousInput = scene.input?.enabled;
    if (scene.input) scene.input.enabled = false;
    this.root = doc.createElement('section');this.root.id = 'public-shell';
    this.root.dataset.uiRebuild='screen-v2';
    this.root.dataset.cast = isUserCastEnabled() ? 'owner-three' : 'legacy';
    this.root.dataset.page = this.page;this.root.setAttribute('aria-label', PAGE_NAMES[this.page]);
    for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','keydown']) {
      this.root.addEventListener(type, event => event.stopPropagation());
    }
    this.host = doc.getElementById('game-container');
    this.previousTouchAction = this.host?.style.touchAction;
    if(this.host) { this.host.style.touchAction = 'pan-y';this.host.append(this.root); }
    this.storageChanged = event => {
      if(event.key === 'starush.public-profile' || event.key === null) {
        if(event.key===null||event.newValue===null){this.growthContext=null;this.growthConfirmation=null;this.routeSelection=null;this.arrangementPlan=null;this.rehearsalSetup=null;}
        this.workshopMessage='';this.saveMessage='';this.recoveryConfirmation=null;this.recoveryMessage='';this.render();
      }
    };
    globalThis.window?.addEventListener?.('storage',this.storageChanged);
    // Motion is CSS-only and keyed to actual navigation; no timers or callbacks outlive the shell.
    this.pendingMotion='enter';
    this.render();
  }
  element(tag, className, text, parent = this.root) {
    const node = this.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent?.append(node);return node;
  }
  icon(name, parent, vectorFallback=false) {
    const key=vectorFallback?null:getPublicMenuIcon(name,parent);
    if(key){
      const image=this.art(key,parent);
      if(image&&shellIcons[name]?.length)image.addEventListener('error',()=>{
        if(this.disposed||!image.parentNode)return;
        image.remove();this.icon(name,parent,true);
      },{once:true});
      return image;
    }
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(key,value);
    for (const [tag, attributes] of shellIcons[name] || []) {
      const node = this.doc.createElementNS('http://www.w3.org/2000/svg',tag);
      for(const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
      svg.append(node);
    }
    parent.append(svg);return svg;
  }
  art(key,parent,className='menu-art') {
    const src=PUBLIC_MENU_ART[key];if(!src)return null;
    const image=this.element('img',className,undefined,parent);image.src=src;image.alt='';image.width=64;image.height=64;image.draggable=false;
    return image;
  }
  button(parent, label, callback, { className = '', icon, action, nav, iconOnly = false, lineIcon = false } = {}) {
    const button = this.element('button', className, undefined, parent);button.type = 'button';
    button.setAttribute('aria-label', label);
    if(action) button.dataset.action = action;
    if(nav) button.dataset.nav = nav;
    if(icon) this.icon(icon,button,lineIcon);
    if(!iconOnly) this.element('span','',label,button);else button.title = label;
    button.addEventListener('click', () => {
      if (this.disposed || this.navigating || button.disabled || this.scene._sessionExperience?.isBlocking()) return;
      resumePlayerAudioFromGesture(this.scene.sound);
      callback();
    });return button;
  }
  navigate(callback) {
    if (this.navigating || this.disposed || !callback) return;
    this.navigating = true;callback();
  }
  getArrangementHandoff() {
    const model=getPublicShellModel(),context={stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id};
    const plan=normalizeArrangementPlan(this.arrangementPlan,context);
    this.routeSelection=isUserCastEnabled()?normalizePublicRoutePlan(this.routeSelection,context):null;
    const rehearsalSetup=copyPublicRehearsalSetup(this.rehearsalSetup);
    return {...(plan?{arrangementPlan:plan}:{}),...(this.routeSelection?{routePlan:this.routeSelection}:{}),...(rehearsalSetup?{rehearsalSetup}:{})};
  }
  getNavigationHandoff() { return {...this.getArrangementHandoff(),shellReturnPage:this.page}; }
  startMenuScene(page,{returnToCurrent=false,profile}={}) {
    if(this.disposed)return false;
    const entry=createPublicShellSceneEntry(page,returnToCurrent?this.getNavigationHandoff():this.getArrangementHandoff(),profile?.persisted===false);
    if(!entry)return false;
    this.scene.scene.start(entry.key,entry.data);return true;
  }
  openRoot(page) {
    if(this.disposed||this.navigating||this.scene._sessionExperience?.isBlocking()||page===this.page)return false;
    const route=getPublicShellRoute(page);if(!route?.navigation)return false;
    const callback=this.options[route.navigation.callback];
    this.returnPage=null;
    if(page===this.originPage||typeof callback!=='function')return this.showPage(page,{remember:false,root:true});
    this.pageHistory=[];this.pageSnapshots.clear();this.navigate(callback);return true;
  }
  showPage(page,{remember=true,root=false,restore=false}={}) {
    if(this.disposed||this.navigating||this.scene._sessionExperience?.isBlocking()||!validPage(page)||page===this.page)return false;
    if(page==='preflight'&&typeof this.options.onStart!=='function'&&typeof this.options.onPreflight==='function'){
      this.navigate(this.options.onPreflight);return true;
    }
    if(page==='finaleTrial'&&typeof this.options.onFinaleTrial!=='function'){
      this.navigate(()=>this.startMenuScene('finaleTrial',{returnToCurrent:true}));return true;
    }
    if(page==='rehearsal'&&typeof this.options.onRehearsal!=='function'){
      this.navigate(()=>this.startMenuScene('rehearsal',{returnToCurrent:true}));return true;
    }
    const currentMain=this.root.querySelector('.shell-content');
    const focus=this.doc.activeElement;
    const drawer=focus?.closest?.('.tour-reference-list,.roster-reference-list');
    const active=drawer?this.root.querySelector('[data-action='+this.page+'-reference]'):focus;
    const key=this.root.contains(active)?['action','member','chapter','inventoryItem','nav'].find(key=>/^[\w-]+$/.test(active?.dataset?.[key]||'')):null;
    const attribute=key?.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);
    this.pageSnapshots.set(this.page,{scrollTop:currentMain?.scrollTop||0,focus:key?`[data-${attribute}="${active.dataset[key]}"]`:null});
    if(root){this.pageHistory=[];this.pageSnapshots.clear();this.returnPage=null;}else if(remember)this.pageHistory.push(this.page);
    this.page=page;this.workshopMessage='';this.pendingMotion=restore?'back':root?'root':'forward';this.render();
    const snapshot=restore?this.pageSnapshots.get(page):null;
    const main=this.root.querySelector('.shell-content');if(main)main.scrollTop=snapshot?.scrollTop||0;
    const target=snapshot?.focus?this.root.querySelector(snapshot.focus):null;
    const heading=(isUserCastEnabled()&&['library','growth','records','chapterArchive','playhub','finaleTrial','rehearsal'].includes(page)?this.root.querySelector('h1'):this.root.querySelector('.shell-page-heading'))||this.root.querySelector('h1')||this.root;
    heading.setAttribute('tabindex','-1');(target||heading).focus({preventScroll:true});
    return true;
  }
  backPage() {
    if(this.disposed||this.navigating||this.scene._sessionExperience?.isBlocking())return false;
    const page=this.pageHistory.pop();
    if(page){
      if(page==='preflight')this.selection=new PublicShellSelection();
      return this.showPage(page,{remember:false,restore:true});
    }
    const parent=this.returnPage||getPublicShellRoute(this.page)?.parentId;this.returnPage=null;
    if(parent)return getPublicShellRoute(parent).navigation?this.openRoot(parent):this.showPage(parent,{remember:false,restore:true});
    this.navigate(this.options.onBack);
  }
  returnSelection(profile) {
    if(this.pageHistory.length||this.returnPage||!getPublicShellRoute(this.page)?.navigation)return this.backPage();
    return this.navigate(()=>this.options.onBack(profile));
  }
  inventoryFeedback(memberId,equipmentId) {
    const result=equipPublicPerformer(memberId,equipmentId);
    this.workshopMessage={equipped:'装备配置已保存，下次出战生效。','storage-error':'保存失败，材料和装备保持原样。',
      incompatible:'此配件不能由当前成员装备。','save-required':'记录尚未保存，未改变装备。',locked:'配件尚未解锁。',unchanged:'装备未改变。'}[result.preparationStatus]||'配置未改变。';
    this.render('[data-action=equip-selected]');
  }
  preparedPreflightButton(parent) {
    const member=getPublicPerformer(this.selection.memberId),current=loadPublicProfile().selectedId===member.id;
    this.button(parent,current?'查看本场出战准备':`确认${member.name}出战并查看准备`,()=>{
      const result=this.selection.confirmMember();
      if(!result.persisted||result.selectedId!==member.id){
        this.workshopMessage='出战成员未能保存，未进入出战准备。';this.render();return;
      }
      this.showPage('preflight',{remember:false,root:true});
    },{className:'shell-primary',icon:'clapperboard',action:'prepared-preflight'});
  }
  previewTourReplay(target) {
    const profile=loadPublicProfile(),current=getPublicTourReview(profile,this.selection.memberId)?.replayTarget;
    if(!current||current.performerId!==target?.performerId||current.chapterId!==target?.chapterId)return;
    this.replayProposal={target:{...current},expected:{performerId:profile.selectedId,chapterId:profile.campaign.selectedChapterId}};
    this.replayMessage='';this.render('[data-action=replay-confirm]');
    this.root.querySelector('[data-replay-proposal]')?.scrollIntoView?.({block:'nearest'});
  }
  renderTourReplayProposal(main) {
    const proposal=this.replayProposal;
    if(!proposal||!isUserCastEnabled()||!['desk','records'].includes(this.page))return;
    const section=this.element('section','lobby-tour-next',undefined,main);section.dataset.replayProposal='true';
    this.element('h2','','准备复演 · '+proposal.target.name,section);
    this.element('p','system-context','确认后切换出战成员与场地，沿用该成员已保存的训练和配件。不会自动装备、训练或开战。',section);
    if(this.replayMessage){const message=this.element('p','shell-save-notice',this.replayMessage,section);message.setAttribute('role','status');}
    this.button(section,'确认配置并准备',()=>{
      const result=selectPublicReplaySession(proposal.target,proposal.expected);
      if(result.sessionStatus!=='selected'){
        this.replayMessage={stale:'当前出战配置已变化，请取消并重新选择复演。',
          'storage-error':'保存失败，成员和场地均未切换；可重试确认。',
          'save-required':'记录尚未保存或不可用，请先处理存档。',
          'write-denied':'当前页面已失去存档控制权，请返回持有控制权的页面。'}[result.sessionStatus]||'复演配置不可用，请重新选择。';
        this.render('[data-action=replay-confirm]');return;
      }
      this.replayProposal=null;this.replayMessage='';this.selection=new PublicShellSelection();
      this.routeSelection=null;this.goalContext=null;
      this.showPage('preflight',{remember:false,root:true});
    },{className:'shell-primary',icon:'check',action:'replay-confirm'});
    this.button(section,'取消',()=>{this.replayProposal=null;this.replayMessage='';this.render('[data-action=replay-proposal]');},
      {icon:'x',action:'replay-cancel'});
  }
  applyGrowthPlan(confirmation) {
    const result=applyPublicPreparationPlan(confirmation.expected,confirmation.target);
    this.workshopMessage={planned:'整套方案已保存，出战成员尚未改变。',stale:'当前配置已更新，请重新规划并确认。',
      'storage-error':'保存失败，材料和装备保持原样。','save-required':'记录尚未保存，未应用方案。',
      incompatible:'此配件不能由当前成员装备。',insufficient:'练习笔记不足，未应用方案。',locked:'配件尚未拥有，未应用方案。',
      downgrade:'已完成阶位不可降级。',unchanged:'配置未改变。'}[result.preparationStatus]||'方案无效，未应用。';
    if(result.preparationStatus==='planned'||result.preparationStatus==='stale'){
      this.growthContext=null;this.growthConfirmation=null;
    }
    this.render(isUserCastEnabled()?(this.growthConfirmation?'[data-action=growth-confirm]':'[data-action=prepared-preflight]'):'[data-action=growth-apply]');
  }
  renderRetiredTrainingRecovery(main,profile=loadPublicProfile()) {
    if(!isUserCastEnabled())return;
    const offer=getRetiredTrainingRecovery(profile);if(!offer.notes)return;
    const section=this.element('section','workshop-training',undefined,main);
    this.element('h2','','旧成员训练记录',section);
    this.element('p','',`当前三人阵容之外的两名旧成员占用 ${offer.notes} 练习笔记。可回收训练投入，旧成员配件与演出记录保留。`,section);
    const confirm=this.retiredRecoveryConfirmation;
    if(confirm)this.element('p','',`确认回收 ${confirm.notes} 练习笔记？两名旧成员将回到阶位 1，当前三人训练不变。`,section);
    const actions=this.element('div','preflight-links',undefined,section);
    actions.style.gridTemplateColumns='minmax(0,1fr)';
    if(confirm){
      const button=this.button(actions,'确认回收旧训练',()=>{
        const result=recoverRetiredPublicTraining(confirm.trainingLevels);
        this.workshopMessage={recovered:'旧训练投入已回收，配件与演出记录保留。',stale:'旧训练记录已更新，请重新确认。',
          'storage-error':'保存失败，未回收训练投入。','save-required':'记录尚未保存，未回收训练投入。'}[result.preparationStatus]||'没有可回收的训练投入。';
        this.retiredRecoveryConfirmation=null;this.render();
      },{icon:'check',action:'confirm-retired-recovery'});button.disabled=!profile.persisted;
      this.button(actions,'取消',()=>{this.retiredRecoveryConfirmation=null;this.render();},{icon:'x',action:'cancel-retired-recovery'});
    }else{
      const button=this.button(actions,`回收旧训练 · ${offer.notes} 笔记`,()=>{
        this.retiredRecoveryConfirmation=offer;this.render('[data-action=confirm-retired-recovery]');
        this.root.querySelector('[data-action=confirm-retired-recovery]')?.scrollIntoView?.({block:'nearest'});
      },{icon:'arrow-left',action:'recover-retired-training'});button.disabled=!profile.persisted;
    }
  }
  render(focusSelector,trainingPortrait=null) {
    // A selected actor moves back into a hidden strip when the page refreshes.
    // Its visible switch is the keyboard return point on the refreshed page.
    if (focusSelector && this.root.querySelector('dialog[data-sheet-kind=actors]')?.querySelector(focusSelector)) {
      focusSelector='[data-action=actor-switch]';
    }
    // A live sheet holds borrowed nodes; return them before the page is replaced.
    this.hierarchySheetDispose?.();
    const owner=isUserCastEnabled();
    this.journeyFocusDispose?.();this.journeyFocusDispose=null;
    this.portraitInteractionDispose?.();this.portraitInteractionDispose=null;
    if(!trainingPortrait){this.homePortraitDispose?.();this.homePortraitDispose=null;}
    this.homeSceneDispose?.();this.homeSceneDispose=null;
    this.menuPortraitDispose?.();this.menuPortraitDispose=null;
    const model = getPublicShellModel();
    this.arrangementPlan=isUserCastEnabled()?normalizeArrangementPlan(this.arrangementPlan,{stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id}):null;
    this.routeSelection=isUserCastEnabled()?normalizePublicRoutePlan(this.routeSelection,{stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id}):null;
    const scrollTop = this.root.querySelector('.shell-content')?.scrollTop || 0;
    this.journeyScrollTop=this.root.querySelector('.journey-map')?.scrollTop;
    this.root.replaceChildren();
    const motion=this.pendingMotion;this.pendingMotion=null;
    if(motion)this.root.dataset.motion=motion;else delete this.root.dataset.motion;
    this.root.dataset.page=this.page;this.root.dataset.rootPage=getPublicShellRootId(this.page);this.root.setAttribute('aria-label',PAGE_NAMES[this.page]);
    this.root.dataset.moduleId=getPublicShellRoute(this.page).moduleId;
    this.root.dataset.uiPass=owner?'hierarchy-v1':'stage-v2';
    this.root.dataset.shellFamily=owner?'hierarchy':'legacy';
    this.root.dataset.presentationMember=['roster','inventory'].includes(this.page)?this.selection.memberId:model.member.id;
    this.root.dataset.coreJourney=String(isUserCastEnabled()&&['desk','roster','tour','preflight'].includes(this.page));
    this.root.dataset.homeDemo=String(isUserCastEnabled()&&this.page==='desk');
    // Owner pages leave the old inner-page family; non-owner was always 'false'.
    this.root.dataset.innerFamily='false';
    this.root.dataset.systemPreparation=String(isUserCastEnabled()&&['inventory','workshop','growth'].includes(this.page));
    this.root.dataset.directoryReading=String(isUserCastEnabled()&&['playhub','records','chapterArchive','library'].includes(this.page));
    this.root.dataset.challengePreparation=String(isUserCastEnabled()&&['goals','finaleTrial','rehearsal'].includes(this.page));
    const study=visualStudyEnabled();this.root.dataset.visualStudy=study?'enjo':'';
    const homeConcept=this.page==='desk'&&isUserCastEnabled();
    const header = this.element('header','shell-header');
    if(this.page !== 'desk'){
      const back=this.button(header,'返回',()=>this.backPage(),{
        className:'shell-icon-button',icon:'arrow-left',iconOnly:true,action:'back',lineIcon:isUserCastEnabled() });
      if(owner)back.dataset.uiIcon='back';
    }
    const brand = this.element('div','shell-brand',undefined,header);
    const title=this.page === 'desk' ? 'ST☆RUSH' : PAGE_NAMES[this.page];
    const heading=this.element('h1','',title,brand);
    heading.setAttribute('aria-label',title);
    const letter=owner?{roster:'roster',tour:'tour',inventory:'inventory',preflight:'preflight',workshop:'workshop',events:'program',sideplay:'practice',backstage:'backstage',services:'services'}[this.page]:undefined;
    if(letter)heading.dataset.uiLetter=letter;
    if(homeConcept){
      heading.replaceChildren();
      this.element('span','shell-brand-copy',title,heading);
      const image=this.element('img','shell-brand-art',undefined,heading);
      image.alt='';image.setAttribute('aria-hidden','true');image.width=480;image.height=200;image.draggable=false;
      image.onerror=()=>{
        image.remove();const concept=heading.querySelector('.home-concept-art');
        heading.textContent=title;if(concept)heading.append(concept);
      };
      image.src='art/comic-ui-20261021/logo.png';
      mountHomeConceptArt(this,heading,'logo');
    }
    const titleRow=isUserCastEnabled()?PUBLIC_TITLE_ART.rows[this.page]:undefined;
    const singleTitle=isUserCastEnabled()?PUBLIC_TITLE_ART.single[this.page]:undefined;
    if(this.page==='desk'&&(Number.isInteger(titleRow)||singleTitle)){
      heading.dataset.titleArt='true';brand.classList.add('shell-brand-lettered');
      heading.replaceChildren();
      this.element('span','shell-title-copy',title,heading);
      const slot=this.element('span','shell-title-window',undefined,heading);
      if(Number.isInteger(titleRow))slot.dataset.row=String(titleRow);
      const image=this.element('img',singleTitle?'shell-title-art shell-title-single':'shell-title-art',undefined,slot);
      image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;
      const dimensions=PUBLIC_TITLE_ART.singleDimensions?.[this.page]||[960,220];
      image.width=singleTitle?dimensions[0]:1536;image.height=singleTitle?dimensions[1]:1024;
      image.onload=()=>{heading.dataset.lettered='true';};
      image.onerror=()=>{delete heading.dataset.lettered;};
      image.src=singleTitle||PUBLIC_TITLE_ART.src;
      if(image.complete&&image.naturalWidth>0)image.onload();
    }
    const eyebrow=this.element('span','shell-eyebrow',this.page === 'desk' ? '巡演后台' : 'ST☆RUSH',brand);
    if(owner)eyebrow.hidden=true;
    if(homeConcept&&!owner)mountHomeConceptArt(this,eyebrow,'backstage');
    if(owner){
      // Quiet native balance; training is reached from Member, not a header shortcut.
      const resource=this.element('span','shell-wallet ui-resource',undefined,header);
      resource.hidden=this.page!=='desk';
      resource.setAttribute('role','status');resource.setAttribute('aria-label',`练习笔记 ${model.resources.balance}`);resource.title='练习笔记';
      const balance=this.element('strong','',String(model.resources.balance),resource);balance.dataset.resource='notes';
    }else{
      const wallet=this.button(header,`练习笔记 ${model.resources.balance} · 成员训练`,()=>this.navigate(this.options.onWorkshop),
        {className:'shell-wallet',icon:'clapperboard',nav:'workshop'});
      wallet.disabled=this.page==='workshop';
      wallet.title='练习笔记 · 成员训练';wallet.replaceChildren();this.icon('clapperboard',wallet,isUserCastEnabled()&&this.page!=='desk');
      const balance=this.element('strong','',String(model.resources.balance),wallet);balance.dataset.resource='notes';
      if(this.page==='desk'&&isUserCastEnabled())mountHomeConceptArt(this,wallet,'ticket');
    }
    const settings=this.button(header,'声音与公演规则',()=>this.scene._sessionExperience?.showSettings(),{
      className:'shell-icon-button',icon:'settings-2',iconOnly:true,action:'settings',lineIcon:isUserCastEnabled() });
    if(owner)settings.hidden=this.page!=='desk';
    if(homeConcept)mountHomeConceptArt(this,settings,'settings');
    const context=this.element('div','shell-session-context');
    context.dataset.currentPerformer=model.member.id;context.dataset.currentChapter=model.chapter.id;
    context.setAttribute('aria-label','当前出战配置');
    // Owner pages show the session once (home/preflight); challenge modes keep their mode label.
    if(owner&&!['rehearsal','finaleTrial'].includes(this.page))context.hidden=true;
    this.element('span','',this.page==='rehearsal'?'单站排练':this.page==='finaleTrial'?'三站连续压轴':`本场 · ${model.chapter.name}`,context);
    this.element('strong','',this.page==='lounge'?`出战 · ${model.member.name}`:model.member.name,context);
    const main = this.element('main','shell-content');
    this.saveRecovery(main, model);
    if(this.page !== 'workshop') this.pendingSave(main, model);
    if(this.page==='rehearsal')this.rehearsalSetup=getRehearsalMenuSetup(loadPublicProfile(),model.chapter.id,this.rehearsalSetup);
    mountSystemScreenFrame(this,main,model);
    if(this.page === 'desk') this.desk(main,model);
    if(this.page === 'roster') this.roster(main,model);
    if(this.page === 'tour') this.tour(main,model);
    if(this.page === 'workshop') this.workshop(main,model,trainingPortrait);
    if(this.page === 'preflight') renderPreflight(this,main,model);
    if(this.page === 'inventory') renderInventory(this,main,model);
    if(this.page === 'records') renderArchive(this,main);
    if(this.page === 'chapterArchive') renderChapterArchive(this,main,model);
    if(this.page === 'playhub') renderPlayHub(this,main,model);
    if(this.page === 'goals') renderRunGoals(this,main,model);
    if(this.page === 'library') renderArrangementLibrary(this,main);
    if(this.page === 'growth') renderGrowthCatalog(this,main);
    if(this.page === 'finaleTrial') renderFinaleTrial(this,main,model);
    if(this.page === 'rehearsal') renderRehearsal(this,main,model);
    renderProductModuleScreen(this,main,model);
    this.renderTourReplayProposal(main);
    if(owner){compactHierarchyPage(this,main,model);composeSecondaryScene(this,main);}
    this.navigation();
    owner?mountHierarchyUi(this):mountOwnerGeneratedUi(this);
    if(owner){mountSecondaryUi(this);mountShowbillMenu(this,main,model);}
    else delete this.root.dataset.edition;
    if(this.newRunConfirmation)renderNewRunConfirmation(this);
    main.scrollTop = scrollTop;
    if(owner&&this.page==='inventory'&&this.pendingInventoryDetailId){
      const itemId=this.pendingInventoryDetailId;
      this.pendingInventoryDetailId=null;
      this.root.querySelector(`[data-inventory-item=${itemId}]`).click();
      if(focusSelector==='[data-action=equip-selected]')this.root.querySelector('[data-inventory-sheet=item]').dataset.refresh='true';
    }
    if(focusSelector) this.root.querySelector(focusSelector)?.focus({preventScroll:true});
  }
  pendingSave(main, model) {
    if(model.recovery || (!model.hasPendingSave && !this.saveMessage)) return;
    const section=this.element('section','shell-pending-save',undefined,main);
    section.setAttribute('aria-label','进度保存');
    section.dataset.state=model.hasPendingSave?'pending':model.persisted?'saved':'reset';
    const status=this.element('p','shell-save-status',this.saveMessage||'记录尚未保存，刷新或关闭页面可能丢失本页进度。',section);
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    if(!model.hasPendingSave) return;
    this.button(section,'重试保存',()=>{
      const saved=retryPublicProfileSave();
      this.saveMessage=saved.persisted?'记录已保存在本机。'
        :saved.hasPendingSave?'仍未能保存，请保留本页，恢复存储空间或权限后重试。'
        :'本机存档已被移除，未恢复旧记录。';
      this.render(saved.hasPendingSave?'[data-action=retry-save]':this.page==='desk'?'[data-action=start]':'[data-action=back]');
    },{className:'shell-save-retry',icon:'check',action:'retry-save'});
  }
  saveRecovery(main, model) {
    if (!model.recovery && !this.recoveryMessage) return;
    const section = this.element('section', 'shell-save-recovery', undefined, main);
    section.setAttribute('aria-label', '存档恢复');
    const status = this.element('p', '', this.recoveryMessage || (model.recovery.kind === 'unsupported'
      ? '存档版本不兼容，原档已保留。本页进度暂不保存。'
      : '本机存档损坏，原档已保留。本页进度暂不保存。'), section);
    status.setAttribute('role', 'status');
    if (model.recovery?.kind !== 'corrupt') return;
    if (this.recoveryConfirmation !== model.recovery.raw) {
      this.button(section, '恢复存档', () => {
        this.recoveryConfirmation = model.recovery.raw;
        this.render('[data-action=cancel-recovery]');
      }, { action: 'recover-save', icon: 'settings-2' });
      return;
    }
    this.element('p', '', '将备份损坏原档，并以本页可用进度重建。无法自动找回未读取的旧进度。', section);
    const actions = this.element('div', 'shell-recovery-actions', undefined, section);
    this.button(actions, '暂不恢复', () => {
      this.recoveryConfirmation = null; this.render('[data-action=recover-save]');
    }, { action: 'cancel-recovery' });
    this.button(actions, '备份并重建', () => {
      const result = recoverPublicProfile(this.recoveryConfirmation);
      this.recoveryConfirmation = null;
      const messages = {
        recovered: '已备份原档，当前进度已保存在本机。',
        'backup-conflict': '已有另一份损坏原档备份，未覆盖。恢复已停止。',
        'backup-failed': '原档备份失败，未重建存档。请保留本页。',
        'save-failed': '原档已备份，但新档保存失败。请保留本页后重试恢复。',
        'write-denied': '本页没有存档写入权限，未重建。',
        'read-failed': '无法读取本机存档，未重建。',
      };
      this.recoveryMessage = messages[result.recoveryStatus] || '本机存档已变化，未重建。';
      this.render();
    }, { action: 'confirm-recovery' });
  }
  map(parent, chapter, className = '', decorative = false) {
    const figure = this.element('figure',`shell-map ${className}`,undefined,parent);
    const world=this.element('div','shell-map-world',undefined,figure);
    const district=chapter.id==='opening'?{base:STREET_RESTORATION_ART,props:OLD_STREET_PROPS,label:'旧商街实景布局'}
      :chapter.id==='neon'?{base:NEON_STREET_ART,props:NEON_STREET_PROPS,label:'霓虹街口试听街巷'}
      :['encore','homecoming'].includes(chapter.id)?{base:HARBOR_STAGE_ART,props:HARBOR_STAGE_PROPS,label:'港湾甲板与帆顶舞台'}
      :chapter.id==='raincheck'?{base:HARBOR_STAGE_ART,props:ROOFTOP_PROPS,label:'屋顶广播场'}:null;
    const img = this.element(decorative?'span':'img','shell-map-ground',undefined,world);
    const ground=district?getChapterGroundArt(chapter.id):`${SCENE_ART}${chapter.id}-ground.webp`;
    if(decorative)img.style.backgroundImage=`url("${ground}")`;
    else {img.src=ground;img.alt=district?.label||'公演场地';img.draggable=false;}
    for(const p of district?.props||[]){
      const prop=this.element(decorative?'span':'img','shell-map-prop',undefined,world);
      const path=chapter.id==='raincheck'&&p.id==='broadcast-stage'?'art/roof-broadcast-20261103/stage.webp':chapter.id==='opening'?oldStreetMaterialPath(p.materialVariant||p.art):`${district.base}${p.art}.webp`;
      if(decorative)prop.style.backgroundImage=`url("${path}")`;
      else {prop.src=path;prop.alt='';prop.draggable=false;}
      prop.style.left=`${p.x/10}%`;prop.style.top=`${p.y/17.78}%`;prop.style.width=`${p.width/10}%`;prop.style.height=`${p.height/17.78}%`;
    }
    figure.style.setProperty('--chapter-accent',hex(chapter.accent));
    figure.dataset.chapter = chapter.id;
    if(isUserCastEnabled())mountChapterVenueArt(this,figure,chapter);
    return figure;
  }
  mark(parent, member, large = false, motionOptions = null) {
    const art=getUiPerformerArt(member.id);
    const visual=large && art ? {kind:'portrait',source:art.portrait,width:art.width,height:art.height} : null;
    const mark = this.element('span',(large ? 'member-mark member-mark-large' : 'member-mark')+(visual?' member-mark-full':''), visual?undefined:member.identityMark,parent);
    mark.dataset.performer=member.id;
    const cel=visual?.kind==='cel';
    const frame=cel ? this.element('span','member-cel-frame',undefined,mark) : mark;
    if(cel){
      mark.style.setProperty('--cel-row',String(Math.floor(visual.frame/visual.columns)));
      mark.style.setProperty('--cel-column',String(visual.frame%visual.columns));
    }
    let portrait;
    if(!large && isUserCastEnabled() && parent.parentNode?.classList.contains('shell-member-strip')){
      mark.replaceChildren();
      portrait=this.element('img','member-portrait menu-head-avatar',undefined,mark);
      setMemberPickerAvatar(portrait,member.id);
    }else{
      portrait=this.element('img','member-portrait',undefined,frame);
      portrait.src=visual?.source || art?.avatar;portrait.alt='';portrait.draggable=false;
      portrait.width=visual?.width || 128;portrait.height=visual?.height || 128;portrait.decoding='async';
      if(!large&&isUserCastEnabled())mountMenuAvatar(this,mark,member.id,portrait);
    }
    if(large&&isUserCastEnabled()){
      const rig=motionOptions?.animate===true&&!art?.confirmedDesign?getCompanionRig(member.id):null;
      if(art?.confirmedDesign)this.homePortraitDispose=mountHomePortrait(this,mark,member.id,portrait,motionOptions?.background);
      else if(member.id==='enjo'&&motionOptions?.animate===true)this.homePortraitDispose=mountEnjoContinuousPortrait(this,mark,portrait);
      else if(member.id==='kai'&&motionOptions?.animate===true)this.homePortraitDispose=mountKaiContinuousPortrait(this,mark,portrait);
      else if(rig)this.homePortraitDispose=mountCompanionRig(this,mark,portrait,rig,motionOptions.background);
      else if(member.id==='sakura')this.homePortraitDispose=mountHomePortrait(this,mark,member.id,portrait,motionOptions?.background,{animate:motionOptions?.animate===true});
      else this.menuPortraitDispose=mountMenuPortrait(this,mark,member.id,portrait,motionOptions);
    }
    mark.setAttribute('aria-hidden','true');mark.style.setProperty('--member-color',hex(member.colorHex));return mark;
  }
  desk(main, model) {
    renderMobileLobby(this,main,model);
  }
  roster(main, model) {
    const owner=isUserCastEnabled();
    if(owner)this.root.dataset.rosterLayout='showcase';
    const roles={sakura:'远程 · 连续扫射',kai:'近战 · 突进',enjo:'近身 · 范围魔法'};
    if(!owner)this.element('h2','shell-page-heading','本场，由谁领唱？',main);
    const strip = this.element('div','shell-member-strip',undefined,main);strip.setAttribute('role','group');strip.setAttribute('aria-label','公演成员');
    for(const member of PUBLIC_PERFORMERS) {
      const button = this.button(strip,member.name,()=>{
        this.selection.previewMember(member.id);this.render(`[data-member="${member.id}"]`);
      },{className:'shell-member-option'+(owner?' roster-member-choice':'')});
      button.dataset.member = member.id;button.setAttribute('aria-pressed',String(member.id===this.selection.memberId));
      button.replaceChildren();
      if(owner){
        const image=this.element('img','roster-headshot',undefined,button);
        setMemberPickerAvatar(image,member.id);
      }else this.mark(button,member);
      this.element('span','',member.name,button);
      if(isUserCastEnabled()&&(member.id===model.member.id||member.id===this.selection.memberId))
        this.element('small','member-option-state',member.id===model.member.id?'出战':'预览',button);
    }
    const member = getPublicPerformer(this.selection.memberId);
    const detail = this.element('section','shell-performer-detail',undefined,main);detail.style.setProperty('--member-color',hex(member.colorHex));
    if(owner)detail.dataset.rosterMember=member.id;
    const design=getUiPerformerArt(member.id)?.designId;if(design)detail.dataset.design=design;
    detail.dataset.selection=member.id===model.member.id?'current':'candidate';
    const portrait=isUserCastEnabled()?this.element('div','roster-portrait-stage',undefined,detail):detail;
    this.mark(portrait,member,true,{animate:true});
    if(owner){
      portrait.append(strip);
      const stamp=this.element('div','roster-stage-stamp',undefined,portrait);
      this.element('span','','ST / CAST',stamp);
      this.element('strong','',String(PUBLIC_PERFORMERS.indexOf(member)+1).padStart(2,'0'),stamp);
    }
    const name = this.element('div','shell-performer-name'+(owner?' roster-stage-identity':''),undefined,detail);
    if(!isUserCastEnabled())this.element('span','shell-eyebrow',member.id.toUpperCase(),name);
    const memberHeading=this.element('h2','',member.name,name);
    if(owner)memberHeading.setAttribute('aria-label',member.name);
    this.element('p','',member.id===model.member.id ? '当前出战成员' : '候选出战成员',name);
    name.dataset.memberPreview=member.id;name.setAttribute('role','status');name.setAttribute('aria-live','polite');
    if(owner)this.element('span','roster-role',roles[member.id],name);
    const action = this.element('section','shell-action-detail',undefined,owner?detail:name);
    if(owner){
      const iconName={sakura:'crosshair',kai:'sword',enjo:'hammer'}[member.id];
      for(const [parent,className] of [[portrait,'roster-role-emblem'],[action,'roster-action-visual']]){
        const visual=this.element('span',className,undefined,parent);
        visual.setAttribute('aria-hidden','true');
        const svg=this.doc.createElementNS('http://www.w3.org/2000/svg','svg');
        for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'24',height:'24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
        for(const [tag,attributes] of battleCommandIcons[iconName]){
          const node=this.doc.createElementNS('http://www.w3.org/2000/svg',tag);
          for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
          svg.append(node);
        }
        visual.append(svg);
      }
    }
    const actionCopy=owner?this.element('div','roster-action-copy',undefined,action):action;
    this.element('span','shell-eyebrow','专属行动',actionCopy);this.element('h3','',member.actionName,actionCopy);
    this.element('p','',member.actionSummary,actionCopy);
    const prepared=getPreparationSnapshot(loadPublicProfile(),member.id);
    const equipment=PUBLIC_EQUIPMENT.find(item=>item.id===prepared.equipmentId);
    const preparation=this.element('section','shell-member-preparation',undefined,main);
    preparation.dataset.performer=member.id;
    this.element('span','',`${member.name}的演出准备`,preparation);
    if(owner){
      const summary=this.element('strong','',undefined,preparation);
      this.element('span','roster-preparation-rank',`阶位 ${prepared.trainingLevel}`,summary);
      summary.append(' · ');
      this.element('span','roster-preparation-loadout',equipment?.name||'未装备配件',summary);
    }else this.element('strong','',`阶位 ${prepared.trainingLevel} · ${equipment?.name||'未装备配件'}`,preparation);
    this.button(preparation,'查看成员训练',()=>this.showPage('workshop'),{icon:'clapperboard',action:'member-training',lineIcon:owner});
    const dossier=getCharacterDossier(member.id);
    const story=this.element('section','shell-dossier',undefined,main);
    this.element('h3','',dossier.role,story);
    this.element('p','',dossier.motive,story);
    this.element('p','',dossier.relationship,story);
    this.element('blockquote','',dossier.quote,story);
    if(owner){
      const inspector=this.element('section','roster-inspector',undefined,detail);
      const tabs=this.element('div','roster-inspector-tabs',undefined,inspector);
      tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','成员资料');
      const definitions=[['ability','专属行动',action,'play'],['preparation','演出准备',preparation,'clapperboard'],['dossier','成员档案',story,'book-open']];
      const controls=[];
      const select=id=>{
        this.rosterPanel=id;
        for(const [key,,panel] of definitions){
          const tab=controls.find(node=>node.dataset.rosterTab===key),active=key===id;
          panel.hidden=!active;tab.setAttribute('aria-selected',String(active));tab.setAttribute('tabindex',active?'0':'-1');
        }
      };
      for(const [id,label,panel,icon] of definitions){
        const tab=this.button(tabs,label,()=>select(id),{className:'roster-inspector-tab',icon,lineIcon:true});
        tab.dataset.rosterTab=id;tab.id='roster-tab-'+id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','roster-panel-'+id);
        panel.id='roster-panel-'+id;panel.dataset.rosterPanel=id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
        tab.addEventListener('keydown',event=>{
          const index=definitions.findIndex(row=>row[0]===id),next=event.key==='Home'?0:event.key==='End'?definitions.length-1:event.key==='ArrowRight'?(index+1)%definitions.length:event.key==='ArrowLeft'?(index+definitions.length-1)%definitions.length:null;
          if(next===null)return;event.preventDefault();select(definitions[next][0]);controls[next].focus();
        });
        controls.push(tab);inspector.append(panel);
      }
      select(definitions.some(row=>row[0]===this.rosterPanel)?this.rosterPanel:'ability');
      portrait.append(name);
    }
    const readiness = this.element('div','shell-selection-context',undefined,main);
    this.element('span','',`本场公演 · ${model.chapter.name}`,readiness);
    this.element('span','',model.chapter.subtitle,readiness);
    const footer=this.element('footer','shell-selection-footer');
    if(owner){
      const context=this.element('div','roster-confirm-context',undefined,footer);
      this.element('span','',member.id===model.member.id?'当前出战':'待确认',context);
      this.element('strong','',member.name,context);
    }
    this.button(footer,`确认${member.name}出战`,()=>{
      const result=this.selection.confirmMember();
      if(result.selectedId===member.id) this.returnSelection(result);
    },{className:'shell-primary shell-confirm',icon:'check',action:'confirm-member'});
  }
  tour(main, model) {
    if(isUserCastEnabled()){main.dataset.tourLayout='venue';main.dataset.tourPresentation='program';}
    const heading=this.element('div','shell-tour-heading',undefined,main);
    this.element('h2','shell-page-heading','巡演路线',heading);
    this.element('span','',model.completed ? '全程已通关' : `已通关 ${model.clearedCount} / ${model.chapters.length}`,heading);
    const sequence=isUserCastEnabled()?this.element('section','tour-stop-sequence',undefined,main):main;
    if(isUserCastEnabled())sequence.setAttribute('aria-label','巡演章节顺序');
    for(const chapter of model.chapters) {
      const selected=chapter.id===this.selection.chapterId;
      const row=this.button(sequence,`${chapter.name}，${!chapter.unlocked ? '未解锁' : chapter.cleared ? '已通关' : '可挑战'}`,()=>{
        if(!this.root.contains(main))return;
        if(this.selection.previewChapter(chapter.id)){
          if(isUserCastEnabled())this.journeyDetails=true;
          this.render(`[data-chapter="${chapter.id}"]`);
        }
      },{className:'shell-chapter-option'});
      row.dataset.chapter=chapter.id;row.setAttribute('aria-pressed',String(selected));row.disabled=!chapter.unlocked;
      row.dataset.state=!chapter.unlocked?'locked':chapter.cleared?'cleared':'available';
      row.replaceChildren();
      const preview=this.map(row,chapter,'shell-route-preview',true);preview.setAttribute('aria-hidden','true');
      this.element('span','shell-chapter-number',`0${chapter.ordinal}`,row);
      const copy=this.element('span','shell-chapter-copy',undefined,row);
      this.element('strong','',chapter.name,copy);
      this.element('span','',chapter.subtitle,copy);
      const state=!chapter.unlocked ? `通关${model.chapters[chapter.ordinal-2].name}后开放`
        : chapter.cleared ? '已通关 · 可再演' : '可挑战';
      this.element('small','shell-chapter-state',state,copy);
      if(isUserCastEnabled()){row.setAttribute('aria-label',`${chapter.name}，${state}`);row.title=state;}
      this.icon(!chapter.unlocked ? 'lock' : selected ? 'check' : 'arrow-right',row,isUserCastEnabled());
      row.style.setProperty('--chapter-accent',hex(chapter.accent));
    }
    const chapter=model.chapters.find(c=>c.id===this.selection.chapterId) || model.chapter;
    let archive=main;
    if(isUserCastEnabled()){
      const venue=this.element('section','tour-selected-venue',undefined,main);venue.dataset.tourSelected=chapter.id;
      this.map(venue,chapter,'shell-main-map tour-venue-stage');
      const caption=this.element('div','tour-venue-caption',undefined,venue);
      this.element('small','',`第 ${chapter.ordinal} 站 / ${model.chapters.length}`,caption);
      this.element('h2','',chapter.name,caption);this.element('p','',chapter.subtitle,caption);
      this.element('p','tour-story-title','序幕 · '+getChapterContent(chapter.id).story.title,caption);
      const pacing=getPublicChapterPacing(chapter.id),review=getPublicTourReview(loadPublicProfile(),model.member.id);
      const route=this.element('section','tour-chapter-plan',undefined,main);route.dataset.pacingChapter=chapter.id;
      const ticket=this.element('div','tour-plan-ticket',undefined,route);
      this.element('h3','',`${chapter.name} · 推进路线`,ticket);
      const steps=this.element('ol','',undefined,ticket);for(const step of pacing.steps)this.element('li','',step,steps);
      this.element('p','tour-primary-objective',pacing.objective,route);
      archive=this.element('details','tour-dossier',undefined,main);archive.dataset.tourDisclosure='true';archive.open=false;
      this.element('summary','','现场情报与通关收获',archive);
      this.element('p','tour-pressure',pacing.pressure,archive);
      if(review?.completed)this.element('p','tour-complete-note','本轮巡演已通关，可重看章节故事或再演已开放的场地。个人目标不追加奖励或改变敌人。',route);
    }
    if(chapter.unlocked) {
      const record=getPublicPerformanceRecord(loadPublicProfile(),chapter.id,model.member.id,isUserCastEnabled()?PUBLIC_RULESET_ID:null);
      const section=this.element('section','shell-performance-record',undefined,archive);
      section.dataset.recordChapter=chapter.id;section.dataset.recordMember=model.member.id;
      this.element('strong','',`${model.member.name} · ${chapter.name}个人纪录`,section);
      if(record) {
        this.element('p','',`最快 ${formatPerformanceTime(record.bestTime.durationMs)} · 最少受击 ${record.bestHits.hitCount} 次`,section);
        this.element('small','',record.bestHits.hitCount===0?'无伤通关已达成 · 复演挑战个人用时':'复演目标 · 减少受击，争取无伤通关',section);
      } else this.element('p','',chapter.cleared?'本成员尚无实测纪录 · 再演建立个人成绩':'首次通关，建立个人成绩',section);
    }
    const reward=this.element('section','shell-tour-reward',undefined,archive);reward.dataset.rewardChapter=chapter.id;
    this.element('strong','',`通关收获 · 练习笔记 +${getChapterRewardPreview(loadPublicProfile(),chapter.id,model.member.id).notes}`,reward);
    const equipment=PUBLIC_EQUIPMENT.find(item=>item.chapterId===chapter.id);
    if(!chapter.cleared&&equipment)this.element('p','',`首通解锁 · ${equipment.name}`,reward);
    if(!chapter.cleared&&equipment)this.element('small','',equipment.description,reward);
    this.element('p','shell-selection-context',`本场成员 · ${model.member.name} / ${model.member.actionName}`,main);
    const footer=this.element('footer','shell-selection-footer');
    if(isUserCastEnabled()){
      if(this.tourMessage){const status=this.element('p','shell-save-notice',this.tourMessage,main);status.setAttribute('role','status');}
      this.button(main,'确认场地并选择目标',()=>{
        if(!this.root.contains(main))return;
        const result=this.selection.confirmChapter();
        if(!result||result.persisted!==true||result.hasPendingSave){
          this.tourMessage='场地未能保存或已不可用，请先核对存档与巡演进度。';this.selection=new PublicShellSelection();this.render();return;
        }
        this.tourMessage='';
        if(this.options.onGoals)this.navigate(this.options.onGoals);
        else this.showPage('goals');
      },{className:'shell-tour-goals',icon:'check',action:'chapter-goals',lineIcon:isUserCastEnabled()});
    }
    this.button(footer,isUserCastEnabled()?'确认场地并查看准备':`前往${chapter.name}`,()=>{
      if(!this.root.contains(main))return;
      const result=this.selection.confirmChapter();
      if(isUserCastEnabled()&&(!result||result.persisted!==true||result.hasPendingSave)){
        this.tourMessage='场地未能保存或已不可用，请先核对存档与巡演进度。';this.selection=new PublicShellSelection();this.render('[data-action=confirm-chapter]');return;
      }
      this.tourMessage='';
      if(result){if(isUserCastEnabled())this.showPage('preflight');else this.returnSelection(result);}
      else {this.selection=new PublicShellSelection();this.render();}
    },{className:'shell-primary shell-confirm',icon:'arrow-right',action:'confirm-chapter',lineIcon:isUserCastEnabled()});
  }
  workshop(main,model,trainingPortrait=null) {
    const profile=loadPublicProfile(), member=getPublicPerformer(this.selection.memberId);
    this.element('h2','shell-page-heading','成员训练计划',main);
    const equipmentInventory=getPublicEquipmentInventory(profile,member.id),prepared=equipmentInventory.preparation,rank=prepared.trainingLevel;
    const strip=this.element('div','shell-member-strip',undefined,main);
    strip.setAttribute('role','group');strip.setAttribute('aria-label','训练成员');
    for(const candidate of PUBLIC_PERFORMERS) {
      const button=this.button(strip,candidate.name,()=>{
        this.selection.previewMember(candidate.id);this.workshopMessage='';this.render(`[data-member="${candidate.id}"]`);
      },{className:'shell-member-option'});
      button.dataset.member=candidate.id;button.setAttribute('aria-pressed',String(candidate.id===member.id));
      button.replaceChildren();
      if(isUserCastEnabled()){
        const image=this.element('img','training-headshot',undefined,button);
        setMemberPickerAvatar(image,candidate.id);
      }else this.mark(button,candidate);
      this.element('span','',candidate.name,button);
    }
    const current=member.id===model.member.id;
    const identity=this.element('section','workshop-member-context',undefined,main);
    identity.dataset.performer=member.id;identity.dataset.selection=current?'current':'candidate';
    if(isUserCastEnabled()){
      const stage=this.element('div','workshop-portrait-stage',undefined,identity);
      if(trainingPortrait)stage.append(trainingPortrait);
      else this.mark(stage,member,true,{animate:true});
    }else this.mark(identity,member);
    const identityCopy=this.element('div',isUserCastEnabled()?'workshop-member-copy':'',undefined,identity);
    this.element('small','',current?'当前出战':'候选准备 · 尚未出战',identityCopy);
    this.element('strong','',isUserCastEnabled()?member.name:`${member.name} · ${member.actionName}`,identityCopy);
    if(isUserCastEnabled()){
      this.element('span','workshop-member-action',member.actionName,identityCopy);
      this.element('span','workshop-member-role',{sakura:'远程 · 连续扫射',kai:'近战 · 突进',enjo:'近身 · 范围魔法'}[member.id],identityCopy);
    }
    const training=this.element('section','workshop-training',undefined,main);
    training.dataset.performer=member.id;
    training.dataset.trainingPrimary='true';
    this.element('h2','',`训练阶位 ${rank}`,training);
    const cost=getTrainingCost(rank);
    if(isUserCastEnabled()){
      const track=this.element('ol','workshop-rank-track',undefined,training);
      track.setAttribute('aria-label','训练阶位进度');
      for(let level=1;;level++){
        const step=this.element('li','',undefined,track);
        step.dataset.trainingRank=String(level);
        step.dataset.state=level<rank?'complete':level===rank?'current':level===rank+1?'next':'locked';
        if(level===rank)step.setAttribute('aria-current','step');
        this.element('b','',String(level).padStart(2,'0'),step);
        this.element('span','',level<rank?'已完成':level===rank?'当前阶位':level===rank+1?'下一阶位':'待训练',step);
        if(getTrainingCost(level)===null)break;
      }
      const power=snapshot=>`+${Math.round((getPreparationEffects(snapshot,member.id).actionPower-1)*1000)/10}%`;
      const effects=this.element('dl','workshop-effects',undefined,training);
      for(const[key,label,value]of [
        ['current','当前涂染增益',power(prepared)],
        ['next','下阶涂染增益',cost===null?'已满阶':power({...prepared,trainingLevel:rank+1})],
        ['cost','本次消耗',cost===null?'无需消耗':`${cost} 练习笔记`],
      ]){const row=this.element('div','',undefined,effects);row.dataset.trainingEffect=key;this.element('dt','',label,row);this.element('dd','',value,row);}
    }else this.element('p','',`主动行动涂染威力 +${(rank-1)*10}%`,training);
    const train=this.button(training,cost===null?'训练已完成':`训练至阶位 ${rank+1}`,()=>{
      this.preparationFeedback(trainPublicPerformer(member.id,rank),'train');
    },{className:'shell-primary',icon:'clapperboard',action:'train'});
    train.querySelector('span').className='workshop-train-command';
    if(cost!==null){
      this.element('span','workshop-train-cost',`${cost} 练习笔记`,train);
      train.setAttribute('aria-label',`训练至阶位 ${rank+1} · ${cost} 练习笔记`);
    }
    train.disabled=cost===null||model.resources.balance<cost||!model.persisted;
    if(cost!==null&&model.resources.balance<cost)this.element('small','workshop-muted',`还需 ${cost-model.resources.balance} 练习笔记`,training);
    const wallet=this.element('section','workshop-wallet',undefined,main);
    this.element('span','','练习笔记',wallet);
    const balance=this.element('strong','',String(model.resources.balance),wallet);balance.dataset.resource='notes';
    this.element('small','','通关 +3 · 首次解锁章节配件额外 +3',wallet);
    this.button(main,'成长资料',()=>this.showPage('growth'),{icon:'book-open',action:'training-catalog'});
    this.renderRetiredTrainingRecovery(main,profile);
    const inventory=this.element('section','workshop-inventory',undefined,main);
    this.element('h2','','演出配件',inventory);
    const equipped=equipmentInventory.equippedItem;
    this.element('p','workshop-muted',`${member.name}装备：${equipped?.name||'无'} · 1 个配件位`,inventory);
    for(const item of equipmentInventory.compatibleItems) {
      const active=item.equipped,unlocked=item.owned;
      const row=this.button(inventory,item.name,()=>this.preparationFeedback(equipPublicPerformer(member.id,active?null:item.id),`equipment-${item.id}`),
        {className:'workshop-equipment'});
      row.dataset.equipment=item.id;row.setAttribute('aria-pressed',String(active));row.disabled=!unlocked||!model.persisted;
      row.dataset.state=!unlocked?'locked':active?'equipped':'available';
      row.replaceChildren();this.icon(!unlocked?'lock':active?'check':'settings-2',row);
      const copy=this.element('span','workshop-item-copy',undefined,row);
      this.element('strong','',item.name,copy);this.element('span','',item.description,copy);
      this.element('small','workshop-equipment-state',!unlocked?item.unlock:active?'已装备':item.performerId?item.ownerName+'专用 · 可装备':'可装备',copy);
    }
    const pendingSave=model.hasPendingSave||model.attempts>0;
    const saveNotice=model.persisted?'训练与装备保存在本机。'
      :model.recovery?'原档已保留，恢复存档前训练与装备暂不可用。'
      :pendingSave?'记录尚未保存，训练与装备暂不可用。':'尚无已保存的训练或装备记录。';
    const notice=this.element('p','workshop-status',this.workshopMessage||saveNotice,main);
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    if(!model.persisted&&pendingSave&&!model.recovery)this.button(main,'重试保存',()=>{
      const saved=retryPublicProfileSave();
      this.workshopMessage=saved.persisted?'记录已保存在本机，可继续训练或装备。'
        :saved.attempts===0&&!saved.hasPendingSave?'本机存档已被移除，未恢复旧记录。':'仍未能保存，请保留本页，恢复存储空间或权限后重试。';
      this.render(saved.persisted?'[data-action=train]':'[data-action=retry-save]');
    },{className:'shell-primary',icon:'check',action:'retry-save'});
    const footer=this.element('footer','shell-selection-footer shell-preparation-footer');
    this.element('p','',`${model.chapter.name} · ${member.name} · 阶位 ${rank}`,footer);
    if(isUserCastEnabled())footer.append(train);
    footer.append(notice);
    const parent=this.pageHistory.at(-1)||this.returnPage||getPublicShellRoute(this.page)?.parentId;
    this.button(footer,current?(parent?`返回${PAGE_NAMES[parent]}`:'返回主界面'):`确认${member.name}出战`,()=>{
      if(current){this.backPage();return;}
      const result=this.selection.confirmMember();
      if(!result.persisted||result.selectedId!==member.id){
        this.workshopMessage='出战成员未能保存，未切换页面。';this.render('[data-action=confirm-preparation]');return;
      }
      this.returnSelection(result);
    },{className:'shell-primary',icon:current?'arrow-left':'check',action:'confirm-preparation'});
  }
  preparationFeedback(result,focus) {
    const equipmentSheet=this.page==='workshop'&&focus.startsWith('equipment-')&&isUserCastEnabled();
    // Same-member training and equipment update controls without restarting its live renderer.
    const trainingPortrait=this.page==='workshop'&&isUserCastEnabled()?this.root.querySelector('.workshop-portrait-stage').children[0]:null;
    this.workshopMessage={trained:'训练已保存，下次出战生效。',equipped:'装备配置已保存，下次出战生效。',
      'storage-error':'保存失败，材料和装备保持原样。','save-required':'记录尚未保存，未扣除材料。',
      stale:'训练状态已更新，请确认当前阶位。',insufficient:'练习笔记不足。','max-level':'训练已完成。',
      incompatible:'此配件不能由当前成员装备。',locked:'配件尚未解锁。',unchanged:'装备未改变。',invalid:'未找到该成员。'}[result.preparationStatus]||'配置未改变。';
    const selector=focus==='train'?'[data-action=train]':`[data-equipment="${focus.slice(10)}"]`;
    this.render(equipmentSheet?undefined:selector,trainingPortrait);
    if(equipmentSheet){
      const content=this.root.querySelector('.workshop-inventory');
      const status=this.element('p','workshop-equipment-feedback',this.workshopMessage,content);
      status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      status.id='workshop-equipment-result';
      content.insertBefore(status,content.children[1]);
      const sheet=openHierarchySheet(this,{title:'演出配件',content,trigger:this.root.querySelector('[data-action=workshop-sheet-equipment]')});
      const item=sheet.querySelector(selector);
      const target=item.disabled?sheet.querySelector('[data-action=sheet-close]'):item;
      target.setAttribute('aria-describedby',status.id);
      target.focus();
      target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    }
  }
  navigation() {
    if(isUserCastEnabled())return renderHierarchyNavigation(this,PUBLIC_SHELL_ROOTS,this.page,getPublicShellRootId);
    const nav=this.element('nav','shell-navigation');nav.setAttribute('aria-label','公演导航');
    for(const {id:page,navigation:{label,icon}} of PUBLIC_SHELL_ROOTS) {
      const button=this.button(nav,label,()=>this.openRoot(page),{nav:page,icon,lineIcon:isUserCastEnabled()});
      if(isUserCastEnabled()&&page==='roster'){button.dataset.action='choose-member';button.title='更换成员';}
      if(page===this.page){button.setAttribute('aria-current','page');button.disabled=true;}
      else if(page===getPublicShellRootId(this.page))button.setAttribute('aria-current','location');
      if(isUserCastEnabled()&&this.page==='desk')mountHomeConceptArt(this,button,`nav-${page}`);
    }
  }
  destroy() {
    if(this.disposed)return;
    this.hierarchySheetDispose?.();
    this.disposed=true;this.pendingMotion=null;
    this.journeyFocusDispose?.();this.journeyFocusDispose=null;
    this.portraitInteractionDispose?.();this.portraitInteractionDispose=null;
    this.homePortraitDispose?.();this.homePortraitDispose=null;
    this.homeSceneDispose?.();this.homeSceneDispose=null;
    this.menuPortraitDispose?.();this.menuPortraitDispose=null;
    this.pageHistory=[];this.pageSnapshots.clear();
    this.root.remove();
    globalThis.window?.removeEventListener?.('storage',this.storageChanged);
    if(this.host)this.host.style.touchAction=this.previousTouchAction;
    if(this.scene.input)this.scene.input.enabled=this.previousInput;
  }
}
