import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {getPerformerArt, getPerformerRosterVisual} from '../src/systems/ActorPresentation.mjs';
import {PublicShellView} from '../src/systems/PublicShellView.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const source = new URL('../../01-美术/enjo-independent-portrait-source-20261007/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('source_manifest.json', source)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sharp = createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const reviewed = [
  {file:'enjo-portrait.webp', runtime:'public/art/performer-portraits-20260925/enjo-portrait.webp', width:512, height:768,
    bytes:53264, sha256:'2d12225cc708c55b604ddcc3d8d8f89dba3b6624f858ef887cdc558afe9f81ef'},
  {file:'enjo-avatar.webp', runtime:'public/art/performer-portraits-20260925/enjo-avatar.webp', width:256, height:256,
    bytes:15224, sha256:'8541ca4bad27812ef772e277e56267dfb709e2cfba46961e9ad53d060dab3817'},
];

for (const entry of manifest.exports) test(entry.file + ' uses the reviewed independent portrait pixels', () => {
  const candidate = fs.readFileSync(new URL('candidate/' + entry.file, source));
  const runtime = fs.readFileSync(new URL('../' + entry.runtime, import.meta.url));
  assert.equal(sha(candidate), entry.sha256);
  assert.equal(sha(runtime), entry.sha256, 'Enjo still uses the enlarged battle assembly');
  assert.equal(runtime.length, entry.bytes);
  assert.equal(runtime.toString('ascii', 0, 4), 'RIFF');
  assert.equal(runtime.toString('ascii', 8, 12), 'WEBP');
  assert.equal(RUNTIME_PAYLOAD.filter(row => row.file === entry.runtime.slice(7)).length, 1);
});

test('independent portrait retains source lineage and full-figure margins without reopening final or rig gates', () => {
  assert.equal(manifest.identity, 'enjo');
  assert.equal(manifest.source_only, true);
  assert.equal(manifest.ai_assisted, true);
  for (const gate of ['human_paintover', 'final_art', 'runtime_authorized', 'program_authorized',
    'copy_to_runtime', 'approved_for_runtime', 'approved_for_character_bible', 'rig_sdk_ready']) assert.equal(manifest[gate], false);
  assert.equal(manifest.exports.length, 2);
  assert(manifest.exports.reduce((bytes, row) => bytes + row.bytes, 0) < 100_000);
  for (const row of manifest.references) assert.equal(sha(fs.readFileSync(new URL('reference/' + row.file, source))), row.sha256);
  for (const row of manifest.raw) assert.equal(sha(fs.readFileSync(new URL('raw/' + row.name + '.png', source))), row.sha256);
  assert.equal(manifest.raw.length, 1);
  assert.equal(manifest.prompts.length, 1);
  for (const file of manifest.prompts) assert(JSON.parse(fs.readFileSync(new URL(file, source))).prompt.length > 100);
  assert.equal(manifest.selectedRaw, 'raw/enjo-full.png');
  const p = manifest.portraitPlacement;
  assert.deepEqual(p.canvas, [512, 768]);
  assert(p.left >= 18 && p.top >= 24 && p.left + p.width <= 494 && p.top + p.height <= 744);
  assert(!RUNTIME_PAYLOAD.some(row => /enjo-independent-portrait-source|enjo-full|prompts\//.test(row.file)));
});

test('real roster and compact avatar consumers retain Enjo identity without changing the battle bank', () => {
  const art = getPerformerArt('enjo');
  assert.equal(art.path, 'art/performer-motion-20260922/enjo-walk.webp');
  assert.equal(art.frameCount, 48);
  assert.equal(art.fullPortrait, manifest.exports[0].runtime.slice(7));
  assert.equal(art.portrait, manifest.exports[1].runtime.slice(7));
  assert.deepEqual(getPerformerRosterVisual('enjo'), {id:'enjo', kind:'portrait', source:art.fullPortrait, width:512, height:768});
  const view = {element(tag, className, text, parent) {
    const node = {tag, className, text, children:[], dataset:{}, style:{setProperty(){}}, setAttribute(){}};
    parent?.children.push(node); return node;
  }};
  const member = {id:'enjo', identityMark:'X', colorHex:0x123456};
  const full = PublicShellView.prototype.mark.call(view, null, member, true).children[0];
  const avatar = PublicShellView.prototype.mark.call(view, null, member).children[0];
  assert.equal(full.src, "art/five-q-ui-20261013/enjo-portrait.webp"); assert.equal(full.width, 232); assert.equal(full.height, 290);
  assert.equal(avatar.src, "art/five-q-ui-20261013/enjo-avatar.webp"); assert.equal(avatar.width, 128); assert.equal(avatar.height, 128);
});

test('reviewed export selection is fixed independently of editable source manifest', () => {
  assert.deepEqual(manifest.exports, reviewed);
  for (const entry of reviewed) {
    assert.equal(sha(fs.readFileSync(new URL('candidate/' + entry.file, source))), entry.sha256);
    assert.equal(sha(fs.readFileSync(new URL('../' + entry.runtime, import.meta.url))), entry.sha256);
  }
});

test('reviewed exports reconstruct from the selected raw with real decoded margins', async () => {
  for (const entry of reviewed) {
    const meta = await sharp(fs.readFileSync(new URL('../' + entry.runtime, import.meta.url))).metadata();
    assert.deepEqual([meta.width, meta.height], [entry.width, entry.height]);
  }
  const portrait = fs.readFileSync(new URL('../' + reviewed[0].runtime, import.meta.url));
  assert.equal((await sharp(portrait).metadata()).hasAlpha, true);
  const bounds = async bytes => {
    const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left = info.width, top = info.height, right = -1, bottom = -1, transparent = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha === 0) transparent++;
      if (alpha > 8) {left = Math.min(left,x); top = Math.min(top,y); right = Math.max(right,x); bottom = Math.max(bottom,y);}
    }
    return {crop:{left, top, width:right-left+1, height:bottom-top+1}, right, bottom, transparent};
  };
  const actual = await bounds(portrait);
  assert(actual.crop.left >= 18 && actual.crop.top >= 24 && actual.right < 494 && actual.bottom < 744);
  assert(actual.transparent > 100_000);
  const raw = fs.readFileSync(new URL('raw/enjo-full.png', source));
  assert.equal(sha(raw), '7093668a33bb37022ff0142fc94865b537afb47abf094cefa4bd5c6b1cc1bed4');
  const crop = (await bounds(raw)).crop;
  assert.deepEqual(manifest.crop, crop);
  const resized = await sharp(raw).extract(crop).resize(476,716,{fit:'inside'}).png().toBuffer();
  const size = await sharp(resized).metadata();
  const left = Math.floor((512-size.width)/2), top = Math.floor((768-size.height)/2);
  assert.deepEqual(manifest.portraitPlacement, {left, top, width:size.width, height:size.height, canvas:[512,768]});
  const full = await sharp({create:{width:512,height:768,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:resized,left,top}]).webp({quality:92,alphaQuality:100,effort:5}).toBuffer();
  const face = {left:365,top:5,width:310,height:310};
  assert.deepEqual(manifest.avatarCrop, face);
  const avatar = await sharp(raw).extract(face).resize(256,256).flatten({background:'#EDF3F6'})
    .webp({quality:92,effort:5}).toBuffer();
  assert.equal(sha(full), reviewed[0].sha256);
  assert.equal(sha(avatar), reviewed[1].sha256);
  assert.equal(sha(portrait), sha(full));
  assert.equal(sha(fs.readFileSync(new URL('../' + reviewed[1].runtime, import.meta.url))), sha(avatar));
});
