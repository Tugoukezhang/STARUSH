import {getChapterContent,CHAPTER_ENCOUNTER_EVENTS} from './publicChapterContent.mjs';
const DISRUPTOR='objective-disruptor';
const eventForChapter=id=>CHAPTER_ENCOUNTER_EVENTS[getChapterContent(id)?.encounter.eventId];
const STATUSES=new Set(['approach','linked','interrupted','released','expired','completed','preempted']);
export function normalizeChapterEvent(row,chapterId) {
  const event=Object.values(CHAPTER_ENCOUNTER_EVENTS).find(e=>e.id===row?.id);
  if(!event||!STATUSES.has(row.status)||(chapterId!==undefined&&eventForChapter(chapterId)!==event))return null;
  return {id:event.id,status:row.status};
}
export function getChapterEventReview(row,chapterId) {
  const valid=normalizeChapterEvent(row,chapterId);if(!valid)return null;
  const event=Object.values(CHAPTER_ENCOUNTER_EVENTS).find(e=>e.id===valid.id);
  const text={approach:'远端干扰仍在准备，联动尚未形成。',linked:'联动尚未结束。',interrupted:'及时打断联动，取消了一次未发出的声浪。',
    released:'联动声浪已发出；事后涂满干扰者不会抹去弹体。',expired:'干扰窗口自然结束，未记录为主动打断。',
    completed:'联动遭遇已结束，未记录为提前打断。',preempted:event.id==='neon-linked-cue'?'抢先解决干扰，未形成联动。':'设施已先行完成，接力干扰无需再出场。'}[valid.status];
  const harborText=valid.status==='released'?'联动落击已释放；事后涂满干扰者不会撤销已经发生的落击。'
    :text.replaceAll('声浪','落击');
  return {...valid,label:event.label,text:event.id==='harbor-cue-relay'?harborText:text,hint:event.hint};
}

// One finite interaction per chapter. The Scene still owns all enemies, clocks and effects.
export class ChapterEncounterEvent {
  constructor(chapterId){this.config=eventForChapter(chapterId);this.reset();}
  reset(){this.row=null;this.wasLinked=false;this.captainSubphase=null;this.disruptorState=null;this.remoteDisruptor=false;}
  observe({captainSubphase,disruptorState,remoteDisruptor}={},roles={}){
    this.captainSubphase=captainSubphase;this.disruptorState=disruptorState;this.remoteDisruptor=remoteDisruptor===true;
    if(!this.row&&this.config?.id==='neon-linked-cue'&&this.remoteDisruptor&&roles[DISRUPTOR]?.state==='active')this.row={id:this.config.id,status:'approach'};
  }
  eligible(role,at,completed,roles) {
    if(this.config?.id==='neon-linked-cue'){
      if(role==='spotlight-captain'&&roles['stage-cue-emitter']?.state!=='resolved')return false;
      if(role==='stage-cue-emitter'&&!roles[DISRUPTOR])return false;
    }
    if(!this.config||role!==this.config.secondary)return completed>=at;
    if(this.config.id==='neon-linked-cue'&&roles[DISRUPTOR]?.state==='active')return this.remoteDisruptor&&this.disruptorState==='disrupting';
    if(this.config.id==='harbor-cue-relay'&&roles['spotlight-captain']?.state==='active')return ['entrance','objective-disruption','captured-cue'].includes(this.captainSubphase);
    return completed>=at;
  }
  begin(role,roles) {
    if((this.row&&this.row.status!=='approach')||!this.config||role!==this.config.secondary)return;
    const linked=this.config.id==='neon-linked-cue'?roles[DISRUPTOR]?.state==='active'&&this.remoteDisruptor&&this.disruptorState==='disrupting'
      :roles['spotlight-captain']?.state==='active'&&['entrance','objective-disruption','captured-cue'].includes(this.captainSubphase);
    if(linked){this.wasLinked=true;this.row={id:this.config.id,status:'linked'};}
  }
  released(role){
    // A later solo host cannot rewrite an approach-only expiry as a linked attack.
    if(!this.wasLinked||!['linked','expired'].includes(this.row?.status)||role!==this.config.partner)return false;
    this.row.status='released';return true;
  }
  resolved(role,outcome){
    if(this.row?.status==='linked'&&role===DISRUPTOR&&outcome==='objective-unavailable')this.row.status='preempted';
    if(this.row?.status==='approach'&&role===DISRUPTOR)this.row.status=outcome==='window-expired'?'expired':'preempted';
  }
  action(roles,{emitterState,captainSubphase}={}) {
    if(this.row?.status!=='linked')return null;
    const source=roles[DISRUPTOR],partner=roles[this.config.partner];
    if(source?.state==='resolved'){
      if(['painted','interrupted','objective-complete'].includes(source.outcome)){
        const ready=this.config.id==='neon-linked-cue'?emitterState==='windup':['entrance','objective-disruption','captured-cue'].includes(captainSubphase);
        if(partner?.state==='active'&&ready)return {id:this.row.id,kind:this.config.id==='neon-linked-cue'?'interrupt-emitter':'interrupt-captain'};
      }else if(source.outcome==='window-expired'){this.row.status='expired';return null;}
    }
    if(partner?.state==='resolved')this.row.status='completed';
    return null;
  }
  acknowledge(action){
    const kind=this.config?.id==='neon-linked-cue'?'interrupt-emitter':'interrupt-captain';
    if(this.row?.status!=='linked'||action?.id!==this.row.id||action.kind!==kind)return false;
    this.row.status='interrupted';return true;
  }
  snapshot(){return this.row?{...this.row}:null;}
}

export function resolveChapterRelayPlacement({player,view,devices,currentZone,range,canReceive,clearLine,exclude=null}={}){
  if(![player?.x,player?.y,view?.x,view?.y,view?.width,view?.height,range].every(Number.isFinite)
    ||range<=0||!Array.isArray(devices)||typeof canReceive!=='function'||typeof clearLine!=='function')return null;
  const candidates=devices.filter(d=>d!==exclude&&!d.complete&&d.zone===currentZone&&canReceive(d)
    &&Math.hypot(d.x-player.x,d.y-player.y)>range+48);
  let best=null;
  for(const radius of [range+48,range+72])for(let i=0;i<16;i++){
    const angle=i*Math.PI/8,p={x:player.x+Math.cos(angle)*radius,y:player.y+Math.sin(angle)*radius};
    if(p.x<Math.max(30,view.x+22)||p.x>Math.min(970,view.x+view.width-22)
      ||p.y<Math.max(currentZone===0?960:30,view.y+112)||p.y>Math.min(1748,view.y+view.height-120))continue;
    if(clearLine(p,p,16)!==true||clearLine(player,p,16)!==true)continue;
    for(const device of candidates){const distance=Math.hypot(device.x-p.x,device.y-p.y);if(distance>range+72)continue;
      if(!best||distance<best.distance)best={...p,device,distance};}
  }
  return best?Object.freeze({x:best.x,y:best.y,device:best.device}):null;
}
