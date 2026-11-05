import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
const url = new URL('../src/systems/BattleMusicController.mjs', import.meta.url);
assert.ok(fs.existsSync(url), 'public battle needs an owned, gesture-safe music controller');
const { BattleMusicController } = await import(url);
const { MUSIC_SCORE, createMusicScore, renderBattleMusic } = await import('../src/utils/battleMusicScore.mjs');
const { PlayerPreferences } = await import('../src/utils/playerPreferences.mjs');
assert.equal(MUSIC_SCORE.duration, 30);
assert.equal(MUSIC_SCORE.sampleRate, 32000);
assert.equal(MUSIC_SCORE.bars, 16);
const score = createMusicScore();
assert.deepEqual(score, createMusicScore(), 'original score is reproducible');
for (const stem of ['theme','rhythm']) {
  assert.ok(score[stem].length > 100);
  for (const event of score[stem]) {
    assert.ok(event.at >= 0 && event.at < MUSIC_SCORE.duration);
    assert.ok(event.duration > 0 && event.gain > 0 && event.gain < 0.2);
  }
}
const old = new PlayerPreferences(() => ({getItem:()=>'{"version":1,"volume":0.2}'}));
assert.equal(old.read().musicVolume, 0.45);
assert.equal(old.read().volume, 0.2);
assert.equal(old.update({musicVolume:3}).value.musicVolume, 1);
assert.equal(old.update({musicVolume:-1}).value.musicVolume, 0);
assert.equal(old.update({musicVolume:NaN}).value.musicVolume, 0);

const parameter = () => ({value:0, cancelScheduledValues(){}, setValueAtTime(v){this.value=v;}, linearRampToValueAtTime(v){this.value=v;}});
{
  const contexts=[];
  const node=()=>({connect(){},start(){},stop(){},gain:{...parameter(),exponentialRampToValueAtTime(){}},frequency:{...parameter(),exponentialRampToValueAtTime(){}}});
  globalThis.OfflineAudioContext=class {
    constructor(channels,length,rate){assert.ok(length<=rate*3,'render short cached voices, not a minute-long graph');this.length=length;this.rate=rate;this.destination={};contexts.push(this);}
    createBuffer(channels,length,rate){const data=new Float32Array(length);return {length,sampleRate:rate,duration:length/rate,getChannelData:()=>data};}
    createGain=node;createOscillator=node;createBufferSource=node;createBiquadFilter=node;
    async startRendering(){return this.createBuffer(1,this.length,this.rate);}
  };
  const promise=renderBattleMusic();assert.equal(promise,renderBattleMusic(),'retry must reuse one render');
  const buffers=await promise;assert.equal(buffers.length,2);assert.ok(buffers.every(b=>b.length===960000));
  assert.ok(contexts.length<80,'cache repeated notes instead of hundreds of contexts');
  assert.equal(await renderBattleMusic(),buffers);delete globalThis.OfflineAudioContext;
}
function setup(state='running', render=async()=>[{duration:30},{duration:30}]) {
  const context = new EventEmitter();
  Object.assign(context,{state,currentTime:10,destination:{},nodes:[],
    addEventListener:context.on.bind(context),removeEventListener:context.off.bind(context),
    createGain(){return {gain:parameter(),connect(){},disconnect(){this.disconnected=true;}};},
    createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},start(...args){this.args=args;},stop(){this.stopped=true;}};this.nodes.push(node);return node;},
  });
  const sound = new EventEmitter(); sound.context = context;
  const music = new BattleMusicController({sound},{render,preferences:{musicVolume:0.45,muted:false}});
  return {music,context,sound};
}
{
  const {music,context,sound} = setup('suspended'); await music.prepared;
  assert.equal(context.nodes.length,0,'no autoplay/context resume from render');
  context.state='running';context.emit('statechange');
  assert.equal(music.sources.length,2);
  assert.deepEqual(music.sources[0].args,music.sources[1].args,'stems aligned');
  const nodes=[...music.sources];context.currentTime=14.02;music.setPaused(true);
  assert.equal(music.sources.length,0);assert.ok(nodes.every(n=>n.stopped&&n.disconnected));
  assert.ok(Math.abs(music.offset-4)<0.0001);
  context.currentTime=29;music.setPaused(false);
  assert.equal(music.sources[0].args[1],music.offset,'pause must not restart bar one');
  music.update({finale:true});assert.equal(music.phase,'finale');
  assert.ok(music.gains[1].gain.value>0.2,'finale has rhythmic contrast');
  const before=music.gains[1].gain.value;music.duck(0.9);
  assert.ok(music.gains[1].gain.value<before);
  context.currentTime+=1;music.update({finale:true});assert.equal(music.gains[1].gain.value,before);
  sound.emit('starush-audio-preferences',{muted:true,musicVolume:0.8});
  assert.equal(music.gains[0].gain.value,0);assert.equal(music.gains[1].gain.value,0);
  sound.emit('starush-audio-preferences',{muted:false,musicVolume:0.25,volume:0});
  assert.ok(music.gains[0].gain.value>0,'music independent from SFX volume');
  music.finish();assert.equal(music.sources.length,0);
  music.setPaused(false);music.update({finale:false});assert.equal(music.sources.length,0,'result cannot restart');
  music.destroy();music.destroy();assert.equal(sound.listenerCount('starush-audio-preferences'),0);
  assert.equal(context.listenerCount('statechange'),0);
  assert.ok(context.nodes.every(n=>n.stopped&&n.disconnected));
}
{
  let resolve;const {music,context}=setup('running',()=>new Promise(r=>resolve=r));
  music.setPaused(true);await Promise.resolve();resolve([{duration:30},{duration:30}]);await music.prepared;
  assert.equal(context.nodes.length,0,'render resolving during briefing cannot leak music');
  music.destroy();music.setPaused(false);assert.equal(context.nodes.length,0);
}
{
  const {music,context}=setup('running',async()=>{throw Error('unavailable');});await music.prepared;
  assert.equal(music.status,'unavailable');assert.equal(context.nodes.length,0);music.destroy();
}
{
  const music=new BattleMusicController({sound:{}},{render:async()=>{throw Error('should not render');}});
  await music.prepared;assert.equal(music.status,'unavailable');music.destroy();
}
console.log('P16-086 music score, ownership, gesture gate, pause offsets, mix, mute and disposal pass');
