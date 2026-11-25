import {getPublicRunGoalOptions, getArrangementCatalog} from '../utils/publicRunGoals.mjs';
import {openHierarchySheet} from './HierarchySheets.mjs';
import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';

// Program (events), practice (sideplay) and the challenge catalog (playhub).
// Pages only read profile-derived catalogs; every command opens an existing route.
// Static headers/buttons carry registered AI lettering; dynamic states, counts and descriptions stay native text.
const STOP_LABELS = {cleared: '已通关', ready: '可出演', locked: '未开放'};
const MODE_ART = {'hub-finale-trial': ['mode-finale', 'finale'], 'hub-rehearsal': ['mode-rehearsal', 'rehearsal']};
const JOURNEY_ART = 'art/chapter-journey-20261101';

// Lettering image plus the same words as screen-reader text.
function letter(view, parent, key, text) {
  const image = view.element('img', 'pg-letter', undefined, parent);
  image.src = ['chapters','goal-info','set-goal'].includes(key) ? `art/program-studio-20261101/letter-${key}.webp` : key === 'tour' ? 'art/hierarchy-ui-20261101/letters-tour.webp' : `${JOURNEY_ART}/letter-${key}.webp`; image.alt = ''; image.draggable = false;
  view.element('span', 'pg-sr', text, parent);
  return image;
}

function go(view, parent, letterKey, label, detail, page, action, uiIcon, className) {
  const owner = view.page;
  const button = view.button(parent, label, () => {
    if (view.page === owner && view.root.contains(button)) view.showPage(page);
  }, {className, action});
  button.replaceChildren();
  view.element('span', 'pg-glyph', undefined, button).dataset.uiIcon = uiIcon;
  const copy = view.element('span', 'pg-command-copy', undefined, button);
  letter(view, view.element('strong', 'pg-command-letter', undefined, copy), letterKey, label);
  view.element('small', '', detail, copy);
  return button;
}

// The shared portrait header repeats the page title, member and role; these pages lead with their own art.
const dropScene = root => root.querySelector('.pm-scene').remove();
const STUDIO_ART = 'art/program-studio-20261101';

