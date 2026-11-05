import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {PUBLIC_MENU_ART} from '../src/systems/PublicMenuArt.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

test('formal UI consumes the new coherent icon family instead of legacy gold menu chrome',()=>{
 for(const id of ['home','hub','goals','notes','nozzle','lens','tempo','relay','echo','overdrive','recovery'])
  assert.equal(PUBLIC_MENU_ART[id],'art/formal-ui-20261016/'+id+'.webp',id);
 for(const [id,file]of Object.entries({members:'members',route:'tour',bag:'equipment',records:'records',training:'training',journal:'records'}))
  assert.equal(PUBLIC_MENU_ART[id],'art/playable-ui-20261018/'+file+'.webp',id);
});

test('home keeps one character hero and explicitly groups the secondary session facts without writes',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();const before=plain(e.profile.loadPublicProfile());
 assert(h.query('[data-home-details]'),'home long-form progress needs an explicit secondary disclosure');
 assert(h.query('[data-home-details]').querySelector('[data-home-last-run]'));
 assert(h.query('.lobby-stage'));assert(h.query('[data-action=start]'));assert(h.query('[data-action=preflight]'));
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});

test('preflight visually identifies the actual member and venue without applying a build or starting',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();const before=plain(e.profile.loadPublicProfile());
 h.click('[data-action=preflight]');
 const hero=h.query('.preflight-hero');assert(hero,'missing purpose-built preparation hero');
 assert.equal(hero.dataset.performer,'sakura');assert.equal(hero.dataset.chapter,'opening');
 assert(hero.querySelector('img'));assert(h.query('[data-action=preflight-member]'));
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);assert.equal(h.starts.length,0);h.shutdown();
});

test('one final stylesheet owns the matte UI and no longer imports blue-gold legacy surfaces',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert(css.includes('/art/playable-ui-20261018/primary.webp'));
 assert(!/owner-public-menu-ui-20261015|owner-battle-ui-20261015|user-cast-ui-20261015/.test(css));
 for(const name of ['.lobby-shortcut-copy','.system-entry-copy','.lobby-session-action','.growth-comparison-labels','.session-panel','.battle-choice-row'])assert(css.includes(name),name);
 assert(!/font-size:\s*[^;]*(?:vw|cqw)|letter-spacing:\s*-/.test(css));
});

test('wide sword owner has a full-width lobby frame and an inset preparation figure',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert.match(css,/\.lobby-stage \.lobby-member-visual\[data-performer=kai\][^{]*\{[^}]*max-width:none/);
 assert.match(css,/\.preflight-hero\[data-performer=kai\] \.preflight-figure\s*\{[^}]*right:8px/);
});

test('formal UI runtime candidates are explicit hash locked images with source sheets excluded',()=>{
 const file=new URL('../../01-美术/formal-ui-20261016/manifest.json',import.meta.url);
 assert(fs.existsSync(file),'formal UI export manifest missing');
 const manifest=JSON.parse(fs.readFileSync(file));assert.equal(manifest.assets.length,29);assert.equal(manifest.textBaked,false);
 const rows=RUNTIME_PAYLOAD.filter(x=>x.file.startsWith('art/formal-ui-20261016/'));assert.equal(rows.length,29);
 for(const row of rows){
  const item=manifest.assets.find(x=>x.file===row.file);assert(item,row.file);
  const bytes=fs.readFileSync(new URL('../public/'+row.file,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
 }
 assert(!rows.some(x=>/source|manifest|reference|[.]png$/.test(x.file)));
});
