// A page heading describes the destination; each cover identifies the actual run or collection.
const covers = {
  inventory: ['console', '装备配置'],
  goals: ['city', '当前场地'],
  library: ['console', '编排场地'],
  growth: ['console', '当前出战'],
  records: ['archive', '巡演通关'],
  playhub: ['stage', '当前出战'],
};

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
    banner.append(map.querySelector('.ui-tour-progress'));
    main.insertBefore(banner, map);
  }
  const spec = covers[page];
  if (!spec) return;
  const [art, label] = spec;
  const cover = view.element('div', 'showbill-cover', undefined, null);
  cover.dataset.cover = art;
  if (page === 'inventory') {
    const context = main.querySelector('.inv-context');
    view.element('span', 'showbill-caption', label, cover);
    cover.append(context);
  } else {
    const value = page === 'records' ? model.clearedCount+' / '+model.chapters.length
      : ['goals','library'].includes(page) ? model.chapter.name : model.member.name;
    view.element('span', 'showbill-caption', label, cover);
    view.element('strong', 'showbill-value', value, cover);
  }
  main.insertBefore(cover, main.children[0]);
}
