import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const uiSource = readFileSync(new URL('../src/utils/ui.js', import.meta.url), 'utf8');
const uiFactory = new Function('document', `${uiSource
  .replace('export function setBattleHudVisible', 'function setBattleHudVisible')
  .replace('export function keepBattleHudHiddenForScene', 'function keepBattleHudHiddenForScene')}
return { keepBattleHudHiddenForScene, setBattleHudVisible };`);

const ids = ['hud', 'combo-display', 'encore-indicator', 'center-stage-indicator', 'form-display'];
const elements = Object.fromEntries(ids.map((id) => [id, { style: { display: 'block' } }]));
globalThis.document = {
  getElementById(id) {
    return elements[id] || null;
  },
};
const { keepBattleHudHiddenForScene, setBattleHudVisible } = uiFactory(globalThis.document);

let shutdownCallback = null;
const scene = {
  events: {
    once(eventName, callback) {
      if (eventName === 'shutdown') shutdownCallback = callback;
    },
  },
};

keepBattleHudHiddenForScene(scene);

ids.forEach((id) => {
  assert.equal(elements[id].style.display, 'none', `${id} should hide when a non-battle scene is created`);
});
assert.equal(typeof shutdownCallback, 'function', 'non-battle scenes should also hide HUD during shutdown');

setBattleHudVisible(true);
shutdownCallback();

ids.forEach((id) => {
  assert.equal(elements[id].style.display, 'none', `${id} should hide again during scene shutdown`);
});

[
  ['../src/utils/ui.js', 'export function keepBattleHudHiddenForScene'],
  '../src/scenes/TitleScene.js',
  '../src/scenes/CharacterScene.js',
  '../src/scenes/StageScene.js',
].forEach((entry) => {
  const [relativePath, expected = 'keepBattleHudHiddenForScene(this)'] = Array.isArray(entry)
    ? entry
    : [entry];
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.ok(
    source.includes(expected),
    `${relativePath} should bind the HUD hidden lifecycle`
  );
});
