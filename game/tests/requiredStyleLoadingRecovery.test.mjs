import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=id=>html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))?.[1];
function fixture(){
 const listeners={},timers=new Map(),nodes=Object.fromEntries(['game-loading','game-loading-message','game-loading-retry','game-container','portrait-protection'].map(id=>[id,{hidden:id==='portrait-protection',inert:false,dataset:{},addEventListener(type,fn){this[type]=fn;}}]));
 let timerId=0,reloads=0;
 const window={addEventListener(type,fn){(listeners[type]??=[]).push(fn);},location:{reload:()=>reloads++}};
 const context=vm.createContext({window,document:{getElementById:id=>nodes[id]},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 const early=script('game-style-recovery-bootstrap');if(early)vm.runInContext(early,context);
 const error=target=>(listeners.error??[]).forEach(fn=>fn({target}));
 return {nodes,window,timers,error,boot:()=>vm.runInContext(script('game-loading-bootstrap'),context),reloads:()=>reloads};
}
const css={tagName:'LINK',rel:'stylesheet'};
test('required styles have a failure observer before requests can fail',()=>{
 assert(script('game-style-recovery-bootstrap'),'missing early required-style recovery observer');
 assert(html.indexOf('id="game-style-recovery-bootstrap"')<html.indexOf('rel="stylesheet"'));
});
test('early CSS failure survives bootstrap start, profile acquisition and scene ready',()=>{
 const f=fixture();f.error(css);f.boot();f.window.starushLoading.start();f.window.starushLoading.progress(.9);f.window.starushLoading.ready();
 assert.equal(f.nodes['game-loading'].dataset.state,'error');assert.equal(f.nodes['game-loading'].hidden,false);
 assert.equal(f.nodes['game-container'].inert,true);assert.equal(f.nodes['game-loading-retry'].hidden,false);assert.equal(f.timers.size,0);
});
test('late CSS failure brings back visible recovery and cannot be cleared by ready',()=>{
 const f=fixture();f.boot();f.window.starushLoading.ready();assert.equal(f.nodes['game-loading'].hidden,true);
 f.error(css);f.window.starushLoading.ready();
 assert.equal(f.nodes['game-loading'].dataset.state,'error');assert.equal(f.nodes['game-loading'].hidden,false);assert.equal(f.nodes['game-container'].inert,true);
});
test('icons, previews, image faults and ordinary runtime errors are not required CSS',()=>{
 const f=fixture();f.boot();for(const target of [{tagName:'LINK',rel:'icon'},{tagName:'LINK',rel:'preload'},{tagName:'IMG'},undefined])f.error(target);
 f.window.starushLoading.ready();assert.equal(f.nodes['game-loading'].hidden,true);assert.equal(f.nodes['game-container'].inert,false);
});
test('successful start and ready retain existing orientation input protection',()=>{
 const f=fixture();f.boot();f.window.starushLoading.progress(.5);assert.match(f.nodes['game-loading-message'].textContent,/50%/);
 f.nodes['portrait-protection'].hidden=false;f.window.starushLoading.ready();assert.equal(f.nodes['game-loading'].hidden,true);assert.equal(f.nodes['game-container'].inert,true);assert.equal(f.timers.size,0);
});
test('style retry remains explicit reload and leaves no timeout behind',()=>{
 const f=fixture();f.boot();f.error(css);f.nodes['game-loading-retry'].click();assert.equal(f.reloads(),1);assert.equal(f.timers.size,0);
});
