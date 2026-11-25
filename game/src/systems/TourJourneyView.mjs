import {openHierarchySheet} from './HierarchySheets.mjs';
import {getChapterContent} from '../utils/publicChapterContent.mjs';
import {loadPublicProfile} from '../utils/publicRunProgression.mjs';
import {canReadStoryBeat} from '../utils/publicStory.mjs';
import {getStoryReadingLabel} from '../utils/publicStoryPlayback.mjs';
import {playerPreferences} from '../utils/playerPreferences.mjs';
import {getChapterRewardPreview} from '../utils/publicPreparation.mjs';
import {PUBLIC_MENU_ART} from './PublicMenuArt.mjs';
import {getEquipmentIconArt} from './EquipmentIconArt.mjs';

export function mountTourJourney(view,main,model){
 main.dataset.tourView='journey';
 const box=main.querySelector('[data-holder=tour]'),sequence=main.querySelector('.tour-stop-sequence');
 const map=view.element('section','journey-map',undefined,null);map.setAttribute('aria-label','巡演章节地图');map.style.setProperty('--journey-count',String(model.chapters.length));main.insertBefore(map,main.children[0]);
 sequence.className='tour-stop-sequence journey-route';map.append(sequence);
 const progress=main.querySelector('.ui-tour-progress');map.insertBefore(progress,sequence);
 const venue=main.querySelector('.tour-selected-venue');box.append(venue);
 const confirm=view.root.querySelector('[data-action=confirm-chapter]');confirm.hidden=true;
 const footer=confirm.parentNode;footer.hidden=true;
 for(const row of sequence.querySelectorAll('.shell-chapter-option')){
  const content=getChapterContent(row.dataset.chapter);row.classList.add('journey-chapter');row.style.setProperty('--journey-row',String(model.chapters.length-content.ordinal+1));
  row.dataset.journeySide=content.ordinal%2===1?'left':'right';
  const art=view.element('img','journey-landmark',undefined,row);art.src='art/showbill/stop-'+content.id+'.webp';art.alt='';art.draggable=false;
  const copy=row.querySelector('.shell-chapter-copy');
  row.replaceChildren(art,copy,row.querySelector('.shell-chapter-number'));
  const statusIcon={locked:'lock',cleared:'check',available:'arrow-right'}[row.dataset.state];
  const state=copy.querySelector('.shell-chapter-state');
  if(row.dataset.state==='locked'){
    const condition=state.textContent;
    state.replaceChildren();
    row.disabled=false;
    const info=view.element('div','locked-tour-condition',undefined,box);
    info.hidden=true;
    const chapterName=copy.querySelector('strong').textContent;
    row.setAttribute('aria-label',chapterName+'，查看开放条件');
    const place=view.element('img','',undefined,info);place.src=art.src;place.alt='';
    view.element('p','',condition,info);
    row.addEventListener('click',()=>openHierarchySheet(view,{title:chapterName+' · 开放条件',content:info,trigger:row}));
  }
  view.icon(statusIcon,state,true);
 }
 const current=model.chapters.find(row=>row.id===view.selection.chapterId&&row.unlocked)||model.chapter;
 const target=sequence.querySelector(`[data-chapter=${current.id}]`);
 let top=view.root.dataset.motion?null:view.journeyScrollTop,width=null,moved=false;
 const observer=new window.ResizeObserver(()=>{
  const nextWidth=map.clientWidth;
  if(width!==null&&nextWidth!==width){top=null;moved=false;}
  width=nextWidth;if(moved)return;
  map.scrollTop=top??sequence.offsetTop+target.offsetTop-(map.clientHeight-target.offsetHeight)/2;
 });
 // Image decoding can change scroll anchoring without player input. Only actual input cancels placement.
 map.addEventListener('pointerdown',()=>{moved=true;},{passive:true});
 map.addEventListener('wheel',()=>{moved=true;},{passive:true});
 map.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))moved=true;});
 observer.observe(map);observer.observe(sequence);
 view.journeyFocusDispose=()=>observer.disconnect();
 if(view.journeyDetails!==true)return;
 view.journeyDetails=false;
 const chapter=getChapterContent(view.selection.chapterId),profile=loadPublicProfile(),content=view.element('section','journey-detail',undefined,box);
 const trigger=sequence.querySelector(`[data-chapter=${chapter.id}]`);
 const head=view.element('header','journey-detail-heading',undefined,content);
 const image=view.element('img','journey-detail-landmark',undefined,head);image.src=chapter.resources.venue;image.alt='';
 const name=view.element('h3','journey-detail-name',chapter.name,head);name.dataset.uiLetter='chapter-'+chapter.id;
 view.element('p','journey-place',chapter.subtitle,head);
 const tabs=view.element('nav','journey-detail-tabs',undefined,content);tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','章节详情');
 const panels=view.element('div','journey-detail-panels',undefined,content),sections={};
 const selectTab=id=>{
  for(const [key,section]of Object.entries(sections)){
   section.panel.hidden=key!==id;section.button.setAttribute('aria-selected',String(key===id));section.button.tabIndex=key===id?0:-1;
  }
 };
 for(const [id,label]of [['mission','目标'],['story','故事']]){
  const button=view.button(tabs,label,()=>selectTab(id),{className:'journey-detail-tab',action:'journey-tab-'+id});
  button.id='journey-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls','journey-panel-'+id);
  const panel=view.element('section','journey-detail-panel',undefined,panels);panel.id='journey-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
  sections[id]={button,panel};
 }
 tabs.addEventListener('keydown',event=>{
  const keys=Object.keys(sections),index=keys.findIndex(key=>sections[key].button===event.target);
  if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
  selectTab(keys[next]);sections[keys[next]].button.focus();
 });
 selectTab(view.journeyStoryReturn===true?'story':'mission');view.journeyStoryReturn=false;
 const stories=view.element('nav','journey-stories',undefined,sections.story.panel);stories.setAttribute('aria-label','章节故事');
 for(const [phase,label]of [['intro','开场'],['midpoint','途中'],['outro','章尾']]){
  const allowed=canReadStoryBeat(profile,chapter.id,phase),reading=getStoryReadingLabel(chapter.id+':'+phase,playerPreferences.read().storyProgress);
  const button=view.button(stories,label+' · '+(allowed?reading:'通关后开放'),()=>{
   view.hierarchySheetDispose();
   const session=view.scene._sessionExperience;
   session.showStory(chapter.id,phase,{complete:()=>{session.close();if(view.disposed||view.page!=='tour')return;view.journeyDetails=true;view.journeyStoryReturn=true;view.render();}});
  },{className:'journey-story',action:'journey-story-'+phase});
  button.dataset.storyPhase=phase;button.disabled=!allowed;button.replaceChildren();view.element('strong','journey-story-phase',label,button);
  view.element('small','',allowed?reading:'通关后开放',button);
  view.icon(allowed?'arrow-right':'lock',button,true);
  if(allowed&&reading!=='已读')sections.story.button.setAttribute('aria-label','故事，有未读片段');
 }
 const goals=view.element('section','journey-objective-section',undefined,sections.mission.panel);
 if(sections.story.button.getAttribute('aria-label'))view.element('small','journey-unread','未读',sections.story.button);
 const steps=view.element('ol','journey-objectives',undefined,goals);for(const text of chapter.pacingSteps)view.element('li','',text,steps);
 const rule=view.element('details','journey-rule-details',undefined,sections.mission.panel);
 view.element('summary','','场地规则',rule);view.element('p','journey-mission-rule',chapter.briefing.rule,rule);
 const reward=getChapterRewardPreview(profile,chapter.id,model.member.id);
 const rewards=view.element('section','journey-reward-strip',undefined,content);rewards.setAttribute('aria-label','通关收获');
 view.element('p','journey-reward-heading','通关收获',rewards);
 const items=view.element('div','journey-reward-items',undefined,rewards);
 const description=view.element('p','journey-reward-description',undefined,rewards);description.hidden=true;
 description.id='journey-reward-description';description.setAttribute('role','status');
 const rows=[{id:'notes',name:'练习笔记',value:`+${reward.notes}`,state:'通关获得',src:PUBLIC_MENU_ART.notes,
   description:`练习笔记 +${reward.notes} · 通关并保存后到账，可用于成员训练。`},
  ...reward.equipment.map(item=>({id:item.id,name:item.name,value:item.name,state:item.performerId?'成员首通':'章节首通',
   src:getEquipmentIconArt(item.id).src,description:`${item.name} · ${item.description}。通关后在背包中装备。`}))];
 for(const item of rows){
  const button=view.button(items,item.name+'，'+item.state,()=>{
   const opened=button.getAttribute('aria-expanded')!=='true';
   for(const other of items.querySelectorAll('button'))other.setAttribute('aria-expanded','false');
   button.setAttribute('aria-expanded',String(opened));description.hidden=!opened;description.textContent=opened?item.description:'';
  },{className:'journey-reward-item'});
  button.dataset.reward=item.id;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',description.id);button.replaceChildren();
  const icon=view.element('img','journey-reward-icon',undefined,button);icon.src=item.src;icon.alt='';icon.draggable=false;
  view.element('strong','journey-reward-value',item.value,button);view.element('small','journey-reward-state',item.id==='notes'?item.name:item.state,button);
 }
 const commands=view.element('footer','journey-commands',undefined,content);
 const goalButton=main.querySelector('[data-action=chapter-goals]');goalButton.hidden=true;
 const prepare=view.button(commands,'前往准备',()=>{view.hierarchySheetDispose();confirm.click();},{className:'journey-prepare',action:'journey-prepare'});
 prepare.setAttribute('aria-label','前往准备 · '+chapter.name);view.icon('arrow-right',prepare,true);
 const dialog=openHierarchySheet(view,{title:chapter.name,content,trigger});dialog.dataset.sheetKind='chapter';
 dialog.dataset.chapterPresentation='briefing294';
 const title=dialog.querySelector('.ui-sheet-title');title.dataset.uiLetter='chapter-'+chapter.id;
}
