const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function openingStreetFrame(player){
 const vertical=clamp((700-player.y)/180,0,1);
 const horizontal=clamp(Math.min(player.x-260,740-player.x)/90,0,1);
 const weight=vertical*horizontal;
 return {zoom:1-.32*weight,x:(player.x-500+(172-187.5)/.68)*weight,
  y:108+((516-333.5)/.68-108)*weight,weight};
}

export function supportsStreetOverview(config){
 return !config||(config.progressiveRestoration===true&&['neon','encore'].includes(config.chapterId));
}

// Public street chapters share the owner; HUD uses its own unscaled viewport.
export class OpeningStreetCamera{
 constructor(scene){
  this.scene=scene;this.main=scene.cameras.main;this.disposed=false;this.filters=new Map();
  this.hud=scene.cameras.add(0,0,this.main.width,this.main.height,false,'opening-street-hud');
  this.mask=this.main.id|this.hud.id;this.overview=false;
  this.onAdded=node=>this.route(node);this.onRender=()=>this.refreshLayers();
  this.onFollow=()=>{
   if(scene._battlePaused||scene._battleEnded)return;
   scene.paintZone?.updateDeviceLabels?.();scene._updatePublicStage1AttackCues?.();
  };
  scene.events.on('addedtoscene',this.onAdded);scene.events.on('prerender',this.onRender);
  this.main.on('followupdate',this.onFollow);
  this.refreshLayers();
 }
 route(node){
  if(!node||node.active===false)return;
  if(!this.filters.has(node))this.filters.set(node,(node.cameraFilter||0)&this.mask);
  const fixed=node.scrollFactorX===0&&node.scrollFactorY===0;
  const original=this.filters.get(node);
  node.cameraFilter=((node.cameraFilter||0)&~this.mask)|(fixed?this.main.id:(original&this.main.id)|this.hud.id);
 }
 pin(node){this.route(node);return node;}
 refreshLayers(){
  if(this.disposed)return;
  for(const node of this.scene.children.list)this.route(node);
  for(const node of this.filters.keys())if(node.active===false)this.filters.delete(node);
 }
 update(delta){
  if(this.disposed||this.scene._battlePaused||this.scene._battleEnded)return;
  const p=this.scene.player;if(!p||p.active===false||![p.x,p.y].every(Number.isFinite))return;
  const target=this.scene.oldStreet&&supportsStreetOverview(this.scene.oldStreet.config)?openingStreetFrame(p):{zoom:1,x:0,y:108,weight:0};
  const gain=1-Math.exp(-clamp(Number(delta)||16,0,50)/180);
  const ease=(a,b)=>Math.abs(a-b)<.0001?b:a+(b-a)*gain;
  this.main.setZoom(ease(this.main.zoom,target.zoom));
  this.main.setFollowOffset(ease(this.main.followOffset.x,target.x),ease(this.main.followOffset.y,target.y));
  const overview=target.weight>0;
  if(overview!==this.overview){this.main.setDeadzone(overview?undefined:28,overview?undefined:48);this.overview=overview;}
 }
 destroy(){
  if(this.disposed)return;this.disposed=true;
  this.scene.events.off('addedtoscene',this.onAdded);this.scene.events.off('prerender',this.onRender);
  this.main.off('followupdate',this.onFollow);
  for(const [node,original] of this.filters)node.cameraFilter=((node.cameraFilter||0)&~this.mask)|original;
  this.filters.clear();this.scene.cameras.remove(this.hud);
  this.main.setZoom(1).setFollowOffset(0,108).setDeadzone(28,48);
 }
}
