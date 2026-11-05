import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {beginSceneLoading,finishSceneLoading} from '../src/systems/GameLoadRecovery.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function surface(){
 const nodes=Object.fromEntries(['game-loading','game-loading-message','game-loading-retry','game-container','portrait-protection'].map(id=>[id,{hidden:id==='portrait-protection',dataset:{},addEventListener(type,fn){this[type]=fn;}}]));
 const timers=new Map(),listeners={};let id=0,reloads=0;
 const window={addEventListener(type,fn){listeners[type]=fn;},location:{reload(){reloads++;}}};
 vm.runInNewContext(html.match(/<script id="game-loading-bootstrap">([\s\S]*?)<\/script>/)[1],{window,document:{getElementById:id=>nodes[id]},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 return {window,nodes,timers,listeners,reloads:()=>reloads,retry:()=>nodes['game-loading-retry'].click()};
}
function scene(ui){
 const data={stageId:1,performerId:'venus',campaignChapterId:'opening',team:[{characterId:'venus'}]},restarts=[];
 const s={load:new EventEmitter(),events:new EventEmitter(),initialBattleData:data,scene:{pause(){},restart(value){restarts.push(value);}}};
 s._loadRecovery=beginSceneLoading(s,ui);return {s,data,restarts};
}
test('completed failed scene retries the original member and chapter without reloading the document',()=>{
 const f=surface(),{s,data,restarts}=scene(f.window.starushLoading);
 s.load.emit('loaderror',{});assert.equal(f.nodes['game-loading'].dataset.state,'error');
 assert.equal(finishSceneLoading(s),false);f.retry();f.retry();
 assert.deepEqual(restarts,[data]);assert.equal(restarts[0],data);assert.equal(f.reloads(),0);
 assert.equal(f.nodes['game-container'].inert,true);assert.equal(f.nodes['game-loading-retry'].hidden,true);assert.equal(f.timers.size,0);
 s.events.emit('shutdown');s._loadRecovery=beginSceneLoading(s,f.window.starushLoading);assert.equal(finishSceneLoading(s),true);
 assert.equal(f.nodes['game-loading'].hidden,true);assert.equal(s.load.listenerCount('loaderror'),0);
});
test('in-flight failure retains full reload instead of mixing unfinished loader generations',()=>{
 const f=surface(),{s,restarts}=scene(f.window.starushLoading);s.load.emit('loaderror',{});f.retry();assert.equal(f.reloads(),1);assert.deepEqual(restarts,[]);
});
test('completed retry callback is single-use and rejected when a new load owns the scene',()=>{
 const callbacks=[],{s,data,restarts}=scene({start(){},fail(fn){if(fn)callbacks.push(fn);}});
 s.load.emit('loaderror',{});finishSceneLoading(s);assert.equal(callbacks.length,1);assert.equal(callbacks[0](),true);assert.equal(callbacks[0](),false);assert.deepEqual(restarts,[data]);
 s._loadRecovery=beginSceneLoading(s,{start(){},fail(fn){if(fn)callbacks.push(fn);}});s.load.emit('loaderror',{});finishSceneLoading(s);
 s._loadRecovery=beginSceneLoading(s,{start(){}});assert.equal(callbacks[1](),false);assert.equal(restarts.length,1);
});
test('module, required style and session failures never inherit an old scene retry',()=>{
 for(const kind of ['module','style','session']){
  const f=surface();let calls=0;f.window.starushLoading.fail(()=>{calls++;return true;});
  if(kind==='module')f.listeners.error({target:{tagName:'SCRIPT',type:'module'}});
  else if(kind==='style'){f.window.starushStyleLoadFailed=true;f.window.starushLoading.fail(()=>{calls++;return true;});}
  else f.window.starushLoading.hold('session',true);
  f.retry();assert.equal(calls,0,kind);assert.equal(f.reloads(),1,kind);
 }
});
test('ready and fresh start discard old retry ownership; timeout still allows an explicit reload',()=>{
 const f=surface();let calls=0;f.window.starushLoading.fail(()=>{calls++;return true;});f.window.starushLoading.start();
 for(const cb of [...f.timers.values()])cb();assert.equal(f.nodes['game-loading-retry'].hidden,false);f.retry();assert.equal(calls,0);assert.equal(f.reloads(),1);
 const g=surface();g.window.starushLoading.fail(()=>{calls++;return true;});g.window.starushLoading.start();g.window.starushLoading.ready();assert.equal(g.timers.size,0);assert.equal(g.nodes['game-loading'].hidden,true);
});
test('restart rejection falls back to reload without leaving an inert dead-end',()=>{
 const f=surface();f.window.starushLoading.fail(()=>false);f.retry();assert.equal(f.reloads(),1);
 const g=surface();g.window.starushLoading.fail(()=>{throw Error('scene unavailable');});g.retry();assert.equal(g.reloads(),1);
});
