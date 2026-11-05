import test from'node:test';import assert from'node:assert/strict';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
test('playable model, WASM, loader and MIT notice have exact release payload entries',()=>{
 const files=RUNTIME_PAYLOAD.map(r=>r.file);for(const file of ['rigs/companion-sakura-20261031/sakura.p2lrt','vendor/psd2live-3.6.6/p2l.js','vendor/psd2live-3.6.6/p2l_runtime.wasm','vendor/psd2live-3.6.6/LICENSE.txt'])assert.equal(files.filter(f=>f===file).length,1,file);
 assert(!files.some(f=>/neck-underfill|sakura-native-pixels|\.psd$|rig-registered|head-original/.test(f)),'source and failed rigs never enter release');
});
