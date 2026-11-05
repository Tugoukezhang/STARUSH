import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';

export function image(x=0,y=0,key='',frame=0){
  const n={x,y,frame,texture:{key},active:true,visible:true,alpha:1};
  const methods={setDisplaySize:['width','height'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame'],setVisible:['visible'],setScrollFactor:['scrollFactor']};
  for(const [method,fields]of Object.entries(methods))n[method]=function(...values){fields.forEach((field,i)=>this[field]=values[i]??values[0]);return this;};
  n.setTexture=function(key,frame=0){this.texture={key};this.frame=frame;return this;};
  n.setCrop=function(...crop){this.crop=crop;return this;};
  for(const method of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[method]=()=>n;
  n.destroy=()=>{n.active=false;};return n;
}

export function fixture(id='sakura',missing=[]){
  const hits=[],timers=[],targets=[],nodes=[];
  const s={battleData:{stageId:1,performerId:id},time:{now:0,delayedCall(delay,fn){const timer={delay,fn,remove(){}};timers.push(timer);return timer;}},
    player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},playerGfx:image(),
    _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,
    paintZone:{applyPaintAt(){}},enemies:{getChildren:()=>targets},
    _stampGroundSplat(){},_paintPublicStage1TargetsAt:(...args)=>hits.push(args),
    _selectPublicSakuraLeadCueTarget:()=>targets[0]??null,_showRoundBanner(){},_updateHUD(){},
    textures:{exists:key=>!missing.some(suffix=>key.endsWith(suffix))},
    add:{image(...args){const n=image(...args);nodes.push(n);return n;},rectangle:image}};
  const run=s.publicPerformerRun=new PublicStage1PerformerRun(s);
  const actor=s.actorPresentation=new ActorPresentation(s);
  const draw=(wallTime,dx=0,dy=0)=>{s.time.now=wallTime;s.player.x+=dx;s.player.y+=dy;actor.drawPlayer(run.now(),!!(dx||dy),0xffffff);};
  return {s,run,actor,draw,hits,timers,targets,nodes};
}

export const target=(x,y)=>({x,y,active:true,publicStage1EnemyRole:'unlit-chaser'});
