import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('context loss while renderer awaits assets cannot be overwritten by late success',async()=>{
 const source=readFileSync(new URL('../src/systems/EnjoContinuousPortrait.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/,'').replace('export function','function').replace(/import\(\/\* @vite-ignore \*\/ new URL\([^\n]+?\)\.href\)/,'rendererPromise');
 let resolvePlayer;const pending=new Promise(r=>resolvePlayer=r),rendererPromise=Promise.resolve({createEnjoPortrait:()=>pending});
 const mount=new Function('getPortraitBase','rendererPromise',source+';return mountEnjoContinuousPortrait;')(()=>({height:1536,bounds:{height:1325,y:111}}),rendererPromise);
 const nodes=[],view={disposed:false,navigating:false,doc:{baseURI:'http://localhost/'},element(tag){const n=new EventTarget();Object.assign(n,{style:{},dataset:{},setAttribute(){},remove(){}});nodes.push(n);return n;}};
 const parent={dataset:{}},original={hidden:false};const dispose=mount(view,parent,original);await Promise.resolve();await Promise.resolve();
 nodes[1].dispatchEvent(new Event('webglcontextlost',{cancelable:true}));assert.equal(parent.dataset.portraitState,'unavailable');
 let releases=0;resolvePlayer({dispose(){releases++;}});await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(parent.dataset.portraitState,'unavailable');assert.equal(nodes[0].style.visibility,'hidden');assert.equal(releases,1);
 dispose();assert.equal(releases,1);
});
