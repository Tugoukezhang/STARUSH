import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';
import {getHomePortraitArt} from './HomePortraitPresentation.mjs';
import {getActiveUserCastArt,getDisplayPerformer} from '../utils/userCast.mjs';
import {getMenuPortraitArt} from './MenuPortraitPresentation.mjs';
import {PublicStoryPlayback} from '../utils/publicStoryPlayback.mjs';
import {shellIcons} from '../vendor/shellIcons.mjs';
const speakerIds={'战术女武神':'sakura','步枪手':'sakura','机甲剑士':'kai','翡翠风歌':'kai','重锤手':'enjo','蔚蓝魔法师':'enjo'};
function speakerName(raw){
 const id=speakerIds[raw];
 return getActiveUserCastArt(id)?.confirmedDesign?getDisplayPerformer(id).name:raw;
}
function portrait(id){return getActiveUserCastArt(id)?.confirmedDesign?getActiveUserCastArt(id).portrait:id==='sakura'?getHomePortraitArt(id)?.layers.find(l=>l.id==='body')?.src:getMenuPortraitArt(id)?.src;}
function node(parent,tag,cls,text){const e=parent.ownerDocument?.createElement(tag)||document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;parent.append(e);return e;}
function image(parent,cls,src){const e=node(parent,'img',cls);e.alt='';e.draggable=false;e.setAttribute('aria-hidden','true');e.decoding='async';e.src=src;return e;}

export function mountStorySequence(ui,panel,beat,complete,{performerId,progress=[],onProgress=null,persisted=true}={}){
 const root=ui.root;root.dataset.performanceStory='true';root.dataset.performer=performerId;
 const stage=node(panel,'div','performance-story-stage');image(stage,'performance-story-venue',CHAPTER_VENUE_ART[beat.chapterId]);
 const figure=image(stage,'performance-story-portrait',portrait(root.dataset.performer));
 const chapter=node(stage,'div','performance-story-location',beat.place),dialogue=node(panel,'div','performance-story-dialogue');
 const speaker=node(dialogue,'strong','performance-story-speaker'),copy=node(dialogue,'p','performance-story-line');copy.setAttribute('aria-live','polite');
 const count=node(dialogue,'span','performance-story-count');
 const toolbar=node(panel,'div','story-toolbar');
 const history=node(panel,'section','story-history');history.hidden=true;history.setAttribute('role','dialog');history.setAttribute('aria-modal','true');history.setAttribute('aria-label','已读台词');
 const historyHeader=node(history,'header','story-history-header');node(historyHeader,'h3','','已读台词');
 const historyLines=node(history,'div','story-history-lines');historyLines.setAttribute('tabindex','0');
 const historyFooter=node(history,'footer','story-history-footer');
 const playback=new PublicStoryPlayback(beat,progress),saveStatus=node(dialogue,'p','session-note story-save-status');saveStatus.setAttribute('aria-live','polite');
 let disposed=false,pendingClose=false,auto=false,timer=null;
 const showSaved=ok=>{root.dataset.storySaved=String(ok);saveStatus.hidden=ok;saveStatus.textContent=ok?'':'阅读位置未保存，仅本次打开有效。';};showSaved(persisted);
 const live=()=>!disposed&&!ui.disposed&&ui.root===root&&root.dataset.mode==='story';
 function iconButton(button,icon,label){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  for(const [tag,attrs]of shellIcons[icon]){const shape=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))shape.setAttribute(k,v);svg.append(shape);}
  button.replaceChildren(svg);button.classList.add('story-icon');button.title=label;button.setAttribute('aria-label',label);
 }
 const save=()=>{const row=playback.snapshot();root.dataset.storyRead=String(row.read);const ok=!onProgress||onProgress(row)?.persisted===true;showSaved(ok);if(!ok)pauseAuto();return ok;};
 function pauseAuto(){clearTimeout(timer);timer=null;auto=false;root.dataset.storyAuto='false';autoButton.setAttribute('aria-pressed','false');autoButton.title='自动播放';autoButton.setAttribute('aria-label','自动播放');}
 function schedule(){
  clearTimeout(timer);
  if(playback.index===beat.lines.length-1){pauseAuto();return;}
  timer=setTimeout(()=>{
   timer=null;if(!live()||!auto)return;
   if(document.hidden||!history.hidden){pauseAuto();return;}
   playback.advance();const saved=save();draw();if(saved&&auto)schedule();
  },Math.max(3500,beat.lines[playback.index].text.length*130));
 }
 const historyButton=ui.command(toolbar,'已读台词',()=>{
  if(!live())return;pauseAuto();historyLines.replaceChildren();
  for(const line of beat.lines.slice(0,playback.index+1)){const row=node(historyLines,'div','story-history-row');node(row,'strong','',speakerName(line.speaker));node(row,'p','',line.text);}
  history.hidden=false;root.dataset.storyHistory='true';historyClose.focus();historyLines.scrollTop=historyLines.scrollHeight;
 },true);historyButton.dataset.action='story-history';historyButton.setAttribute('aria-haspopup','dialog');iconButton(historyButton,'book-open','已读台词');
 const autoButton=ui.command(toolbar,'自动播放',()=>{
  if(!live()||pendingClose||document.hidden||!history.hidden)return;
  if(auto){pauseAuto();return;}
  auto=true;root.dataset.storyAuto='true';autoButton.setAttribute('aria-pressed','true');autoButton.title='暂停自动播放';autoButton.setAttribute('aria-label','暂停自动播放');schedule();
 },true);autoButton.dataset.action='story-auto';iconButton(autoButton,'play','自动播放');pauseAuto();
 function closeHistory(){history.hidden=true;root.dataset.storyHistory='false';historyButton.focus();}
 const historyClose=ui.command(historyHeader,'返回剧情',()=>{if(live())closeHistory();},true);historyClose.dataset.action='story-history-close';iconButton(historyClose,'x','返回剧情');
 history.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();closeHistory();}
  if(event.key==='Tab'){
   const targets=[historyClose,historyLines,restart],index=targets.indexOf(document.activeElement);
   event.preventDefault();targets[(index+(event.shiftKey?-1:1)+targets.length)%targets.length].focus();
  }
 });
 const hold=()=>{pauseAuto();pendingClose=true;root.dataset.storyPendingClose='true';next.querySelector('span').textContent='重试保存';skip.textContent='仅本次继续';};
 const next=ui.command(panel,'下一句',()=>{
  if(!live()||!history.hidden)return;pauseAuto();
  if(pendingClose){if(save())complete();return;}
  if(playback.finished)return;
  const finished=playback.advance(),saved=save();
  if(finished){if(saved)complete();else hold();return;}draw();
 });next.dataset.action='story-next';
 function draw(){
  const index=playback.index,line=beat.lines[index];speaker.textContent=speakerName(line.speaker);copy.textContent=line.text;count.textContent=`${index+1} / ${beat.lines.length}`;
  root.dataset.storyLine=String(index);root.dataset.storyRead=String(playback.read);root.dataset.storyNarration=String(line.speaker==='旁白');
  const id=line.speaker==='旁白'?performerId:speakerIds[line.speaker];root.dataset.performer=id;
  const src=portrait(id);if(figure.getAttribute('src')!==src)figure.src=src;
  next.querySelector('span').textContent=index===beat.lines.length-1?(ui.battle?'继续公演':'结束阅读'):'下一句';chapter.textContent=beat.place;
 }
 const restart=ui.command(historyFooter,'从头阅读',()=>{
  if(!live())return;pauseAuto();pendingClose=false;root.dataset.storyPendingClose='false';playback.restart();save();closeHistory();skip.textContent=ui.battle?'跳过剧情':'结束阅读';draw();
 },true);restart.dataset.action='story-restart';
 const skip=ui.command(panel,ui.battle?'跳过剧情':'结束阅读',()=>{if(!live()||!history.hidden)return;pauseAuto();if(pendingClose||save())complete();else hold();},true);
 skip.dataset.action='story-close';root.querySelector('.session-footer').append(skip);root.dataset.storyPendingClose='false';root.dataset.storyHistory='false';draw();
 const visibility=()=>{if(document.hidden)pauseAuto();};document.addEventListener('visibilitychange',visibility);
 return()=>{disposed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
}

