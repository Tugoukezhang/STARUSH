import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScenes } from './helpers/publicShellHarness.mjs';

test('preflight selection previews cancel without writes and confirmed member/chapter remain one run manifest', () => {
  const loaded = loadScenes();
  loaded.seed(['opening']);
  const { PublicShellView } = loaded.loadRuntime('systems/PublicShellView.mjs');
  const scene = loaded.harness(loaded.TitleScene).scene;
  const view = new PublicShellView(scene, { page: 'preflight', onStart() {} }, loaded.document);

  const query = selector => view.root.querySelector(selector);
  const click = selector => {
    const button = query(selector);
    assert.ok(button, `Missing shell control: ${selector}`);
    button.click();
  };
  const manifest = () => query('[data-preflight-manifest]');
  assert.equal(manifest()?.dataset.performerId, 'sakura');
  assert.equal(manifest()?.dataset.chapterId, 'opening');

  click('[data-action=preflight-member]');
  click('[data-member=kai]');
  click('[data-action=back]');
  assert.equal(loaded.profile.loadPublicProfile().selectedId, 'sakura', 'Back cancels member preview');
  assert.equal(view.root.dataset.page, 'preflight');
  assert.equal(manifest()?.dataset.performerId, 'sakura');

  click('[data-action=preflight-member]');
  click('[data-member=enjo]');
  click('[data-action=confirm-member]');
  assert.equal(loaded.profile.loadPublicProfile().selectedId, 'enjo');
  assert.equal(view.root.dataset.page, 'preflight');
  assert.equal(manifest()?.dataset.performerId, 'enjo');

  click('[data-action=preflight-chapter]');
  click('button[data-chapter=neon]');
  click('[data-action=confirm-chapter]');
  assert.equal(loaded.profile.loadPublicProfile().campaign.selectedChapterId, 'neon');
  assert.equal(view.root.dataset.page, 'preflight');
  assert.equal(manifest()?.dataset.performerId, 'enjo');
  assert.equal(manifest()?.dataset.chapterId, 'neon');
  assert.match(manifest().textContent, /炎上.*霓虹街口/);

  view.destroy();
});
