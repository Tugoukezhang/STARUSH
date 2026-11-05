import {PUBLIC_CHAPTER_CONTENT} from '../utils/publicChapterContent.mjs';
export const CHAPTER_VENUE_ART=Object.freeze(Object.fromEntries(PUBLIC_CHAPTER_CONTENT.map(row=>[row.id,row.resources.venue])));

// Venue art is decorative; the actual map underneath remains the network/error fallback.
export function mountChapterVenueArt(view,parent,chapter){
  if(!view?.doc||view.disposed||!parent||!Object.hasOwn(CHAPTER_VENUE_ART,chapter?.id)||
    !['shell-main-map','shell-route-preview','preflight-scene'].some(name=>parent.classList.contains(name)))return null;
  const existing=parent.querySelector('.chapter-venue-art');if(existing)return existing;
  const image=view.doc.createElement('img');
  image.className='chapter-venue-art';image.alt='';image.draggable=false;image.hidden=true;
  image.width=768;image.height=512;image.setAttribute('aria-hidden','true');
  parent.append(image);
  const owned=()=>!view.disposed&&image.parentNode===parent&&view.root.contains(parent);
  const fail=()=>{if(!owned())return;image.remove();delete parent.dataset.venueState;};
  const ready=()=>{
    if(!owned())return;
    if(image.naturalWidth!==768||image.naturalHeight!==512)return fail();
    image.hidden=false;parent.dataset.venueState='ready';
  };
  image.addEventListener('load',ready);image.addEventListener('error',fail);
  image.src=CHAPTER_VENUE_ART[chapter.id];
  if(image.complete&&image.naturalWidth>0)ready();
  return image;
}
