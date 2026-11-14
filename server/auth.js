'use strict';
// Authentication, sessions and role-based access control for the Seller Hub.
const { route } = require('./router');
const { get, all, run, tx, insert, nextCode, notify, logActivity } = require('./db');
const {
  HttpError, bad, conflict, forbidden, nowIso, daysFromNow, validate, sha256, randomToken, hashPassword, verifyPassword,
  passwordProblems, maskEmail, BUSINESS_TYPES,
} = require('./lib');
const { sendMail, smtpConfigured, devPreviewEnabled } = require('./mail');

const COOKIE = 'nb_seller_sid';
const SESSION_DAYS = 30;
const SHORT_SESSION_HOURS = 12;

/* ---------- Roles ---------- */
const ROLES = {
  owner: { label: 'Store owner', description: 'Full access, including bank details, team and security settings.' },
  catalogue_manager: { label: 'Catalogue manager', description: 'Creates and edits listings, images and promotions. Read-only stock.' },
  order_manager: { label: 'Order manager', description: 'Processes orders, shipments and returns. Read-only catalogue and stock.' },
  inventory_manager: { label: 'Inventory manager', description: 'Updates stock, thresholds and warehouses. Read-only catalogue and orders.' },
  finance_viewer: { label: 'Finance viewer', description: 'Read-only access to payments, settlements, orders and analytics.' },
};
const ALL_PERMISSIONS = [
  'products.read', 'products.write', 'inventory.read', 'inventory.write', 'orders.read', 'orders.write', 'returns.read', 'returns.write',
  'shipping.read', 'shipping.write', 'payments.read', 'payments.manage', 'growth.read', 'growth.write', 'ads.read', 'ads.write',
  'analytics.read', 'support.use', 'settings.read', 'settings.manage', 'team.manage', 'activity.read',
];
const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  catalogue_manager: ['products.read', 'products.write', 'inventory.read', 'growth.read', 'growth.write', 'ads.read', 'analytics.read', 'support.use', 'settings.read'],
  order_manager: ['orders.read', 'orders.write', 'returns.read', 'returns.write', 'shipping.read', 'shipping.write', 'products.read', 'inventory.read', 'support.use', 'settings.read'],
  inventory_manager: ['inventory.read', 'inventory.write', 'products.read', 'orders.read', 'shipping.read', 'support.use', 'settings.read'],
  finance_viewer: ['payments.read', 'orders.read', 'returns.read', 'analytics.read', 'support.use', 'settings.read'],
};
const can = (role, perm) => (ROLE_PERMISSIONS[role] || []).includes(perm);

