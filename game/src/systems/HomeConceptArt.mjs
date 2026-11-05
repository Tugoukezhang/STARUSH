// Decorative component crops of the selected home concept raster (941x1672), never the whole poster.
// Native labels and icons stay in the DOM; the parent is marked ready only after the crop loads.
export const HOME_CONCEPT_ART_PATH='art/home-selected-reference-20261023/concept.png';
export const HOME_CONCEPT_RENDER_PATH='art/home-transparent-components-20261024/components.png';
export const HOME_SURFACE_ART_PATH='art/home-surface-clean-20261025/components.png';
export const HOME_IDENTITY_ART_PATH='art/home-identity-family-20261024/plates.png';
export const HOME_IDENTITY_RECTS=Object.freeze({'name-kai':Object.freeze([0,0,1024,600]),'name-enjo':Object.freeze([0,600,1024,600])});
const WIDTH=941,HEIGHT=1672;
export const HOME_CONCEPT_RECTS=Object.freeze(Object.fromEntries(Object.entries({
  logo:[0,0,435,151],backstage:[40,153,246,45],
  'nav-desk':[32,1542,136,110],'nav-roster':[224,1542,136,110],'nav-tour':[409,1542,136,110],
  'nav-inventory':[598,1542,136,110],'nav-records':[787,1542,136,110],
  'name-sakura':[0,990,410,240],start:[30,1408,650,115],resume:[684,1410,245,100],
  ticket:[652,85,67,66],settings:[838,76,76,74],
  preflight:[0,235,214,185],prepare:[0,420,214,160],'story-journal':[0,590,214,174],
}).map(([key,rect])=>[key,Object.freeze(rect)])));
const CHAPTER_RECTS=Object.freeze({'chapter-opening':[0,0,640,128],'chapter-neon':[0,128,640,128],'chapter-encore':[0,256,640,128]});
const CLEAN=Object.freeze({start:Object.freeze({src:'art/venue-shell-20261026/start.png',width:1536,height:384}),
 'chapter-raincheck':Object.freeze({src:'art/rooftop-20261103/title.webp',width:768,height:256}),
 'chapter-homecoming':Object.freeze({src:'art/homecoming-300/title.webp',width:768,height:256}),
 'roster-name-sakura':Object.freeze({src:'art/roster-lettering-20261028/sakura.png',width:1411,height:385}),
 'roster-name-kai':Object.freeze({src:'art/roster-lettering-20261028/kai.png',width:1431,height:357}),
 'roster-name-enjo':Object.freeze({src:'art/roster-lettering-20261028/enjo.png',width:1221,height:338})});
const percent=value=>`${Number(value.toFixed(4))}%`;
let cropSequence=0;

export function mountHomeConceptArt(view,parent,key){
  const identity=Object.hasOwn(HOME_IDENTITY_RECTS,key);
  const clean=Object.hasOwn(CLEAN,key)?CLEAN[key]:null;
  const rect=clean?[0,0,clean.width,clean.height]:identity?HOME_IDENTITY_RECTS[key]:Object.hasOwn(HOME_CONCEPT_RECTS,key)?HOME_CONCEPT_RECTS[key]:Object.hasOwn(CHAPTER_RECTS,key)?CHAPTER_RECTS[key]:null;
  if(!rect||!parent||!view?.doc||view.disposed)return null;
  const [x,y,w,h]=rect;
  const chapter=Object.hasOwn(CHAPTER_RECTS,key),width=clean?.width||(identity?1024:chapter?640:WIDTH),height=clean?.height||(identity?1200:chapter?384:HEIGHT);
  const frame=view.doc.createElement('span');frame.className='home-concept-art';
  frame.dataset.conceptArt=key;frame.setAttribute('aria-hidden','true');
  const image=view.doc.createElement('img');
  image.alt='';image.setAttribute('aria-hidden','true');image.width=width;image.height=height;image.draggable=false;
  Object.assign(image.style,{left:percent(-x/w*100),top:percent(-y/h*100),width:percent(width/w*100),height:percent(height/h*100)});
  frame.append(image);parent.append(frame);
  // Only original raster pixels are shown; the viewport preserves one uniform crop scale.
  const element=tag=>view.doc.createElementNS?.('http://www.w3.org/2000/svg',tag)||view.doc.createElement(tag);
  const viewport=element('svg'),picture=element('image');
  const polished=['ticket','settings','name-sakura','start'].includes(key);
  const src=clean?.src||(identity?HOME_IDENTITY_ART_PATH:chapter?'art/home-selected-reference-20261023/chapters.png':polished?HOME_SURFACE_ART_PATH:HOME_CONCEPT_RENDER_PATH);
  viewport.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);viewport.setAttribute('preserveAspectRatio','xMidYMid meet');
  viewport.setAttribute('aria-hidden','true');viewport.setAttribute('focusable','false');
  Object.assign(viewport.style,{width:'100%',height:'100%'});
  picture.setAttribute('href',src);picture.setAttribute('width',String(width));picture.setAttribute('height',String(height));
  const defs=element('defs'),clip=element('clipPath'),crop=element('rect'),clipId=`home-component-${++cropSequence}`;
  clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');
  for(const [key,value]of Object.entries({x,y,width:w,height:h}))crop.setAttribute(key,String(value));
  clip.append(crop);defs.append(clip);viewport.append(defs);picture.setAttribute('clip-path',`url(#${clipId})`);
  viewport.append(picture);frame.append(viewport);frame.dataset.fit='contain';image.hidden=true;
  // Connection is not required (initial render may load first); a destroyed view or a moved/replaced frame is inert.
  const owned=()=>!view.disposed&&image.parentNode===frame&&frame.parentNode===parent;
  const fail=()=>{
    if(!owned())return;
    frame.remove();delete parent.dataset.conceptState;
  };
  const ready=()=>{
    if(!owned())return;
    if(image.naturalWidth>0&&(image.naturalWidth!==width||image.naturalHeight!==height))return fail();
    parent.dataset.conceptState='ready';
  };
  image.addEventListener('load',ready);image.addEventListener('error',fail);
  image.src=src;
  if(image.complete&&image.naturalWidth>0)ready();
  return frame;
}
