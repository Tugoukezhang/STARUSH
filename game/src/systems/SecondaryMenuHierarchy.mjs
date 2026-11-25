import {openHierarchySheet} from './HierarchySheets.mjs';
import {mountEquipmentIcon} from './EquipmentIconArt.mjs';

// Owner second-level routes: growth/library sit under Roster/Tour flows, records under Tour.
// Same contract as MenuHierarchy: only re-parent nodes the canonical renderers already built
// and wired. No new save-writing commands, no changes to growth/arrangement/preview state.
// Static labels get dataset.secondaryLetter hosts (Codex mounts art); numbers, costs, disabled
// reasons and status text stay native and visible.

const hide=(...nodes)=>{for(const node of nodes)if(node)node.hidden=true;};
const srOnly=node=>node?.classList.add('ui-sr-label');

function holder(view,parent,name) {
  const box=view.element('div','ui-sheet-holder',undefined,parent);
  box.hidden=true;box.dataset.holder=name;return box;
}

function toolbar(view,parent,className,label) {
  const tools=view.element('div',className,undefined,parent);
  tools.setAttribute('role','toolbar');tools.setAttribute('aria-label',label);
  return tools;
}

function sheetTool(view,parent,label,uiIcon,content,action,className='') {
  const button=view.button(parent,label,()=>openHierarchySheet(view,{title:label,content,trigger:button}),
    {className:`ui-icon-command ${className}`.trim(),action,iconOnly:true});
  button.dataset.uiIcon=uiIcon;button.dataset.uiWidget='true';
  view.element('span','ui-sr-label',label,button);
  return button;
}

function actorSwitch(view,tools,strip,box) {
  box.append(strip);
  return sheetTool(view,tools,'切换成员','switch',strip,'actor-switch','ui-actor-switch');
}

// Canonical button becomes icon-only; its handler, disabled state and aria-label are untouched.
function iconize(button,uiIcon) {
  button.dataset.uiIcon=uiIcon;button.classList.add('ui-icon-command');button.title=button.getAttribute('aria-label');
  for(const child of button.children)if(child.tagName==='SPAN')srOnly(child);
  return button;
}

// Stage (portrait/selection) first, then body (current plan); heading becomes the lettering host.
function frame(view,main,page) {
  const heading=main.querySelector('h2.shell-page-heading');
  const stage=view.element('section',`sec-${page}-stage`,undefined,null);stage.setAttribute('aria-label',heading.textContent);
  main.insertBefore(stage,heading);
  const body=view.element('div',`sec-${page}-body`,undefined,null);
  main.insertBefore(body,stage.nextSibling);
  heading.classList.add('sec-title');heading.dataset.secondaryLetter=page;stage.append(heading);
  return {stage,body,box:holder(view,main,page)};
}

