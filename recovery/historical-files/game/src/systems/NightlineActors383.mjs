export const NIGHTLINE_ENEMY_ART=Object.freeze({key:'nightline-enemies-383',path:'art/nightline-enemies-b383/atlas.png',width:1254,height:1254});
export const NIGHTLINE_ENEMY_FRAMES=Object.freeze({chaser:[65,567,484,452],sentry:[679,144,499,929]});
export function hasNightlineEnemyArt(scene){
 if(!scene.textures.exists(NIGHTLINE_ENEMY_ART.key))return false;
 const texture=scene.textures.get(NIGHTLINE_ENEMY_ART.key),image=texture.getSourceImage();
 return image?.width===1254&&image?.height===1254&&Object.keys(NIGHTLINE_ENEMY_FRAMES).every(k=>texture.has(k));
}
export function preloadNightlineEnemyArt(scene){
 if(hasNightlineEnemyArt(scene))return;
 if(scene.textures.exists(NIGHTLINE_ENEMY_ART.key))scene.textures.remove(NIGHTLINE_ENEMY_ART.key);
 const frames=Object.fromEntries(Object.entries(NIGHTLINE_ENEMY_FRAMES).map(([key,[x,y,w,h]])=>[key,{frame:{x,y,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}}]));
 scene.enemyArtAttempt=(scene.enemyArtAttempt||0)+1;
 scene.load.atlas(NIGHTLINE_ENEMY_ART.key,NIGHTLINE_ENEMY_ART.path+'?attempt='+scene.enemyArtAttempt,{frames});
}
export class NightlineEnemyArt{
 constructor(scene){this.scene=scene;this.available=hasNightlineEnemyArt(scene);this.rows=new Map();this.destroyed=false;}
 update(enemies,time){
  if(this.destroyed||!this.available)return;
  const live=new Set();
  for(const e of enemies){
   if(e.hp<=0||!Object.hasOwn(NIGHTLINE_ENEMY_FRAMES,e.kind))continue;live.add(e.id);
   let row=this.rows.get(e.id);
   if(!row){
    const frame=NIGHTLINE_ENEMY_FRAMES[e.kind],width=e.kind==='sentry'?24:32;
    row={kind:e.kind,node:this.scene.add.image(e.x,e.y+12,NIGHTLINE_ENEMY_ART.key,e.kind).setOrigin(.5,1).setDisplaySize(width,width*frame[3]/frame[2]).setDepth(2.4),shadow:this.scene.add.ellipse(e.x,e.y+12,29,10,0x081923,.65).setDepth(2.2)};
    this.rows.set(e.id,row);
   }
   row.node.setPosition(e.x,e.y+12);row.shadow.setPosition(e.x,e.y+12);
   const flash=e.flashUntil>time;
   if(flash!==row.flash){if(flash)row.node.setTintFill(0xffffff);else row.node.clearTint();row.flash=flash;}
  }
  for(const [id,row]of this.rows)if(!live.has(id)){row.node.destroy();row.shadow.destroy();this.rows.delete(id);}
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;for(const row of this.rows.values()){row.node.destroy();row.shadow.destroy();}this.rows.clear();this.scene=null;}
}

export function nightlineFacilityState(station,index,snapshot){
 const current=index===snapshot.current,finale=!!snapshot.finale;
 let state='waiting';
 if(snapshot.phase==='complete'||!finale&&index<snapshot.current)state='done';
 else if(current&&station.delivered){
  if(snapshot.enemies?.some(e=>e.hp>0))state='blocked';
  else if(snapshot.carrying||snapshot.boss?.exposed)state='sending';
  else state=station.paint>=100?'ready':'charging';
 }
 return {role:finale?'breaker':'relay',state,color:state==='ready'?0xffd279:state==='blocked'?0xe59ac2:state==='waiting'?0x617980:state==='done'?0x87b1a4:0x89e1d1};
}
export function drawNightlineFacilityBadge(g,station,index,snapshot){
 const {role,state,color}=nightlineFacilityState(station,index,snapshot),x=station.x+16,y=station.y+8;
 g.fillStyle(0x10232c,.95).fillRoundedRect(x-7,y-7,14,14,3);g.lineStyle(1,color,.95);
 if(role==='breaker'){
  g.strokePoints([{x,y:y-6},{x:x+6,y:y-2},{x:x+4,y:y+5},{x,y:y+7},{x:x-4,y:y+5},{x:x-6,y:y-2}],true);
  g.lineBetween(x+1,y-3,x-2,y+1).lineBetween(x-2,y+1,x+2,y+1).lineBetween(x+2,y+1,x-1,y+4);
 }else{
  g.strokeRoundedRect(x-7,y-6,14,12,3);g.lineBetween(x-4,y,x+4,y).lineBetween(x+1,y-3,x+4,y).lineBetween(x+4,y,x+1,y+3);
 }
 if(state==='blocked'||state==='waiting')g.lineStyle(2,0x789197,1).lineBetween(x-6,y+6,x+6,y-6);
 if(state==='ready')g.lineStyle(2,color,1).strokeCircle(station.x,station.y,26);
 return state;
}
