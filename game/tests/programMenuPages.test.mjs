import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ROOT = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey]';
const ART = 'art/chapter-journey-20261101';

test('playhub through the real Tour route: two framed modes, real availability gates, no writes on open', () => {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed([]);
  const h = s.harness(s.TourRouteScene, {suppressDebugAutoStart: true}); h.scene.create();
  const before = plain([...s.storage.values]);
  h.click('[data-action=tour-modes]'); assert.equal(h.root.dataset.page, 'playhub');
  assert.deepEqual(plain([...s.storage.values]), before, 'opening playhub never writes a save');
  const modes = h.query('.pg-modes').querySelectorAll('button');
  assert.deepEqual(modes.map(b => b.dataset.action), ['hub-finale-trial', 'hub-rehearsal']);
  assert.deepEqual(modes.map(b => b.querySelector('.pg-mode-art').src), [`${ART}/mode-finale.webp`, `${ART}/mode-rehearsal.webp`]);
  assert.deepEqual(modes.map(b => b.querySelector('img.pg-letter').src), [`${ART}/letter-finale.webp`, `${ART}/letter-rehearsal.webp`]);
  assert.deepEqual(modes.map(b => b.querySelector('.pg-sr').textContent), ['压轴连演', '压轴排练室']);
  // This harness records the canonical Scene handoff; the browser opens a locked explainer with no start command.
  for (const b of modes) {
    assert.equal(b.dataset.availability, 'locked'); assert.ok(b.querySelector('.pg-mode-lock[data-ui-icon=lock]'));
    b.click(); assert.equal(h.root.dataset.page, 'playhub', `${b.dataset.action} gate holds`);
  }
  assert.deepEqual(plain([...s.storage.values]), before);
  h.shutdown();
});

test('events and sideplay open through the real backstage route without touching stores', () => {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed([]);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  h.click('[data-action=home-open-backstage]');
  const before = plain([...s.storage.values]);
  h.click('[data-action=backstage-open-events]'); assert.equal(h.root.dataset.page, 'events');
  assert.ok(h.query('[data-action=events-open-tour]').classList.contains('pg-primary'));
  assert.deepEqual(plain([...s.storage.values]), before);
  h.click('[data-action=events-return]'); assert.equal(h.root.dataset.page, 'backstage');
  h.click('[data-action=backstage-open-sideplay]'); assert.equal(h.root.dataset.page, 'sideplay');
  assert.equal(h.query('[data-action=hub-finale-trial]'), null); assert.equal(h.query('[data-action=hub-rehearsal]'), null);
  h.click('[data-action=sideplay-open-library]'); assert.equal(h.root.dataset.page, 'library');
  assert.deepEqual(plain([...s.storage.values]), before, 'program pages and their routes never write on open');
  h.shutdown();
  const t = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); t.scene.create();
  t.click('[data-action=home-open-backstage]'); t.click('[data-action=backstage-open-events]');
  t.click('[data-action=events-open-tour]'); assert.equal(t.root.dataset.page, 'tour'); t.shutdown();
});

test('program stylesheet nests under the full screenRebuild root, uses AI skins and fixed type', () => {
  const raw = fs.readFileSync(new URL('../src/styles/programMenu.css', import.meta.url), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.ok(css.startsWith(ROOT + ' {'), 'single root block with every screenRebuild attribute');
  assert.equal(css.split(ROOT).length, 2);
  const body = css.slice(ROOT.length + 2, css.lastIndexOf('}'));
  for (const rule of body.matchAll(/([^{};]+)\{/g)) {
    const sel = rule[1].trim(); if (sel.startsWith('@media')) continue;
    for (const part of sel.split(/,(?![^()]*\))/)) assert.match(part.trim(), /^& (:is\()?\.pg-/, `unscoped: ${part}`);
  }
  for (const skin of ['skin-primary', 'skin-secondary', 'skin-panel']) assert.ok(css.includes(`/art/hierarchy-ui-20261101/${skin}.webp`), skin);
  for (const [, r] of css.matchAll(/border-radius:(\d+)px/g)) assert.ok(Number(r) <= 8, `radius ${r}px`);
  assert.doesNotMatch(css, /content:'/, 'no CSS-drawn arrows');
  assert.doesNotMatch(css, /font-size:[^;}]*(vw|vh|vmin|clamp|%)/, 'no viewport type');
  assert.doesNotMatch(css.slice(css.indexOf('@media')), /font-size/, 'media queries never resize type');
  assert.doesNotMatch(css, /scaleX|font-stretch|letter-spacing:\s*-|background:#[0-9a-f]{6};?border-radius:1[0-9]/);
  assert.ok(css.includes('max-width:340px') && css.includes('prefers-reduced-motion:reduce'));
});

test('program module has no silent performance fallback and no invented chapter guards', () => {
  const src = fs.readFileSync(new URL('../src/systems/ProgramMenuPages.mjs', import.meta.url), 'utf8');
  const events=src.slice(src.indexOf('export function renderProgramEvents'),src.indexOf('export function renderPracticeTools'));
  assert.doesNotMatch(events, /performance\s*\|\||getPublicPerformanceCatalog|objective\s*\|\||subtitle\s*\|\||\?\./);
  assert.doesNotMatch(events, /setItem|savePublic|commit|领取|每日|奖励/);
});
