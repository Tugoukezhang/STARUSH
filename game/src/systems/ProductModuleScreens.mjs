import {appendMemberActionPreview} from './MemberActionPreview.mjs';
import {getProductHubSections} from '../utils/publicProductHub.mjs';
import {BACKSTAGE_ROOMS, BACKSTAGE_TOPICS, loadBackstageProgress, updateBackstageProgress, getCompanionLine} from '../utils/publicBackstageProgress.mjs';
import {getCompanionQuestion} from '../utils/publicCompanionDialogue.mjs';
import {loadPublicProfile} from '../utils/publicRunProgression.mjs';
import {UI_CAST, getUiPerformer, isUserCastEnabled} from '../utils/userCast.mjs';
import {renderProgramEvents, renderPracticeTools} from './ProgramMenuPages.mjs';
import {mountMenuAvatar, setMemberPickerAvatar} from './MenuPortraitAvatar.mjs';
import {mountPortraitInteraction} from './HomePortraitInteraction.mjs';
import {openHierarchySheet} from './HierarchySheets.mjs';
import {mountConsoleUiArt} from './HierarchyUiArt.mjs';
import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';

const PAGES = {
  backstage: ['巡演后台', 'BACKSTAGE', 'clapperboard'],
  lounge: ['成员休息室', 'LOUNGE', 'users'],
  venue: ['场馆事务', 'VENUE', 'clapperboard'],
  events: ['公演企划', 'PROGRAM', 'route'],
  recruitment: ['成员介绍', 'MEMBERS', 'users'],
  sideplay: ['练习目录', 'PRACTICE', 'play'],
  services: ['设置与存档', 'LOCAL', 'settings-2'],
};
const ICONS = {'home': 'clapperboard', 'music': 'clapperboard', 'sparkles': 'users', 'save': 'backpack',
  'volume-2': 'settings-2', 'swords': 'route', 'flag': 'route', 'layers': 'book-open',
  'palette': 'clapperboard', 'heart': 'users', 'gamepad-2': 'play', 'calendar': 'route',
  'user-plus': 'users', 'ticket': 'backpack', 'cloud': 'lock'};
const iconName = name => ICONS[name] || name || 'clapperboard';
const readMessage = status => ({protected: '本机后台记录受保护或已损坏，未覆盖原记录。',
  unavailable: '无法读取本机后台记录，暂不可保存。'}[status] || '本机记录');
const commandMessage = status => ({saved: '已保存到本机。', unchanged: '本机记录未改变。',
  protected: '本机后台记录受保护或已损坏，未覆盖原记录。', unavailable: '无法读取本机后台记录，暂不可保存。',
  'storage-error': '保存失败，未确认新记录。', 'write-failed': '保存失败，未确认新记录。',
  'write-denied': '保存失败：当前页面没有存档写入权限。',
  'invalid-command': '配置无效，未保存。'}[status] || '保存失败，未确认新记录。');
const accepted = status => status === 'saved' || status === 'unchanged';

function statusLine(view, parent, text, className = 'pm-save-status') {
  const node = view.element('p', className, text, parent);
  node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); return node;
}

function command(view, parent, label, callback, options) {
  const page = view.page;
  const button = view.button(parent, label, () => {
    if (view.page !== page || !view.root.contains(button)) return;
    callback();
  }, options);
  return button;
}

function jump(view, parent, label, description, page, action, icon = 'arrow-right') {
  const button = command(view, parent, label, () => view.showPage(page), {className: 'pm-entry', icon: iconName(icon), action});
  button.replaceChildren(); view.icon(iconName(icon), button, true);
  const copy = view.element('span', 'pm-entry-copy', undefined, button);
  view.element('strong', '', label, copy);
  if (description) view.element('small', '', description, copy);
  view.icon('arrow-right', button, true); return button;
}

function heading(view, parent, title, code, icon) {
  const head = view.element('header', 'pm-section-heading', undefined, parent);
  view.icon(iconName(icon), head, true); view.element('h3', '', title, head);
  if (code) view.element('small', '', code, head); return head;
}

