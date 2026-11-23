import {mountPreflightUi271} from './PreflightUiArt271.mjs';
import {getActiveUserCastArt,getDisplayPerformer} from '../utils/userCast.mjs';
const BASE='art/hierarchy-ui-20261101/';
const ICONS=new Set(['home','member','tour','bag','companion','venue','modes','switch','back','close','train','equipment','skill','info','route','archive','settings','lock','owned','selected','story','backstage','program','rehearsal','performers','save']);
const LETTERS=new Set(['roster','tour','inventory','preflight','workshop','start','resume','confirm','sakura','kai','enjo','open','chapter-opening','chapter-neon','chapter-encore','switch','tour-confirm','program','practice','backstage','services']);
const INVENTORY_LETTERS=new Set(['all','owned','compatible','equip','unequip','source']);
LETTERS.add('chapter-raincheck');
LETTERS.add('chapter-homecoming');
const COMPANION_LETTERS=new Set(['greeting','rehearsal','encore','record']);
const COMPANION_GLYPHS=new Set(['greeting','rehearsal','encore']);
const VENUE_LETTERS=new Set(['stage','rehearsal','lounge','assign','prepare','schedule','member','program','stage-soundcheck','stage-blocking','rehearsal-rhythm','rehearsal-ensemble','lounge-rest','lounge-review']);
const VENUE_GLYPHS={stage:'art/companion-studio-20261101/icon-encore.webp',rehearsal:'art/companion-studio-20261101/icon-rehearsal.webp',lounge:'art/companion-studio-20261101/icon-greeting.webp',schedule:'art/lobby-widgets-20261101/program.webp'};

