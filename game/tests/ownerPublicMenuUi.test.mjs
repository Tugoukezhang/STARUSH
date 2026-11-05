import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {shellIcons} from '../src/vendor/shellIcons.mjs';

test('nineteen menu exports are explicit, hash-locked, and do not publish their source sheets',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../01-美术/owner-public-menu-ui-20261015/manifest.json',import.meta.url)));
 const rows=RUNTIME_PAYLOAD.filter(a=>a.file.startsWith('art/owner-public-menu-ui-20261015/'));
 assert.equal(rows.length,19);assert.equal(manifest.assets.length,19);assert.equal(manifest.textBaked,false);
 for(const row of rows){const m=manifest.assets.find(a=>a.file===row.file);assert(m);
  assert.equal(m.alpha,m.id!=='lobby');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/'+row.file,import.meta.url))).digest('hex'),m.sha256);
 }
 assert(!rows.some(a=>/source|manifest|\.png$/.test(a.file)));
});

test('current root navigation uses consistent Lucide symbols while content retains its authored art',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();
 for(const [nav,key]of [['desk','clapperboard'],['roster','users'],['tour','route'],['inventory','backpack'],['records','book-open']]){
  const b=h.query('.shell-navigation').querySelector(`[data-nav=${nav}]`),svg=b.querySelector('svg');
  assert(svg,'missing '+nav+' Lucide symbol');assert.equal(b.querySelector('.menu-art'),null);
  assert.equal(svg.getAttribute('viewBox'),'0 0 24 24');assert.equal(svg.children.length,shellIcons[key].length);
  shellIcons[key].forEach(([tag,attrs],i)=>{assert.equal(svg.children[i].tagName,tag.toUpperCase());for(const [k,v]of Object.entries(attrs))assert.equal(svg.children[i].getAttribute(k),String(v));});
  assert(b.getAttribute('aria-label'));
 }
 const before=plain(e.profile.loadPublicProfile());h.scene._publicShell.showPage('library');
 for(const id of ['wide_brush','relay','tempo','echo','overdrive','recovery']){
  const b=h.query(`[data-arrangement=${id}]`);assert.equal(b.querySelector('.menu-art').src,`art/formal-ui-20261016/${id==='wide_brush'?'nozzle':id}.webp`);
 }
 h.click('[data-arrangement=relay]');assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});

test('equipment art follows item identity while unavailable equip stays disabled and planning stays read-only',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('inventory');
 const before=plain(e.profile.loadPublicProfile());
 for(const [id,path]of [['wide_nozzle','art/formal-ui-20261016/nozzle.webp'],['rhythm_sync','art/formal-ui-20261016/tempo.webp'],['focus_lens','art/formal-ui-20261016/lens.webp']]){
  const b=h.query(`[data-inventory-item=${id}]`),img=b.querySelector('.menu-art');assert(img,'missing '+id+' authored icon');assert.equal(img.src,path);assert.equal(b.dataset.state,'locked');
  h.click(`[data-inventory-item=${id}]`);assert.equal(h.query('[data-action=equip-selected]').disabled,true);
 }
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.scene._publicShell.showPage('growth');
 h.click('[data-growth-rank="3"]');h.click('[data-growth-equipment=focus_lens]');
 assert(h.query('.growth-preview').textContent.includes('未应用'));assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});
