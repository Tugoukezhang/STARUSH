import {openHierarchySheet} from './HierarchySheets.mjs';
import {mountHierarchyUi} from './HierarchyUiArt.mjs';
import {getUiPerformer} from '../utils/userCast.mjs';

export function composeSecondaryScene(view,main){
  if(['growth','library','records'].includes(view.page))main.querySelector('.system-screen-frame').hidden=true;
  if(view.page==='growth'){
    const stage=main.querySelector('.sec-growth-stage');
    const portrait=view.element('div','sec-growth-portrait',undefined,stage);
    view.mark(portrait,getUiPerformer(view.selection.memberId),true);
    portrait.style.setProperty('--growth-face','url("art/setdesign/avatar-'+view.selection.memberId+'.webp")');
    const prepare=view.root.querySelector('[data-action=prepared-preflight]');
    prepare.dataset.uiIcon='route';prepare.classList.add('ui-icon-command');
    for(const span of prepare.querySelectorAll('span'))span.classList.add('ui-sr-label');
  }
  if(view.page==='library'){
    const choices=[...main.querySelectorAll('[data-arrangement]')];
    for(const [stage,key]of [['first','arrangementFirst'],['second','arrangementSecond']]){
      const choice=choices.find(button=>button.dataset.arrangement===view[key]);
      if(choice){const art=choice.querySelector('img').cloneNode();art.className='sec-selected-art';main.querySelector(`[data-library-stage=${stage}]`).append(art);}
    }
  }
  if(view.page==='records'){
    for(const row of main.querySelectorAll('[data-record-chapter]'))row.querySelector('h2').dataset.uiLetter='chapter-'+row.dataset.recordChapter;
    const story=view.root.querySelector('[data-action=story-journal]');
    story.dataset.uiIcon='story';story.dataset.uiWidget='true';story.title='巡演剧情';story.classList.add('ui-icon-command');for(const span of story.querySelectorAll('span'))span.classList.add('ui-sr-label');
  }
  if(view.page==='workshop'){
    main.dataset.secondaryPage='workshop';
    const identity=main.querySelector('.workshop-member-context');
    const training=main.querySelector('.workshop-training');
    const effects=main.querySelector('.workshop-effects');
    training.append(effects);effects.hidden=false;
    const train=view.root.querySelector('[data-action=train]');
    delete train.dataset.uiIcon;
    if(!train.disabled)train.dataset.secondaryLetter='train';
    identity.classList.add('sec-training-stage');training.classList.add('sec-training-body');
    const name=identity.querySelector('.workshop-member-copy').querySelector('strong');
    if(name)name.dataset.uiLetter=identity.dataset.performer;
    const catalog=main.querySelector('[data-action=training-catalog]');
    if(catalog){catalog.dataset.secondaryLetter='growth';catalog.classList.add('sec-small-command');}
  }
  if(view.page==='venue'){
    // B266 venue studio: the room scene leads; a slim three-room dock, a short saved summary with one edit
    // command and the single 筹备 command sit below it; member/program/save live in the opaque editor sheet.
    // Static labels become data-venue-letter/-glyph hosts (Codex mounts the art); dynamic text stays native.
    main.dataset.secondaryPage='venue';
    const screen=main.querySelector('.product-module-screen'),scene=screen.querySelector('.pm-scene');
    for(const selector of ['.pm-scene-copy','.pm-scene-caption','.pm-scene-portrait','.pm-footer'])screen.querySelector(selector).hidden=true;
    const row=screen.querySelector('.pm-room'),fields=row.querySelector('.pm-room-fields'),roomId=row.dataset.room;
    const backdrop={stage:'art/venue-studio-20261101/stage.webp',rehearsal:'art/venue-studio-20261101/rehearsal.webp',lounge:'art/venue-studio-20261101/lounge.webp'}[roomId];
    if(!backdrop)throw new RangeError(`Unknown venue room: ${roomId}`);
    scene.dataset.room=roomId;scene.querySelector('.pm-scene-art').src=backdrop;
    const reskin=(button,key)=>{
      delete button.dataset.uiIcon;delete button.dataset.secondaryLetter;
      for(const selector of ['svg','.menu-art','.line-icon','.shell-art'])for(const old of button.querySelectorAll(selector))old.remove();
      const label=button.querySelector('span');if(label)label.dataset.venueLetter=key;
      return button;
    };
    for(const room of scene.querySelectorAll('[data-room-target]')){reskin(room,room.dataset.roomTarget);room.dataset.venueGlyph=room.dataset.roomTarget;}
    const current=scene.querySelector(`[data-room-target=${roomId}]`);
    const identity=view.element('div','vs-room-identity',undefined,scene);identity.setAttribute('aria-hidden','true');
    view.element('span','',current.getAttribute('aria-label'),identity).dataset.venueLetter=roomId;
    // Editor: original heading, fields, draft line and save command, borrowed (handlers intact).
    const box=view.element('div','ui-sheet-holder',undefined,screen);box.hidden=true;
    const editor=view.element('section','sec-venue-editor',undefined,box);
    const heading=row.querySelector('.pm-section-heading');
    if(heading){for(const selector of ['svg','.menu-art','small'])for(const old of heading.querySelectorAll(selector))old.hidden=true;editor.append(heading);}
    editor.append(fields);
    for(const [selector,key,text]of [['.pm-room-members','member','成员'],['.pm-room-programs','program','节目']]){
      const group=fields.querySelector(selector);if(!group)continue;
      const label=view.element('h4','vs-group-label',text,null);label.dataset.venueLetter=key;fields.insertBefore(label,group);
    }
    const footer=view.element('div','vs-editor-footer',undefined,editor);
    for(const selector of ['.vs-editor-status','.pm-room-draft']){const node=row.querySelector(selector);if(node)footer.append(node);}
    const assign=reskin(row.querySelector(`[data-action=venue-assign-${roomId}]`),'assign');footer.append(assign);
    // Dock: persisted summary + edit, then the one prepare command, then the status line (hidden while idle).
    const dock=view.element('div','sec-venue-dock',undefined,screen);
    const summary=view.element('div','vs-summary',undefined,dock);
    const saved=row.querySelector('.pm-room-saved');saved.classList.add('sec-venue-caption');summary.append(saved);
    const openEditor=(reopened=false)=>{
      const dialog=openHierarchySheet(view,{title:'房间排班',content:editor,trigger:edit});
      dialog.dataset.venueSheet='editor';if(reopened===true)dialog.dataset.venueReopened='true';dialog.querySelector('.ui-sheet-title').dataset.venueLetter='schedule';
      mountHierarchyUi(view,dialog);
      // Close and Escape are cancel: an unsaved draft is dropped (never written) and the page says so.
      const cancel=()=>{
        if(view.disposed||view.page!=='venue'||!view.venueDraft)return;
        view.venueDraft=null;view.productModuleMessage={page:'venue',text:'未保存的排班已取消。'};
        view.render('[data-action=venue-edit]');
      };
      dialog.querySelector('[data-action=sheet-close]').addEventListener('click',cancel);
      dialog.addEventListener('cancel',cancel);
      return dialog;
    };
    const occupied=current.dataset.roomState!=='empty';
    const edit=view.button(summary,occupied?'编辑排班':'先安排成员',openEditor,{className:'sec-venue-edit',action:'venue-edit'});
    edit.dataset.venueGlyph='schedule';
    if(!edit.querySelector('span'))view.element('span','',undefined,edit);
    if(occupied)edit.querySelector('span').dataset.venueLetter='schedule';
    else edit.querySelector('span').textContent='先安排成员';
    const prepare=reskin(row.querySelector(`[data-action=venue-prepare-${roomId}]`),'prepare');prepare.hidden=!occupied;dock.append(prepare);
    const status=screen.querySelector('.pm-save-status');if(status)dock.append(status);
    // An in-editor command re-rendered the page: bring the same editor back over the new nodes.
    if(screen.dataset.venueEditor==='open')openEditor(true);
  }
}