function growth(view,main,model) {
  main.dataset.planningStudio='270';
  const {stage,body,box}=frame(view,main,'growth');
  const caption=main.querySelector('.growth-member');caption.classList.add('sec-growth-caption');stage.append(caption);
  const tools=toolbar(view,stage,'sec-growth-tools','成长工具');
  actorSwitch(view,tools,main.querySelector('.shell-member-strip'),box);
  // The rank group is the canonical selector; only its titled wrapper is retired.
  const ranks=main.querySelector('.growth-ranks'),rankPool=ranks.parentNode;
  ranks.classList.add('sec-growth-stages');stage.append(ranks);hide(rankPool);
  // Saved rank vs planned rank: the native state word becomes a style hook; aria-pressed stays the plan.
  // Steps are positions on one track (connector drawn in CSS), not a new level count.
  ranks.dataset.planningTrack='rank';
  ranks.querySelectorAll('[data-growth-rank]').forEach((rank,index)=>{
    rank.dataset.rankState={'当前':'current','已完成':'complete','规划':'plan'}[rank.querySelector('small').textContent];
    rank.dataset.rankStep=String(index+1);
  });
  const preview=main.querySelector('.growth-preview');preview.classList.add('sec-growth-compare');body.append(preview);
  const comparison=preview.querySelector('.growth-effects');
  const rows=[...comparison.children],unchanged=rows.filter(row=>row.children[1].textContent===row.children[2].textContent);
  if(unchanged.length){
    const more=view.element('details','growth-static-values',undefined,preview);
    view.element('summary','',unchanged.length===rows.length?'查看当前三项效果':'其余 '+unchanged.length+' 项效果不变',more);
    const values=view.element('dl','growth-effects',undefined,more);
    for(const row of unchanged)values.append(row);
  }
  for(const changed of comparison.children)changed.dataset.growthChange='true';
  const pool=main.querySelector('.growth-equipment-pool');srOnly(pool.querySelector('h2'));box.append(pool);
  // Choosing stays in the sheet; each option gains its registered identity art beside the native name.
  for(const option of pool.querySelectorAll('[data-growth-equipment]')){
    if(option.dataset.growthEquipment==='none')continue;
    const art=view.element('span','sec-growth-gear-art',undefined,null);option.insertBefore(art,option.children[0]||null);
    mountEquipmentIcon(view,art,option.dataset.growthEquipment);
  }
  const equipment=sheetTool(view,tools,'演出配件','equipment',pool,'growth-sheet-equipment');
  // The planned gear (the pressed option) is summarized on the first level and opens the same sheet.
  const chosen=pool.querySelector('[data-growth-equipment][aria-pressed=true]');
  if(chosen){
    const [name,effect,state]=[chosen.querySelector('strong'),...chosen.querySelectorAll('small')].map(node=>node.textContent);
    const gear=view.button(body,['演出配件：'+name,effect,state].filter(Boolean).join(' · '),
      ()=>openHierarchySheet(view,{title:equipment.getAttribute('aria-label'),content:pool,trigger:gear}),{className:'sec-growth-gear',action:'growth-gear'});
    gear.dataset.growthGear=chosen.dataset.growthEquipment;gear.dataset.gearState=chosen.dataset.equipmentState;
    gear.replaceChildren();
    mountEquipmentIcon(view,view.element('span','sec-growth-gear-art',undefined,gear),chosen.dataset.growthEquipment);
    const copy=view.element('span','sec-growth-gear-copy',undefined,gear);
    view.element('span','sec-growth-gear-kicker','演出配件',copy).dataset.planningLetter='equipment';
    view.element('strong','sec-growth-gear-name',name,copy);
    view.element('span','sec-growth-gear-effect',effect,copy);
    if(state)view.element('span','sec-growth-gear-state',state,gear);
  }
  // Cost line, blocked reason and (non-user-cast) apply/confirm rows stay in the application block.
  const application=main.querySelector('.growth-application');application.classList.add('sec-growth-plan');body.append(application);
  // The single required-cost line of the plan; the balance stays in the caption.
  application.querySelector('p.system-context').classList.add('sec-growth-cost');
  const blocked=application.querySelector('.workshop-muted');
  if(blocked){blocked.id='sec-growth-blocked';view.root.querySelector('[data-action=growth-apply]').setAttribute('aria-describedby',blocked.id);}
  const source=application.querySelector('.growth-source');
  if(source){
    const sources=view.element('div','sec-growth-sources',undefined,box);
    for(const node of [source,application.querySelector('.inventory-impact'),application.querySelector('[data-action=growth-source]')])
      if(node)sources.append(node);
    sheetTool(view,tools,'获取途径','route',sources,'growth-sheet-sources');
  }
  const info=view.element('div','sec-growth-info',undefined,box);
  view.element('p','',caption.textContent+' · '+(chosen?.querySelector('strong')?.textContent||'未装备'),info);
  info.append(main.querySelector('[data-action=growth-training]').parentNode);
  sheetTool(view,tools,'成长资料','info',info,'growth-sheet-info');
  view.root.querySelector('[data-action=growth-apply]').dataset.secondaryLetter='apply';
  // Confirm carries the real cost in its label, so it keeps native text; cancel is static.
  const cancel=view.root.querySelector('[data-action=growth-cancel]');
  if(cancel)cancel.dataset.secondaryLetter='cancel';
  // The renderer writes the confirmation sentence directly before the confirm row; it describes the confirm.
  const confirm=view.root.querySelector('[data-action=growth-confirm]');
  if(confirm){
    const row=confirm.parentNode,siblings=[...row.parentNode.children],sentence=siblings[siblings.indexOf(row)-1];
    sentence.classList.add('sec-growth-confirm-text');sentence.id='sec-growth-confirm-text';
    confirm.setAttribute('aria-describedby',sentence.id);
  }
  const preflight=view.root.querySelector('[data-action=prepared-preflight]');preflight.classList.add('sec-growth-preflight');
  preflight.dataset.deployment=view.selection.memberId===model.member.id?'current':'candidate';
  for(const child of preflight.children)srOnly(child);
  const sources=preflight.dataset.deployment==='candidate'?['art/hierarchy-ui-20261101/letters-confirm.webp','art/secondary-ui-20261101/letter-preflight.webp']:['art/secondary-ui-20261101/letter-preflight.webp'];
  for(const src of sources){const image=view.element('img','member-flow-letter',undefined,preflight);image.src=src;image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');}
}

function library(view,main,model) {
  main.dataset.planningStudio='270';
  const heading=main.querySelector('h2.shell-page-heading'),intro=heading.nextSibling;
  const {stage,body,box}=frame(view,main,'library');
  intro.classList.add('sec-library-caption');stage.append(intro);
  const tools=toolbar(view,stage,'sec-library-tools','编排资料');
  // Tabs already show each stage's selected choice: they are the two-part composition. The tab name
  // gains that native choice text ("第一段：…", or "需重选"), so state is announced, not only drawn.
  const tabs=main.querySelector('.library-stage-tabs');tabs.classList.add('sec-library-composition');stage.append(tabs);
  for(const tab of tabs.querySelectorAll('[data-library-stage]')){
    tab.querySelector('span').dataset.secondaryLetter=tab.dataset.libraryStage;
    tab.setAttribute('aria-label',tab.getAttribute('aria-label')+'：'+tab.querySelector('strong').textContent);
  }
  const stages=main.querySelector('.library-stages');body.append(stages);
  // Choices read as small art-over-name cells; each description stays in the canonical aria-label. The pressed
  // choice's own description is repeated once, visibly, under the row (aria-hidden: the button already says it).
  for(const panel of stages.querySelectorAll('.library-stage')){
    srOnly(panel.querySelector('h2'));
    const group=panel.querySelector('.arrangement-options');group.classList.add('sec-library-choices');
    group.dataset.planningChoices=String(group.querySelectorAll('[data-arrangement]').length);
    for(const description of group.querySelectorAll('small'))srOnly(description);
  }
  const studies=main.querySelector('.library-studies');srOnly(studies.querySelector('h2'));box.append(studies);
  const pair=[...tabs.querySelectorAll('strong')].map(choice=>choice.textContent).join(' ＋ ');
  const selection=view.element('p','menu-sheet-key','先选第一段，再选第二段 · '+pair,studies);studies.insertBefore(selection,studies.firstChild);
  sheetTool(view,tools,'搭配思路','skill',studies,'library-sheet-study');
  // Guide exists only for a valid preview; it is prose, so it lives in its own sheet.
  const guide=main.querySelector('.library-guide');
  if(guide){
    if(model.chapter){
    const place=view.element('figure','library-guide-place',undefined,guide);
    const venue=view.element('img','',undefined,place);venue.src='art/showbill/stop-'+model.chapter.id+'.webp';venue.alt='';
    view.element('figcaption','','当前场地 · '+model.chapter.name,place);
    guide.insertBefore(place,guide.querySelector('summary')?.nextSibling||guide.firstChild);
    }
    guide.open=true;box.append(guide);sheetTool(view,tools,'编排与场地说明','info',guide,'library-sheet-guide');}
  const preview=main.querySelector('.library-preview');srOnly(preview.querySelector('h2'));body.append(preview);
  // Unchosen rows ("未选择…", values untouched) move into a closed lower layer inside the same preview.
  // "pending" letter hosts have no bitmap yet, so their native text must stay visible until art is registered.
  const effects=preview.querySelector('.arrangement-effects');
  const idle=effects?[...effects.children].filter(row=>row.children[1].textContent.startsWith('未选择')):[];
  if(idle.length){
    const more=view.element('details','sec-library-idle',undefined,preview);
    const summary=view.element('summary','',undefined,more);summary.setAttribute('aria-label',`未选择效果 ${idle.length} 项`);
    view.element('span','','未选择效果',summary).dataset.planningLetterPending='idle';
    view.element('span','sec-library-idle-count',String(idle.length),summary);
    const list=view.element('dl','arrangement-effects sec-library-idle-list',undefined,more);
    for(const row of idle){row.dataset.secondaryIdle='true';list.append(row);}
  }
  // The shell header back is the page's return; the canonical return links stay wired but out of the strip.
  hide(view.root.querySelector('[data-action=library-preflight]').parentNode);
  view.root.querySelector('[data-action=plan-use]').dataset.secondaryLetter='preflight';
}

// Member training (reached from roster equipment / workshop). The canonical identity section is the
// stage (one portrait), the canonical training section is the panel: small rank, rank pips, current/next
// comparison, cost beside balance. Train/confirm/equip keep their own handlers; the shell header's back
// is the only back for the current member, so the footer duplicate is retired.
export function compactTrainingPage(view,main) {
  const box=holder(view,main,'workshop'),identity=main.querySelector('.workshop-member-context');
  const training=main.querySelector('.workshop-training');
  hide(main.querySelector('h2.shell-page-heading'));
  main.dataset.secondaryPage='workshop';
  identity.classList.add('sec-training-stage');training.classList.add('sec-training-body');
  const tools=toolbar(view,identity,'ui-workshop-tools','训练工具');
  actorSwitch(view,tools,main.querySelector('.shell-member-strip'),box);
  const inventory=main.querySelector('.workshop-inventory');box.append(inventory);
  srOnly(inventory.querySelector('h2'));
  for(const row of inventory.querySelectorAll('[data-equipment]')){
    row.children[0].hidden=true;
    const art=view.element('span','equipment-art-slot',undefined,row);mountEquipmentIcon(view,art,row.dataset.equipment);
    row.insertBefore(art,row.children[0]);
  }
  const locked=[...inventory.querySelectorAll('[data-equipment][data-state=locked]')];
  if(locked.length){
    const more=view.element('details','workshop-locked-gear',undefined,inventory);
    view.element('summary','','查看 '+locked.length+' 件未获得配件',more);
    for(const item of locked)more.append(item);
  }
  sheetTool(view,tools,'演出配件','equipment',inventory,'workshop-sheet-equipment');
  training.querySelector('h2').classList.add('sec-training-rank');
  // One required cost (the effects ledger row) and one owned balance (wallet); the command's cost span
  // is screen-reader only, its aria-label already carries the cost.
  const wallet=main.querySelector('.workshop-wallet');training.append(wallet);wallet.setAttribute('aria-label','持有练习笔记');
  const material=view.element('img','training-notes-icon',undefined,wallet);
  material.src='art/training-296/notes.webp';material.alt='';material.width=40;material.height=40;material.draggable=false;
  wallet.insertBefore(material,wallet.children[0]);
  // Where notes come from and the growth catalog are reference detail, not the training decision.
  const info=view.element('div','ui-workshop-info',undefined,box);
  const shortage=training.querySelector('small.workshop-muted');
  if(shortage){
    const balance=Number(wallet.querySelector('strong').textContent);
    const cost=Number(training.querySelector('[data-training-effect=cost]')?.querySelector('dd')?.textContent?.match(/\d+/)?.[0]);
    const runs=Number.isFinite(cost)?Math.ceil(Math.max(0,cost-balance)/3):0;
    view.element('p','menu-sheet-key',shortage.textContent+(runs?' · 再通关 '+runs+' 场即可付清本阶消耗':''),info);
  }
  info.append(wallet.querySelector('small'));
  const catalog=main.querySelector('[data-action=training-catalog]');
  catalog.dataset.secondaryLetter='growth';catalog.classList.add('sec-small-command');info.append(catalog);
  sheetTool(view,tools,'训练说明','info',info,'workshop-sheet-info');
  // Recovery offers and retry-save are real save commands: they stay on the first level.
  for(const node of [...main.children])if(node!==identity&&node!==training&&node!==box&&!node.hidden)training.append(node);
  const footer=view.root.querySelector('.shell-preparation-footer'),summary=footer.children[0];
  if(summary.tagName==='P'&&!summary.classList.contains('workshop-status'))summary.hidden=true;
  const train=view.root.querySelector('[data-action=train]'),notice=footer.querySelector('.workshop-status');
  delete train.dataset.uiIcon;srOnly(train.querySelector('.workshop-train-cost'));
  footer.dataset.trainingState='ready';
  if(!train.disabled)train.dataset.secondaryLetter='train';
  else{
    // Blocked: native label stays readable and the canonical reason sits directly under it.
    const short=training.querySelector('small.workshop-muted');
    const blocked=short?'insufficient':train.querySelector('.workshop-train-cost')?'unsaved':'complete';
    train.dataset.trainingBlocked=blocked;footer.dataset.trainingState=blocked;
    let reason=notice;
    if(blocked!=='unsaved'){
      reason=short||view.element('small','',train.getAttribute('aria-label'),null);
      reason.classList.add('sec-training-reason');footer.insertBefore(reason,train.nextSibling);
    }
    reason.id=`sec-training-${blocked}`;train.setAttribute('aria-describedby',reason.id);
  }
  training.dataset.trainingState=footer.dataset.trainingState;
  const exit=footer.querySelector('[data-action=confirm-preparation]');
  // Train is the footer's one primary; a candidate's deploy is a separate, explicitly tapped secondary.
  if(identity.dataset.selection==='current'){hide(exit);footer.dataset.commands='train';}
  else{exit.dataset.secondaryLetter='deploy';exit.classList.add('sec-training-deploy');footer.dataset.commands='train deploy';}
  return true;
}

function records(view,main) {
  const {stage,body,box}=frame(view,main,'records');
  main.dataset.archiveStudio='269';stage.querySelector('.sec-title').dataset.archiveLetter='records';
  for(const summary of main.querySelectorAll('p.archive-summary')){summary.classList.add('sec-records-caption');stage.append(summary);}
  const tools=toolbar(view,stage,'sec-records-tools','档案工具');
  actorSwitch(view,tools,main.querySelector('.shell-member-strip'),box);
  const list=main.querySelector('.archive-current-records');body.append(list);
  // Chapter log: rows read in route order; the index is the row's position, not new data.
  // Each ticket opens that chapter's field record read-only: no selection, no save.
  list.querySelectorAll('.archive-record').forEach((row,index)=>{
    row.dataset.recordIndex=String(index+1).padStart(2,'0');
    if(row.dataset.recordState==='empty'&&row.dataset.recordChapter!==view.selection.chapterId){
      row.dataset.recordCompact='true';
      row.querySelector('.archive-empty').hidden=true;
    }
    const open=view.button(row,'查阅',()=>{view.reportChapterId=row.dataset.recordChapter;view.showPage('chapterArchive');},
      {className:'sec-records-open',action:'records-open-chapter-'+row.dataset.recordChapter});
    open.dataset.recordOpen=row.dataset.recordChapter;
    open.setAttribute('aria-label',`查阅${row.querySelector('h2').textContent}章节现场`);
    open.title=open.getAttribute('aria-label');
  });
  // History is moved, never dropped; each chapter's block keeps the chapter name it belonged to.
  const info=view.element('div','sec-records-info',undefined,box);
  const overview=main.querySelector('.archive-overview');
  const measured=[...list.querySelectorAll('.archive-record')].filter(row=>row.dataset.recordState==='measured');
  view.element('p','menu-sheet-key',measured.length?'已有实测成绩 · '+measured.map(row=>row.querySelector('h2').textContent).join('、'):'此成员尚无实测成绩。完成一场公演后可在这里查阅用时和受击次数。',info);
  info.append(overview);
  info.append(main.querySelector('.archive-rules-label'));
  for(const row of list.querySelectorAll('.archive-record')){
    const history=row.querySelector('.archive-history');
    if(!history)continue;
    const section=view.element('section','sec-records-history',undefined,info);
    view.element('h3','',row.querySelector('h2').textContent,section);section.append(history);
  }
  const last=main.querySelector('.archive-last-run');
  if(last)info.append(last);
  sheetTool(view,tools,'档案详情','info',info,'records-sheet-info');
  const chapters=iconize(main.querySelector('[data-action=archive-chapters]'),'route');chapters.dataset.uiWidget='true';tools.append(chapters);
}

const SECONDARY_PAGES={growth,library,records};

export function compactSecondaryPage(view,main,model) {
  const compact=SECONDARY_PAGES[view.page];
  if(!compact)return false;
  hide(view.root.querySelector('.shell-session-context'));
  compact(view,main,model);
  main.dataset.secondaryPage=view.page;
  return true;
}
