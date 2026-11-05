import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('game scene destroy unbinds interruption listeners before input plugin is gone',()=>{
 const e=loadScenes(),events=new EventEmitter();
 const {PlayerSessionExperience}=e.loadRuntime('systems/PlayerSessionExperience.mjs');
 const scene={events,input:{resetPointers(){throw Error('destroyed input manager');}}};
 const experience=new PlayerSessionExperience(scene,true);
 events.emit('destroy');
 assert.equal(experience.disposed,true);
 assert.doesNotThrow(()=>experience.interrupt());
 assert.doesNotThrow(()=>e.window.dispatchEvent({type:'blur'}));
 e.document.hidden=true;
 assert.doesNotThrow(()=>e.document.dispatchEvent({type:'visibilitychange'}));
 assert.doesNotThrow(()=>e.window.dispatchEvent({type:'pagehide'}));
 assert.equal(events.listenerCount('destroy'),0);
});

test('normal shutdown cleanup removes its destroy callback and remains idempotent',()=>{
 const e=loadScenes(),events=new EventEmitter();
 const {PlayerSessionExperience}=e.loadRuntime('systems/PlayerSessionExperience.mjs');
 const experience=new PlayerSessionExperience({events},true);
 assert.equal(events.listenerCount('destroy'),1);
 experience.destroy();experience.destroy();
 assert.equal(events.listenerCount('destroy'),0);
 assert.doesNotThrow(()=>events.emit('destroy'));
});
