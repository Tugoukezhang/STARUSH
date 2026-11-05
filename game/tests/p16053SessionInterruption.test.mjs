import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../src/systems/PlayerSessionExperience.mjs',import.meta.url);
assert.ok(fs.existsSync(url),'scene-owned interruption protection is missing');
const {SessionPauseLease,bindSessionInterruptions,PlayerSessionExperience}=await import(url);
assert.equal(typeof PlayerSessionExperience.prototype.canShowChapterRules,'function','hidden practice must not inherit public chapter rules');
for(const [battle,publicRound,expected] of [[false,false,true],[true,true,true],[true,false,false]]){
 assert.equal(PlayerSessionExperience.prototype.canShowChapterRules.call({battle,scene:{_isPublicStage1Round:()=>publicRound}}),expected);
}
function fixture(paused=false,choice=false){
  const log=[];
  const s={_battlePaused:paused,publicPerformerRun:{choiceOpen:choice},
    input:{enabled:true,keyboard:{enabled:true,resetKeys(){log.push('keys');}},resetPointers(){log.push('pointers');}},
    player:{body:{setVelocity(x,y){log.push(['velocity',x,y]);}}},
    _clearMobileInputState(){log.push('touch');},_clearBattlePauseOverlay(){log.push('overlay');},
    _setBattlePaused(v){this._battlePaused=v;log.push(['pause',v]);}};
  return {s,log};
}
const {s,log}=fixture();const lease=new SessionPauseLease(s);
lease.acquire();assert.equal(s._battlePaused,true);assert.equal(s.input.keyboard.enabled,false);
assert.equal(s.input.enabled,false,'DOM dialog must disable the underlying Phaser input plugin');
assert.ok(log.includes('keys'));assert.ok(log.includes('pointers'));assert.ok(log.includes('touch'));
lease.acquire();lease.release();assert.equal(s._battlePaused,false);assert.equal(s.input.keyboard.enabled,true);
assert.equal(s.input.enabled,true);
const nested=fixture(true,true),choice=new SessionPauseLease(nested.s);choice.acquire();choice.release();
assert.equal(nested.s._battlePaused,true,'closing interruption cannot release a choice pause');
assert.ok(!nested.log.some(x=>Array.isArray(x)&&x[0]==='pause'&&x[1]===false));
const manual=fixture(true),existingPause=new SessionPauseLease(manual.s);existingPause.acquire();existingPause.release();
assert.equal(manual.s._battlePaused,true);
const dead=fixture(),ending=new SessionPauseLease(dead.s);ending.acquire();dead.s._battleEnded=true;ending.release();
assert.ok(!dead.log.some(x=>Array.isArray(x)&&x[0]==='pause'&&x[1]===false));
class Surface extends EventTarget {}
const win=new Surface(),doc=new Surface();doc.hidden=false;let interrupts=0;
const unbind=bindSessionInterruptions({win,doc,onInterrupt:()=>interrupts++});
win.dispatchEvent(new Event('focus'));assert.equal(interrupts,0);
win.dispatchEvent(new Event('blur'));doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('pagehide'));
assert.equal(interrupts,3);
unbind();win.dispatchEvent(new Event('blur'));assert.equal(interrupts,3);
const startHidden=bindSessionInterruptions({win,doc,onInterrupt:()=>interrupts++});
assert.equal(interrupts,4,'a scene initialized in a hidden document must start protected');
doc.dispatchEvent(new Event('touchcancel'));assert.equal(interrupts,5,'OS-cancelled touch must interrupt');
startHidden();doc.dispatchEvent(new Event('touchcancel'));assert.equal(interrupts,5);
const battle=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
assert.match(battle,/!nextPaused && this\._sessionExperience\?\.isBlocking\(\)/,'modal must veto premature resume');
assert.match(battle,/_sessionExperience\?\.destroy\(\)/,'scene shutdown disposes session UI');
console.log('P16-053 interruption, nested pause, input release, cleanup pass');
