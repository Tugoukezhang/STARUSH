import {loadPublicProfile,getRunChoice} from '../utils/publicRunProgression.mjs';
import {UI_CAST as PUBLIC_PERFORMERS,isUserCastEnabled} from '../utils/userCast.mjs';
import {getPreparationCatalog} from '../utils/publicPreparationCatalog.mjs';
import {capturePublicRunGoal,getPublicRunGoalOptions,selectPublicRunGoal,describePublicRunGoal,getArrangementCatalog,previewPublicArrangement} from '../utils/publicRunGoals.mjs';
import {getUiPerformerArt} from './UiPerformerArt.mjs';
import {getPublicArrangementStudies,getPublicArrangementGuide} from '../utils/publicSessionContent.mjs';
import {getPreparationSnapshot} from '../utils/publicPreparation.mjs';
import {getPublicBuildModel,getPublicBuildOption} from '../utils/publicBuildContent.mjs';
import {createArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {getPublicPerformanceCatalog} from '../utils/publicPerformanceAccess.mjs';

// Fanfire reuses the generated rifle control symbol; it is not part of the shared menu art table.
const ROLE_CHOICE_ART=Object.freeze({fanfire:'art/battle-controls-20261031/rifle.webp'});
function arrangementArt(view,key,parent){
 let image;
 if(ROLE_CHOICE_ART[key]){image=view.element('img','menu-art',undefined,parent);image.src=ROLE_CHOICE_ART[key];image.alt='';image.width=64;image.height=64;image.draggable=false;}
 else image=view.art(key,parent);
 if(isUserCastEnabled()&&image&&!ROLE_CHOICE_ART[key])image.addEventListener('error',()=>{
  if(view.disposed||!image.parentNode)return;
  image.remove();view.icon('book-open',parent,true).setAttribute('class','menu-art');
 },{once:true});
 return image;
}

export function renderPlayHub(view,main,model) {
  const profile=loadPublicProfile();
  const catalog=getArrangementCatalog(model.member.id);
  const performance=model.performance||getPublicPerformanceCatalog(profile,{chapterId:model.chapter.id}),access=id=>performance.modes.find(row=>row.modeId===id);
  view.element('h2','shell-page-heading','公演中心',main);
  view.element('p','system-context',`${model.member.name} · ${model.chapter.name} · 已完成 ${model.clears} 场`,main);
  const groups=[
    {id:'preparation',title:'演出准备',detail:'开始前检查本场配置与演出目标',entries:[
      ['出战准备',`${model.member.name} · ${model.chapter.name}`,'clapperboard','hub-preflight','preflight',access('campaign')],
      ['个人演出目标',describePublicRunGoal(capturePublicRunGoal(profile)),'route','hub-goals','goals'],
      ['压轴连演','三站压轴 · 生命继承','route','hub-finale-trial','finaleTrial',access('finale-trial')],
      ['压轴排练室','单站压轴与实战课题','clapperboard','hub-rehearsal','rehearsal',access('rehearsal')],
      ['编排资料库',`两段编排 · ${catalog.first.length*catalog.second.length} 种组合预览`,'book-open','hub-library','library'],
    ]},
    {id:'growth',title:'成员成长',detail:'真实训练阶位、配件持有与效果规划',entries:[
      ['成员训练',`当前阶位 ${model.preparation.trainingLevel} · 笔记 ${model.resources.balance}`,'users','hub-training','workshop'],
      ['装备背包','查看已拥有、已装备与未解锁配件','backpack','hub-inventory','inventory'],
      ['成长资料',`当前阶位 ${model.preparation.trainingLevel} · 效果对比不自动应用`,'settings-2','hub-growth','growth'],
    ]},
    {id:'records',title:'演出回顾',detail:'只显示本机实际保存的成绩与故事',entries:[
      ['演出档案',`已通关 ${model.clears} 场 · 成员与场地个人纪录`,'clapperboard','hub-records','records'],
      ['章节现场档案','查阅最近现场、串场路线与联动经过','route','hub-chapter-archive','chapterArchive'],
      ['巡演手记','回看已开放的章节故事', 'route','hub-story-journal',null],
    ]},
  ];
  const categorized=isUserCastEnabled();
  if(categorized){
    view.hubCategory=groups.find(group=>group.id===view.hubCategory)?.id||groups[0].id;
    const categories=view.element('div','hub-categories',undefined,main);categories.setAttribute('role','tablist');categories.setAttribute('aria-label','玩法分类');
    const activate=id=>{
      if(view.disposed||view.navigating||view.scene._sessionExperience?.isBlocking())return;
      view.hubCategory=id;view.render(`[data-hub-category="${id}"]`);
      const content=view.root.querySelector('.shell-content');if(content)content.scrollTop=0;
    };
    for(const [index,group]of groups.entries()){
      const tab=view.button(categories,group.title,()=>activate(group.id),{className:'hub-category'});tab.id='hub-tab-'+group.id;tab.dataset.hubCategory=group.id;
      tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(group.id===view.hubCategory));tab.setAttribute('aria-controls','hub-panel-'+group.id);tab.setAttribute('tabindex',group.id===view.hubCategory?'0':'-1');
      tab.addEventListener('keydown',event=>{
        const next={ArrowLeft:(index+groups.length-1)%groups.length,ArrowRight:(index+1)%groups.length,Home:0,End:groups.length-1}[event.key];
        if(next===undefined)return;event.preventDefault();activate(groups[next].id);
      });
    }
  }
  for(const groupData of groups){
    const group=view.element('section','system-hub-group',undefined,main);
    group.dataset.hubGroup=groupData.id;
    if(categorized){group.id='hub-panel-'+groupData.id;group.hidden=groupData.id!==view.hubCategory;group.setAttribute('role','tabpanel');group.setAttribute('aria-labelledby','hub-tab-'+groupData.id);group.setAttribute('tabindex','0');}
    const heading=view.element('header','system-hub-heading',undefined,group);
    const art=view.element('img','system-hub-portrait',undefined,heading);
    art.src=getUiPerformerArt(model.member.id).avatar;art.alt='';art.width=72;art.height=72;art.draggable=false;art.decoding='async';
    const copy=view.element('div','',undefined,heading);
    view.element('h2','',groupData.title,copy);
    for(const [label,detail,icon,action,page,availability]of groupData.entries){
      const callback=page?()=>{
        if(groupData.id==='growth')view.selection.previewMember(model.member.id);
        view.showPage(page);
      }:()=>view.scene._sessionExperience?.showStoryJournal();
      const button=view.button(group,label,callback,{className:'system-entry',icon,action});
      if(availability){button.dataset.performanceMode=availability.modeId;button.dataset.availability=availability.state;button.setAttribute('aria-label',label+' · '+availability.label+(availability.reason?' · '+availability.reason:''));}
      button.replaceChildren();view.icon(icon,button);
      const content=view.element('span','system-entry-copy',undefined,button);
      view.element('strong','',label,content);view.element('small','',availability?availability.label+' · '+(availability.reason||detail):detail,content);view.icon('arrow-right',button);
    }
  }
}