function scene(view, root, model, member) {
  const page = view.page, [title, code] = PAGES[page];
  const stage = view.element('section', 'pm-scene', undefined, root); stage.dataset.member = member.id;
  const backdrop = view.element('img', 'pm-scene-art', undefined, stage);
  const venueScene = ['backstage', 'venue', 'sideplay'].includes(page), companion = page === 'lounge';
  backdrop.src = page === 'events' ? CHAPTER_VENUE_ART[model.chapter.id]
    : venueScene ? 'art/venue-shell-20261026/venue.webp'
      : companion ? 'art/companion-room-20261031/lounge.webp' : 'art/home-comic-backstage-20261022/backstage.webp';
  if (page === 'recruitment' && isUserCastEnabled()) backdrop.src = 'art/showbill/archive.webp';
  backdrop.alt = ''; backdrop.width = venueScene || companion ? 1024 : 768;
  backdrop.height = venueScene || companion ? 1536 : page === 'events' ? 512 : 1280;
  const copy = view.element('div', 'pm-scene-copy', undefined, stage);
  view.element('small', 'pm-scene-code', code, copy);
  view.element('h2', '', title, copy);
  view.element('strong', 'pm-scene-member', member.name, copy);
  view.element('span', 'pm-scene-role', member.actionName, copy);
  if (companion) stage.dataset.experience = 'companion';
  if (page === 'venue') stage.dataset.experience = 'venue';
  const portrait = companion
    ? command(view, stage, `与${member.name}互动`, () => {}, {className: 'pm-scene-portrait', action: 'companion-touch'})
    : view.element('div', 'pm-scene-portrait', undefined, stage);
  if(companion)portrait.replaceChildren();
  view.mark(portrait, member, true, companion ? {animate: true, background: backdrop} : null);
  const caption = view.element('div', 'pm-scene-caption', undefined, stage);
  view.element('span', '', page === 'lounge' ? '休息中' : page === 'venue' ? '本机排班' : model.chapter.name, caption);
  view.element('span', '', page === 'lounge' ? '本机相处记录' : `巡演 ${model.clearedCount}/${model.chapters.length}`, caption);
}

function castStrip(view, root, selected, prefix, onSelect) {
  const strip = view.element('div', 'pm-cast-strip', undefined, root);
  strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', prefix === 'companion' ? '休息室成员' : '介绍成员');
  for (const member of UI_CAST) {
    const button = command(view, strip, member.name, () => onSelect(member.id), {className: 'pm-cast-option', action: `${prefix}-member-${member.id}`});
    button.setAttribute('aria-pressed', String(member.id === selected)); button.replaceChildren();
    const headshot=view.element('img','pm-member-headshot',undefined,button);
    setMemberPickerAvatar(headshot,member.id);
    view.element('span', '', member.name, button);
  }
  return strip;
}

function backstage(view, root, model, profile) {
  const shortcuts = view.element('nav', 'pm-shortcuts', undefined, root); shortcuts.setAttribute('aria-label', '后台分区');
  for (const [page, moduleId, detail] of [
    ['lounge', 'bonds', '成员与话题'], ['venue', 'venue', '三间房间'], ['events', 'events', '目标与筹备'],
    ['recruitment', 'recruit', '三位成员'], ['sideplay', 'sideplay', '排练与编排'], ['services', 'save', '本机存档'],
  ]) {
    const button = jump(view, shortcuts, PAGES[page][0], detail, page, `backstage-open-${page}`, PAGES[page][2]);
    button.dataset.productModule = moduleId; button.dataset.category = page;
  }
  const sections = getProductHubSections(profile);
  const directory = view.element('div', 'pm-directory', undefined, root);
  heading(view, directory, '公演事务索引', String(sections.reduce((n, s) => n + s.entries.length, 0)).padStart(2, '0'), 'book-open');
  const used = new Set(['lounge', 'venue', 'events', 'recruitment', 'sideplay', 'services']);
  for (const section of sections) {
    const group = view.element('details', 'pm-directory-section', undefined, directory);
    group.dataset.hubSection = section.id; group.dataset.category = section.id; group.open = section.id === 'members';
    const summary = view.element('summary', 'pm-category-heading', undefined, group);
    view.icon(iconName(section.icon), summary, true); view.element('strong', '', section.label, summary);
    view.element('small', '', String(section.entries.length).padStart(2, '0'), summary);
    for (const entry of section.entries) {
      const action = `backstage-open-${entry.page || 'unavailable'}${used.has(entry.page) ? '-' + entry.id : ''}`;
      used.add(entry.page);
      const button = jump(view, group, entry.label, entry.description, entry.page, action, entry.icon);
      button.dataset.hubEntry = entry.id; button.dataset.productModule = entry.id; button.dataset.availability = entry.status;
      button.disabled = !entry.page || entry.page === 'backstage';
      view.element('small', 'pm-entry-state', {'available': '现有内容', framework: '本机框架', 'service-required': '未接入'}[entry.status] || '未开放', button);
    }
  }
  const ledger = view.element('div', 'pm-ledger', undefined, root);
  view.element('span', '', `通关 ${model.clears} 场`, ledger); view.element('span', '', `练习笔记 ${model.resources.balance}`, ledger);
}

