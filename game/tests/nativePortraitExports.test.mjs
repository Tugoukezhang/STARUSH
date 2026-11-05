import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getPerformerArt,performerPortraitCss} from '../src/systems/ActorPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {STAGE1_PUBLIC_CAST} from '../src/utils/stage1PaintRound.mjs';
const base='art/sakura-native-20261004/';
test('Sakura UI now shares the native character identity rather than the previous portrait pair',()=>{
  const art=getPerformerArt('sakura');assert.equal(art.portrait,base+'avatar.webp');assert.equal(art.fullPortrait,base+'portrait.webp');
  assert.equal(STAGE1_PUBLIC_CAST[0].avatar,art.portrait);
  assert.equal(performerPortraitCss('sakura','https://example.com/'),`url("https://example.com/${base}avatar.webp")`);
  for(const file of ['avatar.webp','portrait.webp'])assert(RUNTIME_PAYLOAD.some(row=>row.file===base+file));
  assert(!RUNTIME_PAYLOAD.some(row=>/performer-portraits-20260925\/sakura-/.test(row.file)));
  for(const id of ['venus','genya','kai','enjo'])assert.equal(getPerformerArt(id).portrait,`art/performer-portraits-20260925/${id}-avatar.webp`);
});
