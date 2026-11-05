import {createSakuraConnectedSurface} from './SakuraConnectedSurface.mjs';
// Owner clock for a PSD2Live P2LPlayer already loaded with P2LPlayer.fromBytes (create() self-starts a second, global RAF loop).
// No asset fetch here. Not a gesture system: it only drives exact parameter ids the loaded rig declares.
const TAU=Math.PI*2,FRAME_MS=1000/30,MAX_STEP=.1,REACTION_MS=900;
const LOOK_SPAN=.5,BODY_SPAN=.35,NOD_SPAN=.35,TILT_SPAN=.25,BODY_NOD=.55;
export const P2L_BEHAVIOR=Object.freeze({BLINK:1,BREATH:2,LOOK:4,LIP_SYNC:8});
// Exact ids per capability. A capability is supported only if every id exists; nothing is aliased or synthesized.
// tilt is the whole-figure ParamBodyAngleZ roll: PSD2Live ParamAngleZ rolls only the face mesh about the eye line and slides it off the neck.
export const RIG_CHANNELS=Object.freeze({'look-x':['ParamAngleX'],'look-y':['ParamAngleY'],nod:['ParamAngleY'],tilt:['ParamBodyAngleZ'],body:['ParamBodyAngleX'],breath:['ParamBreath'],blink:['ParamEyeLOpen','ParamEyeROpen'],mouth:['ParamMouthOpenY']});

const clamp=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
// -1..1 around the rig's own default: negative spans default..min, positive default..max.
const toRange=(r,f)=>{f=clamp(f);return f>=0?r.default+f*(r.max-r.default):r.default+f*(r.default-r.min);};

/** Anticipation (small lift), nod (down to -1), settle (exactly 0 from REACTION_MS). */
export function reactionEnvelope(age){
 if(!Number.isFinite(age)||age<0||age>=REACTION_MS)return 0;
 if(age<150)return .25*Math.sin(Math.PI*age/300);
 if(age<450)return .25-1.25*(1-Math.cos(Math.PI*(age-150)/300))/2;
 return -(1+Math.cos(Math.PI*(age-450)/450))/2;
}

/** Reads parameterRanges once and validates every known id the rig declares. */
export function resolveCompanionRig(player,verifiedChannels,breathDriver){
 const ranges=new Map(player.parameterRanges().map(r=>[r.id,r]));
 for(const id of new Set(Object.values(RIG_CHANNELS).flat())){
  const r=ranges.get(id);
  if(r&&!(Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.min<r.max&&r.default>=r.min&&r.default<=r.max))throw new RangeError(`P2L parameter ${id} has invalid range ${r.min}..${r.max} (default ${r.default})`);
 }
 if(!Array.isArray(verifiedChannels))throw new TypeError('P2L requires a visually verified model binding manifest');
 for(const channel of verifiedChannels)if(!Object.hasOwn(RIG_CHANNELS,channel)||!RIG_CHANNELS[channel].every(id=>ranges.has(id)))throw new RangeError('Unbound P2L channel: '+channel);
 if(!['native-sway','isolated','shared-surface'].includes(breathDriver))throw new TypeError('P2L requires an explicit breath driver');
 const supported=Object.keys(RIG_CHANNELS).filter(k=>verifiedChannels.includes(k)),has=k=>supported.includes(k);
 // LOOK stays off: the host owns the angles and the default behavior must not overwrite them. LIP_SYNC has no source.
 // Native BREATH also writes head/body angles; partial models must author just ParamBreath.
 const flags=(has('blink')?P2L_BEHAVIOR.BLINK:0)|(has('breath')&&breathDriver==='native-sway'?P2L_BEHAVIOR.BREATH:0);
 const pose=(look,env,area,elapsed)=>{
  const out=[],nod=env*NOD_SPAN*(area==='head'?1:BODY_NOD);
  if(has('look-x'))out.push(['ParamAngleX',toRange(ranges.get('ParamAngleX'),look.x*LOOK_SPAN)]);
  if(has('look-y')||has('nod'))out.push(['ParamAngleY',toRange(ranges.get('ParamAngleY'),(has('look-y')?look.y*LOOK_SPAN:0)+(has('nod')?nod:0))]);
  if(has('tilt'))out.push(['ParamBodyAngleZ',toRange(ranges.get('ParamBodyAngleZ'),area==='head'?0:-env*TILT_SPAN)]);
  if(has('body'))out.push(['ParamBodyAngleX',toRange(ranges.get('ParamBodyAngleX'),look.x*BODY_SPAN)]);
  if(has('breath')&&breathDriver==='isolated'){const r=ranges.get('ParamBreath');out.push(['ParamBreath',r.min+(.5+.5*Math.sin(TAU*elapsed/3234.5))*(r.max-r.min)]);}
  return out;
 };
 const rest=[...new Set(supported.flatMap(channel=>RIG_CHANNELS[channel]))].map(id=>[id,ranges.get(id).default]);
 return {supported,unsupported:Object.keys(RIG_CHANNELS).filter(k=>!has(k)),flags,pose,rest};
}