export function renderGrowthCatalog(view,main) {
 const profile=loadPublicProfile(),memberId=view.selection.memberId,base=getPreparationCatalog(profile,memberId);
 if(!base)return;
 const sameMember=view.growthContext===memberId;
 const changed=sameMember&&(view.growthExpected?.trainingLevel!==base.current.trainingLevel||view.growthExpected?.equipmentId!==base.current.equipmentId);
 if(!sameMember||changed){
  view.growthContext=memberId;view.growthRank=base.current.trainingLevel;view.growthEquipmentId=base.current.equipmentId;
  view.growthExpected=getPreparationSnapshot(profile,memberId);view.growthConfirmation=null;
  if(changed&&!view.workshopMessage)view.workshopMessage=profile.persisted?'配置已更新，规划已同步为已保存配置。':'配置已更新，规划已同步；当前配置尚未保存。';
 }
 const model=getPreparationCatalog(profile,memberId,{trainingLevel:view.growthRank,equipmentId:view.growthEquipmentId})||base;
 view.element('h2','shell-page-heading','成长规划',main);
 const members=view.element('div','shell-member-strip',undefined,main);members.setAttribute('role','group');members.setAttribute('aria-label','查看成员成长');
 for(const member of PUBLIC_PERFORMERS){const b=view.button(members,member.name,()=>{view.workshopMessage='';view.selection.previewMember(member.id);view.render(`[data-growth-member="${member.id}"]`);},{className:'shell-member-option'});b.dataset.growthMember=member.id;b.setAttribute('aria-pressed',String(member.id===memberId));b.replaceChildren();view.mark(b,member);view.element('span','',member.name,b);}
 view.element('p','system-context growth-member',`${model.member.name} · 当前阶位 ${model.current.trainingLevel} · 练习笔记 ${model.resources.balance}`,main);
 const ranks=view.element('section','arrangement-pool',undefined,main);view.element('h2','','训练阶位',ranks);
 const choices=view.element('div','growth-ranks',undefined,ranks);choices.setAttribute('role','group');choices.setAttribute('aria-label','规划阶位');
 for(const row of model.training){const b=view.button(choices,`阶位 ${row.level}`,()=>{view.workshopMessage='';view.growthRank=row.level;view.render(`[data-growth-rank="${row.level}"]`);},{className:'arrangement-option'});b.dataset.growthRank=String(row.level);b.setAttribute('aria-pressed',String(row.level===model.preview.trainingLevel));b.replaceChildren();view.element('strong','',`阶位 ${row.level}`,b);view.element('small','',row.state==='current'?'当前':row.state==='completed'?'已完成':'规划',b);}
 const preview=view.element('section','growth-preview',undefined,main);preview.setAttribute('aria-live','polite');view.element('h2','',model.preview.applied?'当前配置':'规划配置 · 未应用',preview);
 const labels=view.element('div','growth-comparison-labels',undefined,preview);
 for(const label of ['效果','当前','规划'])view.element('span','',label,labels);
 const percent=n=>`${Math.round((n-1)*1000)/10}%`,table=view.element('dl','growth-effects',undefined,preview);
 for(const [label,field,format]of [['攻击涂染范围','paintRadiusBonus',n=>`+${n}`],['行动充能','chargeMultiplier',percent],['行动涂染威力','actionPower',percent]]){const r=view.element('div','',undefined,table);view.element('dt','',label,r);view.element('dd','',format(model.current.effects[field]),r);view.element('dd','',format(model.preview.effects[field]),r);}
 table.setAttribute('aria-label','当前效果与规划效果');
 const gear=view.element('section','arrangement-pool growth-equipment-pool',undefined,main);view.element('h2','','演出配件',gear);const options=view.element('div','arrangement-options',undefined,gear);options.setAttribute('role','group');options.setAttribute('aria-label','规划配件');
 for(const item of [{id:'none',name:'未装备',description:'无配件加成',owned:true},...model.equipment]){const id=item.id==='none'?null:item.id;const b=view.button(options,item.name,()=>{view.workshopMessage='';view.growthEquipmentId=id;view.render(isUserCastEnabled()?'[data-action=growth-gear]':`[data-growth-equipment="${item.id}"]`);},{className:'arrangement-option'});b.dataset.growthEquipment=item.id;b.dataset.equipmentState=item.id==='none'?'none':item.equipped?'equipped':item.owned?'owned':'locked';b.setAttribute('aria-pressed',String(id===model.preview.equipmentId));b.replaceChildren();view.element('strong','',item.name,b);view.element('small','',item.description,b);view.element('small','',item.id==='none'?'':item.equipped?'当前装备':item.owned?'已拥有':item.unlock,b);}
 const application=view.element('section','growth-application',undefined,main);
 view.element('p','system-context',`当前 → 规划 · 需 ${model.preview.cost} 练习笔记${model.preview.owned?'':' · 配件未拥有'}`,application);
 const selected=model.equipment.find(row=>row.id===model.preview.equipmentId);
 if(selected){
  view.element('p','growth-source',`获取：${selected.unlock}${selected.chapter?' · '+selected.chapter.name:''}`,application);
  if(selected.performerId||selected.behavior)view.element('p','inventory-impact',selected.description+' 占用唯一配件位，不叠加其他配件。',application);
  if(!selected.performerId)view.button(application,'查看获取场地',()=>{if(selected.sourceUnlocked)view.selection.previewChapter(selected.chapterId);view.showPage('tour');},{icon:'route',action:'growth-source'});
 }
 view.renderRetiredTrainingRecovery(main,profile);
 const target={trainingLevel:model.preview.trainingLevel,equipmentId:model.preview.equipmentId};
 const key=JSON.stringify([memberId,target.trainingLevel,target.equipmentId]);
 const blocked=!profile.persisted?'记录尚未保存':target.trainingLevel<model.current.trainingLevel?'已完成阶位不可降级'
   :!model.preview.owned?'配件尚未拥有':model.preview.cost>model.resources.balance?'练习笔记不足':model.preview.applied?'已是当前配置':null;
 if(blocked&&!model.preview.applied)view.element('p','workshop-muted',blocked,application);
 const actions=view.element('div','preflight-links',undefined,application);
 actions.style.gridTemplateColumns='minmax(0,1fr)';
 const apply=view.button(actions,'应用整套方案',()=>{
   view.growthConfirmation={key,expected:{...view.growthExpected},target};view.render('[data-action=growth-confirm]');
   view.root.querySelector('[data-action=growth-confirm]')?.scrollIntoView?.({block:'nearest'});
 },{icon:'check',action:'growth-apply'});apply.disabled=!!blocked;
 let confirmationText,confirmationActions;
 if(view.growthConfirmation?.key===key){
   const confirmation=view.growthConfirmation;
   confirmationText=view.element('p','system-context',isUserCastEnabled()?`${model.member.name} · 阶位 ${target.trainingLevel} · ${selected?.name||'未装备'}。训练不可撤销，出战成员不变。`:`确认${model.member.name} · 阶位 ${target.trainingLevel} · ${selected?.name||'未装备'} · ${model.preview.cost} 练习笔记。训练不可撤销，出战成员不自动切换。`,application);
   confirmationActions=view.element('div','preflight-links',undefined,application);
   confirmationActions.style.gridTemplateColumns=isUserCastEnabled()?'minmax(0,1fr) 84px':'minmax(0,1fr)';
   const confirm=view.button(confirmationActions,`确认应用 · ${model.preview.cost} ${isUserCastEnabled()?'笔记':'练习笔记'}`,()=>view.applyGrowthPlan(confirmation),{className:'shell-primary',icon:'check',action:'growth-confirm'});confirm.disabled=!!blocked;
   view.button(confirmationActions,'取消应用',()=>{view.growthConfirmation=null;view.render('[data-action=growth-apply]');},{icon:'x',action:'growth-cancel'});
 }else view.growthConfirmation=null;
 const links=view.element('div','preflight-links',undefined,main);
 view.button(links,'前往成员训练',()=>view.showPage('workshop'),{icon:'clapperboard',action:'growth-training'});
 view.button(links,'查看背包',()=>{if(model.preview.equipmentId)view.inventoryId=model.preview.equipmentId;view.showPage('inventory');},{icon:'backpack',action:'growth-inventory'});
 const footer=view.element('footer','shell-selection-footer');
 const status=view.element('p','workshop-status',view.workshopMessage||(!profile.persisted?'当前配置尚未保存。':model.preview.applied?'当前方案已保存。':'规划尚未应用；下方出战使用已保存配置。'),footer);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 if(isUserCastEnabled()){
  footer.className+=' planning-command-footer';
  footer.dataset.planState=confirmationActions?'confirm':model.preview.applied?'current':'draft';
  actions.hidden=!!confirmationActions||model.preview.applied;footer.append(actions);
  if(!model.preview.applied)apply.classList.add('shell-primary');
  if(confirmationActions)footer.append(confirmationText,confirmationActions);
 }
 view.preparedPreflightButton(footer);
}

