import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(id = 'sakura', reduced = false) {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const jobs = new Map();
  let serial = 0;
  e.window.requestAnimationFrame = fn => { jobs.set(++serial, fn); return serial; };
  e.window.cancelAnimationFrame = id => jobs.delete(id);
  e.window.matchMedia = () => ({matches: reduced});
  const s = {
    battleData: {stageId: 1, campaignChapterId: 'opening', performerId: id},
    _isPublicStage1Round: () => true,
    _setBattlePaused(v) { this._battlePaused = v; },
    input: {enabled: true, keyboard: {enabled: true, resetKeys() {}}, resetPointers() {}},
    player: {body: {setVelocity() {}}}, sound: {}, _battleEnded: false,
  };
  const UI = e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
  const ui = new UI(s, true);
  return {e, s, ui, jobs,
    step(t) { const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn(t)); },
    load() { ui.root.querySelector('.performance-encore-portrait').dispatchEvent({type: 'load'}); },
    phase() { return ui.root.querySelector('.performance-encore').dataset.phase; },
  };
}

test('Encore V2 shows current identity and native action, without duplicate face or baked placard', () => {
  const sources = {
    sakura: 'art/home-portrait-demo-20261022/sakura-body.webp',
    kai: 'art/portrait-base-20261101/kai.webp',
    enjo: 'art/portrait-base-20261101/enjo.webp',
  };
  for (const [id, src] of Object.entries(sources)) {
    const {ui} = setup(id);
    try {
      assert(ui.showEncore({cleared: 7}));
      assert.equal(ui.root.dataset.encoreStage, 'v2');
      assert.equal(ui.root.querySelector('.encore-stage-action')?.textContent, '安可返场');
      assert.equal(ui.root.querySelector('.encore-stage-performer')?.textContent,
        {sakura: '步枪手', kai: '机甲剑士', enjo: '重锤手'}[id]);
      assert.equal(ui.root.querySelector('.encore-stage-clear')?.textContent, ' · 清弹 7');
      assert.equal(ui.root.querySelector('.performance-encore-portrait').src, src);
      assert.equal(ui.root.querySelectorAll('img').length, 2);
      assert.equal(ui.root.querySelector('.performance-encore-lettering'), null);
      assert.equal(ui.root.querySelector('.performance-encore-closeup'), null);
      assert.match(ui.root.querySelector('.performance-encore-venue').src, /chapter-venues/);
    } finally { ui.destroy(); }
  }
});

test('only real positive safe integer counts appear, retaining existing name text contract', () => {
  const {ui} = setup();
  try {
    for (const cleared of [0, NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '3']) {
      assert(ui.showEncore({cleared}));
      assert.equal(ui.root.querySelector('.performance-encore-name').textContent, '步枪手');
      assert.equal(ui.root.querySelector('.encore-stage-clear'), null);
      ui.close();
    }
    ui.showEncore({cleared: 3});
    assert.equal(ui.root.querySelector('.performance-encore-name').textContent, '步枪手 · 清弹 3');
  } finally { ui.destroy(); }
});

test('load gate and exact 180/900/1180ms timeline remain unchanged', () => {
  const f = setup();
  try {
    f.ui.showEncore(); assert.equal(f.phase(), 'loading'); assert.equal(f.jobs.size, 0);
    f.load(); f.load(); assert.equal(f.jobs.size, 1);
    f.step(0); assert.equal(f.phase(), 'focus');
    f.step(179); assert.equal(f.phase(), 'focus');
    f.step(180); assert.equal(f.phase(), 'hero');
    f.step(899); assert.equal(f.phase(), 'hero');
    f.step(900); assert.equal(f.phase(), 'exit');
    f.step(1179); assert(f.ui.root); assert(f.s._battlePaused);
    f.step(1180); assert.equal(f.ui.root, null); assert.equal(f.s._battlePaused, false);
    assert.equal(f.jobs.size, 0);
  } finally { f.ui.destroy(); }
});

test('reduced motion keeps static hero and exact 240ms completion', () => {
  const f = setup('kai', true);
  try {
    f.ui.showEncore(); f.load(); f.step(0);
    assert.equal(f.ui.root.dataset.reducedMotion, 'true'); assert.equal(f.phase(), 'hero');
    f.step(239); assert(f.ui.root);
    f.step(240); assert.equal(f.ui.root, null); assert.equal(f.jobs.size, 0);
  } finally { f.ui.destroy(); }
});

test('visibility freezes elapsed time; continue cancels work; stale controls cannot close settings', () => {
  const f = setup();
  try {
    f.ui.showEncore(); f.load(); f.step(0); f.step(300);
    f.e.document.hidden = true; f.e.document.dispatchEvent({type: 'visibilitychange'});
    f.step(6000); assert(f.ui.root); assert.equal(f.ui.root.dataset.cinematicPaused, 'true');
    f.e.document.hidden = false; f.e.document.dispatchEvent({type: 'visibilitychange'});
    f.step(9000); assert.equal(f.phase(), 'hero');
    const button = f.ui.root.querySelector('[data-action=encore-continue]');
    button.click(); assert.equal(f.ui.root, null); assert.equal(f.jobs.size, 0);
    f.ui.showSettings(); const settings = f.ui.root;
    button.click(); assert.equal(f.ui.root, settings); assert(f.s._battlePaused);
  } finally { f.ui.destroy(); }
});

test('late decode after shutdown cannot schedule or resume a destroyed scene', async () => {
  const f = setup('enjo'); let resolve;
  try {
    f.ui.showEncore();
    const image = f.ui.root.querySelector('.performance-encore-portrait');
    image.decode = () => new Promise(r => { resolve = r; });
    f.load(); assert.equal(f.jobs.size, 0);
    f.ui.destroy(); resolve(); await new Promise(setImmediate);
    image.dispatchEvent({type: 'load'}); f.e.document.dispatchEvent({type: 'visibilitychange'});
    assert.equal(f.ui.root, null); assert.equal(f.jobs.size, 0); assert.equal(f.s._battlePaused, true);
  } finally { f.ui.destroy(); }
});

test('decode gates first frame and image error retains original start path', async () => {
  const f = setup(); let resolve;
  try {
    f.ui.showEncore();
    f.ui.root.querySelector('.performance-encore-portrait').decode = () => new Promise(r => { resolve = r; });
    f.load(); assert.equal(f.jobs.size, 0);
    resolve(); await new Promise(setImmediate); assert.equal(f.jobs.size, 1);
    f.ui.close(); f.ui.showEncore();
    f.ui.root.querySelector('.performance-encore-portrait').dispatchEvent({type: 'error'});
    assert.equal(f.jobs.size, 1);
  } finally { f.ui.destroy(); }
});

test('V2 CSS is scoped, face-safe and has reduced/hidden motion rules', () => {
  const path = new URL('../src/styles/encoreStageV2.css', import.meta.url);
  assert(existsSync(path), 'Encore V2 stylesheet must exist');
  const css = readFileSync(path, 'utf8');
  assert.match(css, /data-encore-stage=v2/);
  assert.match(css, /grid-template-rows:/);
  assert.match(css, /object-fit:cover/);
  assert.match(css, /object-position:50% 12%/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /data-cinematic-paused=true/);
  assert.doesNotMatch(css, /rotate\(|scaleX\(|scaleY\(/);
  assert.doesNotMatch(css, /performance-story|url\(/);
});
