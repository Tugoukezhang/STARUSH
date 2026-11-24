import {getActiveUserCastArt} from '../utils/userCast.mjs';
import {openHierarchySheet} from './HierarchySheets.mjs';
import {compactSecondaryPage,compactTrainingPage} from './SecondaryMenuHierarchy.mjs';
import {framePlayModes,frameRunGoals} from './ProgramMenuPages.mjs';
import {mountTourJourney} from './TourJourneyView.mjs';
import {compactChallengeMenu} from './ChallengeMenu262.mjs';

// Owner menu hierarchy: four first-level roots; everything else is second level.
// Compaction only re-parents nodes already rendered (and wired) by the page functions.
// It never creates commands that write saves; sheets borrow the original controls.
export const OWNER_ROOTS=Object.freeze(['desk','roster','tour','inventory']);
const ROOT_ICONS=Object.freeze({desk:'home',roster:'member',tour:'tour',inventory:'bag'});
const ARCHIVE_PAGES=new Set(['records','chapterArchive']);

export function ownerRootFor(page,rootIdOf) {
  const root=rootIdOf(page);
  return ARCHIVE_PAGES.has(page)||root==='records'?'tour':root;
}

export function renderHierarchyNavigation(view,roots,page,rootIdOf) {
  const nav=view.element('nav','shell-navigation ui-root-nav');nav.setAttribute('aria-label','公演导航');
  const active=ownerRootFor(page,rootIdOf);
  for(const {id,navigation:{label,icon}} of roots.filter(row=>OWNER_ROOTS.includes(row.id))){
    const button=view.button(nav,label,()=>view.openRoot(id),{className:'ui-nav-root',nav:id,icon,lineIcon:true,iconOnly:true});
    button.dataset.uiIcon=ROOT_ICONS[id];
    if(id==='roster')button.dataset.action='choose-member';
    if(id===page){button.setAttribute('aria-current','page');button.disabled=true;}
    else if(id===active)button.setAttribute('aria-current','location');
  }
  return nav;
}

const hide=(...nodes)=>{for(const node of nodes)if(node)node.hidden=true;};
const srOnly=node=>node?.classList.add('ui-sr-label');

function iconCommand(view,parent,label,uiIcon,callback,{action,className=''}={}) {
  const button=view.button(parent,label,callback,{className:`ui-icon-command ${className}`.trim(),action,iconOnly:true});
  button.dataset.uiIcon=uiIcon;
  view.element('span','ui-sr-label',label,button);
  return button;
}

function sheetTool(view,parent,label,uiIcon,content,{action,className,before}={}) {
  const button=iconCommand(view,parent,label,uiIcon,()=>{
    before?.();
    openHierarchySheet(view,{title:label,content,trigger:button});
  },{action,className});
  return button;
}

function holder(view,parent,name) {
  const box=view.element('div','ui-sheet-holder',undefined,parent);
  box.hidden=true;box.dataset.holder=name;return box;
}

function actorSwitch(view,parent,strip,box) {
  box.append(strip);
  return sheetTool(view,parent,'切换成员','switch',strip,{action:'actor-switch',className:'ui-actor-switch'});
}