// A cast callout lives alongside the HUD. It never takes focus or owns a battle pause.
export function mountEncoreSequence(ui,host,id,complete,cleared=0){
 const card=node(host,'aside','performance-encore');
 card.setAttribute('role','status');
 card.setAttribute('aria-atomic','true');
 card.dataset.performer=id;
 card.dataset.phase='focus';
 image(card,'performance-encore-portrait',getActiveUserCastArt(id)?.avatar||portrait(id));
 const copy=node(card,'div','encore-card-copy');
 node(copy,'strong','encore-stage-action','安可返场');
 const identity=node(copy,'p','performance-encore-name');
 node(identity,'span','encore-stage-performer',getDisplayPerformer(id).name);
 if(Number.isSafeInteger(cleared)&&cleared>0)node(identity,'span','encore-stage-clear',' · 清弹 '+cleared);
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 card.dataset.reducedMotion=String(reduced);
 let frame,started;
 const request=window.requestAnimationFrame?.bind(window)??(callback=>setTimeout(()=>callback(Date.now()),16));
 const cancel=window.cancelAnimationFrame?.bind(window)??clearTimeout;
 const tick=now=>{
   if(ui.disposed||ui.root||ui.scene._battleEnded||ui.scene._battlePaused||ui.scene.publicPerformerRun?.choiceOpen||document.hidden){complete();return;}
   started??=now;
   const elapsed=now-started;
   if(elapsed>=980){complete();return;}
   card.dataset.phase=reduced?'hero':elapsed<120?'focus':elapsed<770?'hero':'exit';
   frame=request(tick);
 };
 frame=request(tick);
 return ()=>{cancel(frame);card.remove();};
}
