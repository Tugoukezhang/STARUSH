import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function fixture(){
 const e=loadScenes(),doc=e.document,animations=[],make=doc.createElement;
 doc.createElement=tag=>{const n=make(tag);n.animate=(frames,options)=>{const a={frames,options,node:n,state:'running',
  cancel(){this.state='cancelled';this.oncancel?.();}};animations.push(a);return a;};return n;};
 const add=(tag,cls,parent,id)=>{const n=doc.createElement(tag);n.className=cls;if(id)n.id=id;parent.append(n);return n;};
 const root=add('div','',doc.body,'hud'),player=add('div','mihoyo-player',root),meta=add('div','mihoyo-player-meta',player);
 add('div','mihoyo-portrait',player);add('span','mihoyo-name',meta);add('div','hp-track',meta,'public-hp-meter');
 const heat=add('div','heat-card',root);add('span','',heat,'heat-level');
 const wave=add('span','',root,'wave-text');wave.textContent='设施 1/10 · 串场 0/4';
 const clock=add('span','',root,'round-clock');clock.textContent='00:16';
 const media={matches:false};doc.defaultView={matchMedia:()=>media};
 const scene={events:new EventEmitter(),_userCastPresentation:true,_isPublicStage1Round:()=>true,
  player:{hp:5},paintZone:{getHeat:()=>0},publicPerformerRun:{runId:'a',member:{id:'sakura',name:'步枪手',actionName:'扫射'},canAct:()=>false}};
 const header=e.loadRuntime('systems/BattleHeaderPresentation.mjs');
 return {scene,doc,wave,clock,meta,media,animations,sync:()=>header.syncBattleHeader(scene,doc,{id:'sakura'}),
  pulses:()=>animations.filter(a=>a.node===wave)};
}
test('existing owner baselines the objective and only a changed objective receives one bounded pulse',()=>{
 const f=fixture();f.sync();f.sync();assert.equal(f.pulses().length,0);f.wave.textContent='设施 2/10 · 串场 0/4';f.sync();
 assert.equal(f.pulses().length,1);const a=f.pulses()[0];assert.equal(a.options.duration,260);assert.equal(a.options.iterations,1);
 assert(a.frames.every(k=>Object.keys(k).every(p=>['backgroundColor','offset'].includes(p))),'progress never rescales or moves readable text');f.sync();assert.equal(f.pulses().length,1);
});
test('subsequent objective updates replace the prior pulse, never a second owner or stacked pulse',()=>{
 const f=fixture();f.sync();const owner=f.scene._battleHeader;f.wave.textContent='设施 2/10';f.sync();
 f.wave.textContent='设施 3/10';f.sync();assert.equal(f.pulses()[0].state,'cancelled');
 assert.equal(f.pulses().filter(a=>a.state==='running').length,1);assert.equal(f.scene._battleHeader,owner);
 assert.equal(f.scene.events.listenerCount('shutdown'),1);assert(!f.scene._battleHudMotion);
});
test('existing pause policy cancels and rebases objective state, so resume never replays old progress',()=>{
 const f=fixture();f.sync();f.wave.textContent='设施 2/10';f.sync();f.scene._battlePaused=true;f.sync();
 assert.equal(f.pulses()[0].state,'cancelled');f.wave.textContent='设施 3/10';f.sync();f.scene._battlePaused=false;f.sync();
 assert.equal(f.pulses().length,1);
});
test('reduced motion suppresses objective motion and cancels a live pulse without replay',()=>{
 const f=fixture();f.media.matches=true;f.sync();f.wave.textContent='设施 2/10';f.sync();assert.equal(f.animations.length,0);
 f.media.matches=false;f.sync();f.wave.textContent='设施 3/10';f.sync();assert.equal(f.pulses().length,1);
 f.media.matches=true;f.sync();assert.equal(f.pulses()[0].state,'cancelled');f.media.matches=false;f.sync();assert.equal(f.pulses().length,1);
});
test('shutdown and whole-game destroy both dispose the single owner while native objective text survives',()=>{
 for(const event of ['shutdown','destroy']){const f=fixture();f.sync();f.wave.textContent='设施 2/10';f.sync();const owner=f.scene._battleHeader;
  f.scene.events.emit(event);assert(owner.disposed);assert.equal(f.scene._battleHeader,undefined);
  assert.equal(f.scene.events.listenerCount('shutdown'),0);assert.equal(f.scene.events.listenerCount('destroy'),0);
  assert.equal(f.pulses()[0].state,'cancelled');assert.equal(f.wave.textContent,'设施 2/10');}
});
test('a restarted header baselines existing checkpoint progress rather than celebrating it again',()=>{
 const f=fixture();f.sync();f.scene.events.emit('shutdown');f.wave.textContent='设施 8/10';f.sync();assert.equal(f.pulses().length,0);
 assert.equal(f.scene.events.listenerCount('shutdown'),1);
});
test('real start-zero then checkpoint-apply ordering rebases without celebrating restored objectives',()=>{
 const f=fixture();f.scene._publicBattleResume={runId:'saved'};f.wave.textContent='设施 0/10';f.sync();
 assert.equal(f.animations.length,0);f.scene._restoringPublicBattleCheckpoint=true;
 f.wave.textContent='设施 8/10';f.sync();assert.equal(f.pulses().length,0);
 f.scene._restoringPublicBattleCheckpoint=false;f.scene._publicBattleResume=null;f.sync();assert.equal(f.pulses().length,0);
 f.wave.textContent='设施 9/10';f.sync();assert.equal(f.pulses().length,1);
});

