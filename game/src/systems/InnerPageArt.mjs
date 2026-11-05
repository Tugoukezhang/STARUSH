const root='art/inner-poster-family-20261025/';
const ART=Object.freeze({bay:Object.freeze({src:root+'equipment-bay.png',width:611,height:399}),ticket:Object.freeze({src:root+'tour-ticket.png',width:611,height:345})});

export function mountInnerPageArt(view,parent,key){
  if(!Object.hasOwn(ART,key)||!parent||!view?.doc||view.disposed)return null;
  const art=ART[key],image=view.element('img','inner-page-art',undefined,parent);
  image.alt='';image.setAttribute('aria-hidden','true');image.width=art.width;image.height=art.height;image.hidden=true;image.draggable=false;
  const owned=()=>!view.disposed&&image.parentNode===parent&&(!view.root||view.root.contains(parent));
  const fail=()=>{if(!owned())return;image.remove();delete parent.dataset.innerArtState;};
  const ready=async()=>{try{if(image.naturalWidth!==art.width||image.naturalHeight!==art.height)return fail();if(image.decode)await image.decode();if(!owned())return;image.hidden=false;parent.dataset.innerArtState='ready';}catch{fail();}};
  image.addEventListener('load',ready,{once:true});image.addEventListener('error',fail,{once:true});image.src=art.src;
  if(image.complete&&image.naturalWidth>0)ready();return image;
}
