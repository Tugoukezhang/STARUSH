export function mountPlanningUi270(view){
 if(!['growth','library'].includes(view.page))return;
 const title=view.root.querySelector('.shell-brand').querySelector('h1');
 title.replaceChildren();delete title.dataset.secondaryLetter;delete title.dataset.uiLetter;
 title.dataset.planningLetter=view.page;
 title.setAttribute('aria-label',view.page==='growth'?'成长规划':'编排组合');
 const labels=view.page==='growth'?[['[data-action=growth-apply]','confirm']]:[['[data-action=plan-use]','preflight']];
 const heading=view.root.querySelector(view.page==='growth'?'.growth-preview':'.library-preview').querySelector('h2');heading.classList.remove('ui-sr-label');heading.dataset.planningLetter=view.page==='growth'?'compare':'effects';
 for(const[selector,key]of labels)for(const host of view.root.querySelectorAll(selector))host.dataset.planningLetter=key;

 for(const host of view.root.querySelectorAll('[data-planning-letter-pending]'))host.dataset.planningLetter=host.dataset.planningLetterPending;
 for(const host of view.root.querySelectorAll('[data-planning-letter]')){
  for(const old of host.querySelectorAll('.sec-letter-art'))old.remove();
  const key=host.classList.contains('sec-growth-gear-kicker')?'gear':host.dataset.planningLetter;
  const image=view.element('img','planning-letter-art',undefined,host);image.src='art/planning-studio-20261102/letter-'+key+'.webp';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');
 }
 if(view.page==='library')for(const row of view.root.querySelector('.library-preview').querySelectorAll('dl.arrangement-effects'))for(const item of row.children)item.dataset.planningLayout=item.children[1].textContent.length>10?'description':'metric';
}