test('low HP changes only presentation, respects max HP, and cleanup removes owned state',()=>{
 const f=fixture();f.scene.player.maxHp=10;f.scene.player.hp=5;f.sync();assert.equal(f.meta.dataset.health,'normal');
 f.scene.player.hp=4;const before=JSON.stringify(f.scene.player);f.sync();assert.equal(f.meta.dataset.health,'critical');assert.equal(JSON.stringify(f.scene.player),before);
 f.scene.player.hp=0;f.sync();assert.equal(f.meta.dataset.health,'empty');f.scene.player.hp=10;f.sync();assert.equal(f.meta.dataset.health,'normal');
 f.scene.events.emit('shutdown');assert.equal(f.meta.dataset.health,undefined);assert.equal(f.clock.dataset.urgency,undefined);
});

test('low-time cue follows authoritative action clock, not a rendered or wall-clock string',()=>{
 const f=fixture();let now=1000;f.scene.publicPerformerRun.now=()=>now;f.scene._paintRoundEndsAt=17000;f.sync();assert.equal(f.clock.dataset.urgency,'normal');
 f.clock.textContent='00:00';f.sync();assert.equal(f.clock.dataset.urgency,'normal');
 now=2000;f.sync();assert.equal(f.clock.dataset.urgency,'low');const cue=f.animations.filter(a=>a.node===f.clock);assert.equal(cue.length,1);assert.equal(cue[0].options.iterations,1);
 now=3000;f.sync();assert.equal(f.animations.filter(a=>a.node===f.clock).length,1,'no per-second blink');assert.equal(f.scene._paintRoundEndsAt,17000);
});

test('finale countdown wins over exploration timer, while invalid or absent timing stays neutral',()=>{
 const f=fixture();f.scene.publicPerformerRun.now=()=>1000;f.scene._paintRoundEndsAt=999999;
 f.scene.publicStage1Finale={snapshot:now=>(assert.equal(now,1000),{active:true,remainingMs:14000})};f.sync();assert.equal(f.clock.dataset.urgency,'low');
 f.scene.publicStage1Finale.snapshot=()=>({active:false,remainingMs:1000});f.sync();assert.equal(f.clock.dataset.urgency,'normal');
 delete f.scene._paintRoundEndsAt;f.sync();assert.equal(f.clock.dataset.urgency,'normal');
 f.scene.publicStage1Finale.snapshot=()=>({active:true,remainingMs:NaN});f.sync();assert.equal(f.clock.dataset.urgency,'normal');
});

test('pause, checkpoint and reduced motion rebase time warning without replay or persistent animation',()=>{
 for(const flag of ['_battlePaused','_publicBattleDialog','_restoringPublicBattleCheckpoint']){
  const f=fixture();let now=1000;f.scene.publicPerformerRun.now=()=>now;f.scene._paintRoundEndsAt=17000;f.sync();f.scene[flag]=true;now=3000;f.sync();
  assert.equal(f.clock.dataset.urgency,'low');delete f.scene[flag];f.sync();assert.equal(f.animations.filter(a=>a.node===f.clock).length,0);
 }
 const f=fixture();let now=1000;f.scene.publicPerformerRun.now=()=>now;f.scene._paintRoundEndsAt=17000;f.sync();now=3000;f.sync();const cue=f.animations.find(a=>a.node===f.clock);assert(cue);
 f.media.matches=true;f.sync();assert.equal(cue.state,'cancelled');f.media.matches=false;f.sync();assert.equal(f.animations.filter(a=>a.node===f.clock).length,1);
});
