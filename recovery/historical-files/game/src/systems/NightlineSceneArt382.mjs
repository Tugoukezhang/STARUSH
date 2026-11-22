export const NIGHTLINE_SCENE_ART=Object.freeze({key:'nightline-scene-382',path:'art/nightline-scene-b382/props.png',width:1254,height:1254});
export const NIGHTLINE_PROP_FRAMES=Object.freeze({canopy:[19,139,591,416],freight:[655,239,568,313],radio:[195,678,243,500],dispatcher:[637,737,605,438]});
export function hasNightlineSceneArt(scene){
 if(!scene.textures?.exists?.(NIGHTLINE_SCENE_ART.key))return false;
 const texture=scene.textures.get(NIGHTLINE_SCENE_ART.key),source=texture.getSourceImage();
 return source?.width===NIGHTLINE_SCENE_ART.width&&source?.height===NIGHTLINE_SCENE_ART.height&&Object.keys(NIGHTLINE_PROP_FRAMES).every(k=>texture.has(k));
}
export function preloadNightlineSceneArt(scene){
 if(hasNightlineSceneArt(scene))return;
 if(scene.textures.exists(NIGHTLINE_SCENE_ART.key)){scene.textures.remove(NIGHTLINE_SCENE_ART.key);scene.nightlineArtRetry=(scene.nightlineArtRetry||0)+1;}
 const frames=Object.fromEntries(Object.entries(NIGHTLINE_PROP_FRAMES).map(([name,[x,y,w,h]])=>[name,{frame:{x,y,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}}]));
 scene.load.atlas(NIGHTLINE_SCENE_ART.key,NIGHTLINE_SCENE_ART.path+(scene.nightlineArtRetry?'?nightlineRetry='+scene.nightlineArtRetry:''),{frames});
}
export function nightlineWallArt(scene){return scene.bodyMode&&scene.routeId==='canopy'?'canopy':'freight';}
export class NightlineSceneArt{
 constructor(scene){
  this.scene=scene;this.nodes=[];this.stations=[];this.destroyed=false;
  const add=(frame,x,y,width,depth)=>{const rect=NIGHTLINE_PROP_FRAMES[frame],n=scene.add.image(x,y,NIGHTLINE_SCENE_ART.key,frame).setOrigin(.5,1).setDisplaySize(width,width*rect[3]/rect[2]).setDepth(depth);this.nodes.push(n);return n;};
  for(const wall of scene.map.walls)this.nodesWall=add(nightlineWallArt(scene),wall.x+wall.width/2,wall.y+wall.height,wall.width+12,1.4);
  for(const d of scene.map.stations)this.stations.push({id:d.id,node:add('radio',d.x,d.y+10,23,1.5),key:null});
  if(scene.finaleMode){const b=scene.map.boss;this.boss=add('dispatcher',b.x,b.y+27,84,1.5);}
 }
 update(stations,snapshot){
  if(this.destroyed)return;
  for(const row of this.stations){const d=stations.find(d=>d.id===row.id);if(!d)continue;
   const progress=Math.max(0,Math.min(1,d.paint/100)),key=String(d.delivered)+'|'+progress;
   if(key===row.key)continue;row.key=key;
   const channel=Math.round(155+100*progress),tint=d.delivered?(channel<<16|channel<<8|channel):0x71858d;
   row.node.setTint(tint).setAlpha(d.delivered?1:.72);
  }
  if(this.boss){const b=snapshot.boss;this.boss.setTint(b.flashUntil>snapshot.time||b.exposed?0xffffff:0xb4ccd0).setAlpha(snapshot.phase==='complete'?.6:1);}
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;for(const n of this.nodes)n.destroy();this.nodes=[];this.stations=[];this.boss=null;this.scene=null;}
}
