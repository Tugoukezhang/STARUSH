// Opaque-base registrations measured from our reviewed 256px equipment exports.
const ENEMY_BASES=Object.freeze({runner:210.5,emitter:211.5,jammer:205.5,captain:210.5,conductor:204.5,relay:211.5});
const STREET_BOUNDS=Object.freeze({
 shop:[560,520,2,143,558,518],repair:[480,402,19,117,461,400],
 garden:[340,328,2,121,338,326],kiosk:[344,368,21,56,323,366],canopy:[704,332,23,33,681,330],tree:[180,240,11,2,168,238],
});
const CHAPTER_BOUNDS=Object.freeze({
 neon:Object.freeze({shop:[600,648,9,3,591,646],cafe:[500,484,2,140,498,482],
  pavilion:[660,460,2,99,658,458],tree:[180,240,6,2,174,238]}),
 encore:Object.freeze({shed:[460,450,2,40,458,448],control:[390,430,2,85,388,428],
  mixer:[270,320,2,53,268,318],stage:[700,450,2,56,698,448]}),
});
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function enemyGroundPose(art,host,rotation=0){
 const name=art.key.replace('stage-actor-',''),base=ENEMY_BASES[name];
 const contactDistance=base===undefined?art.radius:(base-128)*art.size/256;
 const ground={x:host.x+art.offset,y:host.y+art.offset+contactDistance};
 return {x:ground.x+contactDistance*Math.sin(rotation),y:ground.y-contactDistance*Math.cos(rotation),ground,contactDistance};
}

export function streetVisibleBounds(art,bounds,chapterId){
 if(chapterId==='homecoming')chapterId='encore';
 const b=(chapterId?CHAPTER_BOUNDS[chapterId]:STREET_BOUNDS)?.[art];if(!b)return bounds;
 const [w,h,left,top,right,bottom]=b;
 return {x:bounds.x+left/w*bounds.width,y:bounds.y+top/h*bounds.height,
  width:(right-left)/w*bounds.width,height:(bottom-top)/h*bounds.height};
}

export function projectStreetSurfaceContact(prop,source,point,radius,chapterId){
 const r=prop?.footprint;
 if(!r||![prop.width,prop.height,r.x,r.y,r.width,r.height,source?.width,source?.height,point?.x,point?.y,radius].every(Number.isFinite)
   ||Math.min(prop.width,prop.height,r.width,r.height,source.width,source.height,radius)<=0)return null;
 const x=clamp(point.x,r.x,r.x+r.width),y=clamp(point.y,r.y,r.y+r.height);
 const distance=Math.hypot(point.x-x,point.y-y);
 if(distance>=radius)return null;
 const reach=Math.sqrt(radius*radius-distance*distance);
 const visible=streetVisibleBounds(prop.art,{x:0,y:0,width:source.width,height:source.height},chapterId);
 // Footprint position selects the face; a contact never reveals an entire source column.
 return {x:visible.x+(x-r.x)/r.width*visible.width,y:visible.y+(y-r.y)/r.height*visible.height,
  rx:reach/r.width*visible.width,ry:reach/prop.height*source.height};
}

export function performerGroundFeet(actor){
 const heavy=actor.userCastView?.heavyRig?.feetWorld();if(heavy)return heavy;
 const trial=actor.qRebaseView?.feetWorld();if(trial)return trial;
 const contacts=actor.sakuraView?.frame?.contacts;
 if(contacts)return Object.values(contacts).filter(f=>f.state==='stance'&&finite(f.actual)).map(f=>({...f.actual}));
 const view=actor.venusView||actor.genyaView||actor.kaiView||actor.enjoView;
 return (view?.pose?.feet??[]).filter(f=>f.contact===true&&finite(f)&&!(f.lift>0)).map(f=>({x:f.x,y:f.y}));
}

export class WorldGroundContacts{
 constructor(scene){
  this.scene=scene;this.disposed=false;this.graphics=scene.add.graphics().setDepth(9.19999);
 }
 update({player,feet=[],enemies=[],alpha=1}){
  if(this.disposed)return;
  if(this.scene._battleEnded){this.graphics.clear();return;}
  if(this.scene._battlePaused||this.scene._publicBattleDialog)return;
  const g=this.graphics;g.clear();
  const ellipse=(x,y,w,h,a)=>{if(!(a>0)||!Number.isFinite(x+y+w+h+a))return;g.fillStyle(0x35413F,a);g.fillEllipse(x,y,w,h);};
  if(player?.active!==false&&finite(player)&&player.hp>0){
   const a=clamp(Number(alpha)||0,0,1);
   ellipse(player.x,player.y+26,18,5.8,.18*a);
   for(const foot of feet)if(finite(foot))ellipse(foot.x,foot.y,4.8,1.6,.2*a);
  }
  for(const item of enemies){
   const n=item.image,p=item.ground;
   if(!n?.active||n.visible===false||!finite(p))continue;
   const a=clamp(Number(n.alpha)||0,0,1),width=item.art.size*.64;
   ellipse(p.x,p.y,width,width*.21,.12*a);
   ellipse(p.x,p.y,width*.66,Math.max(1,width*.075),.08*a);
  }
 }
 destroy(){if(this.disposed)return;this.disposed=true;this.graphics.destroy();this.graphics=null;this.scene=null;}
}
