import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_MENU_ART} from '../src/systems/PublicMenuArt.mjs';
import {MOBILE_LOBBY_BACKGROUND} from '../src/systems/MobileGameScreens.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const base='art/playable-ui-20261018/';
test('actual menu uses local candidate scene and system bitmap identities',()=>{
 assert.equal(MOBILE_LOBBY_BACKGROUND,'art/home-comic-backstage-20261022/backstage.webp');
 for(const [id,file]of Object.entries({members:'members',route:'tour',bag:'equipment',records:'records',training:'training',journal:'records'}))assert.equal(PUBLIC_MENU_ART[id],base+file+'.webp');
});
test('candidate release includes only twelve consumed raster exports, never source viewer',()=>{
 const rows=RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(base));assert.equal(rows.length,12);
 assert.equal(new Set(rows.map(r=>r.file)).size,12);
 assert(rows.every(r=>r.group==='owner-ui'));assert(!rows.some(r=>r.file.endsWith('/selected.webp')));
 assert(rows.every(r=>r.file.endsWith('.webp')&&!/raw|reference|manifest|preview|state/.test(r.file)));
});
test('primary and title use protected endcaps instead of whole-raster nonuniform stretch',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert(css.includes('/'+base+'primary.webp'));
 assert.match(css,/border-image:[^;]*playable-ui-20261018\/secondary\.webp[^;]*24 240 fill/);
 assert(!/playable-ui-20261018\/(?:primary|secondary|title)\.webp[^;]*100% 100%/.test(css));
 assert.match(css,/\.lobby-background[^}]*height:100%/);
});
test('live candidate keeps a single four-button navigation and read-only preparation tools',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene);h.scene.create();const before=plain(e.profile.loadPublicProfile());
 assert.equal(h.all('.shell-navigation').length,1);
 assert.deepEqual(h.query('.shell-navigation').children.map(button=>button.dataset.nav),['desk','roster','tour','inventory']);
 h.click('[data-action=start]');
 for(const action of ['preflight-member','preflight-training','preflight-equipment','preflight-goals','preflight-arrangement'])assert(h.query('[data-action='+action+']'));
 h.click('[data-action=preflight-arrangement]');
 assert(h.query('[data-action=preflight-library]'));
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);assert.equal(h.starts.length,0);h.shutdown();
});
test('settings image failure retains a visible standard icon and the real command',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 const button=h.query('[data-action=settings]'),image=button.querySelector('img');assert(image);
 image.dispatchEvent({type:'error'});
 assert(!button.querySelector('img'),'broken bitmap must be removed');assert(button.querySelector('svg'),'settings needs a visible fallback');
 assert.equal(button.getAttribute('aria-label'),'声音与演出设置');h.shutdown();
});
