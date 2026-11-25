import { playerPreferences, applyPlayerAudioPreferences, getChapterBriefing } from '../utils/playerPreferences.mjs';
import { loadPublicProfile } from '../utils/publicRunProgression.mjs';
import { getUiPerformer as getPublicPerformer,isUserCastEnabled } from '../utils/userCast.mjs';
import {getChapterEncounterSummary} from '../utils/chapterEncounterContent.mjs';
import {PUBLIC_BUILD_ID,PUBLIC_RULESET_LABEL} from '../utils/releaseIdentity.mjs';
import { getChapterStory, getReadableStoryEntries, canReadStoryBeat } from '../utils/publicStory.mjs';
import { getNextPublicChapterId } from '../utils/publicCampaign.mjs';
import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';
import {getPublicJourneyGuide} from '../utils/publicJourneyContent.mjs';
import { getUiPerformerArt } from './UiPerformerArt.mjs';
import { shellIcons } from '../vendor/shellIcons.mjs';
import {getPublicRouteReview} from '../utils/publicRoutePlan.mjs';
import {ProfileBackupPanel} from './ProfileBackupPanel.mjs';
import {mountConsoleUiArt} from './HierarchyUiArt.mjs';
import {PUBLIC_MENU_ART} from './PublicMenuArt.mjs';
import {mountStorySequence,mountEncoreSequence} from './PerformanceSequenceView.mjs';
import {getStoryReadingLabel,isOwnerStoryBeat} from '../utils/publicStoryPlayback.mjs';

// Isolated DOM input cannot reach Phaser's body-level WebAudio unlock listener.
// Resume only from a user command and let Phaser emit its normal unlock event.
export function resumePlayerAudioFromGesture(sound) {
  const context = sound?.context;
  if (!context || context.state === 'closed') return Promise.resolve(false);
  const unlocked = () => {
    if (sound.context !== context || context.state !== 'running') return false;
    if (sound.locked) sound.unlocked = true;
    return true;
  };
  if (context.state === 'running') return Promise.resolve(unlocked());
  try { return context.resume().then(unlocked, () => false); }
  catch { return Promise.resolve(false); }
}

export function releaseSessionInput(scene) {
  scene._clearMobileInputState?.();
  scene.input?.keyboard?.resetKeys?.();
  scene.input?.resetPointers?.();
  scene.player?.body?.setVelocity?.(0, 0);
}

// A temporary dialog may borrow a pause, but cannot release another surface's pause.
export class SessionPauseLease {
  constructor(scene) { this.scene = scene; this.active = false; }
  acquire() {
    if (this.active) return;
    const s = this.scene;
    this.wasPaused = s._battlePaused === true;
    this.keyboardEnabled = s.input?.keyboard?.enabled;
    this.inputEnabled = s.input?.enabled;
    this.shellRoot = s._publicShell?.root;
    this.shellWasInert = this.shellRoot?.inert;
    if (this.shellRoot) this.shellRoot.inert = true;
    this.battleDialogRoot = s._publicBattleDialog?.root;
    this.battleDialogWasInert = this.battleDialogRoot?.inert;
    if (this.battleDialogRoot) this.battleDialogRoot.inert = true;
    s._setBattlePaused?.(true);
    releaseSessionInput(s);
    if (s.input?.keyboard) s.input.keyboard.enabled = false;
    if (s.input) s.input.enabled = false;
    this.active = true;
  }
  release(resume = true, restoreControls = true) {
    if (!this.active) return;
    this.active = false;
    const s = this.scene;
    // A shutting-down scene no longer owns live controls to restore.
    if (restoreControls) {
      releaseSessionInput(s);
    }
    if (s.input?.keyboard) s.input.keyboard.enabled = this.keyboardEnabled;
    if (s.input) s.input.enabled = this.inputEnabled;
    if (this.shellRoot) this.shellRoot.inert = this.shellWasInert;
    this.shellRoot = null;
    if (this.battleDialogRoot) this.battleDialogRoot.inert = this.battleDialogWasInert;
    this.battleDialogRoot = null;
    if (restoreControls && resume && !s._battleEnded && !this.wasPaused && !s.publicPerformerRun?.choiceOpen) s._setBattlePaused?.(false);
    if (restoreControls && s.publicPerformerRun?.choiceOpen) s._clearBattlePauseOverlay?.();
  }
}

