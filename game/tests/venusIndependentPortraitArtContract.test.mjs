import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPerformerArt, getPerformerRosterVisual} from '../src/systems/ActorPresentation.mjs';
import {PublicShellView} from '../src/systems/PublicShellView.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const source = new URL('../../01-美术/venus-independent-portrait-source-20261007/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('source_manifest.json', source)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

for (const entry of manifest.exports) test(entry.file + ' uses the reviewed independent portrait pixels', () => {
  const candidate = fs.readFileSync(new URL('candidate/' + entry.file, source));
  const runtime = fs.readFileSync(new URL('../' + entry.runtime, import.meta.url));
  assert.equal(sha(candidate), entry.sha256);
  assert.equal(sha(runtime), entry.sha256, 'Venus still uses the enlarged battle assembly');
  assert.equal(runtime.length, entry.bytes);
  assert.equal(runtime.toString('ascii', 0, 4), 'RIFF');
  assert.equal(runtime.toString('ascii', 8, 12), 'WEBP');
  assert.equal(RUNTIME_PAYLOAD.filter(row => row.file === entry.runtime.slice(7)).length, 1);
});

test('independent portrait retains source lineage and full-figure margins without reopening final or rig gates', () => {
  assert.equal(manifest.identity, 'venus');
  assert.equal(manifest.source_only, true);
  assert.equal(manifest.ai_assisted, true);
  for (const gate of ['human_paintover', 'final_art', 'runtime_authorized', 'program_authorized',
    'copy_to_runtime', 'approved_for_runtime', 'approved_for_character_bible', 'rig_sdk_ready']) assert.equal(manifest[gate], false);
  assert.equal(manifest.exports.length, 2);
  assert(manifest.exports.reduce((bytes, row) => bytes + row.bytes, 0) < 100_000);
  for (const row of manifest.references) assert.equal(sha(fs.readFileSync(new URL('reference/' + row.file, source))), row.sha256);
  for (const row of manifest.raw) assert.equal(sha(fs.readFileSync(new URL('raw/' + row.name + '.png', source))), row.sha256);
  for (const file of manifest.prompts) assert(JSON.parse(fs.readFileSync(new URL(file, source))).prompt.length > 100);
  assert.equal(manifest.selectedRaw, 'raw/venus-full.png');
  const p = manifest.portraitPlacement;
  assert.deepEqual(p.canvas, [512, 768]);
  assert(p.left >= 18 && p.top >= 24 && p.left + p.width <= 494 && p.top + p.height <= 744);
  assert(!RUNTIME_PAYLOAD.some(row => /venus-independent-portrait-source|venus-full|prompts\//.test(row.file)));
});

test('real roster and compact avatar consumers retain Venus identity without changing the battle bank', () => {
  const art = getPerformerArt('venus');
  assert.equal(art.path, 'art/performer-motion-20260922/venus-walk.webp');
  assert.equal(art.frameCount, 48);
  assert.equal(art.fullPortrait, manifest.exports[0].runtime.slice(7));
  assert.equal(art.portrait, manifest.exports[1].runtime.slice(7));
  assert.deepEqual(getPerformerRosterVisual('venus'), {id:'venus', kind:'portrait', source:art.fullPortrait, width:512, height:768});
  const view = {element(tag, className, text, parent) {
    const node = {tag, className, text, children:[], dataset:{}, style:{setProperty(){}}, setAttribute(){}};
    parent?.children.push(node); return node;
  }};
  const member = {id:'venus', identityMark:'X', colorHex:0x123456};
  const full = PublicShellView.prototype.mark.call(view, null, member, true).children[0];
  const avatar = PublicShellView.prototype.mark.call(view, null, member).children[0];
  assert.equal(full.src, "art/five-q-ui-20261013/venus-portrait.webp"); assert.equal(full.width, 232); assert.equal(full.height, 290);
  assert.equal(avatar.src, "art/five-q-ui-20261013/venus-avatar.webp"); assert.equal(avatar.width, 128); assert.equal(avatar.height, 128);
});
