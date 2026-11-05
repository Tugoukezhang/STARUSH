import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {GRAFFITI_GROUND} from '../src/systems/GraffitiPaintBrush.mjs';
import {MOBILE_LOBBY_BACKGROUND} from '../src/systems/MobileGameScreens.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const base='art/comic-ui-20261021/',css=()=>fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
test('ground consumes the directional authored ink bank without changing its key or dimensions',()=>{
 assert.equal(GRAFFITI_GROUND.key,'graffiti-ground');assert.equal(GRAFFITI_GROUND.path,'art/comic-ground-ribbons-20261022/ground-v2.png');
 const p=fs.readFileSync(new URL('../public/'+GRAFFITI_GROUND.path,import.meta.url));assert.equal(p.readUInt32BE(16),1024);assert.equal(p.readUInt32BE(20),256);assert.equal(p[25],6);
});
test('only the seven reviewed exports enter the release; old source is kept outside shipment',()=>{
 const expected=[base+'logo.png',base+'encore.png',base+'rifle.png',base+'panel.png',base+'lobby.webp','art/comic-ground-ribbons-20261022/ground-v2.png','art/rifle-idle-20261021/idle.png'].sort();
 const rows=RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(base)||/comic-ground-|rifle-idle-20261021/.test(r.file));assert.deepEqual(rows.map(r=>r.file).sort(),expected);
 assert(!RUNTIME_PAYLOAD.some(r=>r.file==='art/comic-ground-20261021/ground.png'));assert(fs.existsSync(new URL('../public/art/comic-ground-20261021/ground.png',import.meta.url)));
 assert(!RUNTIME_PAYLOAD.some(r=>r.file==='art/graffiti-combat-20261018/ground.webp'));assert(fs.existsSync(new URL('../public/art/graffiti-combat-20261018/ground.webp',import.meta.url)));
 for(const r of rows)assert(fs.existsSync(new URL('../public/'+r.file,import.meta.url)));
});
test('brand raster retains its accessible name and falls back to native heading on load failure',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();const image=h.query('.shell-brand-art');assert(image);assert.equal(image.src,base+'logo.png');assert.equal(image.alt,'');assert(h.query('h1').textContent.includes('ST☆RUSH'));
 image.onerror();assert(!h.query('.shell-brand-art'));assert(h.query('h1').textContent.includes('ST☆RUSH'));assert(h.query('[data-action=start]'));h.shutdown();
});
test('lobby uses the record-shop scene while keeping existing original character images',()=>{
 assert.equal(MOBILE_LOBBY_BACKGROUND,'art/home-comic-backstage-20261022/backstage.webp');const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();assert(h.query('.lobby-character').src.includes('user-cast-20261015/cat-rifle.webp'));h.shutdown();
});
test('illustrated commands preserve live captions and have bounded entry motion with a reduce path',()=>{
 const s=css();assert(s.includes('/'+base+'panel.png'));for(const file of ['encore.png','rifle.png','sword.png','hammer.png'])assert(s.includes('/art/skill-command-20261022/'+file));assert.match(s,/@keyframes comic-command-arrive/);assert.match(s,/@keyframes comic-home-arrive/);assert.match(s,/prefers-reduced-motion:reduce/);
 assert.match(s,/#encore-state[^}]*font-size:14px/);assert.match(s,/#special-state[^}]*font-size:14px/);assert.doesNotMatch(s,/animation:[^;]*comic-command-arrive[^;]*infinite/);
});
test('ink export and one-eye cel are bounded actual bitmaps, not raw generation sheets',()=>{
 const png=fs.readFileSync(new URL('../public/art/rifle-idle-20261021/idle.png',import.meta.url));assert.equal(png.readUInt32BE(16),384);assert.equal(png.readUInt32BE(20),320);assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'e0a8c1160e9304b80c78f40aa69fc23a56812387c4899de1c3c021d72eccb3a9');
 for(const file of ['logo.png','encore.png','rifle.png','panel.png']){const b=fs.readFileSync(new URL('../public/'+base+file,import.meta.url));assert(b.readUInt32BE(16)<=560);assert(b.readUInt32BE(20)<=200);}
});
