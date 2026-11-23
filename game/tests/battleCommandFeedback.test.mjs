import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {sampleBattleCommandFeedback as sample,syncBattleCommandFeedback as sync} from '../src/systems/BattleCommandFeedback.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura'){
 const timers=[],paints=[];
 const scene={events:new EventEmitter(),battleData:{stageId:1,performerId:id},_userCastPresentation:true,
  time:{now:0,delayedCall(delay,fn){const timer={delay,fn,remove(){}};timers.push(timer);return timer;}},
  player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},battleRecord:{playerHitCount:0},
  _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,_encoreCharge:0,
  paintZone:{devices:[],currentZone:0,applyPaintAt(...args){paints.push(args);return true;}},
  enemies:{getChildren:()=>[]},oldStreet:{clearLine:()=>true},_stampGroundSplat(){},
  _paintPublicStage1TargetsAt:()=>false,_showRoundBanner(){},_updateHUD(){},
  actorPresentation:{direction:'left',userCastView:{state:'idle'}}};
 const run=scene.publicPerformerRun=new PublicStage1PerformerRun(scene);
 const document=createDocument(),media={matches:false};document.defaultView={matchMedia:()=>media};
 const button=document.createElement('button');button.id='skill-special';document.body.append(button);
 const state=document.createElement('span');state.id='special-state';button.append(state);
 const meter=document.createElement('span');meter.className='battle-command-charge';button.append(meter);
 const fact={state:'charging',charge:17};
 const render=(current=fact)=>{
  state.textContent=current.state==='paused'?'已暂停':current.state==='busy'?'暂不可用':`${current.charge}%`;
  button.setAttribute('aria-disabled','true');button.style.setProperty('--charge-turn',current.charge/100+'turn');
  meter.setAttribute('aria-valuenow',String(current.charge));
  sync(scene,document,button,'special',run.member,current);
 };
 return {scene,run,timers,paints,document,button,state,meter,media,render};
}

for(const id of ['sakura','kai','enjo'])test(id+' accepted casts use the real phase clock, freeze/resume and never schedule gameplay from UI',()=>{
 const f=fixture(id),s=f.scene;assert.equal(sample(s,'special'),null);
 s.time.now=20;assert(f.run.triggerAction());s.time.now=70;
 const motion=sample(s,'special');assert(motion&&motion.progress>0&&motion.progress<1);
 assert.equal(motion.phase,id==='enjo'?'recovery':'release');
 const before={actions:f.run.actions,charge:s._specialCharge,paints:f.paints.length,timers:f.timers.length};
 assert.equal(f.run.triggerAction(),false,'empty charge cannot create another cast');
 f.run.pauseClock();s._battlePaused=true;const frozen=sample(s,'special');
 s.time.now=5070;assert.deepEqual(sample(s,'special'),frozen);
 f.render({state:'paused',charge:17});assert.equal(f.state.textContent,'已暂停');
 f.run.resumeClock();s._battlePaused=false;assert.deepEqual(sample(s,'special'),frozen);
 s.time.now=5220;assert.equal(sample(s,'special').phase,'recovery');
 s.time.now=5340;assert.equal(sample(s,'special'),null);
 assert.deepEqual({actions:f.run.actions,charge:s._specialCharge,paints:f.paints.length,timers:f.timers.length},before);
 f.run.destroy();assert.equal(sample(s,'special'),null);
});

test('the animation and charge meters have independent meaning and preserve permission and blocked captions',()=>{
 const f=fixture('kai');f.run.triggerAction();f.scene.time.now=80;f.render();
 assert.equal(f.state.textContent,'突进中');
 assert.equal(f.button.getAttribute('aria-disabled'),'true');
 assert.equal(f.meter.getAttribute('aria-valuenow'),'17');
 assert.equal(f.button.style['--charge-turn'],'0.17turn');
 assert.match(f.button.getAttribute('aria-label'),/突进中，充能 17%/);
 assert.equal(f.button.querySelector('.battle-command-phase').hidden,false);
 const width=f.button.querySelector('.battle-command-phase-fill').style.width;
 f.run.pauseClock();f.scene.time.now=10080;
 for(let i=0;i<10;i++)f.render({state:'busy',charge:17});
 assert.equal(f.state.textContent,'暂不可用');
 assert.equal(f.button.querySelector('.battle-command-phase-fill').style.width,width);
 assert.equal(f.button.querySelectorAll('.battle-command-phase').length,1);
 assert.equal(f.button.querySelectorAll('.battle-command-fx').length,1);
 f.scene._battleEnded=true;f.render({state:'ended',charge:17});
 assert.equal(f.button.querySelector('.battle-command-phase').hidden,true);
 assert.equal(f.button.dataset.commandPhase,'idle');
});

