import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const file=new URL('../src/utils/graphicsRecovery.mjs',import.meta.url);
const exists=fs.existsSync(file),api=exists?await import(file):{};
function fixture(){
 const canvas=new EventTarget(),log=[],scene={_sessionExperience:{releaseInput(){log.push('release-input');}}};
 const game={canvas,renderer:{gl:{isContextLost:()=>false}},input:{enabled:true},sound:{stopAll(){log.push('stop-audio');}},
  scene:{getScenes:()=>[scene],stop(target){assert.equal(target,scene);log.push('scene-shutdown');}},destroy(remove){log.push(['destroy',remove]);}};
 const host={starushLoading:{hold(text,retry){log.push(['hold',text,retry]);}}};
 return {canvas,game,host,log};
}
test('graphics loss binding exists and is owned by postBoot/destroy, not a scene restart',()=>{
 assert(exists,'Missing game-level WebGL recovery binding');
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/bindGraphicsRecovery\(game\)/);
 assert.match(main,/game\.events\.once\(Phaser\.Core\.Events\.DESTROY, disposeGraphicsRecovery\)/);
});
test('loss stops the exact damaged game once with visible reload warning and no save command',()=>{
 assert.equal(typeof api.bindGraphicsRecovery,'function');
 const {canvas,game,host,log}=fixture(),dispose=api.bindGraphicsRecovery(game,host);
 canvas.dispatchEvent(new Event('webglcontextlost'));
 assert.equal(game.input.enabled,false);
 assert.equal(log[0][0],'hold');assert.equal(log[0][2],true);
 assert.match(log[0][1],/未保存/);assert.match(log[0][1],/重新加载/);
 assert.deepEqual(log.slice(1),['release-input','scene-shutdown','stop-audio',['destroy',true]]);
 canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(log.length,5);
 canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(log.length,5,'restored textures must not restart an unverified damaged run');
 dispose();dispose();canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(log.length,5);
});
test('normal destroy unbinds without showing recovery or blocking a healthy game',()=>{
 assert.equal(typeof api.bindGraphicsRecovery,'function');
 const f=fixture(),dispose=api.bindGraphicsRecovery(f.game,f.host);dispose();
 f.canvas.dispatchEvent(new Event('webglcontextlost'));assert.deepEqual(f.log,[]);assert.equal(f.game.input.enabled,true);
});
test('already-lost boot and missing optional sound/session are safe without duplicating destroy',()=>{
 assert.equal(typeof api.bindGraphicsRecovery,'function');
 const f=fixture();f.game.renderer.gl.isContextLost=()=>true;f.game.sound=null;f.game.scene.getScenes=()=>[]; 
 const dispose=api.bindGraphicsRecovery(f.game,f.host);
 assert.equal(f.game.input.enabled,false);assert.deepEqual(f.log.at(-1),['destroy',true]);dispose();
 assert.doesNotThrow(()=>api.bindGraphicsRecovery({},{})());
});
function hints(cast){
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script id="first-visit-preview-preload">([\s\S]*?)<\/script>/)[1],links=[];
 const root={dataset:{page:'desk',cast},isConnected:true,querySelector:()=>({}),querySelectorAll:()=>[{complete:true,naturalWidth:20}],
  addEventListener(){},removeEventListener(){}};
 const window={};vm.runInNewContext(script,{window,URLSearchParams,location:{search:''},navigator:{},
  localStorage:{getItem:()=>null},document:{createElement:()=>({}),head:{append:l=>links.push(l)}}});
 window.starushFirstBattlePreload(root);return links;
}
test('current owner cast never speculates obsolete Sakura banks; legacy hint remains bounded',()=>{
 assert.deepEqual(hints('owner-three'),[],'Current cast is downloading four unused old-character files');
 assert.equal(hints('legacy').length,4);
 const shell=fs.readFileSync(new URL('../src/systems/PublicShellView.mjs',import.meta.url),'utf8');
 assert.match(shell,/this\.root\.dataset\.cast\s*=\s*isUserCastEnabled\(\)\s*\?\s*'owner-three'\s*:\s*'legacy'/);
});
