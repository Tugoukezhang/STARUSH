import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Source assertions always target this test's sibling tree, including staged runs.
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(sourceRoot, 'index.html'), 'utf8');
const main = readFileSync(join(sourceRoot, 'src/main.js'), 'utf8');
const helperUrl = new URL('../src/utils/gameViewport.mjs', import.meta.url);
const viewport = existsSync(helperUrl) ? await import(helperUrl) : {};

function installedRequire() {
  for (const start of [sourceRoot, process.cwd()]) {
    for (let base = resolve(start); ; base = dirname(base)) {
      for (const candidate of [base, join(base, '03-\u7a0b\u5e8f'), join(base, 'STARUSH', '03-\u7a0b\u5e8f')]) {
        if (existsSync(join(candidate, 'node_modules/phaser/package.json'))) {
          return createRequire(join(candidate, 'package.json'));
        }
      }
      if (dirname(base) === base) break;
    }
  }
  throw new Error('Run within the STARUSH workspace or its staged copy with installed dependencies available.');
}

const require = installedRequire();
const css = require('postcss').parse(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
const declarations = (selector) => {
  const result = {};
  css.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      rule.walkDecls((decl) => { result[decl.prop] = decl; });
    }
  });
  return result;
};

function fit(input, ...dimensions) {
  assert.equal(typeof viewport.calculateGameViewport, 'function', 'missing pure viewport sizing helper');
  return viewport.calculateGameViewport(input, ...dimensions);
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
}

function assertInside(result, input) {
  assert.ok(result);
  const { top = 0, right = 0, bottom = 0, left = 0 } = input.safeArea || {};
  const x = input.offsetLeft || 0;
  const y = input.offsetTop || 0;
  const epsilon = 1e-9;
  assert.ok(result.x >= x + left - epsilon);
  assert.ok(result.y >= y + top - epsilon);
  assert.ok(result.x + result.width <= x + input.width - right + epsilon);
  assert.ok(result.y + result.height <= y + input.height - bottom + epsilon);
  near(result.width, 375 * result.scale);
  near(result.height, 667 * result.scale);
}

for (const [width, height] of [[375, 667], [390, 844], [320, 568], [1440, 900]]) {
  test(`one maximal contained scale at ${width}x${height}`, () => {
    const input = { width, height };
    const result = fit(input);
    assertInside(result, input);
    near(result.scale, Math.min(width / 375, height / 667));
    near(result.x, (width - result.width) / 2);
    near(result.y, (height - result.height) / 2);
  });
}

test('safe-area and visual viewport offsets keep all four edges inside', () => {
  const input = {
    width: 390, height: 844, offsetLeft: 11, offsetTop: 24,
    safeArea: { top: 47, right: 9, bottom: 34, left: 7 },
  };
  const result = fit(input);
  assertInside(result, input);
  near(result.scale, Math.min(374 / 375, 763 / 667));
  near(result.x, 18 + (374 - result.width) / 2);
  near(result.y, 71 + (763 - result.height) / 2);
});

test('bounded fit has no minimum scale, artificial margin, or desktop cap', () => {
  for (const width of [1, 240, 320, 375, 390, 844, 4096]) {
    for (const height of [1, 180, 568, 667, 844, 2160]) {
      const input = { width, height };
      assertInside(fit(input), input);
    }
  }
  near(fit({ width: 375, height: 667 }).scale, 1);
  assert.ok(fit({ width: 240, height: 400 }).scale < 0.8);
  assert.ok(fit({ width: 4096, height: 2160 }).scale > 2.2);
});

test('resize recomputes from logical dimensions without accumulating a transform', () => {
  const input = { width: 390, height: 844 };
  const original = fit(input);
  const portrait = fit({ width: 320, height: 568 });
  const landscape = fit({ width: 844, height: 390 });
  assert.notEqual(portrait.scale, original.scale);
  assertInside(landscape, { width: 844, height: 390 });
  assert.deepEqual(fit(input), original);
  assert.deepEqual(input, { width: 390, height: 844 });
});

test('invalid or empty viewport geometry returns null instead of NaN or clipping', () => {
  for (const input of [undefined, null, {}, { width: 0, height: 667 },
    { width: -1, height: 667 }, { width: 375, height: Infinity },
    { width: NaN, height: 667 }, { width: '375', height: 667 },
    { width: 375, height: 667, offsetTop: NaN },
    { width: 375, height: 667, safeArea: { left: -1 } },
    { width: 375, height: 667, safeArea: { right: Infinity } },
    { width: 375, height: 667, safeArea: { top: 667 } },
    { width: 375, height: 667, safeArea: { left: 200, right: 200 } },
    { width: 375, height: 667, safeArea: null }]) {
    assert.equal(fit(input), null);
  }
  assert.equal(fit({ width: 375, height: 667 }, 0, 667), null);
  assert.equal(fit({ width: 375, height: 667 }, 375, NaN), null);
});

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type) { listeners.get(type)?.forEach((fn) => fn()); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}

