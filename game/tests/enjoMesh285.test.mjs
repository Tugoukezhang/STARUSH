import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const root=new URL('../',import.meta.url);
test('Enjo explicitly uses the reviewed mesh-avatar candidate, not the retired blink overlay',()=>{
  const source=readFileSync(new URL('src/systems/EnjoContinuousPortrait.mjs',root),'utf8');
  assert.match(source,/portraits\/enjo-286\/renderer.js/);
  assert.doesNotMatch(source,/portraits\/enjo-277\/renderer.js/);
});
test('candidate ships own matching-aspect rig and MIT notice without sample artwork',()=>{
  const files=unzipSync(readFileSync(new URL('public/portraits/enjo-285/enjo.mavatar',root)));
  const rig=JSON.parse(new TextDecoder().decode(files['rig.json']));
  assert.deepEqual(rig.image,{width:1024,height:1536});assert.equal(rig.eyes.length,2);
  assert.equal(rig.view.padTop,0);assert.equal(rig.view.padSide,0);
  assert.ok(files['built/hairmask.png']);assert.ok(!files['source.png']);
  assert.ok(Object.keys(files).every(k=>!k.toLowerCase().includes('miko')));
  assert.match(readFileSync(new URL('public/portraits/enjo-285/LICENSE.mesh-avatar.txt',root),'utf8'),/MIT License/);
  for(const file of ['renderer.js','mesh-avatar.js','rig.json','avatar.json','built/base.png','LICENSE.mesh-avatar.txt'])
    assert.ok(RUNTIME_PAYLOAD.some(row=>row.file==='portraits/enjo-285/'+file));
  const renderer=readFileSync(new URL('public/portraits/enjo-285/renderer.js',root),'utf8');
  assert.match(renderer,/loadMeshAvatar\(canvas,new URL\('\.\/',import.meta.url\)/);
  assert.doesNotMatch(renderer,/enjo\.mavatar/);
  assert.deepEqual(JSON.parse(readFileSync(new URL('public/portraits/enjo-285/rig.json',root),'utf8')),rig);
});