// Topic -> authored question -> one saved answer. Opening a question never writes; only an
// accepted reply command changes history, pressed state and the spoken response.
function lounge(view, root, member, profile, loaded) {
  const ready = loaded.status === 'ready';
  root.dataset.companionStudio = '265';
  // Full navigation releases the game's save lock and renderer before the room starts.
  const homeEntry = view.element('a', 'pm-home-entry', undefined, root);
  homeEntry.addEventListener('click', event => {
    if (view.disposed || view.navigating || view.scene._sessionExperience?.isBlocking()) { event.preventDefault(); return; }
    const returnUrl = new URL(view.doc.location.href);
    returnUrl.searchParams.set('fromHome', '1');
    view.doc.defaultView.history.replaceState(view.doc.defaultView.history.state, '', returnUrl);
  });
  homeEntry.href = 'home-space/companion.html' + '?member=' + encodeURIComponent(member.id);
  homeEntry.setAttribute('aria-label', '安可居所'); homeEntry.title = '安可居所';
  homeEntry.draggable = false;
  const homeGlyph = view.element('img', 'pm-home-glyph', undefined, homeEntry);
  homeGlyph.src = 'art/home-entry-20261103/home.webp'; homeGlyph.alt = ''; homeGlyph.draggable = false;
  view.element('span', 'pm-home-label', '安可居所', homeEntry);
  let memory = loaded.state;
  if (!ready || view.productModuleQuestion?.memberId !== member.id) view.productModuleQuestion = null;
  const questions = new Map(BACKSTAGE_TOPICS.map(topic => [topic.id, getCompanionQuestion(member.id, topic.id)]));
  const resting = () => getCompanionLine(member.id, memory.topics[member.id] ?? BACKSTAGE_TOPICS[0].id, profile, memory);
  const response = view.element('section', 'pm-dialogue', undefined, root);
  const speaker = view.element('header', 'pm-dialogue-heading', undefined, response);
  const avatar = view.element('span', 'pm-speaker-avatar', undefined, speaker);
  mountMenuAvatar(view, avatar, member.id);
  view.element('small', 'pm-speaker', member.name, speaker);
  // The speaker already names the member; the record only carries saved visits and last topic.
  const history = view.element('div', 'pm-ledger', undefined, speaker);
  const visits = view.element('span', '', '', history); visits.dataset.companionVisits = member.id;
  const recent = view.element('span', '', '', history); recent.dataset.companionTopic = member.id;
  const open = view.productModuleQuestion;
  const line = statusLine(view, response, open ? questions.get(open.topicId).prompt : resting(), 'pm-response');
  response.hidden = false; line.setAttribute('aria-atomic', 'true');
  const stage = root.querySelector('.pm-scene'), portrait = stage.querySelector('[data-action="companion-touch"]');
  const interaction = mountPortraitInteraction(view, portrait, stage, member.id, {output: {bubble: response, line},topicDock:true});
  view.portraitInteractionDispose = interaction;
  // One contextual dock: either the topic toolbar or the open question's answers, never both.
  const choices = view.element('div', 'pm-choices', undefined, root);
  const topics = view.element('div', 'pm-topics', undefined, choices); topics.setAttribute('role', 'group'); topics.setAttribute('aria-label', '交谈话题');
  const question = view.element('div', 'pm-question', undefined, choices);
  const topicButtons = new Map(), answerGroups = new Map();
  const present = topicId => {
    view.productModuleQuestion = topicId ? {memberId: member.id, topicId} : null;
    choices.dataset.companionMode = topicId ? 'question' : 'topics';
    topics.hidden = Boolean(topicId); question.hidden = !topicId;
    for (const [id, group] of answerGroups) group.hidden = id !== topicId;
  };
  const back = command(view, question, '返回话题', () => {
    const topicId = view.productModuleQuestion?.topicId;
    present(null); line.textContent = resting();
    if (topicId) topicButtons.get(topicId).focus();
  }, {className: 'pm-question-back', icon: 'arrow-left', lineIcon: true, iconOnly: true, action: 'companion-question-back'});
  for (const topic of BACKSTAGE_TOPICS) {
    const button = command(view, topics, topic.label, () => {
      if (view.doc.hidden || view.root.inert) return;
      present(topic.id); interaction.speak(questions.get(topic.id).prompt);
      answerGroups.get(topic.id).children[0].focus();
    }, {className: 'pm-topic', icon: topic.id === 'greeting' ? 'users' : topic.id === 'rehearsal' ? 'clapperboard' : 'route', lineIcon: true, action: `companion-topic-${topic.id}`});
    topicButtons.set(topic.id, button); button.disabled = !ready;
    // Static generated wordmark + glyph hosts; Codex mounts the art by these exact keys.
    button.dataset.companionLetter = topic.id; button.dataset.companionGlyph = topic.id;
    const {prompt, choices: replies} = questions.get(topic.id);
    const group = view.element('div', 'pm-answers', undefined, question);
    group.dataset.companionAnswers = topic.id; group.setAttribute('role', 'group'); group.setAttribute('aria-label', prompt);
    answerGroups.set(topic.id, group);
    for (const reply of replies) {
      const answer = command(view, group, reply.label, () => {
        if (view.doc.hidden || view.root.inert || view.productModuleQuestion?.topicId !== topic.id) return;
        const result = updateBackstageProgress({type: 'reply', memberId: member.id, topicId: topic.id, replyId: reply.id});
        view.productModuleMessage = {page: 'lounge', text: commandMessage(result.status)};
        status.textContent = view.productModuleMessage.text;
        if (!accepted(result.status)) return;
        memory = result.state; record();
        interaction.speak(getCompanionLine(member.id, topic.id, profile, memory));
      }, {className: 'pm-answer', action: `companion-answer-${reply.id}`});
      answer.dataset.companionReply = reply.id;
    }
  }
  // Record drawer body: only saved facts, rebuilt from the accepted memory on every record().
  const archive = view.element('section', 'pm-companion-record', undefined, root);
  archive.hidden = true; archive.setAttribute('aria-label', '相处记录');
  if (!ready) view.element('p', 'pm-record-status', readMessage(loaded.status), archive);
  const empty = view.element('p', 'pm-record-empty', '还没有相处记录。回到休息室，选“打个招呼”并回应'+member.name+'。', archive);
  const rows = view.element('dl', 'pm-record-rows', undefined, archive);
  const record = () => {
    rows.replaceChildren();
    const met = ready ? UI_CAST.filter(row => memory.visits[row.id] > 0) : [];
    empty.hidden = !ready || met.length > 0;
    for (const {id} of met) {
      const row = view.element('div', 'pm-record-row', undefined, rows); row.dataset.recordMember = id;
      const last = memory.conversations[id], topic = BACKSTAGE_TOPICS.find(entry => entry.id === memory.topics[id]);
      view.element('dt', '', getUiPerformer(id).name, row).dataset.record = 'member';
      view.element('dd', '', `本机交谈 ${memory.visits[id]} 次`, row).dataset.record = 'visits';
      view.element('dd', '', `最近话题 ${topic.label}`, row).dataset.record = 'topic';
      if (!last) continue;
      const reply = getCompanionQuestion(id, last.topicId).choices.find(entry => entry.id === last.replyId);
      view.element('dd', '', `你的回应 ${reply.label}`, row).dataset.record = 'reply';
      view.element('dd', 'pm-record-response', reply.response, row).dataset.record = 'response';
    }
    const topicId = memory.topics[member.id], saved = memory.conversations[member.id];
    visits.textContent = `本机交谈 ${memory.visits[member.id]} 次`;
    recent.textContent = topicId ? `最近话题 ${BACKSTAGE_TOPICS.find(topic => topic.id === topicId).label}` : '尚未交谈';
    for (const [id, control] of topicButtons) {
      const recent = id === topicId;
      control.setAttribute('aria-pressed', String(recent));
      const seen=recent || memory.topicHistory?.[member.id]?.includes(id);
      control.dataset.lastTopic = String(recent);
      control.dataset.topicState = recent ? '最近' : seen ? '聊过' : '可聊';
      control.setAttribute('aria-label', BACKSTAGE_TOPICS.find(topic=>topic.id===id).label+' · '+control.dataset.topicState);
    }
    for (const [id, group] of answerGroups) for (const control of group.children) {
      const chosen = saved?.topicId === id && saved.replyId === control.dataset.companionReply;
      control.setAttribute('aria-pressed', String(chosen)); control.disabled = !ready || chosen;
    }
  };
  record(); present(open?.topicId);
  const status = statusLine(view, root, loaded.status !== 'ready' ? readMessage(loaded.status) : view.productModuleMessage?.page === 'lounge' ? view.productModuleMessage.text : readMessage(loaded.status));
}

