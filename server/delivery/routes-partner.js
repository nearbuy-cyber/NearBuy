'use strict';
// Delivery partner API: account, onboarding, availability, offers, the delivery workflow, earnings and support.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, parseJson } = require('../db');
const { HttpError, bad, conflict, notFound, nowIso, r2, validate, hashPassword, verifyPassword, passwordProblems, encrypt, maskMobile, toCsv, istDate, istDayStart, istDayEnd, addDays, resolveRange, PATTERNS } = require('../lib');
const { rateLimit } = require('../auth');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');
const V = require('./views');
const { partnerRoute: P, createPortalSession, endPortalSession, requireApproved, issueOtp, verifyOtp } = require('./auth');

const LANGUAGES = ['Hindi', 'English', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Gujarati', 'Punjabi', 'Malayalam', 'Urdu'];
const EDITABLE = ['draft', 'info_required', 'rejected', 'expired'];
const DUMMY_HASH = 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const withName = (ctx) => { ctx.partner.name = ctx.user.name; return ctx.partner; };
const partnerUser = (identifier) => {
  const id = String(identifier || '').trim().toLowerCase();
  const user = PATTERNS.mobile.test(id)
    ? get("SELECT u.* FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'partner' WHERE u.mobile = ?", id)
    : get("SELECT u.* FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'partner' WHERE u.email = ?", id);
  return user || null;
};
function logApplication(partnerId, status, note, actor) {
  insert('partner_applications', { partner_id: partnerId, status, note: note || null, actor: actor || 'Partner', created_at: nowIso() });
}

/* ---------- Onboarding state ---------- */
function requiredDocuments(vehicle) {
  const kinds = ['photo', 'identity'];
  if (vehicle && S.VEHICLES[vehicle.type] && S.VEHICLES[vehicle.type].needs_licence) kinds.push('licence', 'vehicle');
  return kinds;
}
function checklist(partner, user) {
  const vehicle = E.vehicleOf(partner.id);
  const docs = all('SELECT kind, status FROM partner_documents WHERE partner_id = ?', partner.id);
  const training = parseJson(partner.training, {});
  const missingDocs = requiredDocuments(vehicle).filter((k) => !docs.some((d) => d.kind === k && d.status !== 'rejected'));
  return [
    { key: 'account', label: 'Account and verification', done: Boolean(partner.mobile_verified_at && user.email_verified_at), hint: !partner.mobile_verified_at ? 'Verify your mobile number' : !user.email_verified_at ? 'Verify your email address' : null },
    { key: 'profile', label: 'Basic profile', done: Boolean(partner.city && partner.home_zone_id && partner.language && partner.emergency_name && partner.emergency_phone), hint: 'City, operating zone, language and emergency contact' },
    { key: 'vehicle', label: 'Vehicle details', done: Boolean(vehicle), hint: 'Choose the vehicle you will deliver with' },
    { key: 'documents', label: 'Identity and eligibility documents', done: Boolean(vehicle) && !missingDocs.length && partner.payout_status !== 'missing', hint: missingDocs.length ? `Upload: ${missingDocs.map((k) => S.DOCUMENT_KINDS[k].toLowerCase()).join(', ')}` : partner.payout_status === 'missing' ? 'Add your payout account' : null },
    { key: 'training', label: 'Training and policy acknowledgement', done: S.TRAINING_MODULES.every(([k]) => training[k]), hint: `${S.TRAINING_MODULES.filter(([k]) => training[k]).length} of ${S.TRAINING_MODULES.length} modules acknowledged` },
  ];
}
function onlineBlockers(partner) {
  const reasons = [];
  if (partner.status !== 'approved') reasons.push(`Your application is ${S.APPLICATION_STATUS[partner.status].toLowerCase()}.`);
  if (partner.fleet_hold) reasons.push('Your fleet manager has put your account on hold.');
  if (!E.vehicleOf(partner.id)) reasons.push('Add a vehicle.');
  const zones = all("SELECT z.* FROM service_zones z JOIN partner_zones pz ON pz.zone_id = z.id WHERE pz.partner_id = ?", partner.id);
  if (!zones.length) reasons.push('Choose an operating zone.');
  else if (!zones.some((z) => z.status === 'active' && C.zoneOpenNow(z))) reasons.push('None of your zones is open for delivery right now.');
  return reasons;
}
function profile(ctx) {
  const p = get('SELECT * FROM delivery_partners WHERE id = ?', ctx.partner.id);
  const vehicle = E.vehicleOf(p.id);
  const fleet = p.fleet_id ? get('SELECT code, name FROM fleets WHERE id = ?', p.fleet_id) : null;
  return {
    user: { name: ctx.user.name, mobile: ctx.user.mobile, email: ctx.user.email, email_verified: Boolean(ctx.user.email_verified_at), mobile_verified: Boolean(p.mobile_verified_at) },
    partner: {
      code: p.code, status: p.status, status_label: S.APPLICATION_STATUS[p.status], status_note: p.status_note, city: p.city, home_zone_id: p.home_zone_id, language: p.language,
      emergency_name: p.emergency_name, emergency_phone: p.emergency_phone, categories: parseJson(p.categories, []), online: Boolean(p.online), online_since: p.online_since,
      fleet, fleet_hold: Boolean(p.fleet_hold), payout: p.payout_status === 'missing' ? null : { holder: p.payout_holder, bank: p.payout_bank, account_ending: p.payout_last4, ifsc: p.payout_ifsc, status: p.payout_status },
      training: parseJson(p.training, {}), rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null, rating_count: p.rating_count,
      submitted_at: p.submitted_at, approved_at: p.approved_at, documents_valid_until: p.documents_valid_until, is_demo: Boolean(p.is_demo), editable: EDITABLE.includes(p.status),
      last_location_at: p.last_location_at,
    },
    vehicle: vehicle ? { type: vehicle.type, label: S.VEHICLES[vehicle.type].label, registration_no: vehicle.registration_no, ownership: vehicle.ownership, status: vehicle.status } : null,
    zones: all('SELECT z.id, z.code, z.name, z.city, z.status FROM service_zones z JOIN partner_zones pz ON pz.zone_id = z.id WHERE pz.partner_id = ?', p.id),
    documents: all('SELECT id, kind, file_name, mime, size, status, note, uploaded_at FROM partner_documents WHERE partner_id = ? ORDER BY id', p.id).map((d) => ({ ...d, kind_label: S.DOCUMENT_KINDS[d.kind] })),
    required_documents: requiredDocuments(vehicle), checklist: checklist(p, ctx.user), online_blockers: onlineBlockers(p),
    unread_notifications: get("SELECT COUNT(*) AS n FROM delivery_notifications WHERE audience = 'partner' AND partner_id = ? AND read_at IS NULL", p.id).n,
  };
}
const config = () => ({
  vehicles: Object.entries(S.VEHICLES).map(([key, v]) => ({ key, label: v.label, needs_licence: v.needs_licence, max_kg: v.max_kg, max_km: v.max_km })),
  categories: S.CATEGORIES, document_kinds: S.DOCUMENT_KINDS, languages: LANGUAGES, training: S.TRAINING_MODULES.map(([key, title, text]) => ({ key, title, text })),
  ticket_categories: S.PARTNER_TICKET_CATEGORIES, statuses: S.APPLICATION_STATUS, test_tools: C.TEST_TOOLS(), geofence_m: C.CONFIG.geofenceM(), offer_seconds: C.CONFIG.offerSeconds(),
  zones: all("SELECT id, code, name, city, status, center_lat, center_lng, radius_km, open_time, close_time FROM service_zones ORDER BY name"),
});

/* ---------- Account ---------- */
route('GET', '/api/partners/config', { auth: 'public' }, () => config());
route('POST', '/api/partners/applications', { auth: 'public' }, (ctx) => {
  rateLimit(`partner-register:${ctx.ip}`, 20, 3600000);
  const data = validate(ctx.body, {
    name: { required: true, min: 2, max: 80, label: 'Full name' }, mobile: { required: true, format: 'mobile', label: 'Mobile number' },
    email: { required: true, format: 'email', lower: true, max: 160, label: 'Email address' }, password: { required: true, max: 128 },
    fleet_code: { max: 40, upper: true }, accept_terms: { type: 'bool', mustBeTrue: true, message: 'Accept the delivery partner terms to continue.' },
  });
  const fields = {};
  const problem = passwordProblems(data.password);
  if (problem) fields.password = problem;
  if (get('SELECT 1 FROM users WHERE email = ?', data.email)) fields.email = 'An account with this email already exists. Sign in instead.';
  if (get("SELECT 1 FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'partner' WHERE u.mobile = ?", data.mobile)) fields.mobile = 'A delivery partner account with this mobile number already exists.';
  const fleet = data.fleet_code ? get("SELECT * FROM fleets WHERE join_code = ? AND status = 'active'", data.fleet_code) : null;
  if (data.fleet_code && !fleet) fields.fleet_code = 'That fleet code is not valid. Leave it empty to join as an individual.';
  if (Object.keys(fields).length) throw bad('Please correct the highlighted fields.', fields);
  const result = tx(() => {
    const userId = insert('users', { email: data.email, password_hash: hashPassword(data.password), name: data.name, mobile: data.mobile, created_at: nowIso() });
    insert('user_roles', { user_id: userId, role: 'partner', created_at: nowIso() });
    const code = nextCode('DP', 2000);
    const partnerId = insert('delivery_partners', { code, user_id: userId, fleet_id: fleet ? fleet.id : null, status: 'draft', created_at: nowIso(), updated_at: nowIso() });
    logApplication(partnerId, 'draft', 'Account created.');
    C.audit({ type: 'partner', name: data.name, userId, ip: ctx.ip }, 'Created partner account', 'partner', code);
    return { userId, code };
  });
  createPortalSession(ctx, 'partner', result.userId);
  return reply.created({ ok: true, code: result.code });
});
route('POST', '/api/partners/login', { auth: 'public' }, (ctx) => {
  const data = validate(ctx.body, { identifier: { required: true, max: 160, label: 'Mobile number or email' }, password: { required: true, max: 128 } });
  const key = `partner-login:${ctx.ip}:${data.identifier.toLowerCase()}`;
  rateLimit(key, 8, 900000);
  const user = partnerUser(data.identifier);
  const ok = verifyPassword(data.password, user && user.password_hash ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect mobile number, email or password.');
  run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
  createPortalSession(ctx, 'partner', user.id);
  return { ok: true };
});
route('POST', '/api/partners/login/otp', { auth: 'public' }, async (ctx) => {
  const data = validate(ctx.body, { mobile: { required: true, format: 'mobile', label: 'Mobile number' } });
  rateLimit(`partner-otp:${ctx.ip}`, 12, 900000);
  const user = partnerUser(data.mobile);
  if (!user) throw new HttpError(404, 'No delivery partner account uses this mobile number.', { fields: { mobile: 'Register first, or check the number.' } });
  return { ok: true, ...(await issueOtp(user, 'sms', 'login')) };
});
route('POST', '/api/partners/login/otp/verify', { auth: 'public' }, (ctx) => {
  const data = validate(ctx.body, { mobile: { required: true, format: 'mobile' }, code: { required: true, max: 10 } });
  rateLimit(`partner-otp-verify:${ctx.ip}`, 20, 900000);
  const user = partnerUser(data.mobile);
  if (!user) throw new HttpError(401, 'That code is not correct.');
  verifyOtp(user.id, 'login', data.code);
  run('UPDATE delivery_partners SET mobile_verified_at = COALESCE(mobile_verified_at, ?) WHERE user_id = ?', nowIso(), user.id);
  createPortalSession(ctx, 'partner', user.id);
  return { ok: true };
});
route('POST', '/api/partners/password/forgot', { auth: 'public' }, async (ctx) => {
  const data = validate(ctx.body, { identifier: { required: true, max: 160, label: 'Mobile number or email' } });
  rateLimit(`partner-forgot:${ctx.ip}`, 8, 900000);
  const user = partnerUser(data.identifier);
  // The same answer is given whether or not the account exists.
  if (!user) return { ok: true, message: 'If an account exists, a reset code has been sent.' };
  const sent = await issueOtp(user, PATTERNS.mobile.test(data.identifier) ? 'sms' : 'email', 'reset');
  return { ok: true, message: 'If an account exists, a reset code has been sent.', ...sent };
});
route('POST', '/api/partners/password/reset', { auth: 'public' }, (ctx) => {
  const data = validate(ctx.body, { identifier: { required: true, max: 160 }, code: { required: true, max: 10 }, password: { required: true, max: 128, label: 'New password' } });
  rateLimit(`partner-reset:${ctx.ip}`, 12, 900000);
  const problem = passwordProblems(data.password);
  if (problem) throw bad('Please correct the highlighted fields.', { password: problem });
  const user = partnerUser(data.identifier);
  if (!user) throw new HttpError(400, 'That code is not correct.', { fields: { code: 'Incorrect code.' } });
  verifyOtp(user.id, 'reset', data.code);
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(data.password), user.id);
  run("DELETE FROM sessions WHERE user_id = ? AND user_agent LIKE '[partner]%'", user.id); // a reset signs every device out
  C.audit({ type: 'partner', name: user.name, userId: user.id, ip: ctx.ip }, 'Reset password', 'partner', null);
  return { ok: true, message: 'Password changed. Sign in with the new password.' };
});
route('POST', '/api/partners/logout', { auth: 'public' }, (ctx) => { endPortalSession(ctx, 'partner'); return { ok: true }; });

P('GET', '/api/partners/me', (ctx) => ({ ...profile(ctx), config: config() }));
P('GET', '/api/partners/verification-status', (ctx) => {
  const p = ctx.partner;
  return {
    status: p.status, status_label: S.APPLICATION_STATUS[p.status], note: p.status_note, checklist: checklist(p, ctx.user),
    can_receive_offers: p.status === 'approved', history: all('SELECT status, note, actor, created_at FROM partner_applications WHERE partner_id = ? ORDER BY id', p.id).map((h) => ({ ...h, label: S.APPLICATION_STATUS[h.status] })),
    documents: all('SELECT kind, status, note FROM partner_documents WHERE partner_id = ?', p.id),
  };
});
P('POST', '/api/partners/verify/:channel/request', async (ctx) => {
  const channel = ctx.params.channel === 'mobile' ? 'sms' : ctx.params.channel === 'email' ? 'email' : null;
  if (!channel) throw notFound('Verification channel');
  return { ok: true, ...(await issueOtp(ctx.user, channel, `verify_${ctx.params.channel}`)) };
});
P('POST', '/api/partners/verify/:channel/confirm', (ctx) => {
  if (!['mobile', 'email'].includes(ctx.params.channel)) throw notFound('Verification channel');
  verifyOtp(ctx.user.id, `verify_${ctx.params.channel}`, ctx.body.code);
  if (ctx.params.channel === 'mobile') run('UPDATE delivery_partners SET mobile_verified_at = ? WHERE id = ?', nowIso(), ctx.partner.id);
  else run('UPDATE users SET email_verified_at = ? WHERE id = ?', nowIso(), ctx.user.id);
  return { ok: true };
});
P('PATCH', '/api/partners/profile', (ctx) => {
  const p = ctx.partner;
  const data = validate(ctx.body, {
    city: { min: 2, max: 60 }, home_zone_id: { type: 'int' }, zone_ids: { type: 'array', of: 'int', max: 10 }, language: { enum: LANGUAGES },
    emergency_name: { min: 2, max: 80, label: 'Emergency contact name' }, emergency_phone: { format: 'mobile', label: 'Emergency contact number' },
    categories: { type: 'array', of: 'string', max: 3 },
  }, { partial: true });
  if (data.emergency_phone && data.emergency_phone === ctx.user.mobile) throw bad('Please correct the highlighted fields.', { emergency_phone: 'Give a different number from your own.' });
  if (data.categories && (!data.categories.length || data.categories.some((c) => !S.CATEGORIES[c]))) throw bad('Please correct the highlighted fields.', { categories: 'Choose at least one delivery category.' });
  const zoneIds = data.zone_ids || (data.home_zone_id ? [data.home_zone_id] : null);
  if (data.home_zone_id && !get('SELECT 1 FROM service_zones WHERE id = ?', data.home_zone_id)) throw bad('Please correct the highlighted fields.', { home_zone_id: 'Choose a zone from the list.' });
  tx(() => {
    const patch = { updated_at: nowIso() };
    for (const key of ['city', 'home_zone_id', 'language', 'emergency_name', 'emergency_phone']) if (data[key] !== undefined && data[key] !== null) patch[key] = data[key];
    if (data.categories) patch.categories = JSON.stringify(data.categories);
    run(`UPDATE delivery_partners SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(patch), p.id);
    if (zoneIds) {
      const ids = [...new Set([...(data.home_zone_id ? [data.home_zone_id] : []), ...zoneIds])].filter((id) => get('SELECT 1 FROM service_zones WHERE id = ?', id));
      if (!ids.length) throw bad('Please correct the highlighted fields.', { home_zone_id: 'Choose at least one operating zone.' });
      run('DELETE FROM partner_zones WHERE partner_id = ?', p.id);
      ids.forEach((id) => insert('partner_zones', { partner_id: p.id, zone_id: id, created_at: nowIso() }));
    }
  });
  return { ok: true, ...profile(ctx) };
});
P('PUT', '/api/partners/vehicle', (ctx) => {
  const p = ctx.partner;
  if (!EDITABLE.includes(p.status)) throw conflict('Vehicle details are locked while your application is under review or approved. Raise a support ticket to change your vehicle.');
  const data = validate(ctx.body, { type: { required: true, enum: Object.keys(S.VEHICLES), label: 'Vehicle type' }, registration_no: { max: 16, upper: true, label: 'Registration number' }, ownership: { enum: ['own', 'family', 'rented', 'fleet'], label: 'Ownership' } });
  const spec = S.VEHICLES[data.type];
  const fields = {};
  if (spec.needs_licence || data.type === 'ev_two_wheeler') {
    if (spec.needs_licence && !data.registration_no) fields.registration_no = 'Enter the registration number shown on the number plate.';
    else if (data.registration_no && !/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(data.registration_no.replace(/[\s-]/g, ''))) fields.registration_no = 'Enter a valid registration number, for example DL3SAB1234.';
    if (!data.ownership) fields.ownership = 'Tell us who owns the vehicle.';
  }
  if (Object.keys(fields).length) throw bad('Please correct the highlighted fields.', fields);
  const reg = data.registration_no ? data.registration_no.replace(/[\s-]/g, '') : null;
  run(`INSERT INTO partner_vehicles (partner_id, type, registration_no, ownership, status, updated_at) VALUES (?, ?, ?, ?, 'unverified', ?)
    ON CONFLICT(partner_id) DO UPDATE SET type = excluded.type, registration_no = excluded.registration_no, ownership = excluded.ownership, status = 'unverified', updated_at = excluded.updated_at`, p.id, data.type, reg, data.ownership || 'own', nowIso());
  return { ok: true, ...profile(ctx) };
});
P('PUT', '/api/partners/payout', (ctx) => {
  const data = validate(ctx.body, {
    holder: { required: true, min: 2, max: 80, label: 'Account holder name' }, bank: { required: true, min: 2, max: 80, label: 'Bank name' },
    account: { required: true, format: 'account', label: 'Account number' }, ifsc: { required: true, format: 'ifsc', upper: true, label: 'IFSC' },
  });
  // The account number is encrypted at rest; only the last four digits are ever shown again. A change needs fresh verification.
  run("UPDATE delivery_partners SET payout_holder = ?, payout_bank = ?, payout_account_enc = ?, payout_last4 = ?, payout_ifsc = ?, payout_status = 'unverified', updated_at = ? WHERE id = ?",
    data.holder, data.bank, encrypt(data.account), data.account.slice(-4), data.ifsc, nowIso(), ctx.partner.id);
  C.audit(ctx.actor, 'Updated payout account', 'partner', ctx.partner.code, `Account ending ${data.account.slice(-4)}`);
  return { ok: true, ...profile(ctx) };
});
P('POST', '/api/partners/documents', (ctx) => {
  const kind = String(ctx.query.kind || '');
  if (!S.DOCUMENT_KINDS[kind]) throw bad('Choose which document this is.');
  const stored = C.storeFile(ctx.raw, { allowPdf: kind !== 'photo' });
  tx(() => {
    for (const old of all("SELECT * FROM partner_documents WHERE partner_id = ? AND kind = ? AND status != 'verified'", ctx.partner.id, kind)) { C.removeFile(old.storage_key); run('DELETE FROM partner_documents WHERE id = ?', old.id); }
    const id = insert('partner_documents', { partner_id: ctx.partner.id, kind, file_name: String(ctx.query.name || '').slice(0, 120) || null, mime: stored.mime, size: stored.size, storage_key: stored.key, uploaded_at: nowIso() });
    if (kind === 'photo') run('UPDATE delivery_partners SET photo_document_id = ? WHERE id = ?', id, ctx.partner.id);
  });
  return reply.created({ ok: true, ...profile(ctx) });
}, { raw: true, limit: 5 * 1024 * 1024 });
P('GET', '/api/partners/documents/:id/file', (ctx) => {
  const doc = get('SELECT * FROM partner_documents WHERE id = ? AND partner_id = ?', Number(ctx.params.id), ctx.partner.id);
  if (!doc) throw notFound('Document');
  return reply.bytes(doc.mime, C.readFile(doc.storage_key));
});
P('POST', '/api/partners/training', (ctx) => {
  const key = String(ctx.body.module || '');
  if (!S.TRAINING_MODULES.some(([k]) => k === key)) throw bad('Unknown training module.');
  const training = parseJson(ctx.partner.training, {});
  if (!training[key]) training[key] = nowIso();
  const done = S.TRAINING_MODULES.every(([k]) => training[k]);
  run('UPDATE delivery_partners SET training = ?, training_completed_at = ? WHERE id = ?', JSON.stringify(training), done ? (ctx.partner.training_completed_at || nowIso()) : null, ctx.partner.id);
  return { ok: true, ...profile(ctx) };
});
P('POST', '/api/partners/applications/submit', (ctx) => {
  const p = ctx.partner;
  if (!EDITABLE.includes(p.status)) throw conflict(`Your application is already ${S.APPLICATION_STATUS[p.status].toLowerCase()}.`);
  const missing = checklist(p, ctx.user).filter((s) => !s.done);
  if (missing.length) throw bad(`Complete these steps before submitting: ${missing.map((s) => s.label.toLowerCase()).join('; ')}.`, { steps: missing.map((s) => s.key).join(',') });
  tx(() => {
    run("UPDATE delivery_partners SET status = 'submitted', status_note = NULL, submitted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), p.id);
    logApplication(p.id, 'submitted', 'Application submitted for review.');
    C.notifyAdmin('partner_application', `New partner application: ${p.code}`, ctx.user.name);
    C.audit(ctx.actor, 'Submitted partner application', 'partner', p.code);
  });
  C.publish(['admin', `partner:${p.id}`], { kind: 'partner' });
  return { ok: true, ...profile(ctx) };
});
P('GET', '/api/partners/sessions', (ctx) => ({ sessions: all("SELECT id, created_at, last_seen_at, user_agent, ip FROM sessions WHERE user_id = ? AND user_agent LIKE '[partner]%' ORDER BY last_seen_at DESC", ctx.user.id).map((s) => ({ ...s, user_agent: s.user_agent.replace('[partner] ', ''), current: s.id === ctx.session.id })) }));
P('DELETE', '/api/partners/sessions/:id', (ctx) => {
  if (Number(ctx.params.id) === ctx.session.id) throw bad('Use Sign out to end the session you are using now.');
  if (!run("DELETE FROM sessions WHERE id = ? AND user_id = ? AND user_agent LIKE '[partner]%'", Number(ctx.params.id), ctx.user.id).changes) throw notFound('Session');
  return { ok: true };
});

/* ---------- Availability and location ---------- */
P('GET', '/api/partners/zones', (ctx) => ({
  zones: all('SELECT z.id, z.code, z.name, z.city, z.status, z.status_note, z.center_lat, z.center_lng, z.radius_km, z.open_time, z.close_time, (pz.partner_id IS NOT NULL) AS selected FROM service_zones z LEFT JOIN partner_zones pz ON pz.zone_id = z.id AND pz.partner_id = ? ORDER BY z.name', ctx.partner.id)
    .map((z) => ({ ...z, selected: Boolean(z.selected), open_now: z.status === 'active' && C.zoneOpenNow(z) })),
}));
P('PATCH', '/api/partners/availability', (ctx) => {
  const online = ctx.body.online === true;
  const p = withName(ctx);
  if (online) {
    const blockers = onlineBlockers(p);
    if (blockers.length) throw new HttpError(409, `You cannot go online yet. ${blockers.join(' ')}`, { code: 'cannot_go_online', blockers });
  } else if (E.activeTask(p.id)) throw conflict('Finish or hand back your active delivery before going offline.');
  if (Boolean(p.online) !== online) tx(() => E.setOnline(p, online, online ? 'Partner went online' : 'Partner went offline'));
  return { ok: true, online };
});
P('POST', '/api/partners/location', (ctx) => {
  rateLimit(`loc:${ctx.partner.id}`, 240, 60000);
  return E.recordLocation(ctx.partner, ctx.body, E.activeTask(ctx.partner.id));
});

/* ---------- Home, offers and tasks ---------- */
const dayBounds = (ymd) => [istDayStart(ymd), istDayEnd(ymd)];
function earningsBetween(partnerId, from, to) {
  const rows = all("SELECT type, COALESCE(SUM(amount), 0) AS total FROM partner_earning_ledger WHERE partner_id = ? AND created_at BETWEEN ? AND ? GROUP BY type", partnerId, from, to);
  const by = Object.fromEntries(rows.map((r) => [r.type, r2(r.total)]));
  return { total: r2(rows.reduce((s, r) => s + r.total, 0)), base: by.base || 0, distance: by.distance || 0, incentive: by.incentive || 0, tip: by.tip || 0, adjustment: by.adjustment || 0 };
}
const completedBetween = (partnerId, from, to) => get("SELECT COUNT(*) AS n FROM deliveries WHERE partner_id = ? AND status = 'delivered' AND completed_at BETWEEN ? AND ?", partnerId, from, to).n;
const liveOffer = (partnerId) => {
  const offer = get("SELECT * FROM delivery_offers WHERE partner_id = ? AND status = 'offered' AND expires_at > ? ORDER BY id DESC LIMIT 1", partnerId, nowIso());
  return offer ? V.offerForPartner(offer, E.one(offer.delivery_id)) : null;
};
P('GET', '/api/partners/home', (ctx) => {
  const p = get('SELECT * FROM delivery_partners WHERE id = ?', ctx.partner.id);
  const [from, to] = dayBounds(istDate());
  const active = E.activeTask(p.id);
  const zone = p.home_zone_id ? get('SELECT id, name, city, status, center_lat, center_lng, radius_km FROM service_zones WHERE id = ?', p.home_zone_id) : null;
  return {
    status: p.status, status_label: S.APPLICATION_STATUS[p.status], online: Boolean(p.online), online_blockers: onlineBlockers(p), zone,
    today: { completed: completedBetween(p.id, from, to), earnings: earningsBetween(p.id, from, to).total },
    active: p.status === 'approved' && active ? V.forPartner(active) : null, offer: p.status === 'approved' ? liveOffer(p.id) : null,
    location: p.last_location_at ? { lat: p.last_lat, lng: p.last_lng, at: p.last_location_at } : null, cash_in_hand: E.cashInHand(p.id),
    unread_notifications: get("SELECT COUNT(*) AS n FROM delivery_notifications WHERE audience = 'partner' AND partner_id = ? AND read_at IS NULL", p.id).n,
    notifications: all("SELECT id, type, title, body, read_at, created_at FROM delivery_notifications WHERE audience = 'partner' AND partner_id = ? ORDER BY id DESC LIMIT 5", p.id),
  };
});
P('GET', '/api/delivery/offers', (ctx) => {
  requireApproved(ctx);
  const offer = liveOffer(ctx.partner.id);
  return { offers: offer ? [offer] : [], online: Boolean(ctx.partner.online) };
});
P('POST', '/api/delivery/offers/:id/accept', (ctx) => {
  requireApproved(ctx);
  const d = E.acceptOffer(withName(ctx), Number(ctx.params.id));
  return { ok: true, delivery: V.forPartner(d) };
});
P('POST', '/api/delivery/offers/:id/decline', (ctx) => {
  requireApproved(ctx);
  E.declineOffer(ctx.partner, Number(ctx.params.id), String(ctx.body.reason || '').slice(0, 120));
  return { ok: true };
});
P('GET', '/api/partners/tasks', (ctx) => {
  requireApproved(ctx);
  const range = resolveRange({ range: ctx.query.range || '7d', from: ctx.query.from, to: ctx.query.to }, '7d');
  const rows = all(`SELECT d.*, (SELECT COALESCE(SUM(amount), 0) FROM partner_earning_ledger l WHERE l.delivery_id = d.id AND l.partner_id = ? AND l.type != 'adjustment') AS earned,
      (SELECT COALESCE(SUM(amount), 0) FROM partner_earning_ledger l WHERE l.delivery_id = d.id AND l.partner_id = ? AND l.type = 'adjustment') AS adjusted
    FROM deliveries d WHERE d.id IN (SELECT delivery_id FROM delivery_assignments WHERE partner_id = ?) AND d.created_at BETWEEN ? AND ? ORDER BY d.id DESC LIMIT 200`,
  ctx.partner.id, ctx.partner.id, ctx.partner.id, range.fromIso, range.toIso);
  const active = E.activeTask(ctx.partner.id);
  return {
    range: { key: range.key, label: range.label, from: range.from, to: range.to }, active: active ? V.forPartner(active) : null,
    // A delivery that was taken away from this partner is listed without any detail of where it finally went.
    history: rows.map((d) => {
      const mine = d.partner_id === ctx.partner.id;
      return { code: d.code, order_code: get('SELECT code FROM orders WHERE id = ?', d.order_id).code, pickup_name: d.pickup_name, date: d.completed_at || d.created_at,
        status: mine ? d.status : 'reassigned', status_label: mine ? C.label(d.status) : 'Reassigned', category_label: S.CATEGORIES[d.category], earnings: r2(d.earned), adjustment: r2(d.adjusted), distance_km: d.distance_km };
    }),
  };
});
P('GET', '/api/deliveries/:code', (ctx) => { requireApproved(ctx); return { delivery: V.forPartner(E.own(ctx.partner, ctx.params.code)) }; });

const step = (path, fn) => P('POST', `/api/deliveries/:code/${path}`, (ctx) => {
  requireApproved(ctx);
  const d = fn(withName(ctx), ctx.params.code, ctx);
  return { ok: true, delivery: V.forPartner(E.one(d.id)) };
});
step('start', (p, code) => E.startTrip(p, code));
step('arrived-at-pickup', (p, code) => E.arrivedAtPickup(p, code));
step('verify-pickup', (p, code, ctx) => E.verifyPickup(p, code, ctx.body));
step('picked-up', (p, code) => E.pickedUp(p, code));
step('arrived-at-destination', (p, code) => E.arrivedAtDestination(p, code));
step('proof', (p, code, ctx) => E.submitProof(p, code, ctx.body));
step('complete', (p, code, ctx) => E.complete(p, code, ctx.body));
step('failed-attempt', (p, code, ctx) => {
  const data = validate(ctx.body, { reason: { required: true, enum: ['Customer unavailable', 'Incorrect delivery address', 'Customer refused the order', 'Could not reach the address', 'Other'] }, note: { max: 200 } });
  return E.failAttempt(p, code, data.note ? `${data.reason} — ${data.note}` : data.reason);
});
P('POST', '/api/deliveries/:code/proof-photo', (ctx) => {
  requireApproved(ctx);
  const d = E.submitProof(withName(ctx), ctx.params.code, { method: 'photo' }, ctx.raw);
  return { ok: true, delivery: V.forPartner(E.one(d.id)) };
}, { raw: true, limit: 5 * 1024 * 1024 });
P('POST', '/api/deliveries/:code/location', (ctx) => {
  requireApproved(ctx);
  rateLimit(`loc:${ctx.partner.id}`, 240, 60000);
  const d = E.own(ctx.partner, ctx.params.code);
  if (!S.ACTIVE.includes(d.status)) throw conflict('This delivery is not in progress.');
  return E.recordLocation(ctx.partner, ctx.body, d);
});
P('POST', '/api/deliveries/:code/release', (ctx) => {
  requireApproved(ctx);
  const data = validate(ctx.body, { reason: { required: true, min: 5, max: 200, label: 'Reason' } });
  const d = E.own(ctx.partner, ctx.params.code);
  E.unassign(d, { type: 'partner', name: ctx.user.name, userId: ctx.user.id }, `Partner handed the task back: ${data.reason}`);
  C.audit(ctx.actor, 'Partner released delivery', 'delivery', d.code, data.reason);
  return { ok: true };
});

/* ---------- Earnings ---------- */
function wallet(partnerId) {
  const sum = (where) => r2(get(`SELECT COALESCE(SUM(amount), 0) AS n FROM partner_earning_ledger WHERE partner_id = ? AND ${where}`, partnerId).n);
  return {
    available: sum("status = 'available'"), pending: sum("status = 'pending'"), in_payout: sum("status = 'in_payout'"), paid: sum("status = 'paid'"),
    incentives: sum("type = 'incentive'"), tips: sum("type = 'tip'"), adjustments: sum("type = 'adjustment'"),
  };
}
P('GET', '/api/partners/earnings', (ctx) => {
  requireApproved(ctx);
  const id = ctx.partner.id;
  const today = istDate();
  const weekStart = addDays(today, -6);
  const [tFrom, tTo] = dayBounds(today);
  const p = get('SELECT payout_status FROM delivery_partners WHERE id = ?', id);
  return {
    today: { ...earningsBetween(id, tFrom, tTo), completed: completedBetween(id, tFrom, tTo) },
    week: { ...earningsBetween(id, istDayStart(weekStart), tTo), completed: completedBetween(id, istDayStart(weekStart), tTo), from: weekStart, to: today },
    daily: Array.from({ length: 7 }, (_, i) => { const day = addDays(weekStart, i); const [f, t] = dayBounds(day); return { day, total: earningsBetween(id, f, t).total, completed: completedBetween(id, f, t) }; }),
    wallet: wallet(id), payout_account_status: p.payout_status,
    adjustments: all('SELECT code, amount, reason, created_at, (SELECT code FROM deliveries WHERE id = a.delivery_id) AS delivery_code FROM financial_adjustments a WHERE partner_id = ? ORDER BY id DESC LIMIT 20', id),
    tips_supported: false, payout_schedule: 'Payouts are created by the operations team for your available balance once your payout account is verified.',
  };
});
const ledgerRows = (partnerId, range) => all(`SELECT l.txn_code, l.type, l.amount, l.note, l.status, l.created_at, d.code AS delivery_code, (SELECT code FROM partner_payouts WHERE id = l.payout_id) AS payout_code
  FROM partner_earning_ledger l LEFT JOIN deliveries d ON d.id = l.delivery_id WHERE l.partner_id = ? AND l.created_at BETWEEN ? AND ? ORDER BY l.id DESC LIMIT 500`, partnerId, range.fromIso, range.toIso);
P('GET', '/api/partners/transactions', (ctx) => {
  requireApproved(ctx);
  const range = resolveRange({ range: ctx.query.range || '30d', from: ctx.query.from, to: ctx.query.to });
  return { range: { key: range.key, label: range.label }, transactions: ledgerRows(ctx.partner.id, range) };
});
P('GET', '/api/partners/statement.csv', (ctx) => {
  requireApproved(ctx);
  const range = resolveRange({ range: ctx.query.range || '30d', from: ctx.query.from, to: ctx.query.to });
  return reply.csv(`earnings-statement-${ctx.partner.code}.csv`, toCsv([['txn_code', 'Transaction ID'], ['created_at', 'Date'], ['delivery_code', 'Delivery'], ['type', 'Type'], ['amount', 'Amount (INR)'], ['status', 'Status'], ['payout_code', 'Payout'], ['note', 'Note']], ledgerRows(ctx.partner.id, range)));
});
P('GET', '/api/partners/payouts', (ctx) => {
  requireApproved(ctx);
  return { payouts: all('SELECT code, amount, status, reference, failure_reason, created_at, settled_at FROM partner_payouts WHERE partner_id = ? ORDER BY id DESC LIMIT 100', ctx.partner.id) };
});
P('GET', '/api/partners/cod', (ctx) => {
  requireApproved(ctx);
  return {
    cash_in_hand: E.cashInHand(ctx.partner.id), limit: E.COD_CASH_LIMIT(),
    instructions: 'Deposit cash at your zone hub or transfer it to the company collection account, then record the deposit here with its reference. Earnings from cash orders are released when the deposit is confirmed.',
    transactions: all('SELECT c.code, c.type, c.amount, c.method, c.status, c.reference, c.note, c.created_at, d.code AS delivery_code FROM cod_transactions c LEFT JOIN deliveries d ON d.id = c.delivery_id WHERE c.partner_id = ? ORDER BY c.id DESC LIMIT 100', ctx.partner.id),
  };
});
P('POST', '/api/partners/cod/deposits', (ctx) => {
  requireApproved(ctx);
  const data = validate(ctx.body, { amount: { required: true, type: 'number', min: 1, max: 100000 }, method: { required: true, enum: ['hub_cash', 'bank_transfer', 'upi'] }, reference: { required: true, min: 4, max: 60, label: 'Deposit reference' } });
  const inHand = E.cashInHand(ctx.partner.id);
  const awaiting = get("SELECT COALESCE(SUM(amount), 0) AS n FROM cod_transactions WHERE partner_id = ? AND type = 'deposit' AND status = 'pending'", ctx.partner.id).n;
  if (data.amount > r2(inHand - awaiting) + 0.001) throw bad(`You hold ₹${r2(inHand - awaiting)} that is not yet covered by a deposit.`, { amount: 'More than the cash you hold.' });
  const code = nextCode('COD', 80000);
  insert('cod_transactions', { code, partner_id: ctx.partner.id, type: 'deposit', amount: data.amount, method: data.method, status: 'pending', reference: data.reference, note: 'Deposit recorded by partner — awaiting confirmation', created_at: nowIso() });
  C.notifyAdmin('cod_deposit', `Cash deposit to confirm: ${code}`, `${ctx.partner.code} · ₹${data.amount}`);
  return reply.created({ ok: true, code });
});

/* ---------- Performance ---------- */
P('GET', '/api/partners/performance', (ctx) => {
  requireApproved(ctx);
  const id = ctx.partner.id;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const offers = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM delivery_offers WHERE partner_id = ? AND created_at > ? GROUP BY status', id, since).map((r) => [r.status, r.n]));
  const answered = (offers.accepted || 0) + (offers.declined || 0) + (offers.expired || 0);
  const done = get("SELECT COUNT(*) AS n, AVG((julianday(completed_at) - julianday(assigned_at)) * 1440) AS minutes FROM deliveries WHERE partner_id = ? AND status = 'delivered' AND completed_at > ?", id, since);
  const failed = get("SELECT COUNT(*) AS n FROM delivery_status_history h JOIN deliveries d ON d.id = h.delivery_id WHERE d.partner_id = ? AND h.status = 'delivery_attempt_failed' AND h.created_at > ?", id, since).n;
  const p = get('SELECT rating_sum, rating_count FROM delivery_partners WHERE id = ?', id);
  const onlineLog = all('SELECT online, created_at FROM partner_availability WHERE partner_id = ? AND created_at > ? ORDER BY id', id, since);
  let onlineMs = 0; let start = null;
  for (const row of onlineLog) { if (row.online) start = start || Date.parse(row.created_at); else if (start) { onlineMs += Date.parse(row.created_at) - start; start = null; } }
  if (start) onlineMs += Date.now() - start;
  return {
    period: 'Last 30 days', completed: done.n, failed_attempts: failed, offers_received: answered, offers_accepted: offers.accepted || 0,
    acceptance_rate: answered ? Math.round(((offers.accepted || 0) / answered) * 100) : null, average_minutes: done.minutes ? Math.round(done.minutes) : null,
    rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null, rating_count: p.rating_count, online_hours: r2(onlineMs / 3600000),
    note: 'These figures help you and the operations team spot problems. Earnings never depend on riding speed, and declining an offer does not reduce your pay.',
  };
});

/* ---------- Support, incidents and notifications ---------- */
const ticketList = (where, ...params) => all(`SELECT t.code, t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at, d.code AS delivery_code FROM delivery_tickets t LEFT JOIN deliveries d ON d.id = t.delivery_id WHERE ${where} ORDER BY t.id DESC LIMIT 100`, ...params);
function ticketDetail(t, labels) {
  return {
    code: t.code, category: t.category, category_label: labels[t.category] || t.category, subject: t.subject, description: t.description, status: t.status, priority: t.priority,
    created_at: t.created_at, updated_at: t.updated_at, has_evidence: Boolean(t.evidence_key), delivery_code: t.delivery_id ? (get('SELECT code FROM deliveries WHERE id = ?', t.delivery_id) || {}).code : null,
    messages: all('SELECT author_type, author_name, body, created_at FROM delivery_ticket_messages WHERE ticket_id = ? ORDER BY id', t.id),
  };
}
function createTicket({ raisedBy, partnerId, sellerId, fleetId, deliveryId, category, subject, description, priority }) {
  const code = nextCode('DTK', 6000);
  const id = insert('delivery_tickets', { code, raised_by: raisedBy, partner_id: partnerId || null, seller_id: sellerId || null, fleet_id: fleetId || null, delivery_id: deliveryId || null, category, subject, description, priority: priority || 'normal', created_at: nowIso(), updated_at: nowIso() });
  C.notifyAdmin(priority === 'urgent' ? 'safety_incident' : 'ticket', `${priority === 'urgent' ? 'URGENT: ' : ''}New ${raisedBy} ticket ${code}`, subject, deliveryId);
  return { id, code };
}
P('GET', '/api/partners/tickets', (ctx) => ({ tickets: ticketList("t.partner_id = ? AND t.raised_by = 'partner'", ctx.partner.id).map((t) => ({ ...t, category_label: S.PARTNER_TICKET_CATEGORIES[t.category] })) }));
P('POST', '/api/partners/tickets', (ctx) => {
  const data = validate(ctx.body, { category: { required: true, enum: Object.keys(S.PARTNER_TICKET_CATEGORIES) }, description: { required: true, min: 10, max: 1500 }, delivery_code: { max: 20 } });
  const d = data.delivery_code ? get('SELECT id, code FROM deliveries WHERE code = ? AND id IN (SELECT delivery_id FROM delivery_assignments WHERE partner_id = ?)', data.delivery_code, ctx.partner.id) : null;
  if (data.delivery_code && !d) throw bad('Please correct the highlighted fields.', { delivery_code: 'That delivery is not one of yours.' });
  const safety = data.category === 'safety';
  const created = tx(() => {
    const t = createTicket({ raisedBy: 'partner', partnerId: ctx.partner.id, fleetId: ctx.partner.fleet_id, deliveryId: d && d.id, category: data.category, subject: `${S.PARTNER_TICKET_CATEGORIES[data.category]}${d ? ` — ${d.code}` : ''}`, description: data.description, priority: safety ? 'urgent' : 'normal' });
    if (safety) {
      const p = get('SELECT last_lat, last_lng, online FROM delivery_partners WHERE id = ?', ctx.partner.id);
      insert('incidents', { code: nextCode('INC', 400), partner_id: ctx.partner.id, delivery_id: d ? d.id : null, type: 'safety', description: data.description, lat: p.online ? p.last_lat : null, lng: p.online ? p.last_lng : null, created_at: nowIso() });
    }
    return t;
  });
  return reply.created({ ok: true, code: created.code });
});
const ownTicket = (ctx) => { const t = get("SELECT * FROM delivery_tickets WHERE code = ? AND partner_id = ? AND raised_by = 'partner'", ctx.params.code, ctx.partner.id); if (!t) throw notFound('Ticket'); return t; };
P('GET', '/api/partners/tickets/:code', (ctx) => ({ ticket: ticketDetail(ownTicket(ctx), S.PARTNER_TICKET_CATEGORIES) }));
P('POST', '/api/partners/tickets/:code/messages', (ctx) => {
  const t = ownTicket(ctx);
  const data = validate(ctx.body, { body: { required: true, min: 2, max: 1500, label: 'Message' } });
  insert('delivery_ticket_messages', { ticket_id: t.id, author_type: 'partner', author_name: ctx.user.name, body: data.body, created_at: nowIso() });
  run("UPDATE delivery_tickets SET status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END, updated_at = ? WHERE id = ?", nowIso(), t.id);
  C.publish('admin', { kind: 'ticket' });
  return { ok: true, ticket: ticketDetail(ownTicket(ctx), S.PARTNER_TICKET_CATEGORIES) };
});
P('POST', '/api/partners/tickets/:code/evidence', (ctx) => {
  const t = ownTicket(ctx);
  const stored = C.storeFile(ctx.raw);
  if (t.evidence_key) C.removeFile(t.evidence_key);
  run('UPDATE delivery_tickets SET evidence_key = ?, evidence_mime = ?, updated_at = ? WHERE id = ?', stored.key, stored.mime, nowIso(), t.id);
  return { ok: true };
}, { raw: true, limit: 5 * 1024 * 1024 });
P('GET', '/api/partners/notifications', (ctx) => ({ notifications: all("SELECT id, type, title, body, read_at, created_at FROM delivery_notifications WHERE audience = 'partner' AND partner_id = ? ORDER BY id DESC LIMIT 60", ctx.partner.id) }));
P('POST', '/api/partners/notifications/read', (ctx) => { run("UPDATE delivery_notifications SET read_at = ? WHERE audience = 'partner' AND partner_id = ? AND read_at IS NULL", nowIso(), ctx.partner.id); return { ok: true }; });

module.exports = { createTicket, ticketDetail, ticketList, logApplication, checklist, requiredDocuments, wallet, earningsBetween, LANGUAGES };
