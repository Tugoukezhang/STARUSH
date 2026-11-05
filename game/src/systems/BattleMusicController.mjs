import { renderBattleMusic } from '../utils/battleMusicScore.mjs';
import { playerPreferences } from '../utils/playerPreferences.mjs';

export class BattleMusicController {
  constructor(scene, {render=renderBattleMusic, preferences=playerPreferences.read()}={}) {
    this.context=scene.sound?.context;
    this.sound=scene.sound;
    this.sources=[];this.gains=[];this.buffers=null;
    this.paused=false;this.ended=false;this.destroyed=false;
    this.offset=0;this.startedAt=0;this.duckUntil=0;this.phase='explore';
    this.status='preparing';this.mixKey=null;
    this.setPreferences(preferences);
    this.onPreferences=value=>this.setPreferences(value);
    this.onContextChange=()=>this.sync();
    this.sound?.on?.('starush-audio-preferences',this.onPreferences);
    this.context?.addEventListener?.('statechange',this.onContextChange);
    this.prepared=this.context?.createBufferSource ? Promise.resolve().then(render).then(buffers=>{
      if(this.destroyed||this.ended)return;
      this.buffers=buffers;this.status='ready';this.sync();
    }).catch(()=>{this.status='unavailable';this.stopSources();}) : Promise.resolve().then(()=>{this.status='unavailable';});
  }
  setPreferences(value={}) {
    this.musicVolume=Number.isFinite(value.musicVolume)?Math.max(0,Math.min(1,value.musicVolume)):0.45;
    this.muted=value.muted===true;this.applyMix();
  }
  setPaused(paused) { this.paused=paused===true;this.sync(); }
  update({finale=false,encore=false}={}) {
    this.phase=encore?'encore':finale?'finale':'explore';this.sync();
  }
  duck(seconds) {
    this.duckUntil=Math.max(this.duckUntil,(this.context?.currentTime||0)+seconds);
    this.applyMix();
  }
  sync() {
    if(this.destroyed||this.ended||this.paused){this.stopSources();return;}
    if(!this.buffers||this.context?.state!=='running')return;
    if(!this.sources.length) {
      this.startedAt=this.context.currentTime+0.02;
      try {
        for(const buffer of this.buffers) {
          const source=this.context.createBufferSource(),gain=this.context.createGain();
          source.buffer=buffer;source.loop=true;gain.gain.value=0;
          source.connect(gain);
          // Separate music gain bypasses Phaser's SFX-volume node, not user mute.
          gain.connect(this.context.destination);
          this.sources.push(source);this.gains.push(gain);
          source.start(this.startedAt,this.offset);
        }
      } catch {this.stopSources();this.buffers=null;this.status='unavailable';return;}
      this.mixKey=null;
    }
    this.applyMix();
  }
  applyMix() {
    if(!this.gains?.length)return;
    const now=this.context.currentTime, duck=now<this.duckUntil?0.25:1;
    const level=this.muted?0:this.musicVolume*duck;
    const values=[level*(this.phase==='encore'?0.85:1),level*(this.phase==='explore'?0.34:0.9)];
    const key=values.join(':');if(key===this.mixKey)return;this.mixKey=key;
    this.gains.forEach((node,i)=>{
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value,now);
      node.gain.linearRampToValueAtTime(values[i],now+(this.muted?0:0.12));
    });
  }
  stopSources() {
    if(this.sources.length&&this.buffers) this.offset=(this.offset+Math.max(0,this.context.currentTime-this.startedAt))%this.buffers[0].duration;
    for(const source of this.sources){try{source.stop();}catch{/* Already stopped by context disposal. */}source.disconnect();}
    for(const gain of this.gains)gain.disconnect();
    this.sources=[];this.gains=[];this.mixKey=null;
  }
  finish() {this.ended=true;this.stopSources();this.buffers=null;}
  destroy() {
    if(this.destroyed)return;
    this.destroyed=true;this.finish();
    this.sound?.off?.('starush-audio-preferences',this.onPreferences);
    this.context?.removeEventListener?.('statechange',this.onContextChange);
  }
}
