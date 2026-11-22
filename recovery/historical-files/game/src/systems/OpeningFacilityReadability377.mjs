import {streetVisibleBounds} from './WorldGroundingPresentation.mjs';
export const isOpeningFacility=device=>device?.required===true&&device.id?.startsWith('oldstreet-')&&['lamp','speaker','power'].includes(device.sceneArt);
export function openingLabelOccluders(scene){
 const street=scene.oldStreet;if(!street||street.config)return [];
 const rows=[];
 for(const item of street.items.values()){
  const image=item.colorImage?.visible?item.colorImage:item.image;
  if(!image||image.active===false||image.visible===false)continue;
  const p=item.definition,outer=image.getBounds?.()||{x:p.x-p.width/2,y:p.y-p.height,width:p.width,height:p.height};
  const b=streetVisibleBounds(p.art,outer);
  if([b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0)rows.push(b);
 }
 const actor=scene.actorPresentation?.userCastView?.cueExclusionBounds?.();
 if(actor&&[actor.x,actor.y,actor.right,actor.bottom].every(Number.isFinite)&&actor.right>actor.x&&actor.bottom>actor.y)
  rows.push({x:actor.x,y:actor.y,width:actor.right-actor.x,height:actor.bottom-actor.y});
 return rows;
}
export function drawOpeningFacilitySocket(gfx,device,view){
 if(!isOpeningFacility(device))return false;
 const {x,y}=device,cy=y+31,locked=view.state==='locked',muted=locked||view.state==='suppressed';
 const alpha=locked?.24:muted?.46:.9;
 gfx.fillStyle(0xe7eee9,alpha*.8).lineStyle(2,0x26383c,alpha);
 if(device.sceneArt==='lamp')gfx.fillEllipse(x,cy,52,16).strokeEllipse(x,cy,52,16);
 else{
  const points=device.sceneArt==='power'?[{x,y:cy-9},{x:x+27,y:cy},{x,y:cy+9},{x:x-27,y:cy}]
   :[{x:x-20,y:cy-8},{x:x+20,y:cy-8},{x:x+27,y:cy+8},{x:x-27,y:cy+8}];
  gfx.fillPoints(points,true).strokePoints(points,true);
 }
 // Pigment only follows the accepted owner state; shape remains useful without color.
 if(!locked){gfx.lineStyle(3,view.accent,muted?.45:.95).lineBetween(x-13,cy,x+13,cy);}
 return true;
}
export class OpeningLabelLeaders{
 constructor(scene){this.scene=scene;this.graphics=null;this.key=null;}
 update(layout,devices){
  const s=this.scene,z=Number(s.cameras?.main?.zoom)||1,lines=[];
  for(const row of layout){
   const d=devices.find(d=>d.id===row.id);if(!isOpeningFacility(d))continue;
   const dx=row.x-d.x,dy=row.y-d.y,horizontal=Math.abs(dx)>Math.abs(dy);
   const from={x:d.x+(horizontal?Math.sign(dx)*24:0),y:d.y+(horizontal?0:dy>0?32:-35)};
   const to={x:row.x-(horizontal?Math.sign(dx)*(row.rect.right-row.rect.left)/(2*z):0),y:row.y-(horizontal?0:Math.sign(dy)*12/z)};
   if(Math.hypot(to.x-from.x,to.y-from.y)<4||s.oldStreet?.clearLine(from,to,1)===false)continue;
   lines.push([from.x,from.y,to.x,to.y]);
  }
  const key=JSON.stringify(lines);if(key===this.key)return;this.key=key;
  this.graphics?.clear();if(!lines.length)return;
  const g=this.graphics??=s.add.graphics().setDepth(2.3);
  for(const line of lines)g.lineStyle(1.5/z,0x26383c,.7).lineBetween(...line);
 }
 clear(){this.graphics?.clear();this.key=null;}
 destroy(){this.graphics?.destroy();this.graphics=null;this.key=null;this.scene=null;}
}
