import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {bindMobileOrientation} from '../src/utils/gameViewport.mjs';

function fixture({landscape=false,touch=true}={}){
 const host=new EventTarget(),events=new EventEmitter(),container={inert:false},banner={hidden:true},loading={hidden:true};
 Object.assign(host,{innerWidth:landscape?667:375,innerHeight:landscape?375:667,matchMedia:()=>({matches:touch}),document:{getElementById:id=>id==='game-container'?container:id==='game-loading'?loading:banner}});
 const scenes=[],game={events,scene:{getScenes:()=>scenes}},rotate=landscape=>{host.innerWidth=landscape?667:375;host.innerHeight=landscape?375:667;host.dispatchEvent(new Event('resize'));};
 const battle=()=>{const session={battle:true,calls:0,interrupt(){this.calls++;}};return {_sessionExperience:session};};
 const dispose=bindMobileOrientation(game,host);
 return {host,events,container,banner,loading,scenes,game,rotate,battle,dispose};
}

test('battle loaded after landscape activation is interrupted once without another resize',()=>{
 const f=fixture();f.rotate(true);assert(f.container.inert&&!f.banner.hidden);
 const scene=f.battle();f.scenes.push(scene);f.events.emit('poststep');
 assert.equal(scene._sessionExperience.calls,1,'landscape must also protect a battle created after the resize');
 for(let i=0;i<20;i++)f.events.emit('poststep');assert.equal(scene._sessionExperience.calls,1);f.dispose();
});

test('a scene whose session is attached later cannot escape the active orientation guard',()=>{
 const f=fixture({landscape:true}),scene={};f.scenes.push(scene);f.events.emit('poststep');
 scene._sessionExperience=f.battle()._sessionExperience;f.events.emit('poststep');assert.equal(scene._sessionExperience.calls,1);f.dispose();
});

test('scene restart gets its own interruption while the same old session is not reopened',()=>{
 const f=fixture({landscape:true}),scene=f.battle();f.scenes.push(scene);f.events.emit('poststep');
 const previous=scene._sessionExperience;scene._sessionExperience=f.battle()._sessionExperience;f.events.emit('poststep');
 assert.equal(previous.calls,1);assert.equal(scene._sessionExperience.calls,1);f.dispose();
});

test('portrait removes the frame listener and the next rotation can interrupt the same session again',()=>{
 const f=fixture(),scene=f.battle();f.scenes.push(scene);assert.equal(f.events.listenerCount('poststep'),0);
 f.rotate(true);assert.equal(scene._sessionExperience.calls,1);assert.equal(f.events.listenerCount('poststep'),1);
 f.rotate(true);assert.equal(f.events.listenerCount('poststep'),1);assert.equal(scene._sessionExperience.calls,1);
 f.rotate(false);assert.equal(f.events.listenerCount('poststep'),0);assert.equal(f.container.inert,false);assert.equal(f.banner.hidden,true);
 f.events.emit('poststep');assert.equal(scene._sessionExperience.calls,1);f.rotate(true);assert.equal(scene._sessionExperience.calls,2);f.dispose();
});

test('menus stay untouched while every new active battle session is protected',()=>{
 const f=fixture({landscape:true}),menu={_sessionExperience:{battle:false,interrupt(){throw Error('menu must not interrupt');}}};
 const first=f.battle(),second=f.battle();f.scenes.push(menu,first,second);f.events.emit('poststep');
 assert.equal(first._sessionExperience.calls,1);assert.equal(second._sessionExperience.calls,1);f.dispose();
});

test('dispose is idempotent and removes orientation/frame hooks without releasing the loading owner',()=>{
 const f=fixture({landscape:true}),scene=f.battle();f.scenes.push(scene);f.events.emit('poststep');f.loading.hidden=false;
 f.dispose();f.dispose();assert.equal(f.events.listenerCount('poststep'),0);assert.equal(f.banner.hidden,true);assert.equal(f.container.inert,true);
 f.events.emit('poststep');f.rotate(false);f.rotate(true);assert.equal(scene._sessionExperience.calls,1);
});

test('desktop landscape does not install mobile frame polling or interrupt play',()=>{
 const f=fixture({landscape:true,touch:false}),scene=f.battle();f.scenes.push(scene);f.events.emit('poststep');f.rotate(true);
 assert.equal(scene._sessionExperience.calls,0);assert.equal(f.events.listenerCount('poststep'),0);assert.equal(f.container.inert,false);f.dispose();
});
