import {getPortraitBase} from './PortraitBaseRegistration.mjs';
import {RED_VALKYRIE_AVATAR} from '../utils/redValkyrieArt.mjs';
import {GREEN_WINDSONG_AVATAR} from '../utils/greenWindsongArt.mjs';
// Confirmed replacements have their own avatars; the remaining legacy member uses its registered crop.
const ART=Object.freeze({sakura:RED_VALKYRIE_AVATAR,kai:GREEN_WINDSONG_AVATAR,enjo:getPortraitBase('enjo').avatar});
export const getMenuAvatarArt=id=>Object.hasOwn(ART,id)?ART[id]:null;
export function mountMenuAvatar(view,parent,id,fallback){
 const art=getMenuAvatarArt(id);if(!art||!parent||!view?.doc||view.disposed)return null;
 const image=view.element('img','menu-head-avatar',undefined,parent);image.alt='';image.setAttribute('aria-hidden','true');image.width=art.width;image.height=art.height;image.hidden=true;image.draggable=false;
 parent.dataset.menuAvatar=id;parent.dataset.avatarState='loading';if(fallback)fallback.hidden=true;
 let started=false,failed=false;const owned=()=>!failed&&!view.disposed&&image.parentNode===parent&&(!view.root||view.root.contains(parent));
 const fail=()=>{if(!owned())return;failed=true;image.remove();
  if(getPortraitBase(id)){parent.dataset.avatarState='unavailable';const error=view.element('span','menu-avatar-error','!',parent);error.setAttribute('role','img');error.setAttribute('aria-label','头像未能载入');error.title='头像未能载入';}
  else{delete parent.dataset.menuAvatar;delete parent.dataset.avatarState;if(fallback)fallback.hidden=false;}
 };
 const ready=async()=>{if(!owned()||started)return;started=true;try{if(image.naturalWidth!==(art.naturalWidth||art.width)||image.naturalHeight!==(art.naturalHeight||art.height))return fail();if(image.decode)await image.decode();if(!owned())return;image.hidden=false;parent.dataset.avatarState='ready';}catch{fail();}};
 image.addEventListener('load',ready,{once:true});image.addEventListener('error',fail,{once:true});image.src=art.src;if(image.complete&&image.naturalWidth>0)ready();return image;
}
