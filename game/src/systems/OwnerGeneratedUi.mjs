const ART = 'art/owner-ui-family-20261031/';
const ROOM_ART = {stage: 'venue', rehearsal: 'training', lounge: 'companion'};
const STEP_STATE = {cleared: '已通关', available: '可挑战', locked: '未解锁'};

function icon(view, parent, id) {
  parent.dataset.ownerUiIcon = id;
  if (parent.querySelector('.owner-ui-icon')) return;
  const image = view.doc.createElement('img');
  image.className = 'owner-ui-icon';
  image.alt = ''; image.setAttribute('aria-hidden', 'true');
  image.width = 256; image.height = 256; image.draggable = false;
  image.src = ART + id + '.webp';
  parent.append(image);
}

function controls(view, selector, skin, art) {
  for (const node of view.root.querySelectorAll(selector)) {
    node.dataset.ownerUiSkin = skin;
    if (art) icon(view, node, art);
  }
}

function bands(view, selector, art) {
  for (const node of view.root.querySelectorAll(selector)) node.dataset.ownerUiBand = art;
}

// Decorate existing semantic nodes only; the screen owns all commands and data.
export function mountOwnerGeneratedUi(view) {
  const root = view.root, page = root.dataset.page;
  delete root.dataset.ownerGeneratedUi;
  if (view.disposed || root.dataset.cast !== 'owner-three' || root.dataset.uiPass !== 'stage-v2'
    || !['desk', 'lounge', 'venue'].includes(page)) return false;
  root.dataset.ownerGeneratedUi = 'true';
  if (page === 'desk') {
    controls(view, '.home-space-entry[data-action=home-open-lounge]', 'primary', 'companion');
    controls(view, '.home-space-entry[data-action=home-open-venue]', 'secondary', 'venue');
    const summary = root.querySelector('.lobby-details')?.querySelector('summary');
    if (summary) { summary.dataset.ownerUiDisclosure = 'true'; icon(view, summary, 'progress'); }
    controls(view, '.lobby-session-action', 'secondary', 'training');
    // One native route command; each chapter step gets its own surface and both real facts.
    for (const route of root.querySelectorAll('.shell-progress-route')) {
      route.dataset.ownerUiRoute = 'steps';
      const facts = [];
      for (const step of route.querySelectorAll('.shell-progress-step')) {
        const current = step.classList.contains('is-current');
        const fact = (current ? '当前 · ' : '') + STEP_STATE[step.dataset.state];
        step.dataset.ownerUiStep = step.dataset.state;
        if (current) step.dataset.ownerUiCurrent = 'true';
        if (!step.querySelector('.owner-ui-step-state')) view.element('small', 'owner-ui-step-state', fact, step);
        facts.push(`${step.querySelector('b').textContent} ${step.querySelector('span').textContent} ${fact}`);
      }
      route.setAttribute('aria-description', facts.join('；'));
    }
    controls(view, '.lobby-record-action', 'secondary', 'history');
    for (const section of root.querySelectorAll('.lobby-tour-next')) {
      section.dataset.ownerUiBand = 'ledger';
      for (const button of section.querySelectorAll('button')) {
        button.dataset.ownerUiSkin = 'secondary'; icon(view, button, 'progress');
      }
    }
    for (const selector of ['.lobby-session-overview', '.lobby-progress', '.lobby-last-run']) bands(view, selector, 'ledger');
  }
  if (page === 'lounge') {
    // The visit record lives inside the dialogue heading, so it shares the dialogue band.
    bands(view, '.pm-dialogue', 'dialogue');
    controls(view, '.pm-cast-option', 'tab');
    for (const button of root.querySelectorAll('.pm-topic')) {
      const id = button.dataset.action;
      button.dataset.ownerUiSkin = 'tab';
      icon(view, button, id === 'companion-topic-greeting' ? 'companion'
        : id === 'companion-topic-rehearsal' ? 'training' : 'progress');
    }
    // Answers are the decision surface; native text only, the selected bitmap marks the saved one.
    controls(view, '.pm-answer', 'primary');
    controls(view, '.pm-question-back', 'tab');
  }
  if (page === 'venue') {
    for (const button of root.querySelectorAll('.pm-room-hotspot')) {
      button.dataset.ownerUiSkin = 'tab'; icon(view, button, ROOM_ART[button.dataset.roomTarget]);
    }
    controls(view, '.pm-room-member', 'tab');
    controls(view, '.pm-room-program', 'tab');
    controls(view, '.pm-command', 'secondary', 'venue');
    // Prepare is already a real disabled/enabled command, never a grant surface.
    for (const button of root.querySelectorAll('.pm-prepare')) {
      button.dataset.ownerUiSkin = 'primary';
      const image = button.querySelector('.owner-ui-icon');
      button.dataset.ownerUiIcon = 'play'; image.src = ART + 'play.webp';
    }
    bands(view, '.pm-room-saved', 'ledger');
    for (const header of root.querySelectorAll('.pm-section-heading')) icon(view, header, ROOM_ART[header.closest('[data-room]').dataset.room]);
  }
  return true;
}