test('binding fits before Phaser bounds refresh, tracks mobile resize/scroll, and cleans up', () => {
  assert.equal(typeof viewport.bindGameViewport, 'function', 'missing viewport binding');
  const container = { style: {} };
  const safeArea = { paddingTop: '47px', paddingRight: '0px', paddingBottom: '34px', paddingLeft: '0px' };
  const probe = {};
  const host = Object.assign(eventTarget(), {
    innerWidth: 1440, innerHeight: 900,
    visualViewport: Object.assign(eventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 }),
    document: { getElementById: (id) => id === 'game-container' ? container : probe },
    getComputedStyle: (node) => { assert.equal(node, probe); return safeArea; },
  });
  let refreshCount = 0;
  const game = {
    config: { width: 375, height: 667 },
    scale: { refresh() {
      refreshCount += 1;
      const expected = fit({ ...host.visualViewport,
        safeArea: { top: parseFloat(safeArea.paddingTop), bottom: parseFloat(safeArea.paddingBottom) } });
      assert.equal(container.style.transform, `scale(${expected.scale})`);
      assert.equal(container.style.left, `${expected.x}px`);
      assert.equal(container.style.top, `${expected.y}px`);
    } },
  };
  const dispose = viewport.bindGameViewport(game, host);
  assert.equal(refreshCount, 1);
  Object.assign(host.visualViewport, { width: 320, height: 568 });
  host.visualViewport.dispatch('resize');
  Object.assign(host.visualViewport, { offsetTop: 19, offsetLeft: 4 });
  host.visualViewport.dispatch('scroll');
  safeArea.paddingBottom = '21px';
  host.dispatch('resize');
  host.dispatch('orientationchange');
  host.dispatch('pageshow');
  assert.equal(refreshCount, 6);
  const validStyle = { ...container.style };
  host.visualViewport.width = 0;
  host.visualViewport.dispatch('resize');
  assert.deepEqual(container.style, validStyle);
  assert.equal(refreshCount, 6, 'invalid dimensions must not refresh Phaser with zero canvas bounds');
  dispose();
  dispose();
  assert.equal(host.listenerCount() + host.visualViewport.listenerCount(), 0);
  host.dispatch('resize');
  assert.equal(refreshCount, 6);
});

test('binding falls back to the layout viewport when VisualViewport is unavailable', () => {
  assert.equal(typeof viewport.bindGameViewport, 'function');
  const container = { style: {} };
  const host = Object.assign(eventTarget(), {
    innerWidth: 375, innerHeight: 667,
    document: { getElementById: (id) => id === 'game-container' ? container : null },
  });
  let refreshCount = 0;
  const dispose = viewport.bindGameViewport({ config: { width: 375, height: 667 },
    scale: { refresh() { refreshCount += 1; } } }, host);
  assert.equal(container.style.transform, 'scale(1)');
  host.innerHeight = 568;
  host.dispatch('resize');
  assert.equal(container.style.transform, `scale(${568 / 667})`);
  assert.equal(refreshCount, 2);
  dispose();
});

