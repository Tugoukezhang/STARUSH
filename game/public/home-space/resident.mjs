// Companion scene assets are served by the static room as well as the main game.
const CAST = Object.freeze({
  sakura: {name:'战术女武神', folder:'red-valkyrie', look:'护目镜、橙红高马尾和白色战术夹克', greeting:'护目镜擦好了。来，击个掌！'},
  kai: {name:'翡翠风歌', folder:'green-windsong', look:'薄荷绿长发、白花和月牙风铃', greeting:'听，风铃响了。欢迎回来。'},
  enjo: {name:'蔚蓝魔法师', folder:'blue-academy', look:'粉发白帽、蓝白制服和魔法书', greeting:'我刚好翻到喜欢的那一页，来一起看！'},
});
const ART = '../art/';
const query = new URLSearchParams(location.search).get('member');

function savedField(key, field){
  try {
    return JSON.parse(localStorage.getItem(key))?.[field];
  } catch {
    return null;
  }
}

const id = [query, savedField('starush.backstage.v1','selectedCompanionId'),
  savedField('starush.public-profile','selectedId'), 'sakura'].find(value => Object.hasOwn(CAST, value));
export const resident = {...CAST[id], id};
const design = ART + resident.folder + '-20261123/';
export const poster = ART + 'cast-encounters-20261125/' + id + '-victory.webp';

const heading = document.querySelector('header .heading small');
heading.textContent = resident.name;
document.querySelector('#home').dataset.member = id;
document.querySelector('#scene').setAttribute('aria-label', resident.name+'的星光居所');
const open = document.querySelector('#portrait-open');
open.title = open.ariaLabel = resident.name+'立绘';
open.querySelector('img').src = design+'avatar.png';
document.querySelector('#portrait-title').textContent = resident.name;
document.querySelector('.portrait-name').textContent = resident.look;
const portrait = document.querySelector('.portrait-stage img');
portrait.src = design+'portrait.png';
portrait.alt = resident.name+'全身立绘，'+resident.look;

async function loadSheet(url){
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

function frameCanvas(image, frame, columns, mirror, shiftY = 0, squash = 1){
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d',{willReadFrequently:true});
  ctx.translate(size/2,244+shiftY);
  ctx.scale(mirror ? -1 : 1,squash);
  ctx.drawImage(image, (frame%columns)*size, Math.floor(frame/columns)*size, size, size, -size/2, -244, size, size);
  const pixels = ctx.getImageData(0,0,size,size).data;
  const alpha = new Uint8Array(size*size);
  for(let i=0;i<alpha.length;i++) alpha[i] = pixels[i*4+3];
  return {canvas, alphaMask:{width:size,height:size,data:alpha}};
}

// The 3D room consumes billboards with CPU alpha hit masks for tap-to-greet.
export async function loadResidenceFrames(makeTexture){
  const [poses, walk, vertical] = await Promise.all([
    loadSheet(ART+'cast-encounters-20261125/'+id+'-room.webp'),
    loadSheet(design+'motion.png'),
    loadSheet(ART+'performance-poses/'+id+'.webp'),
  ]);
  const make = (image,frame,columns,mirror=false,shiftY=0,squash=1) => {
    const {canvas,alphaMask} = frameCanvas(image,frame,columns,mirror,shiftY,squash);
    return {texture:makeTexture(canvas),alphaMask};
  };
  // Front, right, back, left match the room controller's angle sectors.
  const steps = [6,7,9,11];
  const walking = [
    ...[4,5,6,7].map(i => make(vertical,i,4)),
    ...steps.map(i => make(walk,i,6)),
    ...[0,1,2,3].map(i => make(vertical,i,4)),
    ...steps.map(i => make(walk,i,6,true)),
  ];
  const greeting = [[0,1],[0,.984],[0,.966],[1,.985],[1,1],[1,1.016],[1,.978],[0,.989],[0,1]];
  const resting = [[0,1],[0,.967],[0,.922],[0,.86],[2,1.04],[2,1.015],[2,1],[2,.988],[2,1]];
  const clip = keys => keys.map(([frame,scale]) => make(poses,frame,3,false,0,scale));
  return {manifest:{character:resident.name,anchor:[.5,12/256],directions:['front','right','back','left']},
    frames:{walk:walking,greet:clip(greeting),rest:clip(resting)}};
}