export function createCompanionRigClock({player,doc,win,rigNode,background=null,onError,verifiedChannels,breathDriver}){
 if(typeof onError!=='function')throw new TypeError('createCompanionRigClock needs an onError host callback');
 if(!player?.rig)throw new Error('P2L player has no loaded rig (already disposed)');
 if(player.animation)throw new Error('P2L player is running its own RAF; load it with P2LPlayer.fromBytes, not create()');
 if(typeof win?.requestAnimationFrame!=='function')throw new TypeError('createCompanionRigClock needs window.requestAnimationFrame');
 const rig=resolveCompanionRig(player,verifiedChannels,breathDriver),canvas=player.canvas,media=win.matchMedia('(prefers-reduced-motion: reduce)');
 let surface=null;
 if(breathDriver==='shared-surface'){
  player.behaviors(0);
  for(const r of player.parameterRanges())player.setParameter(r.id,r.default);
  player.update(0);surface=createSakuraConnectedSurface(player);
 }
 const smoothedLook={x:0,y:0};
 const originalBackgroundTransform=background?.style.transform??'';
 let disposed=false,raf=null,lastStamp=null,elapsed=0,paintedAt=0,mode=null,seen=rigNode.dataset.reactionSequence||'',reactionAt=-Infinity;
 const read=name=>clamp(Number.parseFloat(rigNode.style.getPropertyValue(name)));
 const cancel=()=>{if(raf!==null)win.cancelAnimationFrame(raf);raf=null;lastStamp=null;};
 const frame=(dt,still)=>{
  // Boundary around the vendor WASM/WebGL calls: failures are reported, never replaced by another renderer.
  try{
   const look=still?{x:0,y:0}:{x:read('--portrait-look-x'),y:read('--portrait-look-y')},sequence=rigNode.dataset.reactionSequence||'';
   if(surface){
    const blend=still?1:1-Math.exp(-dt/0.16);
    smoothedLook.x+=(look.x-smoothedLook.x)*blend;smoothedLook.y+=(look.y-smoothedLook.y)*blend;
    look.x=smoothedLook.x;look.y=smoothedLook.y;
   }
   if(sequence!==seen){seen=sequence;reactionAt=elapsed;}
   const env=still||!sequence?0:reactionEnvelope(elapsed-reactionAt);
   for(const [id,value] of still?rig.rest:rig.pose(look,env,rigNode.dataset.reaction,elapsed))player.setParameter(id,value);
   if(surface&&!still){
    // This source has only open/closed artwork. Cross-fading exposes both irises through the lids.
    const phase=elapsed%5700,eyeOpen=phase>=4100&&phase<4230?0:1;
    player.setParameter('ParamEyeLOpen',eyeOpen);player.setParameter('ParamEyeROpen',eyeOpen);
   }
   player.update(dt);
   if(surface)surface({look,env,elapsed,still});
   player.draw();
   if(background){const x=still?0:Math.sin(elapsed*TAU/8400)*3.5-look.x*2,y=still?0:Math.sin(elapsed*TAU/10600)*2-look.y*1.5;background.style.transform=`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(1.04)`;}
   return true;
  }catch(error){destroy();onError(error);return false;}
 };
 const tick=stamp=>{
  raf=null;if(disposed)return;
  if(doc.hidden||media.matches){sync();return;}
  if(lastStamp!==null)elapsed+=Math.max(0,stamp-lastStamp);lastStamp=stamp;
  if(elapsed-paintedAt>=FRAME_MS){if(!frame(Math.min(MAX_STEP,(elapsed-paintedAt)/1000),false))return;paintedAt=elapsed;}
  raf=win.requestAnimationFrame(tick);
 };
 function sync(){
  if(disposed)return;
  if(doc.hidden){cancel();return;}
  if(media.matches){cancel();if(mode!=='still'){mode='still';player.behaviors(0);frame(0,true);}return;}
  // Reactions clicked while still/hidden-at-entry were answered by text; they must not replay as motion later.
  if(mode!=='motion'){mode='motion';seen=rigNode.dataset.reactionSequence||'';reactionAt=-Infinity;player.behaviors(surface?0:rig.flags);if(!frame(0,false))return;}
  if(raf===null){lastStamp=null;raf=win.requestAnimationFrame(tick);}
 }
 const lost=()=>{destroy();onError(new Error('WebGL context lost for the companion rig; no fallback renderer is substituted'));};
 function destroy(){
  if(disposed)return;disposed=true;cancel();
  doc.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);canvas.removeEventListener('webglcontextlost',lost);
  if(background)background.style.transform=originalBackgroundTransform;
  delete rigNode.dataset.renderer;delete rigNode.dataset.rigCapabilities;delete rigNode.dataset.rigUnsupported;delete rigNode.dataset.motionDriver;
  // The clock owns the player. Vendor dispose() frees GL objects and the WASM rig but double-frees if called twice (rig=0 marks it).
  if(player.rig)player.dispose();else onError(new Error('P2L player was disposed outside its companion clock'));
 }
 rigNode.dataset.renderer='p2l';rigNode.dataset.rigCapabilities=rig.supported.join(' ');rigNode.dataset.rigUnsupported=rig.unsupported.join(' ');
 rigNode.dataset.motionDriver=breathDriver;
 doc.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);canvas.addEventListener('webglcontextlost',lost);
 sync();
 return {sync,destroy};
}
