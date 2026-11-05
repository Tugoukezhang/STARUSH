import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const { transformSync } = require('esbuild');
export const plain = value => JSON.parse(JSON.stringify(value));

export function storageFixture() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key), clear: () => values.clear() };
}

function eventTarget(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent(event) {
      event.target ??= this;
      event.currentTarget = this;
      event.stopPropagation ??= () => { event.cancelBubble = true; };
      event.preventDefault ??= () => { event.defaultPrevented = true; };
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn.call(this, event);
      if (event.bubbles && !event.cancelBubble) this.parentNode?.dispatchEvent(event);
      return !event.defaultPrevented;
    },
  });
}

// A tree-backed DOM double for programmatic elements, not a layout/pixel engine.
export function createDocument() {
  const doc = eventTarget({ hidden: false, activeElement: null });
  const make = tag => {
    const attrs = new Map();
    let ownText = '';
    const element = eventTarget({ tagName: tag.toUpperCase(), children: [], parentNode: null,
      dataset: {}, style: { setProperty(key, value) { this[key] = value; }, getPropertyValue(key) { return this[key] ?? ''; }, removeProperty(key) { const prior=this[key] ?? ''; delete this[key]; return prior; } },
      className: '', id: '', disabled: false, hidden: false,
      setAttribute(key, value) {
        attrs.set(key, String(value));
        if (key === 'class') this.className = String(value);
        if (key === 'id') this.id = String(value);
        if (key === 'disabled') this.disabled = true;
        if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      },
      getAttribute(key) {
        if (key === 'class') return this.className;
        if (key === 'id') return this.id;
        if (key === 'disabled') return this.disabled ? '' : null;
        if (key.startsWith('data-')) return this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
        return attrs.get(key) ?? null;
      },
      hasAttribute(key) { return this.getAttribute(key) !== null; },
      removeAttribute(key) { attrs.delete(key); if (key === 'disabled') this.disabled = false; },
      append(...items) {
        for (let item of items) {
          if (typeof item === 'string') { const text = make('#text'); text.textContent = item; item = text; }
          item.remove(); item.parentNode = this; this.children.push(item);
        }
      },
      appendChild(item) { this.append(item); return item; },
      insertBefore(item, ref) {
        if (ref === null || ref === undefined) { this.append(item); return item; }
        assert.ok(this.children.includes(ref), 'NotFoundError: insertBefore reference is not a child');
        if (item === ref) return item;
        item.remove(); item.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, item);
        return item;
      },
      replaceChildren(...items) { for (const child of [...this.children]) child.remove(); ownText = ''; this.append(...items); },
      remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
      },
      contains(item) { return item === this || this.children.some(child => child.contains(item)); },
      matches(selector) {
        const tag = selector.match(/^[\w-]+/)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        const id = selector.match(/#([\w-]+)/)?.[1];
        if (id && this.id !== id) return false;
        for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(name)) return false;
        for (const [, key, value] of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
          if (!this.hasAttribute(key) || (value !== undefined && this.getAttribute(key) !== value)) return false;
        }
        return true;
      },
      querySelectorAll(selector) {
        assert.ok(!/[>:,+~ ]/.test(selector.replace(/\[[^\]]*\]/g, '')), `Unsupported harness selector: ${selector}`);
        const all = this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]);
        return all.filter(child => child.matches(selector));
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
      closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; },
      // Structural clone: attributes, dataset, reflected image/control properties and (deep) children.
      // Listeners are not cloned, matching the real DOM.
      cloneNode(deep = false) {
        const copy = make(tag);
        for (const [key, value] of attrs) copy.setAttribute(key, value);
        Object.assign(copy.dataset, this.dataset);
        for (const key of ['className', 'id', 'hidden', 'disabled', 'src', 'alt', 'draggable', 'title', 'type', 'value', 'loading', 'decoding'])
          if (Object.hasOwn(this, key)) copy[key] = this[key];
        for (const [key, value] of Object.entries(this.style)) if (typeof value !== 'function') copy.style[key] = value;
        if (deep || tag === '#text') copy.textContent = ownText;
        if (deep) copy.append(...this.children.map(child => child.cloneNode(true)));
        return copy;
      },
      focus() { doc.activeElement = this; },
      // This harness has no layout; browser tests verify scroll visibility.
      scrollIntoView() {},
      click() { if (!this.disabled) this.dispatchEvent({ type: 'click', bubbles: true }); },
    });
    Object.defineProperties(element, {
      textContent: { get: () => ownText + element.children.map(child => child.textContent).join(''),
        set(value) { element.replaceChildren(); ownText = String(value); } },
      innerHTML: { set(value) { assert.equal(value, '', 'Harness does not parse HTML; use a real DOM for markup rendering'); element.replaceChildren(); } },
      isConnected: { get: () => doc.body?.contains(element) ?? false },
      parentElement: { get: () => element.parentNode },
      nextSibling: { get: () => { const siblings = element.parentNode?.children ?? []; return siblings[siblings.indexOf(element) + 1] ?? null; } },
    });
    // Native modal dialog subset: open reflects the attribute; close fires a queued 'close' event.
    let modal = false;
    if (element.tagName === 'DIALOG') Object.assign(Object.defineProperty(element, 'open', {
      get: () => attrs.has('open'), set(value) { if (value) attrs.set('open', ''); else { attrs.delete('open'); modal = false; } } }), {
      returnValue: '',
      showModal() {
        if (this.open) { assert.ok(modal, 'InvalidStateError: dialog already open non-modally'); return; }
        assert.ok(this.isConnected, 'InvalidStateError: showModal on a disconnected dialog');
        this.open = true; modal = true; doc.activeElement = this;
      },
      show() { if (!this.open) this.open = true; },
      close(value) {
        if (!this.open) return;
        this.open = false;
        if (value !== undefined) this.returnValue = String(value);
        setTimeout(() => this.dispatchEvent({ type: 'close' }), 0);
      },
    });
    element.classList = {
      contains: name => element.className.split(/\s+/).includes(name),
      add(...names) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove(...names) { element.className = element.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle(name, force) { const add = force ?? !this.contains(name); this[add ? 'add' : 'remove'](name); return add; },
    };
    return element;
  };
  doc.createElement = make;
  doc.createElementNS = (_namespace, tag) => make(tag);
  doc.body = make('body');
  doc.getElementById = id => doc.body.querySelector(`#${id}`);
  doc.querySelector = selector => doc.body.querySelector(selector);
  doc.querySelectorAll = selector => doc.body.querySelectorAll(selector);
  const host = make('main'); host.id = 'game-container'; doc.body.append(host);
  const hud = make('div'); hud.id = 'hud'; doc.body.append(hud);
  return doc;
}

