export function mountShowbillMenu(view, main, model) {
  const page = view.page;
  view.root.dataset.edition = 'showbill';
  const heading = view.root.querySelector('.shell-brand').querySelector('h1');
  if (page !== 'desk') {
    const title = heading.getAttribute('aria-label');
    const native = view.element('h1', 'showbill-title', title, null);
    native.tabIndex = -1;
    native.setAttribute('aria-label', title);
    heading.parentNode.insertBefore(native, heading);
    heading.remove();
  }
  if (page === 'tour') {
    const map = main.querySelector('.journey-map');
    const next = model.chapters.find(chapter => !chapter.cleared);
    const banner = view.element('div', 'showbill-tour-heading', undefined, null);
    const copy = view.element('div', '', undefined, banner);
    view.element('span', 'showbill-caption', next ? '下一站' : '本轮巡演', copy);
    view.element('strong', '', next ? next.name : '全程已通关', copy);
    copy.append(map.querySelector('.ui-tour-progress'));
    banner.append(main.querySelector('[data-action=tour-reference]'));
    main.insertBefore(banner, map);
  }
  if(page==='roster'){
    const stage=main.querySelector('.roster-portrait-stage');
    stage.append(view.root.querySelector('.shell-selection-footer'));
  }
  const actions=['train','confirm-member','plan-use','prepared-preflight','trial-tour','rehearsal-tour',
    'trial-start','rehearsal-start','confirm-goal','report-prepare','story-journal','events-open-tour'];
  for(const action of actions){
    const button=view.root.querySelector('[data-action='+action+']');
    if(button?.getAttribute('aria-label'))button.dataset.commandFace='plain';
  }
}
