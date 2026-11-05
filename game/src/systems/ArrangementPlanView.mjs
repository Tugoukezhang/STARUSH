import {normalizeArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {getPublicBuildModel} from '../utils/publicBuildContent.mjs';
import {getRunChoice} from '../utils/publicRunProgression.mjs';
import {isUserCastEnabled} from '../utils/userCast.mjs';

export function renderArrangementPlan(view,main,model,clearFocus){
  const data={stageId:1,performerId:model.member.id,campaignChapterId:model.chapter.id};
  const plan=normalizeArrangementPlan(view.arrangementPlan,data);
  if(!plan)return;
  const build=getPublicBuildModel(model.preparation,model.member.id,plan.choices);
  if(!build)return;
  const section=view.element('section','preflight-plan',undefined,main);section.dataset.arrangementPlan='true';
  const header=view.element('header','preflight-plan-heading',undefined,section);view.element('h3','','本场编排方案',header);
  const clear=view.button(header,'清除本场方案',()=>{view.arrangementPlan=null;view.render(clearFocus);},{className:'shell-icon-button',icon:'x',iconOnly:true,lineIcon:isUserCastEnabled(),action:'plan-clear'});
  if(isUserCastEnabled()){const label=view.element('img','plan-clear-label',undefined,clear);label.src='art/preflight-console-20261103/clear.webp';label.alt='';label.setAttribute('aria-hidden','true');}
  const pair=view.element('div','preflight-plan-pair',undefined,section);
  for(const [index,id]of plan.choices.entries()){
    const row=view.element('div','preflight-plan-choice',undefined,pair);view.art(id,row);
    const text=view.element('div','',undefined,row);view.element('small','',index?'第二段':'第一段',text);view.element('strong','',getRunChoice(id,plan.performerId).label,text);
  }
  view.element('p','system-context',build.name+' · '+build.preparationLabel,section);
  view.element('p','system-context','局内按段确认后生效，仍可临场改选。',section);
  const details=view.element('details','preflight-plan-effects',undefined,section);view.element('summary','','预选搭配效果',details);
  const effects=view.element('dl','preflight-effects',undefined,details);
  for(const [index,row]of build.rows.entries()){const item=view.element('div','',undefined,effects);item.dataset.planEffect=['paintRadiusBonus','chargeMultiplier','actionPower'][index];view.element('dt','',row.label,item);view.element('dd','',row.value,item);}
  view.element('p','system-context',build.tactic,details);
  const actions=view.element('div','preflight-links',undefined,section);
  view.button(actions,'调整编排方案',()=>{[view.arrangementFirst,view.arrangementSecond]=plan.choices;view.showPage('library');},{icon:'book-open',lineIcon:isUserCastEnabled(),action:'plan-adjust'});
  return section;
}