test('Phaser owns pointer conversion via transformed bounds, with NONE and no centering', () => {
  assert.match(main, /mode:\s*Phaser\.Scale\.NONE/);
  assert.match(main, /autoCenter:\s*Phaser\.Scale\.NO_CENTER/);
  assert.match(main, /postBoot\s*[:(]/);
  assert.match(main, /bindGameViewport\(game\)/);
  assert.match(main, /events\.once\(Phaser\.Core\.Events\.DESTROY,\s*\w+\)/);
  assert.match(main, /activePointers:\s*2/);
  assert.deepEqual([...main.matchAll(/key:\s*'([^']+)'/g)].map((match) => match[1]),
    ['TitleScene', 'TourRouteScene', 'IdolRosterScene', 'BattleScene']);
  assert.match(main, /scene:\s*publicDemoScenes/);
  const phaser = readFileSync(require.resolve('phaser/src/scale/ScaleManager.js'), 'utf8');
  assert.match(phaser, /this\.canvas\.getBoundingClientRect\(\)/);
  assert.match(phaser, /this\.displayScale\.set\(this\.baseSize\.width \/ this\.canvasBounds\.width, this\.baseSize\.height \/ this\.canvasBounds\.height\)/);
  assert.match(phaser, /\(pageX - this\.canvasBounds\.left\) \* this\.displayScale\.x/);
  assert.match(phaser, /\(pageY - this\.canvasBounds\.top\) \* this\.displayScale\.y/);
});

test('Canvas and HUD share a fixed logical container with no second scale or CSS zoom', () => {
  assert.doesNotMatch(html + main, /style\.zoom|\bzoom\s*:|fitStarushFrame|Phaser\.Scale\.FIT/);
  const frame = declarations('#game-container');
  assert.equal(frame.position?.value, 'fixed');
  assert.equal(frame.width?.value, '375px');
  assert.equal(frame.height?.value, '667px');
  assert.equal(frame['transform-origin']?.value, '0 0');
  const canvas = declarations('#game-container > canvas');
  assert.equal(canvas.display?.value, 'block');
  assert.equal(canvas.width?.value, '375px');
  assert.equal(canvas.height?.value, '667px');
  assert.equal(canvas.transform, undefined);
  assert.match(html, /viewport-fit=cover/);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.match(declarations('#viewport-safe-area')[`padding-${side}`]?.value || '',
      new RegExp(`env\\(safe-area-inset-${side},\\s*0px\\)`));
  }
});

test('three action surfaces are native buttons retaining labels and fill hook', () => {
  for (const [id, label] of [['skill-special', '\u6247\u594f'], ['skill-encore', '\u5b89\u53ef'], ['ult-prompt', '\u91ca\u653e\u5b89\u53ef!']]) {
    const button = html.match(new RegExp(`<button\\b([^>]*\\bid="${id}"[^>]*)>([\\s\\S]*?)<\\/button>`));
    assert.ok(button, `${id} must be a native button`);
    assert.match(button[1], /type="button"/);
    assert.ok(button[2].includes(label));
    assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1);
  }
  assert.match(html, /id="special-fill"/);
  assert.doesNotMatch(html, /class="switch-roster"|class="switch-idol/);
  assert.equal(declarations('.mihoyo-skills').bottom?.value, '70px');
  assert.equal(declarations('.mihoyo-skills').right?.value, '8px');
  assert.equal(declarations('.mihoyo-skills')['padding-bottom']?.value, '43px');
  assert.match(html, /id="special-label"/);
  assert.doesNotMatch(html, /background:\s*url\('art\/hud\/sakura-avatar\.jpg'\)/);
});

test('hidden and pause CSS only suppresses explicit modes, preserving scene-owned display', () => {
  assert.match(html, /<div id="hud"(?: data-layout="stage-v2")? style="display:none">/);
  assert.match(html, /<div id="game-container">/);
  for (const target of ['.mihoyo-skills', '#ult-prompt']) {
    assert.equal(declarations(`#game-container[data-battle-mode="hidden"] ${target}`).display?.value, 'none');
  }
  for (const target of ['#hud', '#ult-prompt', '#ult-cutin', '#combo-display', '#encore-indicator', '#center-stage-indicator', '#form-display']) {
    const rule = declarations(`#game-container[data-battle-paused="true"] ${target}`);
    assert.equal(rule.display?.value, 'none', `${target} must disappear while paused`);
    assert.equal(rule.display?.important, true, `${target} must override scene inline display`);
    assert.equal(rule['pointer-events']?.value, 'none');
  }
  css.walkRules((rule) => {
    if (rule.selector.includes('data-battle-')) {
      assert.ok(rule.selectors.every((selector) => /^#game-container\[data-battle-(mode="(?:hidden|result)"|paused="true")\] /.test(selector)));
    }
  });
});

test('HUD typography uses zero tracking and readable compact HP/support/objective dimensions', () => {
  css.walkDecls('letter-spacing', (decl) => assert.equal(decl.value, '0'));
  assert.equal(declarations('*')['letter-spacing']?.value, '0');
  assert.ok(parseFloat(declarations('.mihoyo-name')['font-size']?.value) >= 13);
  assert.ok(parseFloat(declarations('#heat-level')['font-size']?.value) >= 12);
  assert.ok(parseFloat(declarations('.hp-track').height?.value) >= 10);
  assert.ok(parseFloat(declarations('#wave-text')['font-size']?.value) >= 14);
  assert.ok(parseFloat(declarations('.cw-objective')['border-radius']?.value) <= 8);
});
