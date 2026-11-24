import {loadPublicProfile,getRunChoice} from '../utils/publicRunProgression.mjs';
import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';
import {FINALE_TRIAL_CHOICES} from '../utils/publicFinaleTrial.mjs';
import {REHEARSAL_FOCI,getRehearsalConfig,isRehearsalUnlocked} from '../utils/publicRehearsal.mjs';
import {getPublicBuildModel} from '../utils/publicBuildContent.mjs';
import {PUBLIC_EQUIPMENT} from '../utils/publicPreparation.mjs';
import {isUserCastEnabled} from '../utils/userCast.mjs';
import {getPublicPerformanceAccess} from '../utils/publicPerformanceAccess.mjs';

export function getRehearsalMenuSetup(profile,chapterId,saved){
  const options=getRehearsalConfig(saved?{chapterId:saved.chapterId,focus:saved.focus}:null);
  const first=PUBLIC_CHAPTERS.find(c=>isRehearsalUnlocked(profile,c.id));
  const preferred=options?.chapterId??chapterId;
  const config={chapterId:isRehearsalUnlocked(profile,preferred)?preferred:first?.id??'opening',focus:options?.focus??'clear'};
  const valid=options&&Array.isArray(saved.choices)&&saved.choices.length===FINALE_TRIAL_CHOICES.length&&FINALE_TRIAL_CHOICES.every((pool,i)=>Object.hasOwn(saved.choices,i)&&pool.includes(saved.choices[i]));
  return {...config,choices:valid?[...saved.choices]:['wide_brush','echo']};
}

export function renderRehearsal(view,main,model){
  const profile=loadPublicProfile();
  const setup=view.rehearsalSetup=getRehearsalMenuSetup(profile,model.chapter.id,view.rehearsalSetup);
  const chapter=PUBLIC_CHAPTERS.find(c=>c.id===setup.chapterId);
  const access=getPublicPerformanceAccess(profile,{modeId:'rehearsal',chapterId:setup.chapterId}),unlocked=access.canStart;
  main.dataset.performancePage='rehearsal';main.dataset.availability=access.state;
  view.element('h2','shell-page-heading','压轴排练室',main);
  const member=view.element('header','rehearsal-member',undefined,main);view.mark(member,model.member);
  const copy=view.element('div','',undefined,member);view.element('strong','',model.member.name,copy);
  view.element('span','',`${model.preparation.trainingLevel}阶 · ${PUBLIC_EQUIPMENT.find(e=>e.id===model.preparation.equipmentId)?.name||'未装备配件'}`,copy);
  view.element('p','system-context','单站压轴 · 生命与行动充能从本轮初始状态开始。无巡演奖励，不改通关与个人纪录。',main);
  const tabs=view.element('div','rehearsal-stage-tabs',undefined,main);tabs.setAttribute('role','group');tabs.setAttribute('aria-label','排练场地');
  for(const c of PUBLIC_CHAPTERS){const available=isRehearsalUnlocked(profile,c.id);
    const button=view.button(tabs,c.name,()=>{setup.chapterId=c.id;view.render('[data-rehearsal-chapter='+c.id+']');},{className:'arrangement-option',icon:available?'check':'lock'});
    button.dataset.rehearsalChapter=c.id;button.disabled=!available;button.setAttribute('aria-pressed',String(setup.chapterId===c.id));
  }
  if(!unlocked)view.element('p','shell-save-status',access.reason,main);
  const focus=view.element('section','rehearsal-focus',undefined,main);view.element('h3','','本轮课题',focus);
  const group=view.element('div','rehearsal-focus-options',undefined,focus);group.setAttribute('role','group');group.setAttribute('aria-label','排练课题');
  for(const row of REHEARSAL_FOCI){const button=view.button(group,row.label,()=>{setup.focus=row.id;view.render('[data-rehearsal-focus='+row.id+']');},{className:'arrangement-option'});button.dataset.rehearsalFocus=row.id;button.setAttribute('aria-pressed',String(setup.focus===row.id));}
  view.element('p','system-context',REHEARSAL_FOCI.find(f=>f.id===setup.focus).description,focus);
  const stages=view.element('div',isUserCastEnabled()?'challenge-stages challenge-arrangements':'challenge-stages',undefined,main);
  for(const [i,pool]of FINALE_TRIAL_CHOICES.entries()){
    const section=view.element('section','arrangement-pool',undefined,stages);view.element('h3','',i?'第二段编排':'第一段编排',section);
    const choices=view.element('div','arrangement-options',undefined,section);choices.setAttribute('role','group');choices.setAttribute('aria-label',i?'排练第二段':'排练第一段');
    for(const id of pool){const row=getRunChoice(id),button=view.button(choices,row.label,()=>{setup.choices[i]=id;view.render('[data-rehearsal-choice='+id+']');},{className:'arrangement-option'});
      button.dataset.rehearsalChoice=id;button.setAttribute('aria-pressed',String(setup.choices[i]===id));button.setAttribute('aria-label',row.label+'：'+row.description);button.replaceChildren();view.art(id,button);const text=view.element('span','system-entry-copy',undefined,button);view.element('strong','',row.label,text);view.element('small','',row.description,text);
    }
  }
  const guide=view.element('details','challenge-guide',undefined,main);view.element('summary','','场地与编排效果说明',guide);view.map(guide,chapter,'rehearsal-map',true);
  for(const id of FINALE_TRIAL_CHOICES.flat()){const row=getRunChoice(id);view.element('p','system-context',row.label+' · '+row.description,guide);}
  const build=getPublicBuildModel(model.preparation,model.member.id,setup.choices);
  if(build){const details=view.element('details','rehearsal-build',undefined,main);view.element('summary','','本轮配置 · '+build.preparationLabel,details);for(const row of build.rows)view.element('p','system-context',row.label+' · '+row.value,details);}
  const footer=view.element('footer',isUserCastEnabled()?'shell-selection-footer challenge-command-footer':'shell-selection-footer');
  const start=view.button(footer,'开始本站排练',()=>view.navigate(()=>view.options.onRehearsal?.({...setup,choices:[...setup.choices]})),{className:'shell-primary',icon:'play',action:'rehearsal-start'});start.disabled=!unlocked;
}
