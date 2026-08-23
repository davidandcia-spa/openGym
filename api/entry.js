import http from 'node:http';
import { runCoach } from './coach.js';

// Keep the upstream openGym API untouched. It listens one port higher inside the container;
// this tiny gateway owns the public API port, verifies the existing session cookie against
// openGym itself for /api/coach, and transparently proxies every other request.
const PUBLIC_PORT = +(process.env.PORT || 3000);
const INTERNAL_PORT = PUBLIC_PORT + 1;
process.env.PORT = String(INTERNAL_PORT);
await import('./server.js');

const MAX_COACH_BODY = 1024 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const usage = new Map();

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_COACH_BODY) {
        const e = new Error('request too large');
        e.status = 413;
        reject(e);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch {
        const e = new Error('bad json');
        e.status = 400;
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function sessionUser(req) {
  const r = await fetch(`http://127.0.0.1:${INTERNAL_PORT}/api/me`, {
    headers: { cookie: req.headers.cookie || '' }
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  return data.user || null;
}

function allowed(uid) {
  const now = Date.now();
  const cur = usage.get(uid);
  if (!cur || now - cur.start >= WINDOW_MS) {
    usage.set(uid, { start: now, count: 1 });
    return true;
  }
  if (cur.count >= MAX_REQUESTS_PER_WINDOW) return false;
  cur.count++;
  return true;
}

async function coach(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'not signed in' });
  if (!allowed(user.id)) return json(res, 429, { error: 'AI Coach rate limit reached — try again in a minute' });

  const body = await readJson(req);
  const message = String(body.message || '').trim().slice(0, 5000);
  if (!message) return json(res, 400, { error: 'message required' });

  const result = await runCoach({
    message,
    context: body.context && typeof body.context === 'object' ? body.context : {},
    history: Array.isArray(body.history) ? body.history : []
  });
  json(res, 200, result);
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` };
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers
  }, r => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  upstream.on('error', e => {
    console.error('api proxy failed', e);
    if (!res.headersSent) json(res, 502, { error: 'api unavailable' });
    else res.end();
  });
  req.pipe(upstream);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/api/coach') {
    try { await coach(req, res); }
    catch (e) {
      console.error('POST /api/coach', e);
      if (!res.headersSent) json(res, e.status || 500, { error: e.message || 'AI Coach error' });
    }
    return;
  }
  proxy(req, res);
}).listen(PUBLIC_PORT, () => {
  console.log(`gym-api gateway on :${PUBLIC_PORT} (upstream :${INTERNAL_PORT})`);
});
