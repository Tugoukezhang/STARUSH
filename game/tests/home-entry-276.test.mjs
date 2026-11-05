import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveTitleEntry } from '../src/utils/homeEntry276.mjs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const title = read('src/scenes/TitleScene.js');
const screens = read('src/systems/ProductModuleScreens.mjs');
const shell = read('src/systems/PublicShellView.mjs');
const hierarchy = read('src/systems/HierarchyUiArt.mjs');
const main = read('src/main.js');
const css = read('src/styles/homeEntry276.css');
const between = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
const loungeSource = between(screens, 'function lounge(', 'function venue(');

test('normal launch stays on desk and leaves the URL alone', () => {
  for (const data of [undefined, null, {}]) {
    assert.deepEqual(resolveTitleEntry(data, ''), { page: 'desk', cleanedSearch: null });
    assert.deepEqual(resolveTitleEntry(data, '?debugless=1'), { page: 'desk', cleanedSearch: null });
  }
});

test('home return opens the lounge and consumes only fromHome', () => {
  assert.deepEqual(resolveTitleEntry({}, '?fromHome=1'), { page: 'lounge', cleanedSearch: '' });
  // Raw segments survive: URLSearchParams.toString() would rewrite %20 and bare flags.
  assert.deepEqual(resolveTitleEntry({}, '?a=1&fromHome=1&b=x%20y&flag'), { page: 'lounge', cleanedSearch: '?a=1&b=x%20y&flag' });
});

test('a consumed URL does not reapply on refresh or a later scene start', () => {
  const first = resolveTitleEntry({}, '?a=1&fromHome=1');
  assert.deepEqual(resolveTitleEntry({}, first.cleanedSearch), { page: 'desk', cleanedSearch: null });
});

test('only the exact query counts; anything else is untouched', () => {
  for (const search of ['?fromHome=0', '?fromHome=true', '?fromHome=1x', '?fromHome', '?fromHome=', '?xfromHome=1', '?fromHome=1&fromHome=2']) {
    assert.deepEqual(resolveTitleEntry({}, search), { page: 'desk', cleanedSearch: null }, search);
  }
});

test('explicit scene data wins, and the query is still consumed', () => {
  assert.deepEqual(resolveTitleEntry({ openPage: 'roster' }, '?fromHome=1'), { page: 'roster', cleanedSearch: '' });
  assert.deepEqual(resolveTitleEntry({ openPreparation: true }, '?fromHome=1'), { page: 'workshop', cleanedSearch: '' });
  assert.deepEqual(resolveTitleEntry({ openPreparation: false }, '?fromHome=1'), { page: 'desk', cleanedSearch: '' });
  assert.deepEqual(resolveTitleEntry({ openPage: 'tour', openPreparation: true }, ''), { page: 'tour', cleanedSearch: null });
  assert.deepEqual(resolveTitleEntry({ openPreparation: true }, ''), { page: 'workshop', cleanedSearch: null });
});

test('TitleScene consumes before the debug branch and keeps state, path and hash', () => {
  const entry = title.indexOf('resolveTitleEntry(this.scene.settings.data, window.location.search)');
  assert.ok(entry > 0, 'TitleScene resolves its entry from scene data and the live query');
  assert.ok(entry < title.indexOf("query.has('debug') && !suppressDebugAutoStart"), 'a debug start must not leave fromHome behind');
  assert.match(title, /window\.history\.replaceState\(window\.history\.state, '', `\$\{window\.location\.pathname\}\$\{entry\.cleanedSearch\}\$\{window\.location\.hash\}`\)/);
  assert.match(title, /page: entry\.page,/);
  assert.doesNotMatch(title, /openPage \|\| \(/, 'page precedence has one owner');
  assert.doesNotMatch(title, /location\.(assign|replace|href)/, 'no fallback redirects');
  assert.doesNotMatch(read('src/utils/homeEntry276.mjs'), /^import |localStorage|loadPublicProfile|loadBackstageProgress/m, 'route logic reads no state');
});

test('the lounge has exactly one same-tab icon anchor', () => {
  assert.equal(screens.split("'pm-home-entry'").length - 1, 1, 'one entry, created once');
  assert.ok(loungeSource.includes("view.element('a', 'pm-home-entry', undefined, root)"), 'lives in the lounge with no visible text');
  assert.ok(loungeSource.includes("homeEntry.href = 'home-space/companion.html'"));
  assert.ok(loungeSource.includes("homeEntry.setAttribute('aria-label', '安可居所')"));
  assert.ok(loungeSource.includes("homeEntry.title = '安可居所'"));
  assert.ok(loungeSource.includes("homeGlyph.src = 'art/home-entry-20261103/home.webp'"));
  assert.doesNotMatch(screens, /iframe|\.target\s*=|window\.open|home-space\/(?!companion\.html)/);
  assert.ok(!between(screens, 'function backstage(', 'function lounge(').includes('home-space'), 'no shortcut in the backstage hub');
});

test('the entry honours the same blocking guard as shell buttons', () => {
  const guard = between(loungeSource, "homeEntry.addEventListener('click'", 'homeEntry.href');
  assert.match(guard, /preventDefault/);
  for (const condition of ['view.disposed', 'view.navigating', 'isBlocking()']) assert.ok(guard.includes(condition), condition);
});

test('the existing hierarchy pipeline mounts the marker', () => {
  assert.match(hierarchy.match(/const ICONS=new Set\(\[[^\]]*\]\)/)[0], /'venue'/);
  assert.ok(fs.existsSync(new URL('../public/art/hierarchy-ui-20261101/icons-venue.webp', import.meta.url)));
  const render = shell.slice(shell.indexOf('renderProductModuleScreen(this,main,model);'));
  assert.match(render, /owner\?mountHierarchyUi\(this\)/, 'other existing controls still mount');
});

test('entry CSS is scoped, positioned, sized and drawn by no CSS icon', () => {
  assert.match(main, /import '\.\/styles\/preflightArt271\.css';\s*import '\.\/styles\/homeEntry276\.css';/);
  assert.match(css, /\.product-module-screen\[data-companion-studio="265"\]/);
  assert.match(css, /\.pm-home-entry/);
  for (const rule of [/position:absolute/, /left:12px/, /top:62px/, /width:52px/, /height:62px/]) assert.match(css, rule);
  assert.doesNotMatch(css, /url\(|::before|::after|<svg|\.pm-record-tool|\.ui-actor-switch/);
  assert.doesNotMatch(css, /right:\s*\d/, 'the right lane stays with record/switch');
});
