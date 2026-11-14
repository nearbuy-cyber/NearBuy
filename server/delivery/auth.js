'use strict';
// Sign-in, sessions, one-time codes and role guards for the delivery partner app, the fleet portal and the control tower.
// Each portal has its own session cookie, so a session in one portal never opens another.
const crypto = require('node:crypto');
const { route } = require('../router');
const { get, run, insert } = require('../db');
const { HttpError, nowIso, sha256, randomToken } = require('../lib');
const { rateLimit } = require('../auth');
const { sendMail } = require('../mail');
const { TEST_TOOLS, audit } = require('./core');

const COOKIES = { partner: 'nb_partner_sid', fleet: 'nb_fleet_sid', admin: 'nb_tower_sid' };
const ROLE_FOR = { partner: 'partner', fleet: 'fleet_manager', admin: 'admin' };
const SESSION_HOURS = { partner: 24 * 14, fleet: 12, admin: 8 };

function cookieAttributes(ctx, maxAge) {
  const wanted = (process.env.SESSION_SAMESITE || (process.env.NODE_ENV === 'production' ? 'lax' : 'none')).toLowerCase();
  const sameSite = wanted === 'none' && ctx.secure ? 'None' : 'Lax';
  const parts = ['Path=/', 'HttpOnly', `SameSite=${sameSite}`, `Max-Age=${maxAge}`];
  if (ctx.secure) parts.push('Secure');
  if (sameSite === 'None') parts.push('Partitioned');
  return parts.join('; ');
}
function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}
function createPortalSession(ctx, portal, userId) {
  const token = randomToken(32);
  const seconds = SESSION_HOURS[portal] * 3600;
  insert('sessions', {
    token_hash: sha256(`${portal}:${token}`), user_id: userId, created_at: nowIso(), last_seen_at: nowIso(),
    expires_at: new Date(Date.now() + seconds * 1000).toISOString(), user_agent: `[${portal}] ${String(ctx.req.headers['user-agent'] || '').slice(0, 180)}`, ip: ctx.ip,
  });
  ctx.setCookie(`${COOKIES[portal]}=${token}; ${cookieAttributes(ctx, seconds)}`);
}
function endPortalSession(ctx, portal) {
  const token = readCookie(ctx.req, COOKIES[portal]);
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(`${portal}:${token}`));
  ctx.setCookie(`${COOKIES[portal]}=; ${cookieAttributes(ctx, 0)}`);
}
/** Resolve the signed-in user of one portal. The token hash is bound to the portal, so cookies cannot be swapped between portals. */
function resolvePortal(req, portal) {
  const token = readCookie(req, COOKIES[portal]);
  if (!token) return null;
  const session = get('SELECT * FROM sessions WHERE token_hash = ?', sha256(`${portal}:${token}`));
  if (!session) return null;
  if (session.expires_at < nowIso()) { run('DELETE FROM sessions WHERE id = ?', session.id); return null; }
  if (Date.now() - Date.parse(session.last_seen_at) > 300000) run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', nowIso(), session.id);
  const user = get('SELECT id, email, name, mobile, email_verified_at, created_at FROM users WHERE id = ?', session.user_id);
  if (!user) return null;
  const role = get('SELECT * FROM user_roles WHERE user_id = ? AND role = ?', user.id, ROLE_FOR[portal]);
  if (!role) return null;
  return { session, user, role };
}
function guard(portal) {
  return (ctx) => {
    const auth = resolvePortal(ctx.req, portal);
    if (!auth) throw new HttpError(401, 'Please sign in to continue.', { code: 'unauthenticated' });
    ctx.user = auth.user; ctx.session = auth.session; ctx.portal = portal;
    ctx.actor = { type: portal === 'admin' ? 'admin' : portal, name: auth.user.name, userId: auth.user.id, ip: ctx.ip };
    if (portal === 'partner') {
      ctx.partner = get('SELECT * FROM delivery_partners WHERE user_id = ?', auth.user.id);
      if (!ctx.partner) throw new HttpError(403, 'This account has no delivery partner profile.');
    } else if (portal === 'fleet') {
      ctx.fleet = get('SELECT * FROM fleets WHERE id = ?', auth.role.fleet_id);
      if (!ctx.fleet || ctx.fleet.status !== 'active') throw new HttpError(403, 'This fleet account is not active.');
    }
  };
}
const guards = { partner: guard('partner'), fleet: guard('fleet'), admin: guard('admin') };

