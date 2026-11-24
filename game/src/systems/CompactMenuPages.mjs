import {getUiPerformer} from '../utils/userCast.mjs';
import {loadPublicProfile,getRunChoice} from '../utils/publicRunProgression.mjs';
import {PUBLIC_EQUIPMENT} from '../utils/publicPreparation.mjs';
import {getPublicEquipmentInventory} from '../utils/publicEquipmentInventory.mjs';
import {getPublicBattleCheckpointAvailability} from '../utils/publicBattleCheckpoint.mjs';
import {createPublicRoutePlan,normalizePublicRoutePlan} from '../utils/publicRoutePlan.mjs';
import {renderArrangementPlan} from './ArrangementPlanView.mjs';
import {mountEquipmentIcon} from './EquipmentIconArt.mjs';
import {mountPortraitInteraction} from './HomePortraitInteraction.mjs';
import {openHierarchySheet} from './HierarchySheets.mjs';
import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';
import {normalizeArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {capturePublicRunGoal,describePublicRunGoal} from '../utils/publicRunGoals.mjs';
import {getChapterObjectiveSummary} from '../utils/chapterObjectives.mjs';
import {getChapterEncounterSummary} from '../utils/chapterEncounterContent.mjs';

const chapterLetter=id=>'chapter-'+id;
function iconTool(view,parent,label,icon,callback,action){
  const button=view.button(parent,label,callback,{className:'ui-icon-command',action,iconOnly:true});
  button.dataset.uiIcon=icon;button.title=label;
  view.element('span','ui-sr-label',label,button);return button;
}
function openSheet(view,title,content,trigger){
  return openHierarchySheet(view,{title,content,trigger});
}

export function renderCompactHome(view,main,model,{start,renderContinue}){
  main.dataset.hierarchy='desk';
  const scene=view.element('div','ui-home-scene',undefined,view.root.parentNode);
  scene.setAttribute('aria-hidden','true');
  const background=view.element('img','ui-room-background',undefined,scene);
  background.src='art/showbill/openair.webp';background.alt='';background.draggable=false;
  view.homeSceneDispose=()=>scene.remove();
  const spaces=view.element('div','ui-home-spaces',undefined,main);
  view.button(spaces,'巡演后台',()=>view.showPage('backstage'),{className:'home-backstage',icon:'clapperboard',lineIcon:true,action:'home-open-backstage'});
  const stage=view.element('section','ui-home-stage',undefined,main);
  const portrait=view.button(stage,'与'+model.member.name+'互动',()=>{}, {className:'ui-home-portrait',action:'portrait-interact'});
  portrait.dataset.performer=model.member.id;portrait.replaceChildren();
  view.mark(portrait,model.member,true,{animate:true,background});
  view.portraitInteractionDispose=mountPortraitInteraction(view,portrait,stage,model.member.id);
  const dock=view.element('footer','ui-home-dock');
  // Name and chapter caption the primary command; the stage carries no lettering over the figure.
  const caption=view.element('div','ui-home-caption',undefined,dock);
  const identity=view.element('strong','ui-home-identity',model.member.name,caption);identity.dataset.uiLetter=model.member.id;
  const chapter=view.element('strong','ui-home-chapter',model.chapter.name,caption);

  const actions=view.element('div','ui-home-primary',undefined,dock);
  const hasResume=getPublicBattleCheckpointAvailability().available&&!!view.options.onResume;
  const play=view.button(actions,hasResume?'开始新公演':'开始公演',()=>view.showPage('preflight'),{className:'ui-primary-command showbill-start',action:'start'});
  play.replaceChildren();view.element('span','showbill-play-label',play.getAttribute('aria-label'),play);
  view.icon('arrow-right',play,true);
  if(hasResume){play.title='开始新公演：确认后替换中途记录';}
  renderContinue(view,dock,actions,model);
  const progress=view.element('div','home-tour-progress',undefined,dock);
  view.element('span','','巡演通关',progress);
  const meter=view.element('progress','',undefined,progress);
  meter.max=model.chapters.length;meter.value=model.clearedCount;meter.setAttribute('aria-label','巡演通关章节');
  view.element('strong','',model.clearedCount+' / '+model.chapters.length,progress);
  const resume=actions.querySelector('[data-action=resume-run]');if(resume){resume.dataset.uiLetter='resume';resume.className='ui-secondary-command';}
  if(model.recovery||model.hasPendingSave){
    const warning=view.element('section','ui-home-save-warning',undefined,main);
    for(const selector of ['.shell-save-recovery','.shell-pending-save']){const node=main.querySelector(selector);if(node)warning.append(node);}
  }
}

// B264 studio: one context row, three view-only filters, a 3-column object catalogue and a secondary
// detail sheet. Writes go only through view.inventoryFeedback and view.preparedPreflightButton.
// data-inventory-letter hosts keep a native sr-only label plus a native visible short label.
export function renderCompactInventory(view,main,model){
  main.dataset.hierarchy='inventory';main.dataset.inventoryStudio='264';
  const member=getUiPerformer(view.selection.memberId),inventory=getPublicEquipmentInventory(loadPublicProfile(),member.id);
  const items=inventory.items,owned=items.filter(item=>item.owned),deployed=model.member.id===member.id;
  const labelled=(host,key,full,short)=>{
    host.dataset.inventoryLetter=key;view.element('span','ui-sr-label',full,host);
    const visible=view.element('span','inv-command-label',short,host);visible.setAttribute('aria-hidden','true');return visible;
  };
  const context=view.element('p','inv-context',undefined,main);context.dataset.performer=member.id;context.dataset.deployed=String(deployed);
  view.element('strong','inv-context-actor',member.name,context);
  view.element('span','inv-context-deploy',deployed?'出战中':'未出战',context);
  view.element('span','inv-context-slot','配件位 · '+(inventory.equippedItem?inventory.equippedItem.name:'空'),context);
  const filters=view.element('nav','inv-filters',undefined,main);filters.setAttribute('aria-label','配件筛选');
  const status=view.element('p','ui-command-status',view.workshopMessage,main);status.setAttribute('role','status');
  const grid=view.element('section','ui-item-grid',undefined,main);grid.setAttribute('aria-label','演出配件');
  const next=items.find(item=>!item.owned&&item.compatible);
  const empty=view.element('p','ui-inventory-empty',`暂无配件 · 已拥有 ${owned.length} / ${items.length}`+(next?` · 下一件 ${next.name}：${next.unlock}`:''),main);
  empty.setAttribute('role','status');
  const rules={all:()=>true,owned:item=>item.owned,compatible:item=>item.compatible};
  const show=id=>{
    view.inventoryFilter=id;
    for(const button of filters.children)button.setAttribute('aria-pressed',String(button.dataset.inventoryFilter===id));
    for(const slot of grid.children)slot.hidden=!rules[id](items.find(item=>item.id===slot.dataset.inventoryItem));
    empty.hidden=[...grid.children].some(slot=>!slot.hidden);
  };
  for(const [id,short,full,count]of [['all','全部','全部配件',items.length],['owned','已拥有','已拥有的配件',owned.length],
    ['compatible','适用',member.name+'可用的配件',inventory.compatibleItems.length]]){
    const button=view.button(filters,`${full}，${count} 件`,()=>show(id),{className:'inv-filter',action:'bag-filter-'+id,iconOnly:true});
    button.dataset.inventoryFilter=id;labelled(button,id,full,short).className='inv-filter-label';
    view.element('b','inv-filter-count',String(count),button);
  }
  const holder=view.element('div','ui-sheet-holder',undefined,main);holder.hidden=true;
  const percent=value=>`+${Math.round((value-1)*100)}%`;
  for(const item of items){
    const state=!item.owned?'locked':!item.compatible?'incompatible':item.equipped?'equipped':'owned';
    const stateText={locked:'未解锁',incompatible:item.ownerName+'专用',equipped:'已装备',owned:'可装备'}[state];
    const button=view.button(grid,`${item.name} · ${stateText}`,()=>{
      holder.replaceChildren();
      if(view.inventoryId!==item.id)view.workshopMessage='';
      view.inventoryId=item.id;
      const detail=view.element('section','ui-item-detail inv-detail',undefined,holder);detail.dataset.item=item.id;detail.dataset.state=state;
      const head=view.element('div','inv-detail-head',undefined,detail);
      const emblem=view.element('span','equipment-art-slot inv-detail-emblem',undefined,head);mountEquipmentIcon(view,emblem,item.id);
      const facts=view.element('div','inv-detail-facts',undefined,head);
      view.element('p','inv-detail-role',item.performerId?item.ownerName+'专用':'通用配件 · 全员可用',facts);
      view.element('p','inv-detail-state',stateText,facts);
      view.element('p','inv-detail-target',`装备对象 · ${member.name}（${deployed?'出战中':'未出战'}）`,facts);
      // Generic items carry numeric fields that ARE their description; personal items only have behaviour prose.
      const effects=[['paintRadiusBonus','攻击涂染范围',value=>'+'+value],['chargeMultiplier','特殊行动充能',percent],['actionPower','主动行动涂染威力',percent]]
        .filter(([key])=>Object.hasOwn(item,key));
      if(effects.length){
        const list=view.element('dl','inv-effects',undefined,detail);
        for(const [key,label,format]of effects){
          const row=view.element('div','inv-effect-row',undefined,list);
          view.element('dt','',label,row);view.element('dd','',format(item[key]),row);
        }
      }else view.element('p','inv-detail-description',item.description,detail);
      const reason=!item.owned?'解锁条件：'+item.unlock:!item.compatible?`${item.ownerName}专用，${member.name}不能装备`:!model.persisted?'记录尚未保存，暂不能更换装备':'';
      if(reason)view.element('p','inv-detail-reason',reason,detail);
      if(view.workshopMessage){
        const feedback=view.element('p','inv-detail-feedback',view.workshopMessage,detail);
        feedback.setAttribute('role','status');
      }
      const equip=view.button(detail,item.equipped?'卸下配件':'装备给'+member.name,()=>{
        view.pendingInventoryDetailId=item.id;
        view.inventoryFeedback(member.id,item.equipped?null:item.id);
      },{className:'ui-primary-command inv-equip',action:'equip-selected',iconOnly:true});
      equip.disabled=!item.canEquip||!model.persisted;
      labelled(equip,item.equipped?'unequip':'equip',equip.title,item.equipped?'卸下':'装备');
      view.preparedPreflightButton(detail);
      const prepare=detail.querySelector('[data-action=prepared-preflight]');
      for(const key of deployed?['preflight']:['confirm','preflight'])view.element('span','inv-preflight-letter',undefined,prepare).dataset.uiLetter=key;
      const source=view.element('details','inv-source',undefined,detail);
      labelled(view.element('summary','',undefined,source),'source','获取与对比','获取与对比');
      view.element('p','inv-source-unlock',(item.owned?'已获得 · ':'未获得 · ')+item.unlock,source);
      const compare=view.button(source,'在成长规划中对比',()=>{
        view.growthContext=member.id;view.growthExpected={...inventory.preparation};view.growthConfirmation=null;
        view.growthRank=inventory.preparation.trainingLevel;view.growthEquipmentId=item.id;view.showPage('growth');
      },{className:'ui-secondary-command inv-compare',action:'inventory-catalog'});
      compare.disabled=!item.compatible;
      openSheet(view,item.name,detail,button).dataset.inventorySheet='item';
    },{className:'ui-item-slot'});
    button.dataset.inventoryItem=item.id;button.dataset.equipped=String(item.equipped);button.dataset.owned=String(item.owned);button.dataset.state=state;
    button.replaceChildren();
    const art=view.element('span','equipment-art-slot',undefined,button);mountEquipmentIcon(view,art,item.id);
    view.element('span','ui-item-name',item.name,button);
    view.element('span','ui-item-state',stateText,button);
    if(state==='locked')view.element('span','ui-item-lock',undefined,button).dataset.uiIcon='lock';
  }
  show(view.inventoryFilter??'all');
}

export function renderCompactPreflight(view,main,model,{start}){
  main.dataset.hierarchy='preflight';
  const hero=view.element('section','ui-preflight-stage',undefined,main);
  const map=view.element('img','ui-preflight-venue',undefined,hero);map.src=CHAPTER_VENUE_ART[model.chapter.id];map.alt='';map.setAttribute('aria-hidden','true');map.draggable=false;
  const portrait=view.element('div','ui-preflight-portrait',undefined,hero);view.mark(portrait,model.member,true,{animate:true,background:map});
  const caption=view.element('strong','ui-preflight-caption',model.chapter.name,hero);caption.dataset.uiLetter=chapterLetter(model.chapter.id);
  const actor=view.element('span','ui-preflight-actor',model.member.name,hero);actor.dataset.uiLetter=model.member.id;
  main.dataset.preflightStudio='b271';
  const holder=view.element('div','ui-sheet-holder',undefined,main);holder.hidden=true;
  // One summary layer: who/saved loadout, three config tools, then stateful second-level entries.
  const brief=view.element('section','ui-preflight-brief',undefined,main);brief.setAttribute('aria-label','本场出战配置');
  const head=view.element('header','ui-preflight-brief-head',undefined,brief);
  const title=view.element('h2','ui-preflight-brief-title','本场配置',head);title.dataset.flightLetter='loadout';
  const tools=view.element('nav','ui-preflight-tools',undefined,head);tools.setAttribute('aria-label','演出配置');
  iconTool(view,tools,'更换成员','switch',()=>view.navigate(view.options.onRoster),'preflight-member');
  iconTool(view,tools,'配件','equipment',()=>view.showPage('inventory'),'preflight-equipment');
  iconTool(view,tools,'成员训练','train',()=>view.navigate(view.options.onWorkshop),'preflight-training');
  const loadout=view.element('div','ui-preflight-loadout',undefined,brief);
  view.element('strong','ui-preflight-member-name',model.member.name,loadout);
  view.element('span','ui-preflight-member-action',model.member.actionName,loadout);
  const equipment=PUBLIC_EQUIPMENT.find(row=>row.id===model.preparation.equipmentId);
  const info=view.element('p','ui-preflight-facts',`阶位 ${model.preparation.trainingLevel} · ${equipment?equipment.name:'未装备配件'}`,loadout);
  info.setAttribute('aria-label','已保存出战配置');
  const plans=view.element('div','ui-preflight-plans',undefined,brief);plans.setAttribute('role','group');plans.setAttribute('aria-label','本场选择');
  const entry=(label,letter,icon,state,callback,action)=>{
    const button=view.button(plans,label+' · '+state,callback,{className:'ui-preflight-entry',action});button.replaceChildren();
    view.element('span','ui-preflight-entry-icon',undefined,button).dataset.uiIcon=icon;
    view.element('span','ui-preflight-entry-label',label,button).dataset.flightLetter=letter;
    view.element('span','ui-preflight-entry-state',state,button);return button;
  };
  const data={stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id};
  const current=normalizePublicRoutePlan(view.routeSelection,data);
  const routes=view.element('div','ui-route-options',undefined,holder);
  for(const [id,label,description]of [['auto','现场选线','不预选；在地图中决定串场方向'],['west','西侧串场','南北两区均走西侧，各完成两站'],['east','东侧串场','南北两区均走东侧，各完成两站']]){
    const option=view.button(routes,label,()=>{view.routeSelection=createPublicRoutePlan(id,data);view.render('[data-action=preflight-route]');},{className:'ui-route-choice',action:'route-'+id});
    option.setAttribute('aria-pressed',String((current?.id||'auto')===id));view.element('small','',description,option);
    option.dataset.routeChoice=id;
  }
  const routeName=current?(current.id==='west'?'西侧串场':'东侧串场'):'现场选线';
  let route;route=entry('串场路线','route','route',routeName,()=>openSheet(view,'串场路线',routes,route),'preflight-route');
  route.dataset.routeId=current?current.id:'auto';route.title=routeName;
  const arrangement=view.element('div','ui-arrangement-summary',undefined,holder);
  const planned=renderArrangementPlan(view,arrangement,model,'[data-action=preflight-arrangement]');if(!planned)view.element('p','','尚未编排；使用本角色默认演出行动。',arrangement);
  iconTool(view,arrangement,'编排图鉴','skill',()=>view.showPage('library'),'preflight-library');
  const plan=normalizeArrangementPlan(view.arrangementPlan,data);
  let arrange;arrange=entry('演出编排','arrangement','skill',plan?plan.choices.map(id=>getRunChoice(id,plan.performerId).label).join(' · '):'未预选 · 默认行动',
    ()=>openSheet(view,'演出编排',arrangement,arrange),'preflight-arrangement');
  if(plan){const pair=view.element('span','ui-preflight-entry-pair',undefined,arrange);for(const id of plan.choices)view.art(id,pair);}
  const goal=capturePublicRunGoal(loadPublicProfile());
  const goalState=goal?(goal.kind==='steady'?(goal.target===0?'稳演挑战 · 无伤通关':`稳演挑战 · 受击少于 ${goal.target} 次`):`速演挑战 · 用时少于 ${(goal.target/1000).toFixed(3)} 秒`):'标准演出';
  const goalEntry=entry('演出目标','goal','modes',goalState,()=>view.showPage('goals'),'preflight-goals');
  goalEntry.setAttribute('aria-description',describePublicRunGoal(goal));goalEntry.title=describePublicRunGoal(goal);
  const venue=view.element('div','ui-preflight-info',undefined,holder);
  view.element('p','',getChapterObjectiveSummary(model.chapter.id),venue);view.element('p','',getChapterEncounterSummary(model.chapter.id),venue);
  let details;details=iconTool(view,head,'场地资料','info',()=>openSheet(view,'场地资料',venue,details),'preflight-info');
  for(const button of tools.children)button.dataset.uiWidget='true';
  tools.querySelector('[data-ui-icon=switch]').dataset.uiIcon='member';
  const footer=view.element('footer','ui-preflight-footer');
  const command=view.button(footer,'确认开演',start,{className:'showbill-deploy',action:'start'});view.icon('play',command,true);
}