function venue(view, root) {
  const loaded = loadBackstageProgress(), {state} = loaded, ready = loaded.status === 'ready';
  const scene = root.querySelector('.pm-scene');
  const selected = view.productModuleRoom || BACKSTAGE_ROOMS[0].id;
  // B266: one-shot intents set only by the editor's own commands; consumed here so a later visit never resurrects the editor.
  const reopen = view.venueEditorReopen === selected, note = reopen ? view.venueEditorNote : null;
  view.venueEditorReopen = null; view.venueEditorNote = null;
  root.dataset.venueStudio = '266'; root.dataset.venueRoom = selected;
  if (reopen) root.dataset.venueEditor = 'open';
  const memberName = id => id ? getUiPerformer(id).name : '未排班';
  const programName = (room, id) => room.programs.find(p => p.id === id).name;
  const hotspots=view.element('nav','pm-room-map',undefined,scene);hotspots.setAttribute('aria-label','场馆房间');
  for(const [index,room] of BACKSTAGE_ROOMS.entries()){
    const saved=state.rooms[room.id];
    const button=command(view,hotspots,room.name,()=>{
      if(selected===room.id)return;
      if(view.venueDraft)view.productModuleMessage={page:'venue',text:'已切换房间，未保存的排班未提交。'};
      view.productModuleRoom=room.id;view.venueDraft=null;view.render(`[data-action="venue-room-${room.id}"]`);
    },{className:'pm-room-hotspot',action:`venue-room-${room.id}`,icon:room.id==='lounge'?'users':'clapperboard'});
    button.dataset.roomTarget=room.id;button.setAttribute('aria-pressed',String(selected===room.id));
    button.dataset.roomState=saved.prepared?'prepared':saved.memberId?'assigned':'empty';
    // A prepared room still names its member; an empty room never shows a default program as scheduled.
    view.element('small','',saved.memberId?`${memberName(saved.memberId)} · ${saved.prepared?'已筹备':'待筹备'}`:'待安排',button);
  }
  const plan = view.element('div', 'pm-venue-plan', undefined, root);
  const room=BACKSTAGE_ROOMS.find(row=>row.id===selected), index=BACKSTAGE_ROOMS.indexOf(room);
  {
    const saved = state.rooms[room.id], row = view.element('section', 'pm-room', undefined, plan); row.dataset.room = room.id;
    const source=JSON.stringify(saved);
    if(view.venueDraft?.roomId===room.id&&view.venueDraft.source!==source){
      view.venueDraft=null;view.productModuleMessage={page:'venue',text:'房间排班已更新，旧的未保存选择未提交，请重新选择。'};
    }
    const draft=view.venueDraft?.roomId===room.id?view.venueDraft:{roomId:room.id,memberId:saved.memberId,programId:saved.programId,source};
    const edited=focus=>{view.venueDraft=draft;view.venueEditorReopen=room.id;view.render(focus);};
    heading(view, row, room.name, `0${index + 1}`, index === 2 ? 'users' : 'clapperboard');
    const fields = view.element('div', 'pm-room-fields', undefined, row);
    const members=view.element('div','pm-room-members',undefined,fields);members.setAttribute('role','group');members.setAttribute('aria-label',`${room.name}成员`);
    for(const candidate of UI_CAST){
      const button=command(view,members,candidate.name,()=>{draft.memberId=candidate.id;edited(`[data-room-member-option="${candidate.id}"]`);},{className:'pm-room-member'});
      button.dataset.roomMemberOption=candidate.id;button.setAttribute('aria-pressed',String(draft.memberId===candidate.id));button.disabled=!ready;button.replaceChildren();
      const image=view.element('img','pm-member-headshot',undefined,button);setMemberPickerAvatar(image,candidate.id);
      view.element('span','',candidate.name,button).dataset.uiLetter=candidate.id;
    }
    const programs=view.element('div','pm-room-programs',undefined,fields);programs.setAttribute('role','group');programs.setAttribute('aria-label',`${room.name}节目`);
    for(const item of room.programs){
      const button=command(view,programs,item.name,()=>{draft.programId=item.id;edited(`[data-room-program-option="${item.id}"]`);},{className:'pm-room-program'});
      button.dataset.roomProgramOption=item.id;button.setAttribute('aria-pressed',String(draft.programId===item.id));button.disabled=!ready;
      button.querySelector('span').dataset.venueLetter=item.id;
    }
    // Persisted record only: member, program (when someone is scheduled) and prepared state as separate native fields.
    const savedLine = view.element('p', 'pm-room-saved', undefined, row);
    savedLine.dataset.roomSaved = room.id;
    const part = (name, text) => {
      if (savedLine.children.length) view.element('span', 'pm-saved-sep', ' · ', savedLine).setAttribute('aria-hidden', 'true');
      view.element('span', '', text, savedLine).dataset.savedField = name;
    };
    part('member', memberName(saved.memberId));
    if (saved.memberId) part('program', programName(room, saved.programId));
    part('state', saved.prepared ? '已筹备' : '待筹备');
    const actions = view.element('div', 'pm-room-actions', undefined, row);
    const assign = command(view, actions, '保存排班', () => {
      const current=loadBackstageProgress();
      if(current.status==='ready'&&JSON.stringify(current.state.rooms[room.id])!==draft.source){
        view.venueDraft=null;view.productModuleMessage={page:'venue',text:'房间排班已更新，旧的未保存选择未提交，请重新选择。'};
        view.venueEditorReopen=room.id;view.venueEditorNote=view.productModuleMessage.text;
        view.render(`[data-action="venue-room-${room.id}"]`);return;
      }
      const result = updateBackstageProgress({type: 'assign', roomId: room.id, memberId: draft.memberId, programId: draft.programId});
      view.productModuleMessage = {page: 'venue', text: `${room.name} · ${commandMessage(result.status)}`};
      // Accepted: the draft is the record now, the editor closes and the next step is the outside 筹备 command.
      if(accepted(result.status)){view.venueDraft=null;view.render(`[data-action="venue-prepare-${room.id}"]`);return;}
      view.venueEditorReopen=room.id;view.venueEditorNote=view.productModuleMessage.text;
      view.render(`[data-action="venue-assign-${room.id}"]`);
    }, {className: 'pm-command', icon: 'check', action: `venue-assign-${room.id}`});
    const prepare = command(view, actions, '确认筹备', () => {
      const result = updateBackstageProgress({type: 'prepare', roomId: room.id});
      view.productModuleMessage = {page: 'venue', text: `${room.name} · ${commandMessage(result.status)}`}; view.render(`[data-action="venue-prepare-${room.id}"]`);
    }, {className: 'pm-command pm-prepare', icon: 'clapperboard', action: `venue-prepare-${room.id}`});
    const draftLine = view.element('small', 'pm-room-draft', '', row);
    const editorNote = view.element('p', 'vs-editor-status', note || '', row); editorNote.hidden = !note;
    {
      const dirty = draft.memberId !== saved.memberId || draft.programId !== saved.programId;
      assign.disabled = !ready || !draft.memberId || !dirty;
      prepare.disabled = !ready || !saved.memberId || saved.prepared || dirty;
      draftLine.dataset.draftState = dirty ? 'dirty' : 'clean';
      draftLine.textContent = dirty ? `待保存 · ${memberName(draft.memberId)} · ${programName(room,draft.programId)}`
        : saved.prepared ? '与本机记录一致 · 已筹备' : '与本机记录一致';
    }
  }
  const status = statusLine(view, root, loaded.status !== 'ready' ? readMessage(loaded.status) : view.productModuleMessage?.page === 'venue' ? view.productModuleMessage.text : readMessage(loaded.status));
  status.dataset.venueStatus = !ready ? 'error' : view.productModuleMessage?.page === 'venue' ? 'message' : 'idle';
}

