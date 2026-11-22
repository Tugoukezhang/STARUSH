import {streetVisibleBounds} from './WorldGroundingPresentation.mjs';
const ART=new Set(['shop','repair','garden','kiosk','canopy','tree']);
// Presentation reads authored art bounds; it never expands the collision footprint.
export function openingGroundContact(prop){
 if(!prop||prop.interaction||!ART.has(prop.art)||![prop.x,prop.y,prop.width,prop.height].every(Number.isFinite)||prop.width<=0||prop.height<=0)return null;
 const bounds=streetVisibleBounds(prop.art,{x:prop.x-prop.width/2,y:prop.y-prop.height,width:prop.width,height:prop.height});
 const tree=prop.art==='tree',width=tree?Math.min(34,bounds.width*.42):bounds.width*.92;
 return{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height+1,width,height:tree?6:8};
}
export function createOpeningGroundContacts(scene,props){
 const rows=props.map(openingGroundContact).filter(Boolean);if(!rows.length)return null;
 const graphics=scene.add?.graphics?.();if(!graphics)return null;
 if(typeof graphics.fillEllipse!=='function'){graphics.destroy?.();return null;}
 graphics.setDepth(.45);
 for(const r of rows){
  graphics.fillStyle(0x263f3d,.05).fillEllipse(r.x,r.y,r.width,r.height);
  graphics.fillStyle(0x263f3d,.07).fillEllipse(r.x,r.y-.5,r.width*.88,r.height*.6);
  graphics.fillStyle(0x263f3d,.10).fillEllipse(r.x,r.y-1,r.width*.72,r.height*.25);
 }
 return graphics;
}
