const KEYS=new Set(['loadout','route','arrangement','goal','details','equipment','train','start','keep','restart','choose','preflight']);

export function mountPreflightUi271(view,root){
 if(view.page!=='preflight')return;
 if(root===view.root){
  const title=root.querySelector('.shell-brand').querySelector('h1');
  delete title.dataset.uiLetter;for(const image of title.querySelectorAll('.ui-letter-art'))image.remove();
  title.textContent='开演前确认';title.dataset.flightLetter='preflight';title.setAttribute('aria-label','开演前确认');
  const start=root.querySelector('[data-action=start]');delete start.dataset.uiLetter;
  for(const image of start.querySelectorAll('.ui-letter-art'))image.remove();start.dataset.flightLetter='start';
  for(const[action,key]of [['cancel-new-run','keep'],['confirm-new-run','restart']])for(const button of root.querySelectorAll('[data-action='+action+']'))button.dataset.flightLetter=key;
  const stage=root.querySelector('.ui-preflight-stage');
  const status=view.element('span','flight-loading-status',undefined,stage);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const image=view.element('img','flight-loading-glyph',undefined,status);image.src='art/hierarchy-ui-20261101/icons-member.webp';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');
  view.element('span','', '演员就位中',status);
 }
 if(root.tagName==='DIALOG'){
  const title=root.querySelector('.ui-sheet-title'),key={'串场路线':'route','演出编排':'arrangement','场地规则':'details','场地资料':'details'}[title.textContent];
  if(key){title.dataset.flightLetter=key;if(key==='details'){title.textContent='场地规则';root.setAttribute('aria-label','场地规则');}}
 }
 for(const node of root.querySelectorAll('[data-flight-letter]')){
  const key=node.dataset.flightLetter;if(!KEYS.has(key))throw new RangeError('Unknown preflight lettering: '+key);
  if(node.querySelector('.flight-letter-art'))continue;
  const image=view.element('img','flight-letter-art',undefined,node);image.src='art/preflight-studio-20261102/letter-'+key+'.webp';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');
 }
}
