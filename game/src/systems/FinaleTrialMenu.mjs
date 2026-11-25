import {loadPublicProfile,getRunChoice} from '../utils/publicRunProgression.mjs';
import {FINALE_TRIAL_CHOICES} from '../utils/publicFinaleTrial.mjs';
import {isUserCastEnabled} from '../utils/userCast.mjs';
import {getPublicPerformanceAccess} from '../utils/publicPerformanceAccess.mjs';

export function renderFinaleTrial(view,main,model){
  const access=getPublicPerformanceAccess(loadPublicProfile(),{modeId:'finale-trial'}),unlocked=access.canStart;
  main.dataset.performancePage='finale-trial';main.dataset.availability=access.state;
  const owner=isUserCastEnabled();
  view.element('h2','shell-page-heading','压轴连演',main);
  view.element('p','system-context',model.member.name+' · '+model.preparation.trainingLevel+'阶 · 三站连续压轴',main);
  if(owner){
    const brief=view.element('dl','challenge-brief',undefined,main);
    for(const [label,value]of [['场地顺序','旧街开幕 → 霓虹街区 → 港湾舞台'],['跨站状态','生命跨站继承，不自动恢复。每站行动充能重新就绪；重试从第一站开始。'],['记录规则','本轮仅作连演挑战，不发巡演奖励、不改变通关与个人纪录；退出或刷新后不保留。']]){const row=view.element('div','',undefined,brief);view.element('dt','',label,row);view.element('dd','',value,row);}
  }else{
  view.element('p','system-context','旧街开幕 → 霓虹街区 → 港湾舞台',main);
  view.element('p','system-context','生命跨站继承，不自动恢复。每站行动充能重新就绪；重试从第一站开始。',main);
  view.element('p','system-context','本轮仅作连演挑战，不发巡演奖励、不改变通关与个人纪录；退出或刷新后不保留。',main);
  }
  if(!unlocked){
    view.element('p','shell-save-status',access.reason,main);
    const target=owner?view.element('footer','shell-selection-footer challenge-command-footer'):main;
    view.button(target,'前往巡演',()=>view.navigate(view.options.onTour),{className:'shell-primary',icon:'route',action:'trial-tour'});
    return;
  }
  view.trialChoices||=['wide_brush','echo'];
  const stages=view.element('div',owner?'challenge-stages challenge-arrangements':'challenge-stages',undefined,main);
  for(const [i,pool]of FINALE_TRIAL_CHOICES.entries()){
    const section=view.element('section','arrangement-pool',undefined,stages);
    view.element('h2','',i?'第二段编排':'第一段编排',section);
    const group=view.element('div','arrangement-options',undefined,section);
    group.setAttribute('role','group');group.setAttribute('aria-label',i?'第二段编排':'第一段编排');
    for(const id of pool){
      const choice=getRunChoice(id);
      const button=view.button(group,choice.label,()=>{view.trialChoices[i]=id;view.render('[data-trial-choice='+id+']');},
        {className:'arrangement-option'});
      button.dataset.trialChoice=id;button.setAttribute('aria-pressed',String(view.trialChoices[i]===id));
      button.setAttribute('aria-label',choice.label+'：'+choice.description);
      button.replaceChildren();view.art(id,button);
      const copy=view.element('span','system-entry-copy',undefined,button);
      view.element('strong','',choice.label,copy);view.element('small','',choice.description,copy);
    }
  }
  const guide=view.element('details','challenge-guide',undefined,main);view.element('summary','','编排效果说明',guide);
  for(const id of FINALE_TRIAL_CHOICES.flat()){const row=getRunChoice(id);view.element('p','system-context',row.label+' · '+row.description,guide);}
  const footer=view.element('footer',owner?'shell-selection-footer challenge-command-footer':'shell-selection-footer');
  if(owner)view.element('small','mode-session-policy','三站生命继承 · 本轮没有巡演奖励',footer);
  view.button(footer,'开始压轴连演',()=>view.navigate(()=>view.options.onFinaleTrial?.([...view.trialChoices])),
    {className:'shell-primary',icon:'play',action:'trial-start'});
}