test('Encore shows only its real remaining window, with the same paused clock and exact expiry',()=>{
 const {scene:s,run}=fixture();s._publicSakuraEncoreEndsAt=5000;
 s._isPublicSakuraEncoreWindowActive=now=>now<s._publicSakuraEncoreEndsAt;
 assert.equal(sample(s,'encore').caption,'返场5.0s');s.time.now=1234;
 assert.equal(sample(s,'encore').caption,'返场3.8s');assert.equal(sample(s,'encore').progress,3766/5000);
 run.pauseClock();const frozen=sample(s,'encore');s.time.now=9000;assert.deepEqual(sample(s,'encore'),frozen);
 run.resumeClock();s.time.now+=3766;assert.equal(sample(s,'encore'),null);
});

test('reduced motion keeps useful phase text without moving or flashing; it does not restart the cast when changed',()=>{
 const f=fixture('kai');f.run.triggerAction();f.scene.time.now=40;f.render();
 assert.notEqual(f.button.style['--command-x'],'0px');
 f.media.matches=true;f.render();assert.equal(f.button.style['--command-x'],'0px');
 assert.equal(f.button.style['--command-y'],'0px');assert.equal(f.button.style['--command-angle'],'0deg');
 assert.equal(f.button.style['--command-flash'],'0');assert.equal(f.state.textContent,'突进中');
 f.scene.time.now=220;f.media.matches=false;f.render();
 assert.equal(f.state.textContent,'收势');assert.equal(f.run.actions,1);
});

test('shutdown and destroy remove owned decorations and listeners, preserving canonical nodes for restart',()=>{
 for(const event of ['shutdown','destroy']){
  const f=fixture();f.run.triggerAction();f.scene.time.now=40;
  for(let i=0;i<8;i++)f.render();
  assert.equal(f.scene.events.listenerCount('shutdown'),1);assert.equal(f.scene.events.listenerCount('destroy'),1);
  f.scene.events.emit(event);
  assert.equal(f.button.querySelector('.battle-command-fx'),null);
  assert.equal(f.button.querySelector('.battle-command-phase'),null);
  assert.equal(f.button.dataset.commandFeedback,undefined);assert.equal(f.button.style['--command-x'],undefined);
  assert.equal(f.button.querySelector('.battle-command-charge'),f.meter);
  assert.equal(f.scene.events.listenerCount('shutdown'),0);assert.equal(f.scene.events.listenerCount('destroy'),0);
  f.run.destroy();f.scene.publicPerformerRun=new PublicStage1PerformerRun(f.scene);f.render();
  assert.equal(f.button.dataset.commandPhase,'idle');assert.equal(f.button.querySelector('.battle-command-phase').hidden,true);
 }
});

test('death, destroyed run, absent snapshots and legacy presentation cannot leave a release cue',()=>{
 for(const invalidate of [f=>f.scene.player.hp=0,f=>f.scene.player.active=false,
  f=>f.run.destroy(),f=>f.scene._userCastPresentation=false,f=>f.run.actionPresentation=null]){
  const f=fixture();f.run.triggerAction();f.scene.time.now=40;assert(sample(f.scene,'special'));
  invalidate(f);f.render();assert.equal(f.button.dataset.commandPhase,'idle');
  assert.equal(f.button.querySelector('.battle-command-phase').hidden,true);
  assert.equal(f.button.style['--command-flash'],'0');
 }
});
