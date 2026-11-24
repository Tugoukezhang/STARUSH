import{openHierarchySheet}from'./HierarchySheets.mjs';

export function compactChallengeMenu(view,main,model){
 const trial=view.page==='finaleTrial',ready=main.dataset.availability==='ready';main.dataset.challengeMenu='thin-v1';
 const hero=main.querySelector('.system-screen-frame');hero.classList.add('thin-challenge-hero');
 hero.querySelector('.system-frame-venue').src='art/chapter-journey-20261101/mode-'+(trial?'finale':'rehearsal')+'.webp';
 const mark=view.element('img','thin-challenge-mark',undefined,hero);mark.src='art/chapter-journey-20261101/letter-'+(trial?'finale':'rehearsal')+'.webp';mark.alt=trial?'连演':'排练';
 main.querySelector('h2.shell-page-heading').hidden=true;
 for(const row of main.children)if(row.classList.contains('system-context'))row.hidden=true;
 view.element('p','thin-challenge-summary',model.member.name+' · '+model.preparation.trainingLevel+'阶 · '+(trial?'三站连续，生命继承':'单站练习，本轮初始状态'),hero);
 const rules=trial?main.querySelector('.challenge-brief'):main.querySelector('.challenge-guide');rules.hidden=true;
 const info=view.button(hero,'演出规则',()=>openHierarchySheet(view,{title:'演出规则',content:rules,trigger:info}),{className:'thin-challenge-info',iconOnly:true,action:'challenge-rules'});info.dataset.uiIcon='info';
 if(!trial)main.querySelector('.rehearsal-member').hidden=true;
 if(!ready){
  const gate=view.element('section','thin-challenge-gate',undefined,null);gate.setAttribute('role','status');
  const icon=view.element('span','thin-challenge-lock',undefined,gate);icon.dataset.uiIcon='lock';
  gate.append([...main.children].find(row=>row.classList.contains('shell-save-status')));main.insertBefore(gate,hero.nextSibling);
  if(main.dataset.availability==='locked'){
   const access=model.performance.modes.find(mode=>mode.modeId===(trial?'finale-trial':'rehearsal'));
   const list=view.element('ul','showbill-gate-stops',undefined,null);
   list.setAttribute('aria-label','开放此模式所需通关章节');
   const required=trial?access.requiredChapterIds:[view.rehearsalSetup.chapterId];
   for(const id of required){
    const chapter=model.chapters.find(row=>row.id===id);
    const stop=view.element('li','',undefined,list);
    const missing=trial?access.missingChapterIds.includes(id):true;
    stop.dataset.state=missing?'pending':'cleared';
    const image=view.element('img','',undefined,stop);
    image.src='art/showbill/stop-'+id+'.webp';image.alt='';
    view.element('strong','',chapter.name,stop);
    view.element('span','',missing?'待通关':'已通关',stop);
   }
   main.insertBefore(list,gate.nextSibling);
  }
  if(!trial){
   main.querySelector('.rehearsal-stage-tabs').hidden=true;main.querySelector('.rehearsal-focus').hidden=true;main.querySelector('.challenge-stages').hidden=true;
   const start=view.root.querySelector('[data-action=rehearsal-start]');start.hidden=true;
   const tour=view.button(start.parentNode,'前往巡演',()=>view.navigate(view.options.onTour),{className:'shell-primary',action:'rehearsal-tour'});tour.dataset.uiLetter='tour';
  }
 }else{
  const stages=main.querySelector('.challenge-arrangements');
  for(const button of stages.querySelectorAll('.arrangement-option'))button.classList.add('thin-challenge-choice');
  for(const [index,pool]of stages.querySelectorAll('.arrangement-pool').entries()){
   const heading=pool.children[0];heading.dataset.secondaryLetter=index===0?'first':'second';heading.classList.add('thin-challenge-stage-title');
  }
 }
 if(trial)view.root.querySelector(ready?'[data-action=trial-start]':'[data-action=trial-tour]').dataset.uiLetter=ready?'start':'tour';
 else if(ready)view.root.querySelector('[data-action=rehearsal-start]').dataset.uiLetter='start';
}
