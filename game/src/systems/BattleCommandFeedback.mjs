import {PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS} from './PublicStage1SakuraActionContract.mjs';
import {getPublicPerformerAction} from '../utils/publicPerformerAction.mjs';

const weapons={sakura:'rifle',kai:'sword',enjo:'hammer'};
const owners=new WeakMap();
const parts=new WeakMap();
const variables=['--command-x','--command-y','--command-angle','--command-flash','--command-spread'];
const clamp=value=>Math.max(0,Math.min(1,value));

// Presentation only: the Run owns release beats, movement, paint and the paused clock.
export function sampleBattleCommandFeedback(scene,type){
  const run=scene.publicPerformerRun;
  if(scene._userCastPresentation!==true||scene._battleEnded||!run||run.destroyed
    ||scene.player?.active===false||!(scene.player?.hp>0))return null;
  const now=run.now?.();
  if(!Number.isFinite(now))return null;
  if(type==='encore'){
    if(scene._isPublicSakuraEncoreWindowActive?.(now)!==true)return null;
    const remaining=scene._publicSakuraEncoreEndsAt-now;
    if(!Number.isFinite(remaining)||remaining<=0)return null;
    const progress=clamp(remaining/PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS);
    return {kind:'encore',phase:'active',progress,caption:`返场${(remaining/1000).toFixed(1)}s`,
      x:0,y:0,angle:0,flash:0,spread:1};
  }
  if(type!=='special')return null;
  const action=run.getActionPresentation?.(now),kind=weapons[run.member?.id];
  if(!action||!kind||action.memberId!==run.member.id
    ||!Number.isFinite(action.age+action.duration)||action.duration<=0
    ||action.age<0||action.age>=action.duration)return null;
  const progress=clamp(action.age/action.duration),settle=1-progress;
  let x=0,y=0,angle=0,flash=0;
  if(kind==='rifle'){
    // Three existing release beats, followed by recovery; no additional combat timers.
    const beats=getPublicPerformerAction(run.member.id).releaseBeats;
    const beatAge=action.age-(beats.filter(beat=>beat<=action.age).at(-1)||0);
    const kick=Math.exp(-beatAge/28)*settle;
    x=-4*kick;y=2*kick;angle=-5*kick;flash=kick;
  }else if(kind==='sword'){
    x=5*Math.sin(Math.PI*progress)*settle;y=-3*Math.sin(Math.PI*progress);
    angle=-12*settle;flash=settle**2;
  }else{
    y=5*Math.cos(progress*Math.PI*3)*settle**2;
    angle=5*Math.sin(progress*Math.PI*2)*settle;flash=settle**3;
  }
  const caption=kind==='hammer'?'余震':action.phase==='release'?(kind==='rifle'?'扫射中':'突进中'):'收势';
  return {kind,phase:action.phase,progress,caption,x,y,angle,flash,spread:1+progress*.4};
}

function bind(scene,doc,button){
  let owner=owners.get(scene);
  if(!owner){
    owner={buttons:new Set(),media:doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')};
    const dispose=()=>{
      for(const node of owner.buttons){
        const part=parts.get(node);part?.fx.remove();part?.track.remove();parts.delete(node);
        delete node.dataset.commandPhase;delete node.dataset.commandMotion;delete node.dataset.commandKind;
        delete node.dataset.commandFeedback;
        for(const property of variables)node.style.removeProperty(property);
      }
      owner.buttons.clear();owners.delete(scene);
      scene.events?.off?.('shutdown',dispose);scene.events?.off?.('destroy',dispose);
    };
    scene.events?.once?.('shutdown',dispose);scene.events?.once?.('destroy',dispose);
    owners.set(scene,owner);
  }
  owner.buttons.add(button);
  return owner;
}

function mount(doc,button){
  let part=parts.get(button);if(part)return part;
  const fx=doc.createElement('span');fx.className='battle-command-fx';fx.setAttribute('aria-hidden','true');
  for(let i=0;i<3;i++){const stroke=doc.createElement('i');stroke.className='battle-command-stroke';fx.append(stroke);}
  const track=doc.createElement('span');track.className='battle-command-phase';track.setAttribute('aria-hidden','true');track.hidden=true;
  const fill=doc.createElement('span');fill.className='battle-command-phase-fill';track.append(fill);
  button.append(fx,track);part={fx,track,fill};parts.set(button,part);return part;
}

export function syncBattleCommandFeedback(scene,doc,button,type,member,fact){
  const owner=bind(scene,doc,button),part=mount(doc,button);
  const terminal=['ended','preparing','unavailable'].includes(fact.state);
  const motion=terminal?null:sampleBattleCommandFeedback(scene,type);
  const reduced=owner.media?.matches===true;
  const paused=scene._battlePaused||scene._publicBattleDialog||fact.state==='paused'||fact.state==='busy';
  button.dataset.commandFeedback='staged';
  button.dataset.commandKind=type==='encore'?'encore':weapons[member.id]||'unknown';
  button.dataset.commandPhase=motion?.phase||'idle';
  button.dataset.commandMotion=reduced?'reduced':paused?'paused':'full';
  part.track.hidden=!motion;
  if(motion)part.fill.style.width=`${motion.progress*100}%`;
  for(const [property,value] of Object.entries({
    '--command-x':`${reduced?0:motion?.x||0}px`,
    '--command-y':`${reduced?0:motion?.y||0}px`,
    '--command-angle':`${reduced?0:motion?.angle||0}deg`,
    '--command-flash':String(reduced||paused?0:motion?.flash||0),
    '--command-spread':String(reduced?1:motion?.spread||1),
  }))button.style.setProperty(property,value);
  // Paused/busy captions and all release permission/charge meters belong to the canonical HUD.
  if(motion&&!paused){
    const state=doc.getElementById(type+'-state');if(state)state.textContent=motion.caption;
    const label=type==='special'?`${member.name}：${member.actionName}`:'安可';
    button.setAttribute('aria-label',`${label}，${motion.caption}，充能 ${fact.charge}%`);
  }
  button.setAttribute('title',button.getAttribute('aria-label'));
}
