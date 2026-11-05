import {studyUiArt} from './EnjoVisualStudy.mjs';
import {getActiveUserCastArt} from '../utils/userCast.mjs';
const BASE='art/five-q-ui-20261013/';
const MEMBERS=new Set(['sakura','venus','genya','kai','enjo']);

// UI-only exports. Battle atlases and the optional Q renderer keep their own gates.
export function getUiPerformerArt(id){
  if(!MEMBERS.has(id))return null;
  const ownerArt=getActiveUserCastArt(id);if(ownerArt)return ownerArt;
  const study=studyUiArt(id);if(study)return study;
  return Object.freeze({id,avatar:`${BASE}${id}-avatar.webp`,portrait:`${BASE}${id}-portrait.webp`,
    victory:`${BASE}${id}-victory.webp`,defeat:`${BASE}${id}-defeat.webp`,width:232,height:290});
}

export function uiPerformerAvatarCss(id,baseURI=globalThis.document?.baseURI){
  const art=getUiPerformerArt(id);
  if(!art)return 'none';
  const url=baseURI?new URL(art.avatar,baseURI).href:`/${art.avatar}`;
  return `url("${url}")`;
}