export function renderRunGoals(view,main,model) {
  const profile=loadPublicProfile(),goal=capturePublicRunGoal(profile),key=model.member.id+':'+model.chapter.id;
  if(view.goalContext!==key){view.goalContext=key;view.goalKind=goal?.kind||'standard';}
  const rows=getPublicRunGoalOptions(profile);
  view.element('h2','shell-page-heading','本场目标',main);view.element('p','system-context',`${model.member.name} · ${model.chapter.name}`,main);
  const choices=view.element('div','run-goal-options',undefined,main);choices.setAttribute('role','group');choices.setAttribute('aria-label','本场目标');
  for(const row of rows){
    const button=view.button(choices,row.label,()=>{view.goalKind=row.id;view.render(`[data-goal="${row.id}"]`);},{className:'run-goal-option'});
    button.dataset.goal=row.id;button.disabled=!row.available;button.setAttribute('aria-pressed',String(view.goalKind===row.id));button.replaceChildren();
    view.icon(row.available?'check':'lock',button);const text=view.element('span','',undefined,button);view.element('strong','',row.label,text);view.element('small','',row.description,text);
  }
  const draft=rows.find(row=>row.id===view.goalKind),selection=view.element('p','challenge-selection',draft?'预选：'+draft.label+' · '+draft.description:'',main);selection.setAttribute('role','status');selection.setAttribute('aria-live','polite');
  view.element('p','system-context',`当前已确认：${describePublicRunGoal(goal)}`,main);
  const footer=view.element('footer','shell-selection-footer');
  view.element('p','system-context','确认后固定本场门槛；重试沿用，重新确认才采用最新纪录。目标不追加奖励，也不改变敌人。',main);
  const confirmation=view.button(footer,'确认目标并准备',()=>{
    if(selectPublicRunGoal(loadPublicProfile(),view.goalKind))view.showPage('preflight');else view.render();
  },{className:'shell-primary',icon:'play',action:'confirm-goal'});
  confirmation.disabled=!rows.some(row=>row.id===view.goalKind&&row.available);
}

