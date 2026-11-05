const bytes=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const u32Bytes=array=>{const out=new Uint8Array(array.length*4),view=new DataView(out.buffer);for(let i=0;i<array.length;i++)view.setUint32(i*4,array[i],true);return out;};
const putU32=(target,data)=>{const view=new DataView(data.buffer,data.byteOffset,data.byteLength);for(let i=0;i<target.length;i++)target[i]=view.getUint32(i*4,true);};
export function capturePublicBattleWorld(scene){
  scene.paintZone?.paintWork?.drain();
  const surface=scene.paintZone?.streetSurface,r=surface?.raster,layers=[];
  const add=(id,width,height,data)=>layers.push({id,width,height,bytes:data});
  if(r?.pixels){
    add('ground:pixels',r.pixelWidth,r.pixelHeight,bytes(r.pixels));
    if(r.paintColors)add('ground:owners',r.pixelWidth,r.pixelHeight,u32Bytes(r.paintColors));
    if(surface.material){add('material:tones',r.pixelWidth,r.pixelHeight,bytes(surface.material.tones));add('material:owners',r.pixelWidth,r.pixelHeight,u32Bytes(surface.material.colors));}
  }
  for(const [id,item] of scene.oldStreet?.items||[]){const p=item.attackSurface?.raster;if(p?.coverage)add('prop:'+id,p.width,p.height,bytes(p.coverage));}
  return layers.length?layers:null;
}
export function applyPublicBattleWorld(scene,layers){
  if(!Array.isArray(layers)||!layers.length)return false;
  const surface=scene.paintZone?.streetSurface,r=surface?.raster,expected=capturePublicBattleWorld(scene);
  if(!expected||expected.length!==layers.length)return false;
  const saved=new Map(layers.map(l=>[l.id,l]));if(saved.size!==layers.length)return false;
  // Validate the complete owner/schema before changing any live buffer.
  for(const e of expected){const l=saved.get(e.id);if(!l||l.width!==e.width||l.height!==e.height||l.bytes?.byteLength!==e.bytes.byteLength)return false;}
  if(r?.pixels){
    r.pixels.set(saved.get('ground:pixels').bytes);
    if(r.paintColors)putU32(r.paintColors,saved.get('ground:owners').bytes);
    if(surface.material){surface.material.tones.set(saved.get('material:tones').bytes);putU32(surface.material.colors,saved.get('material:owners').bytes);}
    surface.materialDirty?.clear();r.dirty={x:0,y:0,right:r.pixelWidth-1,bottom:r.pixelHeight-1};surface.dirty=true;surface.flush();
  }
  for(const [id,item] of scene.oldStreet?.items||[]){const p=item.attackSurface?.raster;if(p){
    p.restoreCoverage(saved.get('prop:'+id).bytes);item.attackSurface.dirty=true;
    if(p.coverage.some(v=>v>0)){item.image?.setVisible(false);item.colorImage?.setVisible(true);}
  }}
  return true;
}
