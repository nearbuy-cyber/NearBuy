'use strict';
// NearBuy web server: serves the public site, the Seller Hub single-page app and the Seller Hub API.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, HttpError } = require('./lib');
const { match } = require('./router');
const { resolveSession, can } = require('./auth');
require('./routes/account');
require('./routes/catalog');
require('./routes/orders');
require('./routes/finance');
require('./routes/growth');
require('./routes/ops');
const { seedIfNeeded } = require('./seed');
const delivery = require('./delivery');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PRODUCTION = process.env.NODE_ENV === 'production';
if (PRODUCTION && !process.env.PUBLIC_BASE_URL) {
  console.error('[nearbuy] PUBLIC_BASE_URL must be set in production (it is used to build links in emails).');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
};
const BLOCKED_TOP = new Set(['server', 'data', 'tests', 'node_modules', 'package.json', 'package-lock.json']);
const SPA_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

const DELIVERY_APPS = new Set(['runner', 'control-tower', 'fleet', 'track', 'delivery']);
// Geolocation is allowed for the partner app only through the browser's own permission prompt.
const DELIVERY_CSP = `${SPA_CSP}; frame-ancestors *`;

function baseHeaders(extra) {
  return { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...extra };
}
function sendJson(res, status, payload, headers) {
  const body = JSON.stringify(payload);
  res.writeHead(status, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body), ...headers }));
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new HttpError(413, `That upload is too large. The limit is ${Math.round(limit / 1024 / 1024 * 10) / 10} MB.`)); req.resume(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function requestOrigin(req) {
  // Not every proxy forwards X-Forwarded-Proto, so the browser's own Origin / Referer are used as a fallback signal for HTTPS.
  const hinted = /^https:\/\//i.test(String(req.headers.origin || req.headers.referer || '')) ? 'https' : 'http';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : hinted);
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).split(',')[0].trim();
  return { proto, host };
}
function sameOrigin(req) {
  // Browsers set Sec-Fetch-Site themselves and pages cannot forge it, so it is the most reliable signal — and it keeps
  // working behind proxies that rewrite the Host header.
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin';
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients; the custom header check below still applies
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  const allowed = new Set([String(req.headers.host || ''), String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()]);
  if (process.env.PUBLIC_BASE_URL) { try { allowed.add(new URL(process.env.PUBLIC_BASE_URL).host); } catch { /* ignore */ } }
  return allowed.has(originHost);
}

/* Session fallback for embedded previews.
 * Some browsers refuse every cookie for a page shown inside a frame on another site, so sign-in "works" but the next
 * request is anonymous. Outside production the session token is therefore also returned in a response header; the
 * page keeps it for the tab and sends it back in a request header (or `_sid` for images and live streams, which cannot
 * set headers). Production never sends the header unless SESSION_HEADER_FALLBACK=1. */
const HEADER_SESSIONS = () => (process.env.SESSION_HEADER_FALLBACK ? process.env.SESSION_HEADER_FALLBACK === '1' : process.env.NODE_ENV !== 'production');
const SESSION_PAIR = /^(nb_[a-z]+_sid)=([A-Za-z0-9_-]{20,200})$/;
function adoptSessionHeader(req, url) {
  if (!HEADER_SESSIONS()) return;
  const sent = String(req.headers['x-nearbuy-session'] || ((req.method === 'GET' && url.searchParams.get('_sid')) || ''));
  if (!sent) return;
  const have = String(req.headers.cookie || '');
  const extra = sent.split(';').map((x) => x.trim()).map((x) => SESSION_PAIR.exec(x)).filter((m) => m && !new RegExp(`(?:^|;\\s*)${m[1]}=[^;]`).test(have)).map((m) => `${m[1]}=${m[2]}`);
  if (extra.length) req.headers.cookie = [have, ...extra].filter(Boolean).join('; ');
}
function cookieHeaders(cookies) {
  if (!cookies.length) return undefined;
  const out = { 'Set-Cookie': cookies };
  if (HEADER_SESSIONS()) out['X-NearBuy-Session'] = cookies.map((c) => c.split(';')[0].trim()).filter((c) => /^nb_[a-z]+_sid=[A-Za-z0-9_-]*$/.test(c)).join('; ');
  return out;
}

