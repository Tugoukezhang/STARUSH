import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
test('programme and practice headers use native names; secondary commands and sheets identify the same destination',()=>{
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed([]);
 const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 h.click('[data-action=home-open-backstage]');h.click('[data-action=backstage-open-events]');
 assert.equal(h.query('.showbill-title').textContent,'公演企划');
 for(const [action,key]of [['events-chapters','chapters'],['events-goal-info','goal-info']]){
  assert.equal(h.query('[data-action='+action+']').querySelector('.pg-sr').textContent,key==='chapters'?'章节进度':'目标详情');
  assert.equal(h.query('[data-action='+action+']').querySelector('.pg-letter').src,'art/program-studio-20261101/letter-'+key+'.webp');
  h.click('[data-action='+action+']');assert.equal(h.query('dialog').querySelector('.ui-sheet-title').querySelector('.pg-letter').src,'art/program-studio-20261101/letter-'+key+'.webp');h.click('[data-action=sheet-close]');
 }
 h.click('[data-action=back]');h.click('[data-action=backstage-open-sideplay]');assert.equal(h.query('.showbill-title').textContent,'练习广场');h.shutdown();
});
test('new generated components are explicit payload entries and final art remains unapproved',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/program-ui-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.engineSelectable,false);assert.equal(manifest.approved_for_final_art,false);assert.equal(manifest.assets.length,8);assert.equal(manifest.alphaCorner[3],0);
 const shipped=RUNTIME_PAYLOAD.filter(row=>row.group==='owner-program-studio').map(row=>row.file).sort();
 assert.deepEqual(manifest.assets.map(asset=>asset.file).sort(),shipped);
 for(const asset of manifest.assets){
  const bytes=fs.readFileSync(new URL('../public/'+asset.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(asset.topLeftRGBA[3],asset.file.includes('/letter-')?0:255);
 }
 const css=fs.readFileSync(new URL('../src/styles/programArt267.css',import.meta.url),'utf8');assert.doesNotMatch(css,/scaleX|font-stretch|letter-spacing:\s*-/);assert.match(css,/object-fit:contain/);
});
