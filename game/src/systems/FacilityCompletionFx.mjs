// B69: paper-cut restoration pop for a real facility completion. Presentation only;
// completion, rewards, gates and progress stay with PaintZoneSystem.
import {COLOR_HEX} from '../utils/config.js';
export const FACILITY_RESTORATION_POP=Object.freeze({key:'facility-restoration-pop-20261022',path:'art/facility-ink-seal-20261029/pop.png',
  frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.65]),display:112,depth:9.79,max:4});
// Hold each authored cel; the last end is the full 420ms life.
const FRAME_ENDS=Object.freeze([36,140,230,310,370,420]);
const REDUCED_MOTION='(prefers-reduced-motion: reduce)';

function publicUserCastRoute(scene,data){
  return scene?._userCastPresentation===true&&Number(data?.stageId||1)===1&&data?.practiceMode!==true&&!data?.defenseMode&&!data?.publicFinaleTrial;
}
export function isOptionalFacilityCompletionFile(file){return file?.key===FACILITY_RESTORATION_POP.key;}

// Call after preloadActorPresentation so the user-cast route is known.
export function preloadFacilityCompletionFx(scene,data={}){
  scene._facilityCompletionFx?.destroy();scene._facilityCompletionFx=null;
  if(!publicUserCastRoute(scene,data))return false;
  const art=FACILITY_RESTORATION_POP;
  scene.load.spritesheet(art.key,art.path,{frameWidth:art.frameWidth,frameHeight:art.frameHeight});
  scene._facilityCompletionFx=new FacilityCompletionFx(scene);
  return true;
}

// True means the original completion circle must not be drawn.
export function playFacilityCompletionFx(scene,device){return scene?._facilityCompletionFx?.play(device)===true;}

export class FacilityCompletionFx{
  constructor(scene){
    this.scene=scene;this.rows=[];this.played=new WeakSet();this.disposed=false;
    this.update=this.update.bind(this);this.destroy=this.destroy.bind(this);
    scene.events.on('postupdate',this.update);
    scene.events.once('shutdown',this.destroy);
    scene.events.once('destroy',this.destroy);
  }
  now(){return this.scene.publicPerformerRun?.now?.();}
  reduced(){
    const view=this.scene.game?.canvas?.ownerDocument?.defaultView;
    return view?.matchMedia?.(REDUCED_MOTION)?.matches===true;
  }
  eligible(){
    const s=this.scene;
    return !this.disposed&&publicUserCastRoute(s,s.battleData)&&s._isPublicStage1Round?.()===true
      &&Number.isFinite(this.now())&&s.textures?.exists(FACILITY_RESTORATION_POP.key)===true;
  }
  sizeFor(device){
    const camera=this.scene.cameras?.main,view=camera?.worldView;
    if(!view||![view.x,view.y,view.width,view.height].every(Number.isFinite))return FACILITY_RESTORATION_POP.display;
    const zoom=Number(camera.zoom)>0?camera.zoom:1,margin=8/zoom;
    const top=view.y+(this.scene.publicPerformerRun?.runGoal?148:120)/zoom;
    // Conservative union of the six exported ink bounds, not the transparent cell rectangle.
    return Math.min(FACILITY_RESTORATION_POP.display,(device.x-view.x-margin)/.36,
      (view.x+view.width-margin-device.x)/.344,(device.y-top-margin)/.444,
      (view.y+view.height-margin-device.y)/.25);
  }
  play(device){
    if(!device||this.disposed)return false;
    const s=this.scene,art=FACILITY_RESTORATION_POP;
    if(publicUserCastRoute(s,s.battleData)&&s._isPublicStage1Round?.()===true
      &&(s._restoringPublicBattleCheckpoint||s._battlePaused||s._battleEnded||this.reduced()))return true;
    if(!this.eligible())return false;
    if(this.played.has(device))return true;
    this.played.add(device);
    if(!Number.isFinite(device.x+device.y))return true;
    const size=this.sizeFor(device);if(size<52)return true;
    const color=[device.paintColor,s.publicPerformerRun?.member?.color]
      .find(value=>typeof value==='string'&&Object.hasOwn(COLOR_HEX,value));
    // Phaser.CANVAS (1) cannot multiply-tint images; retain a readable neutral check there.
    const tint=s.game?.renderer?.type===1||color===undefined?0xffffff:COLOR_HEX[color];
    while(this.rows.length>=art.max)this.rows.shift().node.destroy();
    const node=s.add.image(device.x,device.y,art.key,0).setOrigin(...art.origin)
      .setDisplaySize(size,size).setDepth(art.depth).setTint(tint);
    this.rows.push({node,start:this.now(),frame:0});
    return true;
  }
  update(){
    if(this.disposed||!this.rows.length)return;
    const s=this.scene;
    if(s._battleEnded||this.reduced()){this.clear();return;}
    const now=this.now();
    if(s._battlePaused||!Number.isFinite(now))return;
    this.rows=this.rows.filter(row=>{
      const frame=FRAME_ENDS.findIndex(end=>now-row.start<end);
      if(frame<0){row.node.destroy();return false;}
      if(frame!==row.frame){row.frame=frame;row.node.setFrame(frame);}
      return true;
    });
  }
  clear(){for(const row of this.rows.splice(0))row.node.destroy();}
  destroy(){
    if(this.disposed)return;
    this.disposed=true;this.clear();
    const events=this.scene.events;
    events.off('postupdate',this.update);
    events.off('shutdown',this.destroy);
    events.off('destroy',this.destroy);
  }
}