export function mountHierarchyUi(view,root=view.root){
  const settings=root.querySelector('[data-action=settings]');
  if(settings){settings.dataset.uiIcon='settings';for(const old of settings.querySelectorAll('.home-concept-art'))old.remove();}
  for(const node of root.querySelectorAll('[data-ui-icon]')){
    const key=node.dataset.uiIcon;
    if(!ICONS.has(key))throw new RangeError(`Unknown hierarchy icon: ${key}`);
    if(node.querySelector('.ui-glyph'))continue;
    for(const selector of ['svg','.line-icon','.shell-art'])for(const old of node.querySelectorAll(selector))old.hidden=true;
    const widget=node.dataset.uiWidget==='true'||['settings','lock','owned','selected'].includes(key);
    const img=view.element('img','ui-glyph',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
    img.src=['backstage','program','rehearsal','performers','save'].includes(key)?`art/lobby-widgets-20261101/${key}.webp`:key==='story'?'art/screen-rebuild-20261101/story.webp':BASE+(widget?'widget-':'icons-')+key+'.webp';
    node.dataset.uiDecorated='true';
    if(key==='close')img.src='art/chapter-sheet-294/close.webp';
  }
  for(const node of root.querySelectorAll('[data-ui-letter]')){
    const key=node.dataset.uiLetter;
    if(!LETTERS.has(key))throw new RangeError(`Unknown hierarchy lettering: ${key}`);
    if(getActiveUserCastArt(key)?.confirmedDesign){
      delete node.dataset.uiLetter;node.dataset.confirmedName=key;
      node.textContent=getDisplayPerformer(key).name;
      Object.assign(node.style,{fontSize:'18px',lineHeight:'28px',fontWeight:'800',color:(['desk','preflight','roster'].includes(view.page)&&!node.classList.contains('member-sheet-name'))?'#f3fff9':'#203939'});
      continue;
    }
    if(node.querySelector('.ui-letter-art'))continue;
    const img=view.element('img','ui-letter-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src=['backstage','services'].includes(key)?'art/console-studio-20261102/letter-'+key+'.webp':['program','practice'].includes(key)?'art/program-studio-20261101/letter-'+key+'.webp':key==='switch'&&['roster','workshop','growth'].includes(view.page)?'art/member-studio-20261101/letter-switch.webp':BASE+'letters-'+key+'.webp';
  }
  for(const node of root.querySelectorAll('[data-ui-letter="chapter-raincheck"]'))node.querySelector('.ui-letter-art').src='art/rooftop-20261103/title.webp';
  for(const node of root.querySelectorAll('[data-ui-letter="chapter-homecoming"]'))node.querySelector('.ui-letter-art').src='art/homecoming-300/title.webp';
  for(const node of root.querySelectorAll('[data-inventory-letter]')){
    const key=node.dataset.inventoryLetter;
    if(!INVENTORY_LETTERS.has(key))throw new RangeError(`Unknown inventory lettering: ${key}`);
    if(node.querySelector('.inventory-letter-art'))continue;
    const img=view.element('img','inventory-letter-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src='art/inventory-studio-20261101/'+key+'.webp';
    if(node.dataset.inventoryFilter){const glyph=view.element('img','inventory-filter-glyph',undefined,node);glyph.alt='';glyph.draggable=false;glyph.setAttribute('aria-hidden','true');glyph.src='art/inventory-studio-20261101/icon-'+key+'.webp';}
  }
  for(const node of root.querySelectorAll('[data-companion-letter]')){
    const key=node.dataset.companionLetter;
    if(!COMPANION_LETTERS.has(key))throw new RangeError(`Unknown companion lettering: ${key}`);
    if(node.querySelector('.companion-letter-art'))continue;
    const img=view.element('img','companion-letter-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src='art/companion-studio-20261101/'+key+'.webp';
  }
  for(const node of root.querySelectorAll('[data-companion-glyph]')){
    const key=node.dataset.companionGlyph;
    if(!COMPANION_GLYPHS.has(key))throw new RangeError(`Unknown companion glyph: ${key}`);
    if(node.querySelector('.companion-glyph-art'))continue;
    const img=view.element('img','companion-glyph-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src='art/companion-studio-20261101/icon-'+key+'.webp';
  }
  for(const node of root.querySelectorAll('[data-venue-letter]')){
    const key=node.dataset.venueLetter;
    if(!VENUE_LETTERS.has(key))throw new RangeError(`Unknown venue lettering: ${key}`);
    if(node.querySelector('.venue-letter-art'))continue;
    const img=view.element('img','venue-letter-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src='art/venue-studio-20261101/letter-'+key+'.webp';
  }
  for(const node of root.querySelectorAll('[data-venue-glyph]')){
    const key=node.dataset.venueGlyph;
    if(!Object.hasOwn(VENUE_GLYPHS,key))throw new RangeError(`Unknown venue glyph: ${key}`);
    if(node.querySelector('.venue-glyph-art'))continue;
    const img=view.element('img','venue-glyph-art',undefined,node);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src=VENUE_GLYPHS[key];
  }
  mountConsoleUiArt(view.doc,root);
  mountPreflightUi271(view,root);
}

const CONSOLE_LETTERS=new Set(['backstage','services','events','practice','members','sound','backup','local','network','export','import','return-settings']);
const CONSOLE_ICONS=new Set(['program','practice','settings','backup']);
export function mountConsoleUiArt(doc,root){
 for(const [attribute,keys,kind]of [['consoleLetter',CONSOLE_LETTERS,'letter'],['consoleIcon',CONSOLE_ICONS,'icon']]){
  const selector=kind==='letter'?'[data-console-letter]':'[data-console-icon]';
  for(const node of root.querySelectorAll(selector)){
   const key=node.dataset[attribute];if(!keys.has(key))throw new RangeError(`Unknown console ${kind==='letter'?'lettering':'icon'}: ${key}`);
   if(node.querySelector('.console-'+kind+'-art'))continue;
   const image=doc.createElement('img');image.className='console-'+kind+'-art';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');image.src='art/console-studio-20261102/'+kind+'-'+key+'.webp';node.append(image);
  }
 }
}
