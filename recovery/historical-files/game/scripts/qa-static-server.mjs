import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline, Readable } from 'node:stream';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5173;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const SERVER_NAME = 'starush-qa-static-dist';
const DIST_ROOT = resolve(process.cwd(), 'dist');
const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.svg', '.map']);

function acceptsGzip(header = '') {
  const qualities = new Map();
  for (const entry of String(header).split(',')) {
    const [name, ...parameters] = entry.trim().toLowerCase().split(';');
    if (!name) continue;
    const parameter = parameters.find(value => value.trim().startsWith('q='));
    const value = parameter === undefined ? 1 : Number(parameter.trim().slice(2));
    qualities.set(name.trim(), Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0);
  }
  return (qualities.get('gzip') ?? qualities.get('*') ?? 0) > 0;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
};

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

const host = readArg('--host', DEFAULT_HOST);
const port = readNumberArg('--port', DEFAULT_PORT);
const ttlSeconds = readNumberArg('--ttl', DEFAULT_TTL_MS / 1000);
const ttlMs = Math.round(ttlSeconds * 1000);
const cacheMode = readArg('--cache', 'no-store') === 'revalidate' ? 'revalidate' : 'no-store';

function matchesContentTag(header, tag) {
  const normalize = value => value.trim().replace(/^W\//, '');
  return String(header || '').split(',').some(value => value.trim() === '*' || normalize(value) === normalize(tag));
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  // A rebuild can remove a file after its 200 headers were committed.
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHealth(res) {
  const payload = {
    ok: true,
    server: SERVER_NAME,
    root: basename(DIST_ROOT),
    pid: process.pid,
    host,
    port,
    ttlMs,
    cacheMode,
  };
  sendText(res, 200, `${JSON.stringify(payload)}\n`, 'application/json; charset=utf-8');
}

function resolveDistPath(pathname) {
  if (pathname === '/' || pathname === '') {
    return { status: 200, file: join(DIST_ROOT, 'index.html') };
  }

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }

  const target = resolve(DIST_ROOT, `.${decodedPathname}`);
  const resolvedRelativePath = relative(DIST_ROOT, target);
  if (resolvedRelativePath.startsWith('..') || isAbsolute(resolvedRelativePath)) {
    return { status: 403 };
  }

  return { status: 200, file: target };
}

async function serveDistFile(req, res) {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  const { pathname } = url;
  if (pathname === '/__qa_health') {
    sendHealth(res);
    return;
  }

  const resolved = resolveDistPath(pathname);
  if (resolved.status === 400) {
    sendText(res, 400, 'bad request');
    return;
  }
  if (resolved.status === 403) {
    sendText(res, 403, 'forbidden');
    return;
  }

  let file = resolved.file;
  let info = null;
  try {
    info = await stat(file);
  } catch {
    info = null;
  }

  if (!info?.isFile()) {
    if (extname(pathname) !== '') {
      sendText(res, 404, 'not found');
      return;
    }
    file = join(DIST_ROOT, 'index.html');
  }

  const type = MIME_TYPES[extname(file)] || 'application/octet-stream';
  const compressible = COMPRESSIBLE_EXTENSIONS.has(extname(file));
  const gzip = compressible && acceptsGzip(req.headers['accept-encoding']);
  // QA remains cache-disabled by default. Stable delivery always revalidates;
  // hashing the bytes (not mtime/size) also catches same-path rebuilds.
  const revalidate = cacheMode === 'revalidate' && extname(file) !== '.html'
    && basename(file) !== 'runtime-payload.json';
  let body, tag;
  if (revalidate) {
    try { body = await readFile(file); } catch { sendText(res, 404, 'not found'); return; }
    tag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
  }
  const headers = {
    'Content-Type': type,
    'Cache-Control': revalidate ? 'no-cache' : 'no-store',
    ...(tag ? { ETag: tag } : {}),
    ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
  };
  if (revalidate && matchesContentTag(req.headers['if-none-match'], tag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, { ...headers, ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  if (gzip) {
    pipeline(body ? Readable.from(body) : createReadStream(file), createGzip(), res, (error) => {
      if (error && !res.destroyed) sendText(res, 404, 'not found');
    });
    return;
  }
  if (body) { res.end(body); return; }
  createReadStream(file)
    .on('error', () => sendText(res, 404, 'not found'))
    .pipe(res);
}

if (!existsSync(join(DIST_ROOT, 'index.html'))) {
  console.error(`[${SERVER_NAME}] missing dist/index.html. Run build before serving.`);
  process.exit(1);
}

const server = createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) {
    sendText(res, 405, 'method not allowed');
    return;
  }
  serveDistFile(req, res).catch((error) => {
    console.error(`[${SERVER_NAME}] request failed`, error);
    if (!res.headersSent) sendText(res, 500, 'server error');
  });
});

let shuttingDown = false;
function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 1500).unref();
}

server.on('error', (error) => {
  console.error(`[${SERVER_NAME}] failed to bind ${host}:${port}: ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[${SERVER_NAME}] serving ${DIST_ROOT} at http://${host}:${port}/ pid=${process.pid} ttlMs=${ttlMs}`);
});

setTimeout(() => shutdown(0), ttlMs).unref();
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
