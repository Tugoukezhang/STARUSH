export const GRAFFITI_GROUND=Object.freeze({key:'graffiti-ground',path:'art/comic-ground-ribbons-20261022/ground-v2.png'});
export const COMPACT_POOL_GROUND=Object.freeze({key:'compact-pool-ground',path:'art/infield/ground-footprints.webp'});
export const COMIC_POOL_MATERIAL=Object.freeze({key:'comic-pool-material',path:'art/comic-paint-directional-20261023/planes.png'});
export const SHARED_COMIC_MATERIAL=Object.freeze({key:'three-cast-comic-material',path:'art/comic-ink-planes-20261029/body.png',size:1254});

export function preloadGraffitiGround(scene){
  const {key,path}=GRAFFITI_GROUND,event='filecomplete-image-'+key;
  const valid=()=>{const source=scene.textures.get(key).getSourceImage();return source.width===1024&&source.height===256;};
  if(scene.textures?.exists(key)&&!valid())scene.textures.remove(key);
  const verify=()=>{if(!valid()){scene.textures.remove(key);scene.load.emit('loaderror',{key,type:'image',reason:'Invalid graffiti atlas dimensions'});}};
  scene.load.once?.(event,verify);
  scene.events?.once('shutdown',()=>scene.load.off(event,verify));
  scene.load.image(key,path);
  const performer=(scene.initialBattleData??scene.battleData)?.performerId||'sakura';
  if(['sakura','kai','enjo'].includes(performer)){preloadCompactPool(scene);preloadCompactPool(scene,SHARED_COMIC_MATERIAL);}
}

function preloadCompactPool(scene,art=COMPACT_POOL_GROUND){
  const {key,path}=art,event='filecomplete-image-'+key,retry=art===COMPACT_POOL_GROUND?'_compactPoolRetries':'_comicPoolMaterialRetries';
  const size=art.size??512;
  const valid=()=>{const source=scene.textures.get(key).getSourceImage();return source.width===size&&source.height===size;};
  const reject=()=>{scene.textures.remove(key);scene[retry]=(scene[retry]||0)+1;};
  if(scene.textures?.exists(key)&&!valid())reject();
  const verify=()=>{if(!valid()){reject();scene.load.emit('loaderror',{key,type:'image',reason:'Invalid compact pool dimensions'});}};
  scene.load.once?.(event,verify);
  scene.events?.once('shutdown',()=>scene.load.off(event,verify));
  // A decoded bad image can remain coalesced in the browser after texture removal.
  scene.load.image(key,scene[retry]?`${path}?poolRetry=${scene[retry]}`:path);
}

export function createGraffitiBrush({data,width,height},performer='sakura',mergeOpaque=false){
  if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width!==height*4||data.length!==width*height*4)return null;
  const frame={sakura:0,kai:1,enjo:3}[performer]??2;
  return {mergeOpaque:mergeOpaque===true&&performer==='sakura',sample(u,v,ink=false){
    if(!Number.isFinite(u+v)||u<0||v<0||u>=1||v>=1)return 0;
    const i=(Math.floor(v*height)*width+frame*height+Math.floor(u*height))*4;
    const value=Math.max(data[i],data[i+1],data[i+2]);
    return ink==='tone'?value/255:ink?Math.max(0,1-value/128):data[i+3]/255;
  },tone(u,v){return this.sample(u,v,'tone');}};
}

// Four registered silhouettes share the same tint and merge into continuous ground paint.
export function createCompactPoolBrush(image,grid=1){
  const {data,width,height}=image??{};
  let footprint=false;
  if(data&&Number.isInteger(width)&&width>0&&width===height&&data.length===width*height*4)
    for(let i=3;i<data.length&&!footprint;i+=4)footprint=data[i]>0;
  if(!footprint)throw new Error('Invalid compact pool image');
  const cell=width/grid;
  return {mergeOpaque:true,preserveSubstrate:true,
    variantAt(x,y){return grid===1?0:(Math.floor(x/19)*3+Math.floor(y/23))&3;},
    sample(u,v,ink=false,variant=0){
      if(!Number.isFinite(u+v)||u<0||v<0||u>=1||v>=1)return 0;
      const x=(variant%grid)*cell+Math.floor(u*cell),y=Math.floor(variant/grid)*cell+Math.floor(v*cell);
      const i=(y*width+x)*4,value=Math.max(data[i],data[i+1],data[i+2]);
      return ink==='tone'?value/255:ink?Math.max(0,1-value/128):data[i+3]/255;
    },tone(u,v,variant){return this.sample(u,v,'tone',variant);}};
}

function readGround(scene,key,width,height,missing,invalid){
  if(!scene.textures.exists(key))throw new Error(missing);
  const source=scene.textures.get(key).getSourceImage();
  if(source.width!==width||source.height!==height)throw new Error(invalid);
  const canvas=(source.ownerDocument??globalThis.document).createElement('canvas');canvas.width=width;canvas.height=height;
  try{const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);return ctx.getImageData(0,0,width,height);}
  finally{canvas.width=canvas.height=0;}
}

export function loadGraffitiBrush(scene){
  if(scene._userCastPresentation!==true)return null;
  const performer=scene.publicPerformerRun?.member?.id??scene.battleData?.performerId??'sakura';
  if(['sakura','kai','enjo'].includes(performer))return createCompactPoolBrush(readGround(scene,COMPACT_POOL_GROUND.key,512,512,'Required compact pool ground is missing','Invalid compact pool ground dimensions'),2);
  return createGraffitiBrush(readGround(scene,GRAFFITI_GROUND.key,1024,256,'Required graffiti ground atlas is missing','Invalid graffiti ground atlas dimensions'),performer,false);
}

export function loadGraffitiMaterial(scene){
  const performer=scene.publicPerformerRun?.member?.id??scene.battleData?.performerId??'sakura';
  if(scene._userCastPresentation!==true||!['sakura','kai','enjo'].includes(performer))return null;
  const {key,size}=SHARED_COMIC_MATERIAL;
  const image=readGround(scene,key,size,size,'Required comic pool material is missing','Invalid comic pool material dimensions');
  // Keep source RGB: the explicit finish mode separates sparse ink accents from tintable gray body.
  image.authoredInk=true;
  image.worldAnchored=true;
  image.inwardContour=true;
  image.printFloor=true;
  image.screenPrint=true;
  image.groundRelief=true;
  image.groundMarkings=true;
  image.poolBody=true;
  image.paintBodyTexture=true;
  image.unmirroredBody=true;
  image.flatPigment=true;
  image.wetMargin=true;
  const data=scene.battleData;
  image.rooftopFinish=data?.campaignChapterId==='raincheck'&&data.practiceMode!==true
    &&data.defenseMode!==true&&Number(data.stageId||1)===1;
  if(performer==='enjo'){
    const key='user-heavy-landing-20261029';
    const source=scene.textures.exists(key)&&scene.textures.get(key).getSourceImage();
    if(source?.width===1024&&source?.height===512){
      const canvas=(source.ownerDocument??globalThis.document).createElement('canvas');canvas.width=canvas.height=256;
      try{
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(source,256,256,256,256,0,0,256,256);
        const local=ctx.getImageData(0,0,256,256);
        if(local.data.some((v,i)=>i%4===3&&v>0))image.impactImage=local;
      }finally{canvas.width=canvas.height=0;}
    }
  }
  return image;
}
