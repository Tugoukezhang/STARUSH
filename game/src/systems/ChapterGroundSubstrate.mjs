import {getChapterGroundColorArt} from './ChapterGroundArt.mjs';
import {getBattleChapter} from '../utils/publicCampaign.mjs';

export function preloadChapterGroundColor(scene,id){
  const path=getChapterGroundColorArt(id);if(!path)return;
  const key=`chapter-ground-color-${id}`,event='filecomplete-image-'+key;
  const valid=()=>{const image=scene.textures.get(key).getSourceImage();return image.width===1000&&image.height===1778;};
  const retries=scene._chapterGroundRetries??=Object.create(null);
  const reject=()=>{scene.textures.remove(key);retries[id]=(retries[id]||0)+1;};
  if(scene.textures?.exists?.(key)&&!valid())reject();
  const verify=()=>{if(!valid()){reject();scene.load.emit('loaderror',{key,type:'image',reason:'Invalid chapter ground dimensions'});}};
  scene.load.once?.(event,verify);
  scene.events?.once('shutdown',()=>scene.load.off(event,verify));
  // A decoded bad image can remain coalesced in the browser after texture removal.
  scene.load.image(key,retries[id]?`${path}?groundRetry=${retries[id]}`:path);
}

export function loadChapterGroundSubstrate(scene,width=1000,height=1778){
  const data=scene.battleData??{};
  if(scene._userCastPresentation!==true||data.practiceMode===true||data.defenseMode===true||Number(data.stageId||1)!==1)return null;
  const key=`chapter-ground-color-${getBattleChapter(data).id}`;
  if(!scene.textures.exists(key))throw new Error('Required chapter ground color is missing');
  const image=scene.textures.get(key).getSourceImage();
  if(image.width!==1000||image.height!==1778)throw new Error('Invalid chapter ground dimensions');
  const canvas=(image.ownerDocument??globalThis.document).createElement('canvas');
  canvas.width=Math.ceil(width/2);canvas.height=Math.ceil(height/2);
  try{
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    const sample=context.getImageData(0,0,canvas.width,canvas.height);
    return {width:canvas.width,height:canvas.height,data:sample.data};
  }finally{canvas.width=canvas.height=0;}
}
