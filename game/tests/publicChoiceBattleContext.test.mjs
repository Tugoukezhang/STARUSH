import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

test('choice carries the actual chapter context and preserves one gesture, save and input ownership', () => {
  const env = loadScenes(), { BattleSurfaceView } = env.loadRuntime('systems/BattleSurfaceView.mjs');
  const chosen = [], before = plain(env.profile.loadPublicProfile());
  const scene = { battleData: { campaignChapterId: 'neon' }, input: { enabled: true, keyboard: { enabled: true, resetKeys() {} }, resetPointers() {} }, events: { once() {}, off() {} }, sound: null };
  const view = new BattleSurfaceView(scene, { mode: 'choice', member: env.profile.PUBLIC_PERFORMERS[0], number: 1, choices: [], options: ['wide_brush', 'relay', 'tempo'].map(id => env.profile.getRunChoice(id)), onChoice: id => chosen.push(id), onLeave() {} }, env.document);
  const context = view.root.querySelector('.battle-choice-context'); assert(context, 'Current frozen chapter remains identifiable');
  assert.equal(context.textContent, '霓虹街口');
  assert.equal(scene.input.enabled, false); assert.equal(scene.input.keyboard.enabled, false);
  view.root.querySelector('[data-choice=wide_brush]').click(); view.root.querySelector('[data-choice=relay]').click(); assert.deepEqual(chosen, ['wide_brush']);
  view.destroy(); assert.equal(scene.input.enabled, true); assert.equal(scene.input.keyboard.enabled, true);
  assert.equal(env.document.getElementById('run-choice'), null); assert.deepEqual(plain(env.profile.loadPublicProfile()), before);
});

test('choice uses a transparent frozen-world backing with a bounded, scrollable lower surface', () => {
  const css = postcss.parse(readFileSync(new URL('../src/styles/freshExperience.css', import.meta.url), 'utf8'));
  const decls = selector => { const result = {}; css.walkRules(selector, r => r.walkDecls(d => { result[d.prop] = d.value; })); return result; };
  const backing = decls('#game-container #run-choice.battle-surface');
  assert.equal(backing.background, '#15282d80'); assert.equal(backing['padding-top'], '170px');
  const scroll = decls('#game-container #run-choice .battle-surface-content'); assert.equal(scroll['min-height'], '0'); assert.equal(scroll['overflow-y'], 'auto');
  assert.equal(decls('#game-container #run-choice .battle-choice-context')['pointer-events'], 'none');
});