export function loadScenes({ storage = storageFixture(), search = '', sessionStorage = storageFixture() } = {}) {
  const document = createDocument();
  const window = eventTarget({ location: { search }, localStorage: storage, sessionStorage });
  window.ResizeObserver=class{observe(){}disconnect(){}};
  const cache = new Map();
  const context = vm.createContext({ console, document, window, localStorage: storage, sessionStorage,
    URLSearchParams, TextEncoder, Date, Math, JSON, setTimeout, clearTimeout, btoa, atob });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    if (filename.endsWith('.css')) return {};
    // Navigation tests do not load WebGL or network modules; dedicated portrait suites test these mounts.
    if(filename.endsWith('KaiContinuousPortrait.mjs'))return {mountKaiContinuousPortrait:()=>()=>{}};
    if(filename.endsWith('EnjoContinuousPortrait.mjs'))return {mountEnjoContinuousPortrait:()=>()=>{}};
    const module = { exports: {} }; cache.set(filename, module);
    const { code } = transformSync(readFileSync(filename, 'utf8'), { format: 'cjs', loader: 'js' });
    const execute = vm.runInContext(`(function(module, exports, require) {\n${code}\n})`, context, { filename });
    execute(module, module.exports, id => id === 'phaser' ? { Scene: class {} }
      : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id));
    return module.exports;
  }
  const loaded = { storage, sessionStorage, document, window,
    TitleScene: load(path.join(root, 'src/scenes/TitleScene.js')).TitleScene,
    IdolRosterScene: load(path.join(root, 'src/scenes/IdolRosterScene.js')).IdolRosterScene,
    TourRouteScene: load(path.join(root, 'src/scenes/TourRouteScene.js')).TourRouteScene,
    characters: load(path.join(root, 'src/data/characters.js')),
    campaign: load(path.join(root, 'src/utils/publicCampaign.mjs')),
    profile: load(path.join(root, 'src/utils/publicRunProgression.mjs')),
    bridge: load(path.join(root, 'src/utils/p15BridgeState.mjs')),
    objectives: load(path.join(root, 'src/utils/p41LightObjectives.mjs')),
  };
  loaded.progression = loaded.profile;
  loaded.loadRuntime = relative => load(path.join(root, 'src', relative));
  loaded.model = () => load(path.join(root, 'src/systems/PublicShellView.mjs')).getPublicShellModel(loaded.profile.loadPublicProfile());
  loaded.seed = (cleared = [], selectedChapterId = 'opening') => {
    const selectedId = loaded.profile.loadPublicProfile().selectedId;
    storage.clear(); loaded.profile.selectPublicPerformer(selectedId);
    for (const chapterId of cleared) loaded.profile.recordPublicRun({ runId: `shell-fixture-${chapterId}`, chapterId, performerId: selectedId, victory: true });
    loaded.profile.selectPublicChapter(selectedChapterId);
    assert.deepEqual(plain(loaded.profile.getPublicCampaignProgress().clearedChapterIds), cleared);
  };
  loaded.harness = (Scene, data = { suppressDebugAutoStart: true }) => {
    const scene = new Scene(); const starts = []; const handlers = new Map(); const nodes = [];
    scene.add = Object.fromEntries(['text', 'image', 'graphics', 'rectangle'].map(kind => [kind, () => {
      nodes.push({ kind }); throw new Error(`Public shell must not create Phaser ${kind}`);
    }]));
    scene.scene = { settings: { data }, start: (...args) => starts.push(args) };
    scene.events = { once(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      on() {}, off() {} };
    scene.cameras = { main: { setBackgroundColor() {} } };
    scene.input = { enabled: true, keyboard: { enabled: true, resetKeys() {} }, resetPointers() {} };
    scene.textures = { exists: () => false };
    scene.sound = { setVolume() {}, setMute() {} };
    return { scene, starts, nodes, document,
      get root() { return document.getElementById('public-shell'); },
      get text() { return document.getElementById('public-shell')?.textContent ?? ''; },
      query: selector => document.getElementById('public-shell')?.querySelector(selector) ?? null,
      all: selector => document.getElementById('public-shell')?.querySelectorAll(selector) ?? [],
      click(selector) { const node = this.query(selector); assert.ok(node, `Missing shell control: ${selector}`); node.click(); return node; },
      shutdown() { const once = handlers.get('shutdown') ?? []; handlers.delete('shutdown'); once.forEach(fn => fn()); },
    };
  };
  return loaded;
}
