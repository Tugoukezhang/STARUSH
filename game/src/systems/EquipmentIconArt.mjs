const IDS=['wide_nozzle','rhythm_sync','focus_lens','travelling_nozzle','return_edge','delayed_hammer'];
const ART=Object.freeze({...Object.fromEntries(IDS.map(id=>[id,Object.freeze({src:`art/equipment-identity-20261025/${id}.png`,width:256,height:256})])),
  rain_relay:Object.freeze({src:'art/rain-relay-295/rain_relay.webp',width:256,height:256})});
export const getEquipmentIconArt=id=>Object.hasOwn(ART,id)?ART[id]:null;

export function mountEquipmentIcon(view,parent,id,fallback){
  const art=getEquipmentIconArt(id);
  if(!art||!parent||!view?.doc||view.disposed)return null;
  const image=view.element('img','menu-art equipment-art',undefined,parent);
  image.alt='';image.setAttribute('aria-hidden','true');image.width=art.width;image.height=art.height;
  image.hidden=true;image.draggable=false;
  const owned=()=>!view.disposed&&image.parentNode===parent&&(!view.root||view.root.contains(parent));
  const fail=()=>{if(!owned())return;image.remove();delete parent.dataset.equipmentArtState;if(fallback)fallback.hidden=false;};
  const ready=async()=>{
    try{
      if(image.naturalWidth!==art.width||image.naturalHeight!==art.height)return fail();
      if(image.decode)await image.decode();
      if(!owned())return;
      image.hidden=false;parent.dataset.equipmentArtState='ready';if(fallback)fallback.hidden=true;
    }catch{fail();}
  };
  image.addEventListener('load',ready,{once:true});image.addEventListener('error',fail,{once:true});
  image.src=art.src;if(image.complete&&image.naturalWidth>0)ready();
  return image;
}
