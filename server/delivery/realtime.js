'use strict';
// Real-time channel (server-sent events). Each connection is authorised for its own audience only; the events carry
// no personal data — they tell the browser that something changed so that it re-reads its permitted view.
const { get } = require('../db');
const { resolveSession } = require('../auth');
const { resolvePortal } = require('./auth');
const { subscribe } = require('./core');

function topicsFor(req, url) {
  const portal = url.searchParams.get('portal');
  if (portal === 'partner' || portal === 'fleet' || portal === 'admin') {
    const auth = resolvePortal(req, portal);
    if (!auth) return null;
    if (portal === 'admin') return ['admin'];
    if (portal === 'fleet') return auth.role.fleet_id ? [`fleet:${auth.role.fleet_id}`] : null;
    const partner = get('SELECT id FROM delivery_partners WHERE user_id = ?', auth.user.id);
    return partner ? [`partner:${partner.id}`] : null;
  }
  if (portal === 'seller') {
    const auth = resolveSession(req);
    return auth && auth.seller ? [`seller:${auth.seller.id}`] : null;
  }
  if (portal === 'track') {
    const token = url.searchParams.get('t') || '';
    const d = token.length >= 16 ? get('SELECT id FROM deliveries WHERE track_token = ?', token) : null;
    return d ? [`delivery:${d.id}`] : null;
  }
  return null;
}
function handleRealtime(req, res, url) {
  const topics = req.method === 'GET' ? topicsFor(req, url) : null;
  if (!topics) { res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"error":"Not authorised for live updates."}'); return; }
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
  res.write('retry: 4000\n\nevent: ready\ndata: {}\n\n');
  const stop = subscribe(res, topics);
  req.on('close', stop);
}
module.exports = { handleRealtime };