function events(view, root, model, profile) {
  renderProgramEvents(view, root, model, profile);
}

function recruitment(view, root, member) {
  castStrip(view, root, member.id, 'recruitment', id => {view.productModuleRecruit = id; view.render(`[data-action="recruitment-member-${id}"]`);});
  const dossier = view.element('section', 'pm-dossier', undefined, root);
  heading(view, dossier, member.name, '初始成员', 'users');
  view.element('strong', 'pm-role-name', member.actionName, dossier);
  view.element('p', '', member.actionSummary, dossier);
  appendMemberActionPreview(view,dossier,member.id);
  command(view, root, '查看成员阵容', () => {
    view.selection.previewMember(member.id); view.showPage('roster');
  }, {className: 'pm-service-command', icon: 'users', action: 'recruitment-open-roster'});
}

// Practice is preparation only; finale-trial/rehearsal live solely in the Tour challenge catalog (playhub).
function sideplay(view, root, model, profile) {
  renderPracticeTools(view, root, model, profile);
}

// B268 console studio: the save state leads (no member portrait, no LOCAL tag); sound/backup are the two real
// session commands; the three unavailable network services are read only, inside the shared native sheet.
function services(view, root, model) {
  const session = view.scene._sessionExperience;
  root.dataset.consoleStudio = '268'; root.dataset.consolePage = 'services';
  root.querySelector('.pm-scene').hidden = true;
  const desk=view.element('img','cs-desk',undefined,root);desk.src='art/showbill/archive.webp';desk.alt='';desk.draggable=false;
  root=view.element('section','cs-local-console',undefined,root);
  view.element('h3', 'cs-heading', '本机记录', root).dataset.consoleLetter = 'local';
  const ledger = view.element('div', 'pm-local-state', undefined, root);
  ledger.setAttribute('role', 'status');
  const state = model.recovery ? 'recovery' : model.hasPendingSave ? 'pending' : model.persisted ? 'saved' : 'none';
  ledger.dataset.saveState = state;
  view.element('strong', '', {recovery: '存档受保护', pending: '进度待保存', saved: '公演进度已保存', none: '暂无已保存公演'}[state], ledger);
  view.element('span', '', `通关 ${model.clears} 场 · 练习笔记 ${model.resources.balance}`, ledger);
  const backstage = loadBackstageProgress();
  view.element('small', '', backstage.status === 'ready' ? '后台记录可读取' : readMessage(backstage.status), ledger);
  const mark = view.element('span', 'cs-state-icon', undefined, ledger);
  if(state==='recovery')mark.dataset.uiIcon='lock';else mark.dataset.consoleIcon='backup';
  mark.setAttribute('aria-hidden', 'true');
  for (const [label, action, method, letter, icon] of [
    ['声音与演出设置', 'services-settings', 'showSettings', 'sound', 'settings'],
    ['本机完整存档', 'services-backup', 'showProfileBackup', 'backup', 'backup'],
  ]) {
    // Session capability is checked once at this external UI boundary.
    const available = typeof session?.[method] === 'function';
    const button = command(view, root, label, () => session[method](), {className: 'pm-service-command', action});
    button.disabled = !available;
    button.querySelector('span').dataset.consoleLetter = letter;
    const glyph = view.element('span', 'cs-glyph', undefined, null); glyph.dataset.consoleIcon = icon; glyph.setAttribute('aria-hidden', 'true');
    button.insertBefore(glyph, button.children[0]);
    if (!available) view.element('small', 'pm-unavailable-reason', '当前会话未挂载本机设置面板', root);
  }
  const holder = view.element('div', 'ui-sheet-holder', undefined, root); holder.hidden = true;
  const offline = view.element('section', 'pm-offline-services', undefined, holder);
  view.element('p','service-local-summary','当前使用本机存档。以下服务尚未接入。',offline);
  for (const [id, label, reason] of [
    ['cloud', '账号与云存档', '未接入账号认证与云端存储服务'],
    ['social', '好友与联机', '未接入好友服务与联机会话服务器'],
    ['platform', '平台服务', '未配置平台账号与支付接入'],
  ]) {
    const row = view.element('div', 'pm-offline-service', undefined, offline); row.dataset.service = id;
    const copy = view.element('div', '', undefined, row); view.element('strong', '', label, copy); view.element('small', '', reason, copy);
    view.element('span', 'cs-service-state', '未接入', row);
  }
  const info = command(view, root, '服务状态', () => {
    const dialog=openHierarchySheet(view,{title:'服务状态',content:offline,trigger:info});
    dialog.querySelector('.ui-sheet-title').dataset.consoleLetter='network';mountConsoleUiArt(view.doc,dialog);
  },
    {className: 'cs-network', action: 'services-network-info'});
  info.querySelector('span').dataset.consoleLetter = 'network';
}

