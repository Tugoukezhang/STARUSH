// Second-level sheet for owner menus. The sheet borrows an existing, already-wired node
// (its handlers stay intact) and always returns it to its original parent and hidden state.
// One live native dialog per view; render/destroy call view.hierarchySheetDispose first.
import {loadPublicProfile} from '../utils/publicRunProgression.mjs';
import {getPreparationSnapshot} from '../utils/publicPreparation.mjs';
import {getPublicPerformanceRecord} from '../utils/publicPerformanceRecords.mjs';
import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';
import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
import {loadBackstageProgress} from '../utils/publicBackstageProgress.mjs';
import {mountHierarchyUi} from './HierarchyUiArt.mjs';
import {getMenuAvatarArt} from './MenuPortraitAvatar.mjs';

export function openHierarchySheet(view,{title,content,trigger}) {
  if(!view?.root||!view.doc||typeof title!=='string'||!title||!content?.parentNode||!trigger)
    throw new TypeError('openHierarchySheet needs view.root, a title, an attached content node and its trigger');
  view.hierarchySheetDispose?.();
  const doc=view.doc,home={parent:content.parentNode,next:content.nextSibling,hidden:content.hidden};
  const dialog=doc.createElement('dialog');dialog.className='ui-sheet';dialog.setAttribute('aria-label',title);
  const actors=content.classList.contains('shell-member-strip')||content.classList.contains('pm-cast-strip');
  const memberDetail=view.page==='roster'&&['ability','dossier'].includes(content.dataset.rosterPanel);
  const panelSemantics=memberDetail?{role:content.getAttribute('role'),label:content.getAttribute('aria-labelledby')}:null;
  dialog.dataset.sheetKind=actors?'actors':memberDetail?'member-'+content.dataset.rosterPanel:'detail';
  if(memberDetail){
    dialog.dataset.member=view.selection.memberId;
    content.setAttribute('role','region');content.setAttribute('aria-label',title);content.removeAttribute('aria-labelledby');
  }
  if(actors){
    content.classList.add('ui-actor-grid');
    const profile=loadPublicProfile();
    const visits=view.page==='lounge'?loadBackstageProgress().state.visits:null;
    for(const button of content.children){
      const id=content.classList.contains('shell-member-strip')?(view.page==='growth'?button.dataset.growthMember:button.dataset.member):button.dataset.action.slice('companion-member-'.length);
      let context;
      if(view.page==='records'){
        const count=PUBLIC_CHAPTERS.filter(chapter=>getPublicPerformanceRecord(profile,chapter.id,id,PUBLIC_RULESET_ID)).length;
        context=count?'成绩 '+count+' / '+PUBLIC_CHAPTERS.length+' 站':'尚无已记录成绩';
      }else if(view.page==='workshop'||view.page==='growth')context='当前阶位 '+getPreparationSnapshot(profile,id).trainingLevel;
      else if(visits)context=visits[id]?'已交谈 '+visits[id]+' 次':'尚未交谈';
      if(context){
        const note=button.querySelector('.picker-context')||view.element('small','picker-context',undefined,button);
        note.textContent=context;
        const name=button.getAttribute('aria-label').split('，')[0];button.setAttribute('aria-label',name+'，'+context);
      }
      if(!button.querySelector('.ui-actor-name')){const name=view.element('span','ui-actor-name',undefined,button);name.dataset.uiLetter=id;}
    }
  }
  const header=doc.createElement('header');header.className='ui-sheet-header';
  const heading=doc.createElement('h2');heading.className='ui-sheet-title';heading.textContent=title;
  if(actors)heading.dataset.uiLetter='switch';
  const close=doc.createElement('button');close.type='button';close.className='ui-sheet-close';
  close.dataset.uiIcon='close';close.dataset.action='sheet-close';close.setAttribute('aria-label','关闭');close.title='关闭';
  const label=doc.createElement('span');label.className='ui-sr-label';label.textContent='关闭';close.append(label);
  const body=doc.createElement('div');body.className='ui-sheet-body';
  if(memberDetail){
    const id=view.selection.memberId,art=getMenuAvatarArt(id);
    const identity=view.element('div','member-sheet-identity',undefined,body);
    const avatar=view.element('img','member-sheet-avatar',undefined,identity);
    avatar.src=art.src;avatar.width=art.width;avatar.height=art.height;avatar.alt='';avatar.draggable=false;
    const name=view.element('span','member-sheet-name',undefined,identity);name.dataset.uiLetter=id;
    name.setAttribute('aria-label',view.root.querySelector('.roster-stage-identity').querySelector('h2').getAttribute('aria-label'));
    const weapon=view.element('img','member-sheet-weapon',undefined,identity);
    weapon.src=view.root.querySelector('.member-profession-glyph').src;weapon.alt='';weapon.draggable=false;
  }
  header.append(heading,close);dialog.append(header,body);
  body.append(content);content.hidden=false;
  // Inside view.root so the shell's own event isolation and root.contains() guards still apply.
  view.root.append(dialog);
  let live=true;
  const dispose=({restoreFocus=false}={})=>{
    if(!live)return;live=false;
    if(view.hierarchySheetDispose===dispose)view.hierarchySheetDispose=null;
    dialog.removeEventListener('cancel',onCancel);dialog.removeEventListener('close',onClose);close.removeEventListener('click',onCommand);
    if(dialog.open)dialog.close();
    home.parent.insertBefore(content,home.next?.parentNode===home.parent?home.next:null);
    content.hidden=home.hidden;
    if(memberDetail){content.setAttribute('role',panelSemantics.role);content.setAttribute('aria-labelledby',panelSemantics.label);content.removeAttribute('aria-label');}
    dialog.remove();
    if(restoreFocus&&trigger.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});
  };
  const onCancel=event=>{event.preventDefault();dispose({restoreFocus:true});};
  const onClose=()=>dispose({restoreFocus:true});
  const onCommand=()=>{if(!view.disposed)dispose({restoreFocus:true});};
  dialog.addEventListener('cancel',onCancel);dialog.addEventListener('close',onClose);close.addEventListener('click',onCommand);
  view.hierarchySheetDispose=dispose;
  mountHierarchyUi(view,dialog);dialog.showModal();
  return dialog;
}