export function renderArrangementLibrary(view,main) {
  const profile=loadPublicProfile(),memberId=profile.selectedId;
  const catalog=getArrangementCatalog(memberId);view.arrangementFirst ||= catalog.first[0].id;view.arrangementSecond ||= catalog.second[0].id;
  // A draft first choice from another member's pool stays visible as invalid; it is never swapped for another choice.
  const invalidFirst=catalog.first.some(row=>row.id===view.arrangementFirst)?null:getRunChoice(view.arrangementFirst);
  const segmented=isUserCastEnabled(),stageRows=[['第一段',catalog.first,'arrangementFirst','first'],['第二段',catalog.second,'arrangementSecond','second']];
  if(segmented&&!['first','second'].includes(view.libraryStage))view.libraryStage='first';
  view.element('h2','shell-page-heading','编排组合',main);view.element('p','system-context','组合预览 · 不自动替换本场方案',main);
  const studies=view.element('section','arrangement-pool library-studies',undefined,main);
  view.element('h2','','搭配思路',studies);
  const studyRows=getPublicArrangementStudies(memberId);
  const options=view.element('div','arrangement-options',undefined,studies);
  options.setAttribute('role','group');options.setAttribute('aria-label','搭配思路');
  if(studyRows.length===4)options.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
  for(const row of studyRows){
    const button=view.button(options,row.name,()=>{
      view.arrangementFirst=row.first;view.arrangementSecond=row.second;
      view.render(isUserCastEnabled()?'[data-action=library-sheet-study]':`[data-arrangement-study="${row.id}"]`);
    },{className:'arrangement-option'});
    button.dataset.arrangementStudy=row.id;
    button.setAttribute('aria-pressed',String(row.first===view.arrangementFirst&&row.second===view.arrangementSecond));
    button.replaceChildren();arrangementArt(view,row.first,button);view.element('strong','',row.name,button);
  }
  const stages=view.element('div','library-stages',undefined,main);
  if(segmented){
    const tabs=view.element('div','library-stage-tabs',undefined,stages);tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','编排段落');
    const activate=id=>{if(view.disposed||view.navigating||view.scene._sessionExperience?.isBlocking())return;view.libraryStage=id;view.render(`[data-library-stage="${id}"]`);};
    for(const[index,[label,rows,key,id]]of stageRows.entries()){
      const tab=view.button(tabs,label,()=>activate(id),{className:'library-stage-tab'});tab.id='library-tab-'+id;tab.dataset.libraryStage=id;
      tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(view.libraryStage===id));tab.setAttribute('aria-controls','library-panel-'+id);tab.setAttribute('tabindex',view.libraryStage===id?'0':'-1');
      tab.replaceChildren();view.element('span','',label,tab);view.element('strong','',rows.find(row=>row.id===view[key])?.label||(id==='first'&&invalidFirst?'需重选':''),tab);
      tab.addEventListener('keydown',event=>{const next={ArrowLeft:1-index,ArrowRight:1-index,Home:0,End:1}[event.key];if(next===undefined)return;event.preventDefault();activate(stageRows[next][3]);});
    }
  }
  for(const [label,rows,key,id]of stageRows){
    const section=view.element('section','arrangement-pool library-stage',undefined,stages);view.element('h2','',label,section);
    if(segmented){section.id='library-panel-'+id;section.hidden=view.libraryStage!==id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','library-tab-'+id);section.setAttribute('tabindex','0');}
    if(id==='first'&&invalidFirst){
      const notice=view.element('p','system-context',`${invalidFirst.label}不在当前成员的编排中，请重新选择第一段。已预选的本场方案不变。`,section);
      notice.dataset.arrangementInvalid=invalidFirst.id;notice.setAttribute('role','status');
    }
    const group=view.element('div','arrangement-options',undefined,section);group.setAttribute('role','group');group.setAttribute('aria-label',label);
    for(const row of rows){const button=view.button(group,row.label,()=>{view[key]=row.id;view.render(`[data-arrangement="${row.id}"]`);},{className:'arrangement-option'});
      button.dataset.arrangement=row.id;button.setAttribute('aria-pressed',String(view[key]===row.id));button.setAttribute('aria-label',row.label+'：'+row.description);button.replaceChildren();arrangementArt(view,row.id,button);view.element('strong','',row.label,button);view.element('small','',row.description,button);}
  }
  const preview=previewPublicArrangement(view.arrangementFirst,view.arrangementSecond,memberId);
  const preparation=getPreparationSnapshot(profile,memberId);
  const build=preview&&isUserCastEnabled()?getPublicBuildModel(preparation,memberId,preview.choices):null;
  const footer=view.element('footer','shell-selection-footer');
  if(isUserCastEnabled()){
    const use=view.button(footer,'预选方案并准备',()=>{
      view.arrangementPlan=createArrangementPlan(preview.choices,{stageId:1,performerId:memberId,campaignChapterId:profile.campaign.selectedChapterId});
      view.showPage('preflight');
    },{className:'shell-primary',icon:'check',action:'plan-use'});
    use.disabled=!build;
  }
  const links=isUserCastEnabled()?view.element('div','preflight-links',undefined,null):footer;
  if(isUserCastEnabled())view.button(links,'返回准备',()=>view.showPage('preflight'),{icon:'clapperboard',action:'library-preflight'});
  view.button(links,'返回玩法中心',()=>view.showPage('playhub',{remember:false,root:true}),{className:isUserCastEnabled()?'':'shell-primary',icon:'arrow-left',action:'library-back'});
  if(!preview){
    const blocked=view.element('section','library-preview',undefined,main);blocked.setAttribute('aria-live','polite');
    view.element('h2','','预览效果',blocked);view.element('p','system-context','第一段需重选后才能预览和预选。',blocked);
    if(links!==footer)main.append(links);
    return;
  }
  const guide=getPublicArrangementGuide(view.arrangementFirst,view.arrangementSecond,memberId,profile.campaign.selectedChapterId);
  const guidePanel=view.element('details','archive-history library-guide',undefined,main);view.element('summary','','编排与场地说明',guidePanel);
  for(const row of [catalog.first.find(row=>row.id===view.arrangementFirst),catalog.second.find(row=>row.id===view.arrangementSecond)])if(row)view.element('p','system-context',row.label+' · '+row.description,guidePanel);
  const context=view.element('section','arrangement-guide',undefined,guidePanel);
  context.setAttribute('aria-live','polite');
  if(build){
    view.element('strong','build-preparation',`${build.name} · ${build.preparationLabel}`,context);
    view.element('p','system-context',build.tactic,context);
  }else if(guide.study)view.element('p','system-context',guide.study.detail,context);
  for(const text of [build?.roleNote||guide.memberNote,guide.chapterNote])if(text)view.element('p','system-context',text,context);
  const combined=build?.effects||preview.effects;
  const previewPanel=view.element('section','library-preview',undefined,main);previewPanel.setAttribute('aria-live','polite');
  view.element('h2','', '预览效果',previewPanel);const effects=view.element('dl','arrangement-effects',undefined,previewPanel);
  const lanes=build&&catalog.first.some(row=>row.id==='fanfire')?getPublicBuildOption(getPublicBuildModel(preparation,memberId,[]),'fanfire'):null;
  for(const [label,value]of [...(build?build.rows.map(row=>[row.label,row.value]):[['攻击涂染范围',`+${combined.paintRadiusBonus}`],['事件行动充能',`${combined.chargeMultiplier} 倍`],['主动行动威力',`${combined.actionPower} 倍`]]),
    ...(lanes?[[lanes.label,preview.choices.includes('fanfire')?lanes.delta+'；'+lanes.detail:'未选择 · 普通射击 1列']]:[]),
    ['接力涂染',combined.relay?'命中后寻找另一有效目标':'未选择'],
    ['攻击回响',combined.echo?'每第三次有效命中后追加':'未选择'],['设施恢复生命',combined.recoverOnAnchor?'必需设施完成时 +1':'未选择']]){
    const row=view.element('div','',undefined,effects);view.element('dt','',label,row);view.element('dd','',String(value),row);
  }
  main.append(previewPanel,guidePanel);
  if(links!==footer)main.append(links);
}
