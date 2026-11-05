import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('stage-v2 tour and inventory stylesheet contract', async t => {
  const path = new URL('../src/styles/tourInventoryV2.css', import.meta.url);
  assert.ok(fs.existsSync(path), 'the dedicated tour/inventory composition stylesheet must exist');
  const css = fs.readFileSync(path, 'utf8');
  const root = postcss.parse(css);
  const rules = [];
  root.walkRules(rule => {
    for (const selector of rule.selectors) rules.push({selector, nodes:rule.nodes});
  });
  const prefix = '#game-container #public-shell[data-cast=owner-three][data-ui-pass=stage-v2][data-shell-family=venue]';

  await t.test('every selector excludes home, roster and shared chrome', () => {
    assert.ok(rules.length >= 45, 'both screens need a complete composition');
    for (const rule of rules) {
      for (const selector of rule.selector.split(/,\s*(?=#game-container)/)) {
        assert.ok(selector.startsWith(prefix), selector);
        assert.match(selector.slice(prefix.length), /^\[data-page=(tour|inventory)\]/);
        assert.doesNotMatch(selector, /\.shell-(header|navigation|session-context|brand)\b/);
        if (selector.includes('[data-page=tour]') && selector.includes('.shell-content')) {
          assert.ok(selector.includes('.shell-content[data-tour-layout=venue]'), selector);
        }
      }
    }
    assert.doesNotMatch(css, /data-page=(desk|roster)|!important|gradient\(|scaleX|font-stretch|transition:\s*all/);
    root.walkDecls('letter-spacing', d => assert.equal(d.value, '0'));
    root.walkDecls('border-radius', d => assert.ok(parseFloat(d.value) <= 6));
  });

  await t.test('tour composes real venues, readable route stops and a large onward command', () => {
    for (const part of ['.tour-stop-sequence', '.shell-chapter-number', '.shell-route-preview',
      '.shell-chapter-option[data-state=locked]', '.tour-venue-stage', '.tour-venue-caption',
      '.tour-plan-ticket', '.tour-dossier', '[data-action=confirm-chapter]']) {
      assert.ok(rules.some(r => r.selector.includes('[data-page=tour]') && r.selector.endsWith(part)), part);
    }
    const stop = rules.find(r => r.selector.endsWith('.tour-stop-sequence'));
    assert.ok(stop.nodes.some(d => d.prop === 'grid-template-columns' && d.value === 'repeat(3,minmax(0,1fr))'));
    const venue = rules.find(r => r.selector.endsWith('.tour-venue-stage'));
    assert.ok(venue.nodes.some(d => d.prop === 'aspect-ratio' && d.value === '3 / 2'));
  });

  await t.test('inventory has stable rail, object bay, effects and six distinct equipment cells', () => {
    for (const part of ['.shell-member-strip', '.shell-member-option', '.inventory-loadout',
      '.inventory-detail-heading', '.inventory-object-stage', '.inventory-effects', '.inventory-grid',
      '.inventory-item[data-state=locked]', '.inventory-item[data-state=owned]',
      '.inventory-item[aria-pressed=true]', '.inventory-item[data-equipped=true]',
      '[data-action=equip-selected]', '[data-action=equip-selected]:disabled']) {
      assert.ok(rules.some(r => r.selector.includes('[data-page=inventory]') && r.selector.endsWith(part)), part);
    }
    const grid = rules.find(r => r.selector.endsWith('.inventory-grid'));
    assert.ok(grid.nodes.some(d => d.prop === 'grid-template-columns' && d.value === 'repeat(3,minmax(0,1fr))'));
    assert.match(css, /object-fit:contain/);
    assert.match(css, /#dafa20/);
    assert.match(css, /#f34799/);
    assert.match(css, /#33e3e0/);
  });

  await t.test('compact layout, touch targets, focus and reduced motion are explicit', () => {
    assert.ok(root.nodes.some(n => n.type === 'atrule' && n.params === '(max-width:340px)'));
    const reduced = root.nodes.find(n => n.type === 'atrule' && n.params === '(prefers-reduced-motion:reduce)');
    assert.ok(reduced);
    const declarations = [];
    reduced.walkDecls(d => declarations.push(`${d.prop}:${d.value}`));
    assert.ok(declarations.includes('animation:none'));
    assert.ok(declarations.includes('transition:none'));
    assert.match(css, /:focus-visible/);
    assert.match(css, /min-height:44px/);
    const transitions = [];
    root.walkDecls('transition', d => transitions.push(d.value));
    assert.ok(transitions.some(value => /180ms/.test(value)));
  });

  await t.test('first-frame venue art and compact equipment composition address captured clipping', () => {
    const venueArt = rules.find(r => r.selector.endsWith('.chapter-venue-art'));
    assert.ok(venueArt.nodes.some(d => d.prop === 'animation' && d.value === 'none'), 'do not fade a ready venue from flat gray');
    const stableStop = rules.find(r => r.selector.endsWith('.shell-chapter-option[data-chapter]'));
    assert.ok(stableStop, 'stop geometry must outrank old short-height rules');
    const object = rules.find(r => r.selector.endsWith('.inventory-object-stage'));
    assert.ok(object.nodes.some(d => d.prop === 'height' && parseFloat(d.value) <= 90), 'object bay must leave room for metrics and choices');
    const detail = rules.find(r => r.selector.endsWith('.inventory-detail'));
    assert.ok(detail.nodes.some(d => d.prop === 'display' && d.value === 'flex'));
    const chooser = rules.find(r => r.selector.endsWith('.inventory-chooser'));
    assert.ok(chooser.nodes.some(d => d.prop === 'order' && d.value === '3'));
    const description = rules.find(r => r.selector.endsWith('.inventory-description'));
    assert.ok(description.nodes.some(d => d.prop === 'order' && d.value === '4'));
    const summary = rules.find(r => r.selector.endsWith('.inventory-chooser > summary'));
    assert.ok(summary.nodes.some(d => d.prop === 'position' && d.value === 'absolute'), 'the duplicate selected-item summary belongs beside the object, not in a second full band');
    for (const part of ['.inventory-effects-heading', '.inventory-effects', '.inventory-effects dt', '.inventory-effects dd']) {
      for (const rule of rules.filter(r => r.selector.endsWith(part))) {
        assert.ok(!rule.nodes.some(d => d.prop === 'display' && d.value === 'none'), part);
        assert.ok(!rule.nodes.some(d => d.prop === 'clip-path'), part);
      }
    }
  });

  await t.test('CSS only references existing public art and cannot replace real content', () => {
    for (const match of css.matchAll(/url\(['"]?(\/art\/[^)'" ]+)/g)) {
      assert.ok(fs.existsSync(new URL('../public' + match[1], import.meta.url)), match[1]);
    }
    root.walkDecls('content', d => assert.ok(['none', "''", '""'].includes(d.value)));
    assert.doesNotMatch(css, /pointer-events:\s*none[^}]*data-action|display:\s*none[^}]*equipment-art/);
  });
});

test('real tour preview preserves locked stops, venues and explicit confirmation', () => {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const h = e.harness(e.TitleScene);
  h.scene.create();
  h.scene._publicShell.showPage('tour');
  const before = e.storage.getItem('starush.public-profile');
  assert.equal(h.all('button[data-chapter]').length, 3);
  assert.equal(h.query('[data-chapter=neon]').disabled, true);
  for (const id of ['opening', 'neon', 'encore']) {
    const venue = h.query('[data-chapter=' + id + ']').querySelector('.chapter-venue-art');
    assert.equal(venue.src, 'art/chapter-venues-20261024/' + id + '.webp');
    venue.naturalWidth = 768;
    venue.naturalHeight = 512;
    venue.dispatchEvent({type:'load'});
    assert.equal(venue.hidden, false);
  }
  assert.ok(h.query('.tour-venue-stage').querySelector('.chapter-venue-art'));
  h.click('[data-chapter=opening]');
  assert.equal(e.storage.getItem('starush.public-profile'), before);
  assert.ok(h.query('[data-action=confirm-chapter]'));
  h.shutdown();
});

test('six real inventory previews do not equip or save and keep real icon art', () => {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  e.seed(['opening', 'neon', 'encore']);
  const h = e.harness(e.TitleScene, {suppressDebugAutoStart:true, openPage:'inventory'});
  h.scene.create();
  const before = e.storage.getItem('starush.public-profile');
  const ids = ['wide_nozzle', 'rhythm_sync', 'focus_lens', 'travelling_nozzle', 'return_edge', 'delayed_hammer'];
  assert.equal(h.all('[data-inventory-item]').length, 6);
  for (const id of ids) {
    h.click('[data-inventory-item=' + id + ']');
    assert.equal(h.query('.inventory-detail').dataset.item, id);
    assert.ok(h.query('.inventory-object-stage').querySelector('.equipment-art').src.endsWith('/' + id + '.png'));
    assert.equal(h.query('[data-action=equip-selected]').disabled, ['return_edge', 'delayed_hammer'].includes(id));
  }
  assert.equal(e.storage.getItem('starush.public-profile'), before);
  h.shutdown();
});