export function renderProgramEvents(view, root, model, profile) {
  dropScene(root);
  root.dataset.programStudio = '267';
  const catalog = model.performance;
  const current = catalog.chapters.find(access => access.chapterId === model.chapter.id);
  const currentState = current.cleared ? 'cleared' : current.state;
  const venue = view.element('section', 'pg-venue', undefined, root);
  const art = view.element('img', 'pg-venue-art', undefined, venue);
  art.src = CHAPTER_VENUE_ART[model.chapter.id]; art.alt = ''; art.width = 768; art.height = 512;
  const plate = view.element('div', 'pg-venue-plate', undefined, venue);
  view.element('h2', '', model.chapter.name, plate);
  view.element('p', '', model.chapter.subtitle, plate);

  // Actual progress only: the current chapter's state and the saved cleared count.
  const status = view.element('p', 'ps-status', undefined, root);
  view.element('b', 'ps-chapter-state', STOP_LABELS[currentState], status).dataset.state = currentState;
  const progress = view.element('span', 'ps-progress', '通关 ', status);
  view.element('b', 'pg-track-count', `${catalog.clearedCount}/${catalog.chapterCount}`, progress);
  const progressStrip = view.element('ol', 'program-stop-strip', undefined, root);
  progressStrip.setAttribute('aria-label', '五站巡演进度');
  for (const chapter of catalog.chapters) {
    const stop = view.element('li', '', undefined, progressStrip);
    stop.dataset.state = chapter.cleared ? 'cleared' : chapter.state;
    if (chapter.chapterId === model.chapter.id) stop.setAttribute('aria-current', 'step');
    const name = model.chapters.find(row => row.id === chapter.chapterId).name;
    const image = view.element('img', '', undefined, stop);
    image.src = 'art/showbill/stop-' + chapter.chapterId + '.webp';
    image.alt = name + ' · ' + STOP_LABELS[stop.dataset.state]; image.draggable = false;
  }
  go(view, root, 'tour', '巡演路线', model.chapter.name, 'tour', 'events-open-tour', 'tour', 'pg-command pg-primary');

  // Chapter track and goal list are read on demand; their hidden sections are borrowed by the sheet.
  const options = getPublicRunGoalOptions(profile);
  const commands = view.element('div', 'ps-more-row', undefined, root);
  const track = view.element('section', 'ps-sheet-content pg-track', undefined, root); track.hidden = true;
  const goals = view.element('section', 'ps-sheet-content pg-goals', undefined, root); goals.hidden = true;
  const owner = view.page;
  for (const [key, title, icon, action, sheet, content] of [
    ['chapters','章节进度','route','events-chapters','chapters',track],
    ['goal-info','目标详情','info','events-goal-info','goals',goals],
  ]) {
    const button = view.button(commands, title, () => {
      if (view.page !== owner || !view.root.contains(button)) return;
      const dialog = openHierarchySheet(view, {title, content, trigger: button});
      dialog.dataset.programSheet = sheet;
      const heading = dialog.querySelector('.ui-sheet-title');
      heading.replaceChildren(); letter(view, heading, key, title);
    }, {className:'ps-more', action});
    button.replaceChildren();
    view.element('span','pg-glyph',undefined,button).dataset.uiIcon = icon;
    letter(view,view.element('strong','pg-command-letter',undefined,button),key,title);
  }

  const head = view.element('header', 'pg-heading', undefined, track);
  letter(view, view.element('h3', '', undefined, head), 'program', '巡演企划');
  view.element('b', 'ps-sheet-count', `${catalog.clearedCount}/${catalog.chapterCount}`, head);
  const preview = view.element('figure', 'ps-current-venue', undefined, track);
  const previewArt = view.element('img', 'pg-venue-art', undefined, preview);
  previewArt.src = art.src; previewArt.alt = model.chapter.name + '场地'; previewArt.draggable = false;
  const next=catalog.chapters.find(access=>access.state==='locked')||catalog.chapters.find(access=>!access.cleared);
  if(next){
    const nextName=model.chapters.find(chapter=>chapter.id===next.chapterId)?.name;
    if(nextName)view.element('p','menu-sheet-key',(next.state==='locked'?'下一开放站 · ':'下一站 · ')+nextName,track);
  }
  const stops = view.element('ol', 'pg-stops', undefined, track);
  for (const [index, access] of catalog.chapters.entries()) {
    const state = access.cleared ? 'cleared' : access.state;
    const stop = view.element('li', 'pg-stop', undefined, stops);
    stop.dataset.programChapter = access.chapterId; stop.dataset.state = state;
    if (access.chapterId === model.chapter.id) stop.setAttribute('aria-current', 'step');
    view.element('b', 'pg-stop-index', String(index + 1), stop);
    view.element('strong', '', model.chapters.find(chapter => chapter.id === access.chapterId).name, stop);
    view.element('small', '', STOP_LABELS[state], stop);
  }

  // Goals are pre-run challenges chosen before a performance: no daily progress, claims or rewards.
  // The sheet only reads them; choosing happens on the goals route.
  const goalHead = view.element('header', 'pg-heading', undefined, goals);
  letter(view, view.element('h3', '', undefined, goalHead), 'goals', '开演目标');
  view.element('b', 'ps-sheet-count', `可选 ${options.filter(goal => goal.available).length}/${options.length}`, goalHead);
  const blocked=options.filter(goal=>!goal.available);
  if(blocked.length)view.element('p','goal-record-condition',blocked.map(goal=>goal.label).join('、')+'需保存当前成员的本章纪录。',goals);
  const list = view.element('ul', 'pg-goal-list', undefined, goals);
  for (const goal of options) {
    const row = view.element('li', 'pg-goal', undefined, list);
    row.dataset.eventGoal = goal.id; row.dataset.availability = goal.available ? 'available' : 'locked';
    view.element('strong', '', goal.label, row);
    view.element('b', 'ps-goal-availability', goal.available ? '可设定' : '未开放', row);
    view.element('small', '', goal.available ? goal.description : goal.id === 'steady' ? '挑战无伤或更少受击' : '挑战更短通关用时', row);
  }
  const choose=go(view, goals, 'set-goal', '设置本场目标', '选定后在备战页确认本场条件', 'goals', 'events-open-goals', 'selected', 'pg-command pg-primary');
  choose.setAttribute('aria-label','设置本场目标');
}

// Keep the practice floor and preparation tools reachable from the same directory.
// Two stacked horizontal entries (picture | wordmark + one dynamic line) over the stage, for one performer.
export function renderPracticeTools(view, root, model, profile) {
  dropScene(root);
  root.dataset.practiceStudio = '267';
  const backdrop = view.element('img', 'ps-stage', undefined, root);
  backdrop.src = `${JOURNEY_ART}/practice-room.webp`; backdrop.alt = ''; backdrop.draggable = false;
  const arrangements = getArrangementCatalog(model.member.id), options = getPublicRunGoalOptions(profile);
  const actor = view.element('p', 'ps-actor', undefined, root);
  view.element('small', '', '当前成员', actor); view.element('strong', '', model.member.name, actor);
  const mode=model.performance.modes.find(row=>row.modeId==='rehearsal');
  const destination=model.chapters.find(row=>row.id===mode.chapterId)?.name||model.chapter.name;
  const practice=view.button(root,'单站实战排练',()=>{if(view.page==='sideplay'&&view.root.contains(practice))view.showPage('rehearsal');},{className:'ps-floor-entry',icon:'play',action:'sideplay-open-rehearsal'});
  const words=practice.querySelector('span');
  words.textContent=mode.canStart?'配置单站排练':'查看单站排练条件';
  view.element('small','',mode.canStart?destination+' · 本轮无巡演奖励':mode.state==='locked'?'先通关「'+destination+'」':mode.reason,practice);
  practice.setAttribute('aria-label',words.textContent+' · '+practice.querySelector('small').textContent);
  const tools = view.element('section', 'ps-entries', undefined, root); tools.setAttribute('aria-label', '演出准备');
  for (const [letterKey, label, detail, page, action, uiIcon, picture] of [
    ['plan', '编排资料库', `两段编排 · ${arrangements.first.length * arrangements.second.length} 种组合`, 'library', 'sideplay-open-library', 'info', 'practice-score'],
    ['goals', '开演目标', `${model.chapter.name} · 可选 ${options.filter(goal => goal.available).length}/${options.length}`, 'goals', 'sideplay-open-goals', 'selected', 'practice-target'],
  ]) {
    const button = go(view, tools, letterKey, label, detail, page, action, uiIcon, 'ps-entry');
    const image = view.element('img', 'ps-entry-art', undefined, null);
    image.src = `${STUDIO_ART}/${picture}.webp`; image.alt = ''; image.draggable = false;
    button.insertBefore(image, button.children[0]);
    button.querySelector('.pg-glyph').remove();
    view.element('span','ps-entry-enter',undefined,button).dataset.uiIcon = 'back';
  }
}