export function bindSessionInterruptions({ win, doc, onInterrupt }) {
  const hidden = () => { if (doc.hidden) onInterrupt(); };
  win.addEventListener('blur', onInterrupt);
  win.addEventListener('pagehide', onInterrupt);
  doc.addEventListener('visibilitychange', hidden);
  doc.addEventListener('touchcancel', onInterrupt);
  hidden();
  return () => {
    win.removeEventListener('blur', onInterrupt);
    win.removeEventListener('pagehide', onInterrupt);
    doc.removeEventListener('visibilitychange', hidden);
    doc.removeEventListener('touchcancel', onInterrupt);
  };
}

export class PlayerSessionExperience {
  constructor(scene, battle = false) {
    this.scene = scene;
    this.battle = battle;
    this.lease = new SessionPauseLease(scene);
    this.root = null;
    this.disposed = false;
    this.onSceneDestroy = () => this.destroy();
    scene.events?.once?.('destroy', this.onSceneDestroy);
    applyPlayerAudioPreferences(scene.sound, playerPreferences.read());
    if (battle) this.unbind = bindSessionInterruptions({ win: window, doc: document,
      onInterrupt: () => this.interrupt() });
  }
  isBlocking() { return Boolean(this.root); }
  releaseInput() { releaseSessionInput(this.scene); }
  attachTitleButton() {
    const button = document.createElement('button');
    button.id = 'player-settings-button';
    button.type = 'button';
    button.textContent = '\u2699\uFE0E';
    button.title = '声音与演出设置';
    button.setAttribute('aria-label', '声音与演出设置');
    button.addEventListener('click', () => this.showSettings());
    document.getElementById('game-container')?.append(button);
    this.titleButton = button;
  }
  chapterId() { return this.scene.battleData?.campaignChapterId || loadPublicProfile().campaign?.selectedChapterId || 'opening'; }
  canShowChapterRules() { return !this.battle || this.scene._isPublicStage1Round?.() === true; }
  shouldSkipLiveStory(chapter) {
    return isUserCastEnabled()&&this.battle&&this.scene.battleData?.practiceMode!==true
      &&this.scene._isPublicStage1Round?.()===true&&!this.scene._battleEnded&&chapter===this.chapterId()
      &&loadPublicProfile().campaign?.clearedChapterIds.includes(chapter)===true;
  }
  showFirstBriefing() {
    if(this.scene._isFinaleTrialRound?.())return;
    if (this.scene._isPublicStage1Round?.() !== true) return;
    const chapter=this.chapterId(),prefs=playerPreferences.read();
    // The player already had the directions and optional story in the preflight screen.
    // A resumed show must also return to the saved field without replaying the introduction.
    if (isUserCastEnabled() && (this.scene.battleData?.preflightChapterId===chapter || this.scene.battleData?.publicBattleResume)) return;
    if (!prefs.seenChapters.includes(chapter)) this.showBriefing(true);
    else if(isUserCastEnabled()&&!prefs.seenStoryIntros.includes(chapter))this.showStory(chapter,'intro',{complete:()=>this.completeChapterIntro(chapter)});
  }
  completeChapterIntro(chapter){
    const prefs=playerPreferences.read();playerPreferences.update({seenChapters:[...prefs.seenChapters,chapter],seenStoryIntros:[...prefs.seenStoryIntros,chapter]});this.close();
  }
  interrupt() {
    if (this.disposed || this.scene._battleEnded) return;
    releaseSessionInput(this.scene);
    this.scene.sound?.stopAll?.();
    if (this.root) return;
    const panel = this.open('公演已暂停', 'interruption');
    this.paragraph(panel, '离开画面时，演出已停在原处。');
    this.paragraph(panel, this.scene._publicBattleCheckpoint
      ? '本场可从最近一次成功的中途暂存继续，已完成的巡演记录不受影响。'
      : '刷新或关闭页面会结束当前公演，已完成的巡演记录不受影响。', 'session-note');
    this.command(panel, this.scene.publicPerformerRun?.choiceOpen ? '返回本场编排' : '返回公演', () => this.close());
  }
  open(title, mode) {
    this.clearEncore();
    this.sequenceDispose?.();this.sequenceDispose=null;
    this.backupPanel?.dispose();this.backupPanel=null;
    if (!this.root) {
      this.previousFocus = document.activeElement;
      this.lease.acquire();
      this.root = document.createElement('section');
      this.root.id = 'player-session-dialog';
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-modal', 'true');
      this.root.setAttribute('aria-labelledby', 'player-session-heading');
      // Phaser also listens for legacy mouse/touch events on window.
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend']) {
        this.root.addEventListener(type, event => event.stopPropagation());
      }
      this.root.addEventListener('keydown', event => {
        event.stopPropagation();
        if(event.key==='Escape' && this.root.dataset.mode==='story-journal'){
          event.preventDefault();this.root.querySelector('[data-action=story-close]')?.click();return;
        }
        if(event.key==='Escape'&&['settings','profile-backup'].includes(this.root.dataset.mode)){
          event.preventDefault();this.root.querySelector('.session-footer')?.querySelector('.session-primary')?.click();return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...this.root.querySelectorAll('button, input, summary')].filter(el => !el.disabled&&!el.hidden&&el.getAttribute('tabindex')!=='-1'&&!el.closest?.('[hidden]'));
        const index = focusable.indexOf(document.activeElement);
        if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === focusable.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
        }
      });
      document.getElementById('game-container')?.append(this.root);
    }
    this.root.dataset.mode = mode;
    if(isUserCastEnabled()&&!this.battle&&['settings','profile-backup'].includes(mode))this.root.dataset.consoleSkin='268';
    else delete this.root.dataset.consoleSkin;
    this.root.dataset.readingFamily = 'false';
    delete this.root.dataset.journeyConsole;
    delete this.root.dataset.performanceStory;delete this.root.dataset.performanceEncore;
    this.root.dataset.reading=String(isUserCastEnabled()&&['story','story-journal'].includes(mode));
    this.root.replaceChildren();
    const panel = document.createElement('div');panel.className = 'session-panel';this.root.append(panel);
    const header = document.createElement('header');header.className='session-header';panel.append(header);
    const heading = document.createElement('h2');heading.id = 'player-session-heading';heading.textContent = title;header.append(heading);
    if(this.root.dataset.consoleSkin==='268')heading.dataset.consoleLetter=mode==='settings'?'sound':'backup';
    const content = document.createElement('div');content.className='session-content';panel.append(content);
    const footer = document.createElement('footer');footer.className='session-footer';panel.append(footer);
    return content;
  }
  paragraph(panel, text, className) {
    const p = document.createElement('p');p.textContent = text;if (className) p.className = className;panel.append(p);return p;
  }
  command(panel, text, callback, secondary = false) {
    const button = document.createElement('button');button.type = 'button';button.textContent = text;
    button.className = secondary ? 'session-secondary' : 'session-primary';
    button.addEventListener('click', () => { resumePlayerAudioFromGesture(this.scene.sound);callback(); });
    const target=!secondary ? this.root?.querySelector('.session-footer') || panel : panel;
    target.append(button);
    if (!secondary) {
      const iconName=['准备开演','返回公演','继续公演'].includes(text)?'play':['继续前行','下一句'].includes(text)?'arrow-right':'arrow-left';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
      for(const [tag,attributes]of shellIcons[iconName]||[]){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);svg.append(node);}
      const label=document.createElement('span');label.textContent=text;button.replaceChildren(svg,label);
      if (['first-briefing','rules'].includes(this.root?.dataset.mode)||this.root?.dataset.reading==='true') {
        const heading=this.root.querySelector('h2');heading.setAttribute('tabindex','-1');
        this.root.scrollTop=0;heading.focus({preventScroll:true});
      } else button.focus();
    }
    return button;
  }
  showSettings() {
    const panel = this.open('声音与演出设置', 'settings');
    const prefs = playerPreferences.read();
    const group=(id,title)=>{const section=document.createElement('section');section.className='session-settings-group';section.dataset.settingsGroup=id;const heading=document.createElement('h3');heading.textContent=title;section.append(heading);panel.append(section);return section;};
    const audio=group('audio','声音设置');
    const muteRow = document.createElement('label');muteRow.className = 'session-setting';
    const muteText = document.createElement('span');muteText.textContent = '静音';
    const mute = document.createElement('input');mute.type = 'checkbox';mute.checked = prefs.muted;mute.id = 'player-muted';
    muteRow.append(muteText, mute);audio.append(muteRow);
    const volumeLabel = document.createElement('label');volumeLabel.className = 'session-setting';volumeLabel.htmlFor = 'player-volume';
    const caption = document.createElement('span');caption.textContent = '音效音量';
    const output = document.createElement('output');volumeLabel.append(caption, output);audio.append(volumeLabel);
    const volume = document.createElement('input');volume.type = 'range';volume.id = 'player-volume';volume.min = '0';volume.max = '100';volume.step = '5';volume.value = String(Math.round(prefs.volume * 100));audio.append(volume);
    const musicLabel = document.createElement('label');musicLabel.className = 'session-setting';musicLabel.htmlFor = 'player-music-volume';
    const musicCaption = document.createElement('span');musicCaption.textContent = '音乐音量';
    const musicOutput = document.createElement('output');musicLabel.append(musicCaption, musicOutput);audio.append(musicLabel);
    const musicVolume = document.createElement('input');musicVolume.type = 'range';musicVolume.id = 'player-music-volume';musicVolume.min = '0';musicVolume.max = '100';musicVolume.step = '5';musicVolume.value = String(Math.round(prefs.musicVolume * 100));audio.append(musicVolume);
    output.setAttribute('for',volume.id);musicOutput.setAttribute('for',musicVolume.id);
    const status = this.paragraph(audio, playerPreferences.pending ? '当前设置仅在本次打开期间生效。' : '当前声音设置', 'session-note');
    status.setAttribute('role', 'status');
    const reflect = () => { output.textContent = `${volume.value}%`;volume.disabled = mute.checked;musicOutput.textContent = `${musicVolume.value}%`;musicVolume.disabled = mute.checked; };
    const save = () => {
      const result = playerPreferences.update({ muted: mute.checked, volume: Number(volume.value) / 100, musicVolume: Number(musicVolume.value) / 100 });
      applyPlayerAudioPreferences(this.scene.sound, result.value);
      status.textContent = result.persisted ? '设置已保存。' : '保存不可用，当前设置仅在本次打开期间生效。';
      if(result.persisted&&document.activeElement===retry)mute.focus({preventScroll:true});
      retry.hidden=result.persisted;
      reflect();
    };
    const retry=this.command(audio,'重试保存设置',save,true);retry.dataset.action='settings-retry';retry.hidden=!playerPreferences.pending;
    reflect();mute.addEventListener('change', save);volume.addEventListener('input', save);musicVolume.addEventListener('input', save);
    const session=group('session','演出资料');
    if (this.canShowChapterRules()) this.settingsShortcut(session,'本场规则','settings-rules','route',()=>this.showBriefing(false));
    if(isUserCastEnabled()&&this.canShowChapterRules())this.settingsShortcut(session,'巡演手记','settings-journal','journal',()=>this.showStoryJournal({fromSettings:true}));
    this.paragraph(panel, `试玩构建 ${PUBLIC_BUILD_ID} · ${PUBLIC_RULESET_LABEL}`, 'session-note');
    if(!this.battle)this.settingsShortcut(session,'本机存档','profile-backup-open','bag',()=>this.showProfileBackup());
    const exit=this.command(panel, '返回', () => this.close());
    if(this.root.dataset.consoleSkin==='268'){
      session.hidden=true;
      exit.querySelector('svg').remove();exit.dataset.consoleReturn='close';exit.setAttribute('aria-label','关闭设置');exit.title='关闭设置';
      const image=document.createElement('img');image.src='art/hierarchy-ui-20261101/icons-close.webp';image.alt='';image.draggable=false;image.className='console-close-art';exit.insertBefore(image,exit.children[0]);
      mountConsoleUiArt(document,this.root);
    }
  }
  settingsShortcut(parent,label,action,key,callback){
    const button=this.command(parent,label,callback,true);button.dataset.action=action;button.classList.add('session-shortcut');
    const image=document.createElement('img');image.src=PUBLIC_MENU_ART[key];image.alt='';image.width=40;image.height=40;image.draggable=false;
    image.addEventListener('error',()=>image.remove(),{once:true});
    const text=document.createElement('span');text.textContent=label;button.replaceChildren(image,text);return button;
  }
  showProfileBackup() {
    if(this.battle||this.disposed)return false;
    const panel=this.open('本机存档','profile-backup');
    this.backupPanel=new ProfileBackupPanel(this,panel,{onRestored:result=>{
      if(result?.reload){globalThis.location.reload();return;}
      this.close();this.scene.scene.start('TitleScene',{suppressDebugAutoStart:true});
    }});
    const back=this.command(panel,'返回设置',()=>this.showSettings());
    if(this.root.dataset.consoleSkin==='268'){
      panel.querySelector('[data-action=backup-export]').dataset.consoleLetter='export';panel.querySelector('.profile-backup-file').dataset.consoleLetter='import';
      back.querySelector('svg').remove();back.querySelector('span').dataset.consoleLetter='return-settings';mountConsoleUiArt(document,this.root);
    }
    return true;
  }
  performerIdentity(panel,member) {
    const art=getUiPerformerArt(member.id),doc=panel.ownerDocument||globalThis.document;
    if(!art||!doc?.createElement||!panel.append)return;
    const identity=doc.createElement('div');identity.className='session-performer';
    const portrait=doc.createElement('img');portrait.src=art.avatar;portrait.alt='';portrait.width=128;portrait.height=128;portrait.draggable=false;
    const name=doc.createElement('strong');name.textContent=`${member.name} · ${member.actionName}`;
    identity.append(portrait,name);panel.append(identity);
  }
  showBriefing(first) {
    if (this.disposed||!this.canShowChapterRules()) return;
    if(this.scene._isFinaleTrialRound?.()){
      const state=this.scene.battleData.publicFinaleTrial;
      const panel=this.open('压轴连演 · 第'+(state.roundIndex+1)+'站','rules');
      this.paragraph(panel,'连续完成三站压轴，生命跨站继承；每站行动充能重新就绪。');
      this.paragraph(panel,'躲开已捕捉的弹路，涂染弱点，再集中攻击。每站限时32秒。');
      this.paragraph(panel,'重新开始会回到第一站。无巡演奖励或个人纪录；退出或刷新不保留。','session-note');
      this.command(panel,'返回',()=>this.showSettings());return;
    }
    if(isUserCastEnabled()&&getPublicJourneyGuide(this.chapterId(),this.scene.battleData?.performerId||loadPublicProfile().selectedId))return this.showJourneyBriefing(first);
    const chapter = this.chapterId();
    const brief = getChapterBriefing(chapter);
    const panel = this.open(brief.title, first ? 'first-briefing' : 'rules');
    const member = getPublicPerformer(this.scene.battleData?.performerId || loadPublicProfile().selectedId);
    this.performerIdentity(panel,member);
    if(first)this.appendStory(panel,getChapterStory(chapter,'intro',this.scene.battleData?.performerId||loadPublicProfile().selectedId));
    this.paragraph(panel, brief.goal, 'session-goal');
    this.paragraph(panel, brief.rule);
    if(isUserCastEnabled())this.paragraph(panel,getChapterEncounterSummary(chapter));
    this.paragraph(panel, brief.progression);
    this.paragraph(panel, `${member.name} · ${member.actionName}\n${member.actionSummary}`, 'session-member');
    const completion = getNextPublicChapterId(chapter) ? '通关后解锁下一站' : '通关后完成本轮巡演';
    this.paragraph(panel, `躲开舞台压力，${completion}。刷新页面会结束当前公演。`, 'session-note');
    this.command(panel, first ? '准备开演' : '返回', () => {
      if (first) playerPreferences.update({ seenChapters: [...playerPreferences.read().seenChapters, chapter] });
      if (first) this.close();else this.showSettings();
    });
  }
  appendStory(panel,beat){
    if(!beat)return;
    const passage=document.createElement('div');passage.className='story-passage';panel.append(passage);
    for(const line of beat.lines){
      const row=document.createElement('div');row.className=line.speaker==='旁白'?'story-narration':'story-dialogue';
      if(line.speaker!=='旁白'){const name=document.createElement('strong');name.textContent=line.speaker;row.append(name);}
      const text=document.createElement('p');text.textContent=line.text;row.append(text);passage.append(row);
    }
  }
  showJourneyBriefing(first) {
    const chapter=this.chapterId(),guide=getPublicJourneyGuide(chapter,this.scene.battleData?.performerId||loadPublicProfile().selectedId);
    if(!guide)return;
    const panel=this.open(getChapterBriefing(chapter).title,first?'first-briefing':'rules');
    this.root.dataset.readingFamily=String(isUserCastEnabled());
    this.root.dataset.journeyConsole='284';
    this.paragraph(panel,guide.goal,'session-goal');
    const scene=document.createElement('div');scene.className='journey-scene';panel.append(scene);
    const art=document.createElement('img');art.className='journey-scene-art';art.alt='';art.draggable=false;
    art.src=chapter==='raincheck'?'art/rooftop-20261103/landmark.webp':'art/chapter-journey-20261101/'+(chapter==='homecoming'?'encore':chapter)+'.webp';
    scene.append(art);
    this.performerIdentity(scene,guide.member);
    const ticket=document.createElement('section');ticket.className='journey-ticket';panel.append(ticket);
    const tablist=document.createElement('div');tablist.className='journey-step-tabs';tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label','本章步骤');ticket.append(tablist);
    const steps=document.createElement('ol');steps.className='session-journey-steps';steps.setAttribute('role','presentation');ticket.append(steps);
    const count=guide.steps.length,tabs=[],rows=[];
    let selected=0;
    const select=index=>{
      selected=index;
      for(const [i,tab]of tabs.entries()){
        tab.setAttribute('aria-selected',String(i===index));
        tab.setAttribute('tabindex',i===index?'0':'-1');
        rows[i].hidden=i!==index;
      }
    };
    for(const [index,step]of guide.steps.entries()){
      const tab=this.command(tablist,step.title,()=>select(index),true);
      tab.classList.add('journey-step-tab');tab.id='journey-step-tab-'+index;tab.dataset.journeyTab=String(index);
      tab.setAttribute('role','tab');tab.setAttribute('aria-controls','journey-step-panel-'+index);
      tabs.push(tab);
      const row=document.createElement('li');row.id='journey-step-panel-'+index;row.dataset.journeyStep=String(index);
      row.setAttribute('role','tabpanel');row.setAttribute('aria-labelledby',tab.id);
      const heading=document.createElement('h3');heading.textContent=step.title;row.append(heading);
      const position=document.createElement('span');position.className='journey-step-count';position.textContent=(index+1)+' / '+count;row.append(position);
      this.paragraph(row,step.text);steps.append(row);rows.push(row);
    }
    select(0);
    const moves={ArrowLeft:()=>(selected+count-1)%count,ArrowRight:()=>(selected+1)%count,Home:()=>0,End:()=>count-1};
    tablist.addEventListener('keydown',event=>{
      if(!Object.hasOwn(moves,event.key))return;
      event.preventDefault();
      const next=moves[event.key]();select(next);tabs[next].focus();
    });
    this.paragraph(panel,'移动时自动攻击 · 轻点设施可优先涂染','journey-control-hint');
    const rules=document.createElement('details');rules.className='journey-rules';rules.open=!first;panel.append(rules);
    const summary=document.createElement('summary');summary.textContent='本场规则';rules.append(summary);
    const route=getPublicRouteReview(this.scene.battleData?.publicRoutePlan,this.scene.battleData);
    if(route)this.paragraph(rules,route.title+' · '+route.text+'\n'+route.finale,'session-note session-route');
    this.paragraph(rules,guide.action,'session-member');
    this.paragraph(rules,guide.targeting,'session-note session-targeting');
    const completion=getNextPublicChapterId(chapter)?'通关后解锁下一站':'通关后完成本轮巡演';
    this.paragraph(rules,completion+'。公演会自动暂存；存储失败会提示。关闭后可从最近暂存继续。','session-note session-save-note');
    const story=this.command(panel,'开场故事',()=>this.showStory(chapter,'intro',{back:()=>this.showBriefing(first)}),true);story.dataset.action='entry-story';
    this.root.querySelector('.session-footer').append(story);
    this.command(panel,first?'准备开演':'返回',()=>{
      if(first)this.showStory(chapter,'intro',{complete:()=>this.completeChapterIntro(chapter)});
      else this.showSettings();
    }).dataset.action='entry-ready';
  }
  showStory(chapter,phase,{live=false,back=null,directory=null,complete=null}={}){
    if(this.disposed||this.scene.battleData?.practiceMode===true)return false;
    const profile=loadPublicProfile();
    const witnessed=live&&chapter===this.chapterId()&&phase==='midpoint'
      &&chapter===(this.scene.oldStreet?.config?.chapterId||'opening')
      &&this.scene._isPublicStage1Round?.()===true&&!this.scene._battleEnded&&this.scene.oldStreet?.storyReady?.();
    if(!witnessed&&!canReadStoryBeat(profile,chapter,phase))return false;
    const beat=getChapterStory(chapter,phase,this.scene.battleData?.performerId||profile.selectedId);
    if(!beat)return false;
    const ownerPlayback=isUserCastEnabled()&&isOwnerStoryBeat(beat);
    const panel=this.open(beat.eventTitle||beat.title,'story');
    if(ownerPlayback){
      this.sequenceDispose=mountStorySequence(this,panel,beat,()=>complete?complete():back?back():this.close(),{
        performerId:this.scene.battleData?.performerId||profile.selectedId,
        progress:playerPreferences.read().storyProgress,persisted:!playerPreferences.pending,
        onProgress:row=>playerPreferences.recordStoryProgress(row),
      });
      if(directory)this.command(panel,'手记目录',directory,true).dataset.action='story-directory';
      return true;
    }
    this.performerIdentity(panel,getPublicPerformer(this.scene.battleData?.performerId||profile.selectedId));
    this.paragraph(panel,`${beat.place} / ${beat.label}`,'story-place');this.appendStory(panel,beat);
    if(directory)this.command(panel,'手记目录',directory,true).dataset.action='story-directory';
    this.command(panel,back?'返回准备':live?'继续前行':'返回',()=>back?back():this.close()).dataset.action='story-close';
    return true;
  }
  showStoryJournal({fromSettings=false,focusStoryId=null}={}){
    if(this.disposed||this.scene.battleData?.practiceMode===true)return;
    const panel=this.open('巡演手记','story-journal');
    this.performerIdentity(panel,getPublicPerformer(this.scene.battleData?.performerId||loadPublicProfile().selectedId));
    const entries=getReadableStoryEntries(loadPublicProfile());
    if(isUserCastEnabled()&&playerPreferences.pending)this.paragraph(panel,'本机设置与阅读记录有未保存的修改。','session-note story-save-notice');
    if(isUserCastEnabled()){
      for(const chapter of PUBLIC_CHAPTERS){
        const section=document.createElement('section');section.className='journal-chapter';section.dataset.journalChapter=chapter.id;panel.append(section);
        const title=document.createElement('h3');title.textContent=chapter.ordinal+'. '+chapter.name;section.append(title);
        const readable=entries.filter(beat=>beat.chapterId===chapter.id);
        this.paragraph(section,!readable.length?'通关上一站后开放。':readable.length<3?'开场已开放；本章通关后可重看途中与章尾。':'本章故事已全部开放。','session-note');
        for(const beat of readable)this.command(section,beat.label+' · '+(beat.eventTitle||beat.title)+(isOwnerStoryBeat(beat)?' · '+getStoryReadingLabel(beat.id,playerPreferences.read().storyProgress):''),()=>this.showStory(beat.chapterId,beat.phase,{
          directory:()=>this.showStoryJournal({fromSettings,focusStoryId:beat.id})}),true).dataset.storyId=beat.id;
      }
    }else for(const beat of entries){
      const button=this.command(panel,beat.title+' · '+beat.label,()=>this.showStory(beat.chapterId,beat.phase),true);button.dataset.storyId=beat.id;
    }
    this.command(panel,'返回',()=>fromSettings?this.showSettings():this.close()).dataset.action='story-close';
    if(focusStoryId){const source=[...this.root.querySelectorAll('[data-story-id]')].find(button=>button.dataset.storyId===focusStoryId);source?.focus();source?.scrollIntoView?.({block:'nearest'});}
  }
  close(resume = true, restoreControls = true) {
    this.sequenceDispose?.();this.sequenceDispose=null;
    this.backupPanel?.dispose();this.backupPanel=null;
    this.root?.remove();this.root = null;
    this.lease.release(resume, restoreControls);
    if (restoreControls && this.previousFocus?.isConnected && !this.previousFocus.closest?.('canvas')) this.previousFocus.focus?.({ preventScroll: true });
  }
  clearEncore(){
    this.encoreDispose?.();
    this.encoreDispose=null;
  }
  showEncore({cleared=0}={}){
    if(this.disposed||!this.battle||!isUserCastEnabled()||this.root||this.encoreDispose||this.scene._battlePaused||this.scene._battleEnded||this.scene.battleData?.practiceMode||this.scene.battleData?.defenseMode||this.scene.publicPerformerRun?.choiceOpen||this.scene._isPublicStage1Round?.()!==true)return false;
    const id=this.scene.battleData?.performerId||'sakura';if(!['sakura','kai','enjo'].includes(id))return false;
    const host=document.getElementById('game-container');
    if(!host)return false;
    this.encoreDispose=mountEncoreSequence(this,host,id,()=>this.clearEncore(),cleared);
    return true;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearEncore();
    this.scene.events?.off?.('destroy', this.onSceneDestroy);
    this.unbind?.();
    this.close(false, false);
    this.titleButton?.remove();
  }
}