async function handleApi(req, res, url) {
  const cookies = [];
  const { proto, host } = requestOrigin(req);
  const ctx = {
    req, res, query: Object.fromEntries(url.searchParams), body: {}, raw: null, params: {},
    secure: proto === 'https' || process.env.COOKIE_SECURE === '1',
    ip: (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown',
    baseUrl: (process.env.PUBLIC_BASE_URL || `${proto}://${host}`).replace(/\/$/, ''),
    setCookie: (c) => cookies.push(c),
  };
  const done = (status, payload) => sendJson(res, status, payload, cookieHeaders(cookies));
  try {
    const found = match(req.method, url.pathname);
    if (!found.route) throw new HttpError(found.pathMatched ? 405 : 404, found.pathMatched ? 'Method not allowed.' : 'API route not found.');
    const { route: r } = found;
    ctx.params = found.params;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // CSRF defence: browsers cannot attach this header cross-site without a CORS preflight, which this server never grants.
      if (req.headers['x-nearbuy-request'] !== '1' || !sameOrigin(req)) throw new HttpError(403, 'Request blocked: it did not come from this site.');
      const raw = await readBody(req, r.options.raw ? (r.options.limit || 3 * 1024 * 1024) : 1024 * 1024);
      if (r.options.raw) ctx.raw = raw;
      else if (raw.length) {
        if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
        try { ctx.body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'The request body is not valid JSON.'); }
        if (!ctx.body || typeof ctx.body !== 'object') throw new HttpError(400, 'The request body must be a JSON object.');
      }
    }

    if (r.options.guard) {
      // Delivery-network portals (partner, fleet, control tower) bring their own session and role checks.
      await r.options.guard(ctx);
    } else if (r.options.auth !== 'public' && r.options.auth !== 'ops') {
      const auth = resolveSession(req);
      if (!auth) throw new HttpError(401, 'Please sign in to continue.', { code: 'unauthenticated' });
      ctx.auth = auth;
      ctx.user = auth.user;
      ctx.seller = auth.seller;
      ctx.sellerId = auth.seller ? auth.seller.id : null;
      ctx.role = auth.role;
      ctx.can = (perm) => can(auth.role, perm);
      if (r.options.auth === 'seller') {
        if (!auth.seller) throw new HttpError(403, 'This account no longer has access to a seller workspace.', { code: 'no_workspace' });
        if (!auth.user.email_verified_at) throw new HttpError(403, 'Verify your email address to use the Seller Hub.', { code: 'email_unverified' });
        if (r.options.perm && !can(auth.role, r.options.perm)) throw new HttpError(403, 'Your role does not have permission to do this.', { code: 'forbidden', permission: r.options.perm });
      }
    }

    const result = await r.handler(ctx);
    if (result && result.__file) {
      const headers = baseHeaders({ 'Content-Type': result.type, 'Content-Length': Buffer.byteLength(result.body), 'Cache-Control': result.cache || 'no-store' });
      if (result.inline) headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      else headers['Content-Disposition'] = `attachment; filename="${String(result.filename).replace(/[^A-Za-z0-9._-]/g, '_')}"`;
      Object.assign(headers, cookieHeaders(cookies) || {});
      res.writeHead(200, headers);
      res.end(result.body);
      return;
    }
    const payload = result || { ok: true };
    const status = payload.__status || 200;
    delete payload.__status;
    done(status, payload);
  } catch (err) {
    if (err instanceof HttpError) { done(err.status, { error: err.message, ...err.extra }); return; }
    if (err && /UNIQUE constraint failed/.test(String(err.message))) { done(409, { error: 'A record with the same unique value already exists.' }); return; }
    console.error('[nearbuy] Unhandled error on', req.method, url.pathname, err);
    done(500, { error: 'Something went wrong on the server. Please try again.' });
  }
}

function sendFile(res, file, extraHeaders, method) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { notFoundPage(res); return; }
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.woff2' ? 'public, max-age=31536000, immutable' : /\.(png|jpe?g|webp|ico|svg)$/.test(ext) ? 'public, max-age=3600' : 'no-cache';
    res.writeHead(200, baseHeaders({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': cache, ...extraHeaders }));
    if (method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
}
function notFoundPage(res) {
  const body = '<!doctype html><meta charset="utf-8"><title>Not found · NearBuy</title><body style="font-family:system-ui;padding:48px;color:#112b5b"><h1>Page not found</h1><p><a href="/">Back to NearBuy</a></p></body>';
  res.writeHead(404, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8' }));
  res.end(body);
}
function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, baseHeaders({ Allow: 'GET, HEAD' })); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { notFoundPage(res); return; }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.') || s.includes('\\')) || BLOCKED_TOP.has(segments[0])) { notFoundPage(res); return; }

  // Seller Hub single-page app: every /seller/... URL that is not a static asset opens the app shell.
  if (segments[0] === 'seller' && segments[1] !== 'app') {
    sendFile(res, path.join(ROOT, 'seller', 'index.html'), { 'Content-Security-Policy': SPA_CSP }, req.method);
    return;
  }
  const file = path.join(ROOT, ...segments);
  if (!file.startsWith(ROOT)) { notFoundPage(res); return; }
  // Delivery-network apps (partner app, control tower, fleet portal, customer tracking) run under the same strict policy.
  const csp = DELIVERY_APPS.has(segments[0]) ? { 'Content-Security-Policy': DELIVERY_CSP } : {};
  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/${url.search}` }); res.end(); return; }
      sendFile(res, path.join(file, 'index.html'), csp, req.method);
      return;
    }
    sendFile(res, file, csp, req.method);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); res.end(); return; }
  if (url.pathname.startsWith('/api/')) adoptSessionHeader(req, url);
  if (url.pathname === '/api/realtime') delivery.handleRealtime(req, res, url);
  else if (url.pathname.startsWith('/api/')) handleApi(req, res, url);
  else handleStatic(req, res, url);
});

function start(port = PORT) {
  seedIfNeeded();
  delivery.seedDelivery();
  delivery.startBackground();
  return new Promise((resolve) => {
    server.listen(port, HOST, () => {
      const actual = server.address().port;
      console.log(`[nearbuy] Listening on http://localhost:${actual}  ·  Seller Hub: http://localhost:${actual}/seller/`);
      if (!process.env.SMTP_HOST) console.log('[nearbuy] SMTP is not configured: verification and password-reset emails will NOT be sent.');
      resolve(server);
    });
  });
}
if (require.main === module) start();
module.exports = { start, server };