// Re-skins the two canonical playhub buttons in place: handler, aria-label and availability stay theirs.
export function framePlayModes(view, main) {
  const modes = view.element('section', 'pg-modes', undefined, main); modes.setAttribute('aria-label', '压轴排练');
  for (const [action, [art, letterKey]] of Object.entries(MODE_ART)) {
    const button = main.querySelector(`[data-action=${action}]`);
    const title = button.querySelector('strong'), status = button.querySelector('small');
    button.replaceChildren(); button.className = 'pg-mode';
    const image = view.element('img', 'pg-mode-art', undefined, button);
    image.src = `${JOURNEY_ART}/${art}.webp`; image.alt = ''; image.draggable = false;
    const plate = view.element('span', 'pg-mode-plate', undefined, button);
    const heading = view.element('span', 'pg-mode-letter', undefined, plate);
    const mark = view.element('img', 'pg-letter', undefined, heading);
    mark.src = `${JOURNEY_ART}/letter-${letterKey}.webp`; mark.alt = ''; mark.draggable = false;
    title.className = 'pg-sr'; heading.append(title); plate.append(status);
    const entry = view.element('span', 'pg-mode-enter', undefined, plate);entry.dataset.uiIcon='back';
    if (button.dataset.availability !== 'ready') view.element('span', 'pg-mode-lock', undefined, button).dataset.uiIcon = 'lock';
    modes.append(button);
  }
}

// Pre-run goal selector (not missions): reshapes the canonical renderRunGoals output in place.
// Option buttons keep their callbacks, data-goal, disabled and aria-pressed; selecting never confirms.
const GOAL_STATE = button => button.disabled ? '需纪录' : button.getAttribute('aria-pressed') === 'true' ? '已预选' : '可选';

export function frameRunGoals(view, main) {
  const heading = main.querySelector('h2.shell-page-heading');
  const title = heading.textContent; heading.replaceChildren(); letter(view, heading, 'goals', title);
  const [context, confirmed, rule] = main.querySelectorAll('p.system-context');
  context.className = 'pg-goal-context';
  for (const button of main.querySelectorAll('.run-goal-option')) {
    button.classList.add('pg-goal-choice');
    button.children[0].remove();
    const icon=view.element('span','pg-goal-icon',undefined,button);
    if(button.disabled||button.getAttribute('aria-pressed')==='true')icon.dataset.uiIcon=button.disabled?'lock':'selected';
    button.insertBefore(icon,button.children[0]);
    const name = button.querySelector('strong'), text = name.parentNode;
    const mark = view.element('img', 'pg-goal-mark', undefined, text);
    mark.src = `${JOURNEY_ART}/goal-${button.dataset.goal}.webp`; mark.alt = ''; mark.draggable = false;
    text.insertBefore(mark, name); name.className = 'pg-sr';
    view.element('b', 'pg-goal-state pg-sr', GOAL_STATE(button), button);
  }
  // Draft (预选) and confirmed (当前已确认) stay two separate status lines in one compact block.
  const status = view.element('div', 'pg-goal-status', undefined, main);
  main.insertBefore(status, main.querySelector('.challenge-selection'));
  const draft=main.querySelector('.challenge-selection');
  const same=view.goalKind===(main.dataset.committedGoal||'standard');
  draft.hidden=same;
  status.append(draft, confirmed);
  if(same)confirmed.textContent=confirmed.textContent.replace('当前已确认','当前');
  const threshold=view.element('strong','goal-window-threshold',confirmed.textContent,rule);
  rule.insertBefore(threshold,rule.firstChild);
  // The fixed-threshold rule is read on demand in the shared sheet instead of a prose slab.
  rule.hidden = true;
  const info = view.button(context, '目标规则', () => openHierarchySheet(view, {title: '目标规则', content: rule, trigger: info}),
    {className: 'pg-goal-info', action: 'goals-rules', iconOnly: true});
  info.dataset.uiIcon = 'info'; view.element('span', 'pg-sr', '目标规则', info);
}