function roster(view,main) {
  const box=holder(view,main,'roster'),stage=main.querySelector('.roster-portrait-stage');
  hide(stage.querySelector('.roster-stage-stamp'),stage.querySelector('.roster-role-emblem'),main.querySelector('.roster-action-visual'),
    main.querySelector('.shell-selection-context'),view.root.querySelector('.roster-confirm-context'));
  const identity=stage.querySelector('.roster-stage-identity');
  identity.classList.add('ui-footer-caption');
  identity.querySelector('h2').dataset.uiLetter=view.selection.memberId;
  srOnly(identity.querySelector('p'));
  // Utility lane above the figure: no control lands on hands, tail or weapon of any actor.
  const lane=view.element('div','ui-roster-lane',undefined,stage);
  actorSwitch(view,lane,main.querySelector('.shell-member-strip'),box);
  const inspector=main.querySelector('.roster-inspector');box.append(inspector);
  hide(inspector.querySelector('.roster-inspector-tabs'));
  const tools=view.element('div','ui-roster-actions',undefined,lane);
  tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','成员资料');
  for(const [id,uiIcon] of [['ability','skill'],['dossier','info']]){
    const tab=inspector.querySelector(`[data-roster-tab=${id}]`),panel=inspector.querySelector(`[data-roster-panel=${id}]`);
    // Clicking the hidden original tab keeps view.rosterPanel and the tab/panel state authoritative.
    sheetTool(view,tools,tab.getAttribute('aria-label'),uiIcon,panel,{action:`roster-sheet-${id}`,before:()=>tab.click()});
  }
  const training=inspector.querySelector('[data-action=member-training]');
  training.dataset.uiIcon='train';training.dataset.uiWidget='true';training.dataset.action='roster-sheet-preparation';
  training.setAttribute('aria-label','成员训练与配件');training.title='成员训练与配件';
  training.classList.add('ui-icon-command');srOnly(training.querySelector('span'));tools.insertBefore(training,tools.children[0]);
  const confirm=view.root.querySelector('[data-action=confirm-member]');
  confirm.dataset.uiLetter='confirm';confirm.classList.add('ui-confirm');
  // Name captions the deploy command instead of the stage's lower-left, where blades reach.
  confirm.parentNode.insertBefore(identity,confirm);
  if(main.querySelector('.shell-performer-detail').dataset.selection==='current'){
    delete confirm.dataset.uiLetter;confirm.dataset.uiIcon='selected';confirm.dataset.current='true';
    for(const child of confirm.children)srOnly(child);
    confirm.setAttribute('aria-label','当前已出战，返回');confirm.title='当前已出战，返回';
    confirm.hidden=true;
    view.element('span','ui-current-deploy','当前出战',confirm.parentNode);
  }
  for(const button of tools.children)button.dataset.uiWidget='true';
  lane.querySelector('[data-action=actor-switch]').dataset.uiWidget='true';
  main.dataset.memberStudio='roster';
  const role={sakura:'rifle',kai:'sword',enjo:'hammer'}[view.selection.memberId];
  const ability=tools.querySelector('[data-action=roster-sheet-ability]');
  const glyph=view.element('img','ui-glyph member-profession-glyph',undefined,ability);
  glyph.src=getActiveUserCastArt(view.selection.memberId)?.weaponIcon||'art/member-studio-20261101/role-'+role+'.webp';glyph.alt='';glyph.draggable=false;glyph.setAttribute('aria-hidden','true');
  const profession=view.element('img','member-profession-caption',undefined,identity);
  profession.src=glyph.src;profession.alt='';profession.draggable=false;identity.insertBefore(profession,identity.children[0]);
}

function tour(view,main,model) {
  const box=holder(view,main,'tour');
  hide(main.querySelector('.shell-tour-heading'),main.querySelector('p.shell-selection-context'));
  const venue=main.querySelector('.tour-selected-venue');
  venue.classList.add('ui-tour-map');
  const caption=venue.querySelector('.tour-venue-caption');
  caption.querySelector('h2').dataset.uiLetter='chapter-'+view.selection.chapterId;
  hide(caption.querySelector('.tour-story-title'));
  const sequence=main.querySelector('.tour-stop-sequence');sequence.classList.add('ui-chapter-tabs');
  for(const row of main.querySelectorAll('.shell-chapter-option')){
    hide(row.querySelector('.shell-route-preview'),row.querySelector('svg'));
    row.querySelector('.shell-chapter-number').hidden=false;
    const copy=row.querySelector('.shell-chapter-copy');
    copy.querySelector('strong').dataset.uiLetter=`chapter-${row.dataset.chapter}`;
    // Subtitle is prose; name + real state stay, and the row's aria-label carries both.
    for(const child of copy.children)if(child.tagName==='SPAN')child.hidden=true;
  }
  const detail=view.element('div','ui-tour-detail',undefined,box);
  for(const node of [main.querySelector('.tour-chapter-plan'),main.querySelector('.tour-dossier'),main.querySelector('[data-action=chapter-goals]')])
    if(node)detail.append(node);
  const tools=view.element('div','ui-tour-tools',undefined,main);
  tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','巡演资料');
  sheetTool(view,tools,'路线与收获','route',detail,{action:'tour-sheet-route'});
  const session=view.scene._sessionExperience;
  const story=iconCommand(view,tools,'巡演手记','info',()=>session.showStoryJournal(),{action:'tour-story'});
  story.disabled=typeof session?.showStoryJournal!=='function';
  iconCommand(view,tools,'演出档案','archive',()=>view.showPage('records'),{action:'tour-records'});
  iconCommand(view,tools,'压轴排练','rehearsal',()=>view.showPage('playhub'),{action:'tour-modes'});
  const confirm=view.root.querySelector('[data-action=confirm-chapter]');
  confirm.dataset.uiLetter='tour-confirm';confirm.classList.add('ui-confirm');
  for(const button of tools.children)button.dataset.uiWidget='true';
  const progress=view.element('p','ui-tour-progress',`已通关 ${model.clearedCount} / ${model.chapters.length} 站`,main);
  main.insertBefore(progress,sequence);
  mountTourJourney(view,main,model);
}

function workshop(view,main) {
  compactTrainingPage(view,main);
  for(const[key,selector]of [['current','[data-training-effect=current]'],['next','[data-training-effect=next]'],['notes','.workshop-wallet']]){
    const row=main.querySelector(selector),host=key==='notes'?row.querySelector('span'):row.querySelector('dt'),label=host.textContent;
    host.replaceChildren();view.element('span','ui-sr-label',label,host);
    const art=view.element('img','member-studio-letter',undefined,host);art.src='art/member-studio-20261101/letter-'+key+'.webp';art.alt='';art.draggable=false;art.setAttribute('aria-hidden','true');
    if(key!=='notes')view.element('span','member-effect-caption','涂染增益',host);
  }
  const train=view.root.querySelector('[data-action=train]');
  if(train.dataset.trainingBlocked!=='complete')train.dataset.secondaryLetter='train';
}