export function renderProductModuleScreen(view, main, model) {
  if (view.page !== 'lounge' || !isUserCastEnabled()) {
    delete view.root.dataset.loungeLayout; delete view.root.dataset.loungeMember;
  }
  if (view.page !== 'lounge') view.productModuleQuestion = null;
  if (!Object.hasOwn(PAGES, view.page)) return false;
  const profile = loadPublicProfile();
  // The loader owns validation: a null saved companion explicitly means the deployed member.
  const companion = view.page === 'lounge' ? loadBackstageProgress() : null;
  const selected = companion ? companion.state.selectedCompanionId ?? model.member.id : view.page === 'recruitment' ? view.productModuleRecruit : model.member.id;
  const member = getUiPerformer(UI_CAST.some(row => row.id === selected) ? selected : model.member.id);
  if (view.page === 'lounge' && isUserCastEnabled()) {
    view.root.dataset.loungeLayout = 'conversation'; view.root.dataset.loungeMember = member.id;
  }
  const root = view.element('div', 'product-module-screen', undefined, main); root.dataset.productPage = view.page;
  // Lounge members lead the screen, above the portrait, so the strip never covers the figure.
  // The companion is saved before it is shown; deployment and profile are never touched.
  if (companion) {
    view.productModuleCompanion = member.id; // the accepted, rendered companion
    const strip = castStrip(view, root, member.id, 'companion', id => {
      if (view.doc.hidden || view.root.inert) return;
      const result = updateBackstageProgress({type: 'select-companion', memberId: id});
      view.productModuleMessage = {page: 'lounge', text: commandMessage(result.status)};
      view.render(`[data-action="companion-member-${id}"]`);
    });
    for (const button of strip.children) button.disabled = companion.status !== 'ready';
  }
  scene(view, root, model, member);
  if (view.page === 'backstage') backstage(view, root, model, profile);
  if (view.page === 'lounge') lounge(view, root, member, profile, companion);
  if (view.page === 'venue') venue(view, root);
  if (view.page === 'events') events(view, root, model, profile);
  if (view.page === 'recruitment') recruitment(view, root, member);
  if (view.page === 'sideplay') sideplay(view, root, model, profile);
  if (view.page === 'services') services(view, root, model);
  if(isUserCastEnabled() && view.page==='recruitment')return true;
  const footer = view.element('footer', 'pm-footer', undefined, root);
  const direct=['backstage','lounge','venue'].includes(view.page);
  command(view, footer, direct ? '返回主界面' : '返回', () => direct ? view.openRoot('desk') : view.backPage(),
    {className:'pm-entry',icon:'arrow-left',action:`${view.page}-return`});
  return true;
}