/* ---------- Rate limiting (in-memory; use a shared store behind multiple instances) ---------- */
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return; }
  entry.count += 1;
  if (entry.count > limit) {
    const minutes = Math.max(1, Math.ceil((entry.reset - now) / 60000));
    throw new HttpError(429, `Too many attempts. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }
}
const clearLimit = (key) => buckets.delete(key);
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k); }, 600000).unref();

/* ---------- Sessions ---------- */
function cookieAttributes(ctx, maxAgeSeconds) {
  // SameSite=Lax cookies are dropped when the Seller Hub runs inside a frame on another site (hosted previews, embedded
  // dashboards): sign-in "succeeds" but the next request is anonymous. Outside production the default is therefore
  // SameSite=None + Partitioned (CHIPS) on HTTPS, which works both embedded and in its own tab. Production keeps Lax
  // unless SESSION_SAMESITE=none is set. State-changing requests are protected separately by the X-NearBuy-Request
  // header and the same-origin check, so this does not open a CSRF path.
  const wanted = (process.env.SESSION_SAMESITE || (process.env.NODE_ENV === 'production' ? 'lax' : 'none')).toLowerCase();
  const sameSite = wanted === 'none' && ctx.secure ? 'None' : 'Lax';
  const parts = ['Path=/', 'HttpOnly', `SameSite=${sameSite}`];
  if (ctx.secure) parts.push('Secure');
  if (sameSite === 'None') parts.push('Partitioned');
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}
function createSession(ctx, userId, remember) {
  const token = randomToken(32);
  const lifetimeMs = remember ? SESSION_DAYS * 86400000 : SHORT_SESSION_HOURS * 3600000;
  insert('sessions', {
    token_hash: sha256(token), user_id: userId, created_at: nowIso(), last_seen_at: nowIso(),
    expires_at: new Date(Date.now() + lifetimeMs).toISOString(), user_agent: String(ctx.req.headers['user-agent'] || '').slice(0, 200), ip: ctx.ip,
  });
  ctx.setCookie(`${COOKIE}=${token}; ${cookieAttributes(ctx, remember ? Math.floor(lifetimeMs / 1000) : undefined)}`);
}
function clearSessionCookie(ctx) { ctx.setCookie(`${COOKIE}=; ${cookieAttributes(ctx, 0)}`); }
function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}
/** Resolve the signed-in user, their seller and role from the session cookie. */
function resolveSession(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const session = get('SELECT * FROM sessions WHERE token_hash = ?', sha256(token));
  if (!session) return null;
  if (session.expires_at < nowIso()) { run('DELETE FROM sessions WHERE id = ?', session.id); return null; }
  if (Date.now() - Date.parse(session.last_seen_at) > 300000) run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', nowIso(), session.id);
  const user = get('SELECT id, email, name, mobile, email_verified_at, created_at FROM users WHERE id = ?', session.user_id);
  if (!user) return null;
  const member = get("SELECT * FROM seller_team_members WHERE user_id = ? AND status = 'active'", user.id);
  const seller = member ? get('SELECT * FROM sellers WHERE id = ?', member.seller_id) : null;
  return { session, user, member, seller, role: member ? member.role : null };
}

/* ---------- Email tokens ---------- */
function issueToken(userId, purpose, hours) {
  run('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL', nowIso(), userId, purpose);
  const token = randomToken(32);
  insert('auth_tokens', { user_id: userId, purpose, token_hash: sha256(token), expires_at: new Date(Date.now() + hours * 3600000).toISOString(), created_at: nowIso() });
  return token;
}
function findToken(token, purposes) {
  if (!token || typeof token !== 'string') return null;
  const row = get('SELECT * FROM auth_tokens WHERE token_hash = ?', sha256(token));
  if (!row || row.used_at || row.expires_at < nowIso() || !purposes.includes(row.purpose)) return null;
  return row;
}
async function sendVerification(ctx, user) {
  const token = issueToken(user.id, 'verify_email', 24);
  const link = `${ctx.baseUrl}/seller/verify-email?token=${token}`;
  const result = await sendMail({
    to: user.email, purpose: 'verify_email', subject: 'Verify your NearBuy Seller Hub email', link,
    text: `Hello ${user.name},\n\nConfirm your email address to activate your NearBuy Seller Hub account:\n${link}\n\nThe link is valid for 24 hours. If you did not create this account, ignore this message.`,
  });
  return { delivered: result.delivered, status: result.status, dev_link: !result.delivered && devPreviewEnabled() ? link : undefined };
}
const mailInfo = () => ({ configured: smtpConfigured(), dev_preview: devPreviewEnabled() });

function sessionPayload(s) {
  const seller = s.seller;
  return {
    user: { id: s.user.id, name: s.user.name, email: s.user.email, mobile: s.user.mobile, email_verified: Boolean(s.user.email_verified_at) },
    seller: seller ? {
      code: seller.code, store_name: seller.store_name, business_name: seller.business_name, status: seller.status,
      status_note: seller.status_note, has_demo_data: Boolean(seller.has_demo_data), logo_upload_id: seller.store_logo_upload_id,
    } : null,
    role: s.role,
    role_label: s.role ? ROLES[s.role].label : null,
    permissions: ROLE_PERMISSIONS[s.role] || [],
    unread_notifications: seller ? get('SELECT COUNT(*) AS n FROM notifications WHERE seller_id = ? AND read_at IS NULL', seller.id).n : 0,
    mail: mailInfo(),
  };
}

/* ---------- Routes ---------- */
route('POST', '/api/auth/register', { auth: 'public' }, async (ctx) => {
  rateLimit(`register:${ctx.ip}`, 30, 3600000);
  const data = validate(ctx.body, {
    name: { required: true, min: 2, max: 80, label: 'Full name' },
    email: { required: true, format: 'email', lower: true, max: 160, label: 'Business email' },
    mobile: { required: true, format: 'mobile', label: 'Mobile number' },
    password: { required: true, max: 128 },
    confirm_password: { required: true, max: 128, label: 'Confirm password' },
    business_name: { required: true, min: 2, max: 120, label: 'Business name' },
    business_type: { required: true, enum: BUSINESS_TYPES, label: 'Business type' },
    accept_terms: { type: 'bool', mustBeTrue: true, message: 'You must accept the seller terms and conditions.' },
  });
  const problem = passwordProblems(data.password);
  if (problem) throw bad('Please correct the highlighted fields.', { password: problem });
  if (data.password !== data.confirm_password) throw bad('Please correct the highlighted fields.', { confirm_password: 'Passwords do not match.' });
  if (get('SELECT id FROM users WHERE email = ?', data.email)) throw bad('Please correct the highlighted fields.', { email: 'An account with this email already exists. Sign in instead.' });

  const user = tx(() => {
    const userId = insert('users', { email: data.email, password_hash: hashPassword(data.password), name: data.name, mobile: data.mobile, created_at: nowIso() });
    const sellerId = insert('sellers', {
      code: nextCode('SLR', 5000), owner_user_id: userId, store_name: data.business_name, business_name: data.business_name,
      business_type: data.business_type, status: 'pending_verification', contact_email: data.email, contact_phone: data.mobile, created_at: nowIso(),
    });
    insert('seller_team_members', { seller_id: sellerId, user_id: userId, role: 'owner', status: 'active', created_at: nowIso() });
    insert('seller_business_profiles', { seller_id: sellerId, legal_name: data.business_name, business_type: data.business_type, updated_at: nowIso() });
    notify(sellerId, 'account', 'Welcome to NearBuy Seller Hub', 'Verify your email, then complete onboarding to start selling.', '/seller/onboarding');
    logActivity({ sellerId, user: { id: userId, name: data.name } }, 'Created seller account', 'account', data.email);
    return { id: userId, email: data.email, name: data.name };
  });
  createSession(ctx, user.id, true);
  const verification = await sendVerification(ctx, user);
  return { __status: 201, ok: true, verification, mail: mailInfo() };
});

route('POST', '/api/auth/login', { auth: 'public' }, (ctx) => {
  const data = validate(ctx.body, {
    email: { required: true, format: 'email', lower: true, max: 160 },
    password: { required: true, max: 128 },
    remember: { type: 'bool' },
  });
  const key = `login:${ctx.ip}:${data.email}`;
  rateLimit(key, 8, 900000);
  const user = get('SELECT * FROM users WHERE email = ?', data.email);
  // Always run a hash comparison so response time does not reveal whether the account exists.
  const ok = verifyPassword(data.password, user && user.password_hash ? user.password_hash : 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
  if (!user || !ok) throw new HttpError(401, 'Incorrect email or password.');
  const member = get("SELECT * FROM seller_team_members WHERE user_id = ? AND status = 'active'", user.id);
  if (!member) throw new HttpError(403, 'This account no longer has access to a seller workspace.');
  clearLimit(key);
  run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
  createSession(ctx, user.id, data.remember);
  logActivity({ sellerId: member.seller_id, user }, 'Signed in', 'session');
  return { ok: true };
});

route('POST', '/api/auth/logout', { auth: 'public' }, (ctx) => {
  const token = readCookie(ctx.req, COOKIE);
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  clearSessionCookie(ctx);
  return { ok: true };
});

route('GET', '/api/auth/me', { auth: 'session' }, (ctx) => sessionPayload(ctx.auth));

route('POST', '/api/auth/resend-verification', { auth: 'session' }, async (ctx) => {
  if (ctx.user.email_verified_at) return { already_verified: true };
  rateLimit(`resend:${ctx.user.id}`, 6, 3600000);
  return { verification: await sendVerification(ctx, ctx.user), mail: mailInfo() };
});

route('POST', '/api/auth/verify-email', { auth: 'public' }, (ctx) => {
  rateLimit(`verify:${ctx.ip}`, 30, 900000);
  const token = findToken(ctx.body && ctx.body.token, ['verify_email']);
  if (!token) throw bad('This verification link is invalid or has expired. Request a new one.');
  tx(() => {
    run('UPDATE auth_tokens SET used_at = ? WHERE id = ?', nowIso(), token.id);
    run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', nowIso(), token.user_id);
    const seller = get('SELECT * FROM sellers WHERE owner_user_id = ?', token.user_id);
    if (seller && seller.status === 'pending_verification') {
      run("UPDATE sellers SET status = 'not_started' WHERE id = ?", seller.id);
      notify(seller.id, 'account', 'Email verified', 'Your business email is confirmed. Continue with seller onboarding.', '/seller/onboarding');
    }
  });
  return { ok: true };
});

route('POST', '/api/auth/forgot-password', { auth: 'public' }, async (ctx) => {
  const data = validate(ctx.body, { email: { required: true, format: 'email', lower: true, max: 160 } });
  rateLimit(`forgot:${ctx.ip}`, 10, 3600000);
  rateLimit(`forgot:${data.email}`, 5, 3600000);
  const user = get('SELECT * FROM users WHERE email = ?', data.email);
  let devLink;
  if (user) {
    const token = issueToken(user.id, 'reset_password', 1);
    const link = `${ctx.baseUrl}/seller/reset-password?token=${token}`;
    const result = await sendMail({
      to: user.email, purpose: 'reset_password', subject: 'Reset your NearBuy Seller Hub password', link,
      text: `Hello ${user.name},\n\nUse this link to choose a new password. It is valid for 60 minutes and can be used once:\n${link}\n\nIf you did not ask for this, you can ignore this message.`,
    });
    if (!result.delivered && devPreviewEnabled()) devLink = link;
  }
  // Same answer whether or not the account exists.
  return { ok: true, mail: mailInfo(), dev_link: devLink };
});

route('GET', '/api/auth/token-info', { auth: 'public' }, (ctx) => {
  rateLimit(`tokeninfo:${ctx.ip}`, 60, 900000);
  const token = findToken(ctx.query.token, ['reset_password', 'team_invite']);
  if (!token) throw bad('This link is invalid or has expired.');
  const user = get('SELECT email, name FROM users WHERE id = ?', token.user_id);
  return { purpose: token.purpose, email: maskEmail(user.email), name: user.name };
});

route('POST', '/api/auth/reset-password', { auth: 'public' }, (ctx) => {
  rateLimit(`reset:${ctx.ip}`, 20, 900000);
  const data = validate(ctx.body, { token: { required: true, max: 200 }, password: { required: true, max: 128 }, confirm_password: { required: true, max: 128 } });
  const token = findToken(data.token, ['reset_password', 'team_invite']);
  if (!token) throw bad('This link is invalid or has expired. Request a new one.');
  const problem = passwordProblems(data.password);
  if (problem) throw bad('Please correct the highlighted fields.', { password: problem });
  if (data.password !== data.confirm_password) throw bad('Please correct the highlighted fields.', { confirm_password: 'Passwords do not match.' });
  tx(() => {
    run('UPDATE auth_tokens SET used_at = ? WHERE id = ?', nowIso(), token.id);
    // Using an emailed link proves control of the mailbox, so the address is marked verified as well.
    run('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', hashPassword(data.password), nowIso(), token.user_id);
    run('DELETE FROM sessions WHERE user_id = ?', token.user_id);
    const member = get('SELECT * FROM seller_team_members WHERE user_id = ?', token.user_id);
    if (member) {
      if (member.status === 'invited') run("UPDATE seller_team_members SET status = 'active' WHERE id = ?", member.id);
      const seller = get('SELECT * FROM sellers WHERE id = ?', member.seller_id);
      if (seller.owner_user_id === token.user_id && seller.status === 'pending_verification') run("UPDATE sellers SET status = 'not_started' WHERE id = ?", seller.id);
      logActivity({ sellerId: member.seller_id, user: { id: token.user_id, name: get('SELECT name FROM users WHERE id = ?', token.user_id).name } }, token.purpose === 'team_invite' ? 'Accepted team invitation' : 'Reset password', 'security');
    }
  });
  clearSessionCookie(ctx);
  return { ok: true, purpose: token.purpose };
});

route('POST', '/api/auth/change-password', { auth: 'session' }, (ctx) => {
  rateLimit(`changepw:${ctx.user.id}`, 10, 900000);
  const data = validate(ctx.body, { current_password: { required: true, max: 128 }, new_password: { required: true, max: 128 }, confirm_password: { required: true, max: 128 } });
  const row = get('SELECT password_hash FROM users WHERE id = ?', ctx.user.id);
  if (!verifyPassword(data.current_password, row.password_hash)) throw bad('Please correct the highlighted fields.', { current_password: 'Current password is incorrect.' });
  const problem = passwordProblems(data.new_password);
  if (problem) throw bad('Please correct the highlighted fields.', { new_password: problem });
  if (data.new_password !== data.confirm_password) throw bad('Please correct the highlighted fields.', { confirm_password: 'Passwords do not match.' });
  if (data.new_password === data.current_password) throw bad('Please correct the highlighted fields.', { new_password: 'Choose a password you have not just used.' });
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(data.new_password), ctx.user.id);
  // Sign out every other device.
  const revoked = run('DELETE FROM sessions WHERE user_id = ? AND id != ?', ctx.user.id, ctx.auth.session.id).changes;
  if (ctx.sellerId) logActivity(ctx, 'Changed password', 'security');
  return { ok: true, other_sessions_signed_out: revoked };
});

route('GET', '/api/auth/sessions', { auth: 'session' }, (ctx) => ({
  sessions: all('SELECT id, created_at, last_seen_at, expires_at, user_agent, ip FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC', ctx.user.id)
    .map((s) => ({ ...s, current: s.id === ctx.auth.session.id })),
}));
route('DELETE', '/api/auth/sessions/:id', { auth: 'session' }, (ctx) => {
  const id = Number(ctx.params.id);
  if (id === ctx.auth.session.id) throw bad('Use Sign out to end the session you are using now.');
  const changes = run('DELETE FROM sessions WHERE id = ? AND user_id = ?', id, ctx.user.id).changes;
  if (!changes) throw new HttpError(404, 'Session not found.');
  return { ok: true };
});

module.exports = { ROLES, ROLE_PERMISSIONS, ALL_PERMISSIONS, can, resolveSession, rateLimit, issueToken, sessionPayload, forbidden, conflict, daysFromNow };