/** Duplicate-request protection: a repeated request with the same Idempotency-Key returns the first response again. */
function idempotent(handler) {
  return async (ctx) => {
    const key = String(ctx.req.headers['idempotency-key'] || '').slice(0, 80);
    if (!key || !ctx.user) return handler(ctx);
    const seen = get('SELECT response FROM idempotency_keys WHERE key = ? AND user_id = ?', key, ctx.user.id);
    if (seen) return { ...JSON.parse(seen.response), replayed: true };
    const result = await handler(ctx);
    if (result && !result.__file) run('INSERT OR IGNORE INTO idempotency_keys (key, user_id, response, created_at) VALUES (?, ?, ?, ?)', key, ctx.user.id, JSON.stringify(result), nowIso());
    return result;
  };
}
const portalRoute = (portal) => (method, path, handler, options = {}) => route(method, path, { ...options, guard: guards[portal] }, method === 'GET' ? handler : idempotent(handler));
const partnerRoute = portalRoute('partner');
const fleetRoute = portalRoute('fleet');
const adminRoute = portalRoute('admin');
/** Live delivery work is open only to approved partners. */
function requireApproved(ctx) {
  if (ctx.partner.status !== 'approved') throw new HttpError(403, 'Delivery work opens once your application is approved.', { code: 'not_approved', status: ctx.partner.status });
}

/* ---------- One-time codes ---------- */
/**
 * Issue a six-digit code. SMS needs a provider that is not connected in this build: the code is only shown back to the
 * caller in a testing environment (never in production), and is otherwise delivered by email when SMTP is configured.
 */
async function issueOtp(user, channel, purpose) {
  rateLimit(`otp:${purpose}:${user.id}`, 6, 900000);
  run('UPDATE otp_codes SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL', nowIso(), user.id, purpose);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  insert('otp_codes', { user_id: user.id, channel, purpose, code_hash: sha256(`${user.id}:${purpose}:${code}`), expires_at: new Date(Date.now() + 600000).toISOString(), created_at: nowIso() });
  let delivered = false;
  if (channel === 'email') {
    const result = await sendMail({ to: user.email, purpose: `otp_${purpose}`, subject: 'Your Routely delivery partner code', text: `Your code is ${code}. It is valid for 10 minutes. If you did not ask for it, ignore this message.` });
    delivered = result.delivered;
  }
  if (!delivered && !TEST_TOOLS()) throw new HttpError(503, channel === 'sms' ? 'Text messages are not connected yet, so a code cannot be sent to this mobile number.' : 'Email is not connected yet, so a code cannot be sent.');
  return { delivered, channel, test_code: delivered ? undefined : code, test_note: delivered ? undefined : 'TEST ENVIRONMENT: no SMS or email provider is connected, so the code is shown here instead of being sent.' };
}
function verifyOtp(userId, purpose, code) {
  const row = get('SELECT * FROM otp_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', userId, purpose);
  if (!row || row.expires_at < nowIso()) throw new HttpError(400, 'That code has expired. Request a new one.', { fields: { code: 'Code expired.' } });
  if (row.attempts >= 5) throw new HttpError(429, 'Too many incorrect attempts. Request a new code.');
  if (row.code_hash !== sha256(`${userId}:${purpose}:${String(code || '').trim()}`)) {
    run('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
    throw new HttpError(400, 'That code is not correct.', { fields: { code: 'Incorrect code.' } });
  }
  run('UPDATE otp_codes SET used_at = ? WHERE id = ?', nowIso(), row.id);
  return true;
}

module.exports = { COOKIES, createPortalSession, endPortalSession, resolvePortal, guards, partnerRoute, fleetRoute, adminRoute, requireApproved, issueOtp, verifyOtp, idempotent, audit };
