import {getPortraitBase} from './PortraitBaseRegistration.mjs';
import {RED_VALKYRIE_AVATAR} from '../utils/redValkyrieArt.mjs';
import {BLUE_ACADEMY_AVATAR} from '../utils/blueAcademyArt.mjs';
import {GREEN_WINDSONG_AVATAR} from '../utils/greenWindsongArt.mjs';
// All three confirmed replacement identities own their decoded avatar assets.
const ART=Object.freeze({sakura:RED_VALKYRIE_AVATAR,kai:GREEN_WINDSONG_AVATAR,enjo:BLUE_ACADEMY_AVATAR});
export const getMenuAvatarArt=id=>Object.hasOwn(ART,id)?ART[id]:null;
// The compact crop covers a 60 CSS pixel avatar on a three-density screen.
// Keep the full registered original as the fallback, including for decode errors.
export function setMemberPickerAvatar(image,id,{onReady,onUnavailable}={}) {
  const art=getMenuAvatarArt(id);
  if(!art||!image)return false;
  let usingOriginal=false;
  const retryOriginal=()=>{
    if(usingOriginal) {
      image.removeEventListener('error',retryOriginal);
      onUnavailable?.();
      return;
    }
    usingOriginal=true;
    image.removeAttribute('srcset');
    image.src=art.src;
  };
  image.addEventListener('error',retryOriginal);
  const loaded=()=>onReady?.(retryOriginal);
  if(onReady)image.addEventListener('load',loaded);
  image.alt='';image.draggable=false;image.width=art.width;image.height=art.height;
  image.srcset='art/setdesign/avatar-'+id+'.webp 1x';
  image.src=art.src;
  if(image.complete&&image.naturalWidth>0)loaded();
  return true;
}
export function mountMenuAvatar(view,parent,id,fallback){
  const art=getMenuAvatarArt(id);
  if(!art||!parent||!view?.doc||view.disposed)return null;
  const image=view.element('img','menu-head-avatar',undefined,parent);
  image.setAttribute('aria-hidden','true');image.hidden=true;
  parent.dataset.menuAvatar=id;parent.dataset.avatarState='loading';
  if(fallback)fallback.hidden=true;
  let decoding=false,failed=false;
  const owned=()=>!failed&&!view.disposed&&image.parentNode===parent&&(!view.root||view.root.contains(parent));
  const fail=()=>{
    if(!owned())return;
    failed=true;image.remove();
    if(getPortraitBase(id)){
      parent.dataset.avatarState='unavailable';
      const error=view.element('span','menu-avatar-error','!',parent);
      error.setAttribute('role','img');error.setAttribute('aria-label','头像未能载入');error.title='头像未能载入';
    }else{
      delete parent.dataset.menuAvatar;delete parent.dataset.avatarState;
      if(fallback)fallback.hidden=false;
    }
  };
  const ready=async retryOriginal=>{
    if(!owned()||decoding)return;
    const width=image.naturalWidth,height=image.naturalHeight;
    const compact=width===180&&height===180;
    if(!compact&&(width!==(art.naturalWidth||art.width)||height!==(art.naturalHeight||art.height))){
      retryOriginal();return;
    }
    decoding=true;
    try{
      if(image.decode)await image.decode();
      if(owned()){image.hidden=false;parent.dataset.avatarState='ready';}
    }catch{if(owned())retryOriginal();}finally{decoding=false;}
  };
  setMemberPickerAvatar(image,id,{onReady:ready,onUnavailable:fail});
  return image;
}
