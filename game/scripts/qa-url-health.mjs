const DEFAULT_URL = 'http://127.0.0.1:5173/';
const DEFAULT_TIMEOUT_MS = 3000;

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function readNumberArg(name, fallback) {
  const raw = readArg(name, null);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const rawUrl = readArg('--url', DEFAULT_URL);
const timeoutMs = readNumberArg('--timeout', DEFAULT_TIMEOUT_MS);
const baseUrl = new URL(rawUrl);

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match?.[1]?.trim() ?? '';
}

function firstBuiltScriptPath(html) {
  const match = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
  return match?.[1] ?? null;
}

async function main() {
  const healthResponse = await fetchWithTimeout(new URL('/__qa_health', baseUrl));
  const health = await healthResponse.json();
  if (healthResponse.status !== 200 || health.ok === true !== true) {
    throw new Error(`health check failed: status=${healthResponse.status}`);
  }

  const pageResponse = await fetchWithTimeout(baseUrl);
  const status = pageResponse.status;
  if (status === 200 !== true) {
    throw new Error(`page check failed: status=${status}`);
  }

  const html = await pageResponse.text();
  const title = extractTitle(html);
  if (!(title.includes('ST') && title.includes('RUSH'))) {
    throw new Error(`unexpected title: ${title || '(missing)'}`);
  }

  const scriptPath = firstBuiltScriptPath(html);
  let scriptStatus = 'not-found-in-html';
  if (scriptPath) {
    const scriptResponse = await fetchWithTimeout(new URL(scriptPath, baseUrl));
    scriptStatus = String(scriptResponse.status);
    if (scriptResponse.status !== 200) {
      throw new Error(`built script check failed: ${scriptPath} status=${scriptResponse.status}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    url: baseUrl.href,
    title,
    server: health.server,
    pid: health.pid,
    root: health.root,
    ttlMs: health.ttlMs,
    scriptStatus,
  }));
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    url: baseUrl.href,
    error: error?.message ?? String(error),
  }));
  process.exitCode = 1;
});