function lounge(view,main) {
  const screen=main.querySelector('.product-module-screen'),scene=screen.querySelector('.pm-scene');
  const box=holder(view,screen,'lounge');
  // Close view: the frame's thigh line meets the dialogue band instead of an ankle crop.
  scene.dataset.portraitFrame='thigh-up';
  srOnly(view.root.querySelector('h1'));
  hide(scene.querySelector('.pm-scene-copy'),scene.querySelector('.pm-scene-caption'),screen.querySelector('.pm-footer'));
  const strip=screen.querySelector('.pm-cast-strip'),toggle=actorSwitch(view,screen,strip,box);
  toggle.dataset.uiWidget='true';
  toggle.disabled=[...strip.children].every(button=>button.disabled);
  // Topics carry the B265 wordmark/glyph keys; the older ui-icon skin and line svg would double-decorate them.
  for(const button of screen.querySelectorAll('.pm-topic')){
    hide(...button.querySelectorAll('svg'));srOnly(button.querySelector('span'));
  }
  screen.querySelector('.pm-question-back').dataset.uiIcon='back';
  const panel=screen.querySelector('.pm-companion-record');
  holder(view,screen,'lounge-record').append(panel);
  // The drawer borrows the panel node that the lounge refreshes after each accepted reply.
  const recordTool=view.button(screen,'相处记录',()=>openHierarchySheet(view,{title:'相处记录',content:panel,trigger:recordTool}),
    {className:'pm-record-tool',action:'companion-record',iconOnly:true});
  view.element('span','ui-sr-label','相处记录',recordTool);recordTool.dataset.companionLetter='record';
}

// B268 console studio: the desk scene is the screen. Events/practice are the two illustrated preparation rows,
// members/services two compact equal utilities. Lounge/venue stay hidden here (home reaches them directly).
// The original wired buttons are re-parented, never recreated; static labels/glyphs are Codex art hosts.
function backstage(view,main) {
  const screen=main.querySelector('.product-module-screen');
  screen.dataset.consoleStudio='268';screen.dataset.consolePage='backstage';
  hide(screen.querySelector('.pm-scene'),screen.querySelector('.pm-directory'),screen.querySelector('.pm-footer'));
  const desk=view.element('img','cs-desk',undefined,null);
  desk.src='art/console-studio-20261102/desk.webp';desk.alt='';desk.draggable=false;desk.setAttribute('aria-hidden','true');
  screen.insertBefore(desk,screen.children[0]);
  const grid=screen.querySelector('.pm-shortcuts');grid.classList.add('ui-backstage-grid');
  for(const page of ['lounge','venue'])hide(grid.querySelector(`[data-category=${page}]`));
  const primary=view.element('div','cs-primary',undefined,grid),utility=view.element('div','cs-utility',undefined,grid);
  for(const [page,letter,icon]of [['events','events','program'],['sideplay','practice','practice'],['recruitment','members'],['services','services']]){
    const button=grid.querySelector(`[data-category=${page}]`);
    for(const svg of button.querySelectorAll('svg'))svg.remove();
    const copy=button.querySelector('.pm-entry-copy');
    copy.querySelector('strong').dataset.consoleLetter=letter;
    if(icon){
      const glyph=view.element('span','cs-glyph',undefined,null);glyph.dataset.consoleIcon=icon;glyph.setAttribute('aria-hidden','true');
      button.insertBefore(glyph,copy);primary.append(button);
    }else{copy.querySelector('small').remove();utility.append(button);}
  }
  screen.querySelector('.pm-ledger').classList.add('cs-readout');
}

function playhub(view,main) {
  framePlayModes(view,main);
  // Other catalog entries stay registered routes, reached from Member/Tour/Preflight.
  hide(main.querySelector('h2.shell-page-heading'),main.querySelector('p.system-context'),main.querySelector('.hub-categories'),...main.querySelectorAll('.system-hub-group'));
}

function goals(view,main) {
  frameRunGoals(view,main);
}

const PAGES={roster,tour,workshop,lounge,playhub,backstage,goals,finaleTrial:compactChallengeMenu,rehearsal:compactChallengeMenu};

export function compactHierarchyPage(view,main,model) {
  const compact=PAGES[view.page];
  // Growth/library/records are second-level routes with their own compactor.
  if(!compact)return compactSecondaryPage(view,main,model);
  hide(view.root.querySelector('.shell-session-context'));
  compact(view,main,model);
  main.dataset.hierarchy=view.page;
  return true;
}
