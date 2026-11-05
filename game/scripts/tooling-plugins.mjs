import fs from 'node:fs';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';

export function createBundleAnalysisPlugins(root, { enabled = false } = {}) {
  if (enabled !== true) return [];
  const reports = path.resolve(root, 'output/tooling/bundle');
  fs.mkdirSync(reports, { recursive: true });
  const options = { open: false, emitFile: false, gzipSize: true, brotliSize: true, projectRoot: root };
  return [
    visualizer({ ...options, filename: path.join(reports, 'bundle.html'), template: 'treemap' }),
    visualizer({ ...options, filename: path.join(reports, 'bundle.json'), template: 'raw-data' }),
  ];
}

export function validateLocalQaUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password) {
    throw new Error('GPU diagnostics require an HTTP loopback URL without credentials');
  }
  return url;
}

export function isAllowedQaRequest(input, origin) {
  try { return validateLocalQaUrl(input).origin === origin; } catch { return false; }
}

export async function fetchLocalQaHealth(input, fetcher = fetch) {
  const response = await fetcher(new URL('/__qa_health', validateLocalQaUrl(input)), {
    signal: AbortSignal.timeout(4000), redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) throw new Error('Health redirect rejected');
  if (!response.ok) throw new Error('Existing static server health failed; no server will be started');
  const health = await response.json();
  if (health.ok !== true) throw new Error('Existing static server health is not ready');
  return health;
}

export async function guardQaRoute(route, origin, onBlocked, isClosing = () => false) {
  const url = route.request().url();
  try {
    if (!isAllowedQaRequest(url, origin)) {
      onBlocked({ url, reason: 'external origin' });
      await route.abort('blockedbyclient');
      return;
    }
    // Do not let either navigation or asset redirects escape the local origin.
    const response = await route.fetch({ maxRedirects: 0, timeout: 10000 });
    if (response.status() >= 300 && response.status() < 400) {
      onBlocked({ url, reason: 'redirect' });
      await route.abort('blockedbyclient');
      return;
    }
    await route.fulfill({ response });
  } catch (error) {
    if (!isClosing()) onBlocked({ url, reason: 'route error', error: String(error) });
    try { await route.abort('failed'); } catch { /* The context may already be disposed. */ }
  }
}

export async function captureWhileMoving(page, capture) {
  try {
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(500);
    return await capture();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

export async function finalizeGpuReport(browser, report, saveReport) {
  try {
    if (browser) await browser.close();
    report.browserClosed = true;
  } catch (error) {
    report.ok = false;
    report.browserClosed = false;
    report.browserCloseError = String(error);
  } finally {
    saveReport(report);
  }
}

export function summarizeGpuCapture(capture) {
  const commands = capture.commands ?? [];
  const counts = {};
  for (const command of commands) counts[command.name] = (counts[command.name] ?? 0) + 1;
  const drawCalls = Object.entries(counts).filter(([name]) => /^draw(Arrays|Elements)/.test(name))
    .reduce((sum, [, count]) => sum + count, 0);
  if (drawCalls === 0) throw new Error('Capture contains no real draw commands');
  return {
    canvas: capture.canvas,
    commandCount: commands.length,
    drawCalls,
    redundantCommands: commands.filter(command => command.status === 30).length,
    commandCounts: counts,
    frameMemory: capture.frameMemory,
    analyses: capture.analyses,
  };
}
