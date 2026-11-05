// Original STARUSH instrumental: 16 bars, two aligned stems, no sampled recordings.
export const MUSIC_SCORE = Object.freeze({ id: 'starush-first-lights-v1', bpm: 128, bars: 16, duration: 30, sampleRate: 32000 });
const beat = 60 / MUSIC_SCORE.bpm;
const harmony = [
  [50,57,61,64], [47,54,57,61], [43,50,54,57], [45,52,57,59],
  [50,57,61,64], [47,54,57,61], [43,50,54,57], [45,52,56,59],
  [54,57,61,64], [47,54,57,61], [43,50,54,57], [45,52,57,59],
  [43,50,54,57], [45,52,57,59], [50,57,61,64], [45,52,56,59],
];
const phrases = [
  [69,73,76,73,71,69], [66,69,73,76,73,69],
  [67,69,74,73,69,67], [64,69,71,76,73,71],
];

export function createMusicScore() {
  const theme = [], rhythm = [];
  const add = (list, instrument, at, duration, gain, note=0) => list.push({instrument,at:at*beat,duration:duration*beat,gain,note});
  for (let bar=0;bar<16;bar++) {
    const chord=harmony[bar], start=bar*4;
    for(const note of chord.slice(1)) add(theme,'pad',start,4.25,0.021,note+12);
    for(let i=0;i<4;i++) add(theme,'bass',start+i,0.72,0.095,chord[0]-12+(i===3?12:0));
    const phrase=phrases[bar%4], positions=[0.5,1,1.75,2.5,3,3.5];
    if(bar%4!==3 || bar>=12) for(let i=0;i<phrase.length;i++) {
      add(theme,'pluck',start+positions[i],i===5?0.7:0.43,bar>=8?0.061:0.052,phrase[i]+(bar===14?12:0));
    }
    for(let i=0;i<4;i++) add(rhythm,'kick',start+i,0.42,0.15);
    for(const i of [1,3]) add(rhythm,'snare',start+i,0.22,0.058);
    for(let i=0;i<8;i++) add(rhythm,'hat',start+i/2,0.09,i%2?0.023:0.013);
    for(let i=0;i<8;i++) add(rhythm,'pluck',start+i/2+0.25,0.22,0.021,chord[1+i%3]+12);
    if(bar%4===3) for(const i of [3.25,3.5,3.75]) add(rhythm,'snare',start+i,0.12,0.027);
  }
  return {theme,rhythm};
}

function schedule(context, event, cycle, noise) {
  const at=event.at+cycle*MUSIC_SCORE.duration, end=at+event.duration;
  const env=context.createGain();env.connect(context.destination);
  env.gain.setValueAtTime(0,at);
  env.gain.linearRampToValueAtTime(event.gain,at+(event.instrument==='pad'?0.12:0.006));
  env.gain.exponentialRampToValueAtTime(0.00001,end);
  let source;
  if(event.instrument==='snare'||event.instrument==='hat') {
    source=context.createBufferSource();source.buffer=noise;source.loop=true;
    const filter=context.createBiquadFilter();filter.type='highpass';
    filter.frequency.value=event.instrument==='hat'?6500:1700;
    source.connect(filter);filter.connect(env);
  } else {
    source=context.createOscillator();source.type=event.instrument==='bass'?'triangle':'sine';
    const frequency=440*2**((event.note-69)/12);
    if(event.instrument==='kick') {
      source.frequency.setValueAtTime(135,at);source.frequency.exponentialRampToValueAtTime(43,at+0.12);
    } else source.frequency.setValueAtTime(frequency,at);
    source.connect(env);
    if(event.instrument==='pluck') {
      const overtone=context.createOscillator(), gain=context.createGain();
      overtone.frequency.value=frequency*2;gain.gain.value=0.18;
      overtone.connect(gain);gain.connect(env);overtone.start(at);overtone.stop(end);
    }
  }
  source.start(at);source.stop(end);
}

let cachedRender;
export function renderBattleMusic() {
  if(cachedRender) return cachedRender;
  const Offline=globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if(!Offline) return Promise.reject(new Error('Offline audio unavailable'));
  cachedRender=(async()=>{
    const stems=[], score=createMusicScore(), frames=MUSIC_SCORE.duration*MUSIC_SCORE.sampleRate;
    const voices=new Map(), allocator=new Offline(1,1,MUSIC_SCORE.sampleRate);
    const noise=allocator.createBuffer(1,32000,MUSIC_SCORE.sampleRate), samples=noise.getChannelData(0);
    let seed=86091;for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2147483648-1;}
    // Render each distinct short voice once. A minute-long graph of hundreds of
    // inactive oscillators cost 25 seconds on the QA host; cached voices avoid it.
    for(const events of [score.theme,score.rhythm]) {
      const buffer=allocator.createBuffer(1,frames,MUSIC_SCORE.sampleRate), target=buffer.getChannelData(0);
      for(const event of events) {
        const key=[event.instrument,event.note,event.duration,event.gain].join(':');
        if(!voices.has(key)) {
          const context=new Offline(1,Math.ceil(event.duration*MUSIC_SCORE.sampleRate),MUSIC_SCORE.sampleRate);
          schedule(context,{...event,at:0},0,noise);
          voices.set(key,(await context.startRendering()).getChannelData(0));
        }
        const voice=voices.get(key),start=Math.round(event.at*MUSIC_SCORE.sampleRate);
        // Wrap release tails into the first bar for a sample-aligned seamless loop.
        const first=Math.min(voice.length,frames-start);
        for(let i=0;i<first;i++)target[start+i]+=voice[i];
        for(let i=first;i<voice.length;i++)target[i-first]+=voice[i];
      }
      stems.push(buffer);
    }
    return stems;
  })().catch(error=>{cachedRender=null;throw error;});
  return cachedRender;
}
