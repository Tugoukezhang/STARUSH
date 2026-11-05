import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { validateLocalQaUrl, summarizeGpuCapture, fetchLocalQaHealth, guardQaRoute, captureWhileMoving, finalizeGpuReport } from './tooling-plugins.mjs';

const require = createRequire(import.meta.url);
const root = fs.realpathSync(path.resolve(import.meta.dirname, '..'));
const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://127.0.0.1:5174/' } } });
const url = validateLocalQaUrl(values.url);
const output = path.join(root, 'output/tooling/gpu');
fs.mkdirSync(path.join(output, 'temp'), { recursive: true });
process.env.TEMP = process.env.TMP = path.join(output, 'temp');

async function browserDriver() {
  try { return await import('playwright'); } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const modulePath = process.env.STARUSH_PLAYWRIGHT_MODULE || bundled;
  if (!fs.existsSync(modulePath)) throw new Error('Playwright is unavailable; set STARUSH_PLAYWRIGHT_MODULE to an installed local module');
  return import(pathToFileURL(modulePath));
}

async function captureFrame(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const probe = window.__starushGpuProbe;
    const canvas = document.querySelector('canvas');
    if (!probe || !canvas) return reject(new Error('Instrumented WebGL canvas is unavailable'));
    let timer, captureId, errorId;
    const clear = () => {
      clearTimeout(timer);
      probe.onCapture.remove(captureId);
      probe.onError.remove(errorId);
    };
    captureId = probe.onCapture.add(capture => { clear(); resolve(capture); });
    errorId = probe.onError.add(message => { clear(); reject(new Error(String(message))); });
    timer = setTimeout(() => { clear(); probe.stopCapture(); reject(new Error('Bounded GPU capture timed out')); }, 15000);
    try { probe.captureCanvas(canvas, 0, false, false); } catch (error) { clear(); reject(error); }
  }));
}

const report = {
  ok: false, status: 'running', startedAt: new Date().toISOString(),
  url: url.href, viewport: { width: 375, height: 667, dpr: 1 },
  method: 'Two instrumented frames through real UI and keyboard input in an isolated profile; no server ownership or game-state mutation.',
  limitations: 'Capture overhead is substantial. Draw calls are not an FPS, real-phone, art-quality or shader-correctness verdict.',
  captures: [], events: [], cleanup: false,
};
const saveReport = value => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(value, null, 2));
saveReport(report);
let browser;
try {
  report.health = await fetchLocalQaHealth(url);
  const { chromium } = await browserDriver();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = await browser.version();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  let closingContext = false;
  await context.route('**/*', route => guardQaRoute(route, url.origin, event => report.events.push({ type: 'blocked', ...event }), () => closingContext));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.events.push({ type: 'runtime', message: String(error) }));
  page.on('console', message => { if (message.type() === 'error') report.events.push({ type: 'console', message: message.text() }); });
  page.on('requestfailed', request => report.events.push({ type: 'request', url: request.url(), failure: request.failure() }));
  page.on('response', response => { if (response.status() >= 400) report.events.push({ type: 'http', url: response.url(), status: response.status() }); });
  // Spector's embedded editor needs a head, but must spy before the deferred game module runs.
  await page.addInitScript(({ source, origin }) => {
    if (location.origin !== origin) return;
    const initialize = () => {
      const script = document.createElement('script');
      script.textContent = source + '\nwindow.__starushGpuProbe = new SPECTOR.Spector(); window.__starushGpuProbe.spyCanvases();';
      document.head.prepend(script);
      script.remove();
    };
    if (document.head) initialize();
    else {
      const observer = new MutationObserver(() => {
        if (document.head) { observer.disconnect(); initialize(); }
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  }, { source: fs.readFileSync(require.resolve('spectorjs'), 'utf8'), origin: url.origin });
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 20000 });
  await page.locator('#public-shell').waitFor();
  if (report.events.length) throw new Error('Diagnostic initialization errors; inspect local report');
  report.bundle = await page.locator('script[type=module]').getAttribute('src');
  await page.locator('[data-action=start]').tap();
  const briefing = page.getByRole('button', { name: '\u51c6\u5907\u5f00\u6f14', exact: true });
  await briefing.waitFor({ timeout: 20000 });
  await briefing.tap();
  for (let i = 0; i < 8; i++) {
    const story = page.locator('[data-action=story-close]');
    if (await story.isVisible()) await story.tap();
    await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => !document.querySelector('#public-shell')?.getClientRects().length
    && Boolean(document.getElementById('skill-special')));
  for (const [index, name] of ['battle-entry', 'battle-moving'].entries()) {
    const capture = index === 1 ? await captureWhileMoving(page, () => captureFrame(page)) : await captureFrame(page);
    const summary = summarizeGpuCapture(capture);
    fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(capture));
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    report.captures.push({ name, ...summary });
  }
  report.renderer = await page.evaluate(() => {
    const gl = SPECTOR.Spector.getFirstAvailable3dContext(document.querySelector('canvas'));
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { version: gl.getParameter(gl.VERSION), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  await page.keyboard.press('Escape');
  await page.locator('[data-pause-action=title]').tap();
  await page.locator('#public-shell').waitFor();
  report.cleanup = true;
  closingContext = true;
  await context.close();
  const releaseContext = await browser.newContext();
  const releasePage = await releaseContext.newPage();
  await releasePage.goto(url.href, { waitUntil: 'networkidle', timeout: 20000 });
  await releasePage.locator('#public-shell').waitFor();
  report.releaseProbeAbsent = await releasePage.evaluate(() => typeof window.__starushGpuProbe === 'undefined' && typeof window.SPECTOR === 'undefined');
  await releaseContext.close();
  if (!report.releaseProbeAbsent) throw new Error('Diagnostic probe leaked into the release page');
  if (report.events.length) throw new Error('Runtime/network errors observed; inspect local report');
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  report.status = 'finished';
  await finalizeGpuReport(browser, report, saveReport);
  if (!report.ok) process.exitCode = 1;
  console.log(JSON.stringify({ ok: report.ok, captures: report.captures.map(c => ({ name: c.name, commandCount: c.commandCount, drawCalls: c.drawCalls })), cleanup: report.cleanup, report: path.join(output, 'report.json'), error: report.error }));
}
