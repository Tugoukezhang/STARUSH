import test from 'node:test';
import assert from 'node:assert/strict';
import * as viewport from '../src/utils/gameViewport.mjs';
test('small touch landscape is protected, desktop and portrait remain playable',()=>{
 assert.equal(typeof viewport.needsPortraitProtection,'function');
 assert.equal(viewport.needsPortraitProtection({width:667,height:375,touch:true}),true);
 for(const input of [{width:375,height:667,touch:true},{width:1280,height:800,touch:true},{width:667,height:375,touch:false},{width:0,height:375,touch:true}])assert.equal(viewport.needsPortraitProtection(input),false);
});
test('rotation releases input via interruption and requires explicit resume after return',()=>{
 assert.equal(typeof viewport.bindMobileOrientation,'function');
 const host=new EventTarget(),container={inert:false},banner={hidden:true};let calls=0,menuCalls=0;
 const loading={hidden:true};
 Object.assign(host,{innerWidth:375,innerHeight:667,matchMedia:()=>({matches:true}),document:{getElementById:id=>id==='game-container'?container:id==='game-loading'?loading:banner}});
 const scene={_sessionExperience:{battle:true,interrupt:()=>calls++}},menu={_sessionExperience:{battle:false,interrupt:()=>menuCalls++}},game={scene:{getScenes:()=>[scene,menu]}};
 const dispose=viewport.bindMobileOrientation(game,host);assert.equal(calls,0);
 host.innerWidth=667;host.innerHeight=375;host.dispatchEvent(new Event('resize'));
 assert.equal(calls,1);assert.equal(menuCalls,0,'menu must not receive a battle interruption');assert.equal(container.inert,true);assert.equal(banner.hidden,false);
 host.dispatchEvent(new Event('resize'));assert.equal(calls,1,'one interruption per orientation transition');
 host.innerWidth=375;host.innerHeight=667;host.dispatchEvent(new Event('resize'));assert.equal(container.inert,false);assert.equal(banner.hidden,true);assert.equal(calls,1);
 dispose();host.innerWidth=667;host.innerHeight=375;host.dispatchEvent(new Event('resize'));assert.equal(calls,1);
 loading.hidden=false;container.inert=true;
 const stop=viewport.bindMobileOrientation(game,host);
 loading.hidden=true;host.innerWidth=375;host.innerHeight=667;host.dispatchEvent(new Event('resize'));
 assert.equal(container.inert,false,'initial landscape loading must not leave a stale inert owner');stop();
});
