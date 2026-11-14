'use strict';
// Control tower API: live operations, partner verification, zones and pricing, finance, complaints, reports and audit.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, parseJson, paged } = require('../db');
const { HttpError, bad, conflict, notFound, nowIso, r2, validate, hashPassword, verifyPassword, passwordProblems, toCsv, istDate, istDayStart, istDayEnd, resolveRange, maskMobile, decrypt, randomToken } = require('../lib');
const { rateLimit } = require('../auth');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');
const V = require('./views');
const T = require('./testorders');
const PR = require('./routes-partner');
const { adminRoute: A, createPortalSession, endPortalSession } = require('./auth');

const DUMMY_HASH = 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const inList = (list) => list.map(() => '?').join(',');
const deliveryByCode = (code) => { const d = get('SELECT * FROM deliveries WHERE code = ?', code); if (!d) throw notFound('Delivery'); return d; };
const partnerByCode = (code) => { const p = get('SELECT p.*, u.name, u.mobile, u.email, u.email_verified_at FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.code = ?', String(code || '').toUpperCase()); if (!p) throw notFound('Partner'); return p; };

/** Staff sign-in shared by the control tower and the fleet portal. */
function staffLogin(portal, role) {
  return (ctx) => {
    const data = validate(ctx.body, { email: { required: true, format: 'email', lower: true, max: 160 }, password: { required: true, max: 128 } });
    const key = `${portal}-login:${ctx.ip}:${data.email}`;
    rateLimit(key, 8, 900000);
    const user = get('SELECT u.* FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = ? WHERE u.email = ?', role, data.email);
    const ok = verifyPassword(data.password, user && user.password_hash ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password.');
    run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
    createPortalSession(ctx, portal, user.id);
    C.audit({ type: portal, name: user.name, userId: user.id, ip: ctx.ip }, 'Signed in', 'session', null);
    return { ok: true };
  };
}
route('POST', '/api/tower/login', { auth: 'public' }, staffLogin('admin', 'admin'));
route('POST', '/api/tower/logout', { auth: 'public' }, (ctx) => { endPortalSession(ctx, 'admin'); return { ok: true }; });
A('GET', '/api/tower/me', (ctx) => ({
  user: { name: ctx.user.name, email: ctx.user.email }, test_tools: C.TEST_TOOLS(), categories: S.CATEGORIES, statuses: S.DELIVERY_STATUS, application_statuses: S.APPLICATION_STATUS,
  vehicles: Object.fromEntries(Object.entries(S.VEHICLES).map(([k, v]) => [k, v.label])), document_kinds: S.DOCUMENT_KINDS,
  unread: get("SELECT COUNT(*) AS n FROM delivery_notifications WHERE audience = 'admin' AND read_at IS NULL").n,
}));

/* ---------- Executive dashboard and live map ---------- */
A('GET', '/api/admin/dashboard', () => {
  const from = istDayStart(istDate()); const to = istDayEnd(istDate());
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const count = (where, ...p) => get(`SELECT COUNT(*) AS n FROM deliveries WHERE ${where}`, ...p).n;
  const closed = get("SELECT SUM(status = 'delivered') AS ok, COUNT(*) AS n FROM deliveries WHERE status IN ('delivered','returned_to_seller') AND completed_at > ?", week);
  const avg = get("SELECT AVG((julianday(completed_at) - julianday(COALESCE(ready_at, created_at))) * 1440) AS m FROM deliveries WHERE status = 'delivered' AND completed_at > ?", week).m;
  const partners = get("SELECT SUM(online = 1) AS online, SUM(online = 0) AS offline FROM delivery_partners WHERE status = 'approved'");
  const open = get("SELECT COUNT(*) AS n, COALESCE(SUM(partner_earning), 0) AS earnings, COALESCE(SUM(CASE WHEN cod_state = 'collected' THEN cod_amount ELSE 0 END), 0) AS cod FROM settlement_records WHERE state = 'open'");
  return {
    today: {
      total: count('created_at BETWEEN ? AND ?', from, to), completed: count("status = 'delivered' AND completed_at BETWEEN ? AND ?", from, to),
      failed_attempts: get("SELECT COUNT(*) AS n FROM delivery_status_history WHERE status = 'delivery_attempt_failed' AND created_at BETWEEN ? AND ?", from, to).n,
      fee_revenue: r2(get("SELECT COALESCE(SUM(customer_fee), 0) AS n FROM deliveries WHERE status = 'delivered' AND completed_at BETWEEN ? AND ?", from, to).n),
    },
    active: count(`status IN (${inList(S.ACTIVE)})`, ...S.ACTIVE), pending_assignment: count(`status IN (${inList(S.UNASSIGNED)})`, ...S.UNASSIGNED),
    delayed: count(`status IN (${inList(S.ACTIVE)}) AND eta_at < ?`, ...S.ACTIVE, new Date(Date.now() - 600000).toISOString()),
    partners: { online: partners.online || 0, offline: partners.offline || 0, pending_review: get("SELECT COUNT(*) AS n FROM delivery_partners WHERE status IN ('submitted','under_review')").n },
    week: { average_delivery_minutes: avg ? Math.round(avg) : null, success_rate: closed.n ? Math.round((closed.ok / closed.n) * 100) : null, closed: closed.n },
    settlements: { open: open.n, partner_earnings_unsettled: r2(open.earnings), cod_with_partners: r2(open.cod) },
    open_tickets: get("SELECT COUNT(*) AS n FROM delivery_tickets WHERE status != 'resolved'").n, open_incidents: get("SELECT COUNT(*) AS n FROM incidents WHERE status = 'open'").n,
    alerts: all("SELECT id, type, title, body, read_at, created_at, (SELECT code FROM deliveries WHERE id = n.delivery_id) AS delivery_code FROM delivery_notifications n WHERE audience = 'admin' ORDER BY id DESC LIMIT 12"),
  };
});
A('GET', '/api/admin/map', (ctx) => {
  // Personal location is restricted to this role and to partners who are online or on a delivery; every view is audited.
  C.audit(ctx.actor, 'Viewed live map', 'map', null);
  const fresh = new Date(Date.now() - C.CONFIG.locationFreshMs()).toISOString();
  const open = all(`SELECT * FROM deliveries WHERE status NOT IN ('delivered','returned_to_seller','cancelled') ORDER BY id DESC LIMIT 300`);
  return {
    zones: all('SELECT id, code, name, city, center_lat, center_lng, radius_km, status FROM service_zones'),
    partners: all(`SELECT p.code, u.name, p.last_lat AS lat, p.last_lng AS lng, p.last_location_at AS at, (SELECT type FROM partner_vehicles WHERE partner_id = p.id) AS vehicle,
        (SELECT code FROM deliveries WHERE partner_id = p.id AND status IN (${inList(S.ACTIVE)}) LIMIT 1) AS delivery_code
      FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.status = 'approved' AND p.online = 1 AND p.last_location_at > ?`, ...S.ACTIVE, fresh).map((p) => ({ ...p, name: C.firstName(p.name) })),
    deliveries: open.map((d) => V.forAdmin(d)),
    incidents: all("SELECT code, type, lat, lng, created_at FROM incidents WHERE status = 'open' AND lat IS NOT NULL"),
  };
});

/* ---------- Delivery operations ---------- */
const TABS = {
  all: null, unassigned: S.UNASSIGNED, active: S.ACTIVE.filter((s) => s !== 'delivery_attempt_failed' && s !== 'return_in_progress'), failed: ['delivery_attempt_failed'],
  returns: ['return_in_progress', 'returned_to_seller'], delivered: ['delivered'], cancelled: ['cancelled'],
};
A('GET', '/api/admin/deliveries', (ctx) => {
  const q = ctx.query;
  const where = ['1 = 1']; const params = [];
  const tab = TABS[q.tab] !== undefined ? q.tab : 'all';
  if (tab === 'delayed') { /* handled below */ }
  if (TABS[tab]) { where.push(`d.status IN (${inList(TABS[tab])})`); params.push(...TABS[tab]); }
  if (q.tab === 'delayed') { where.push(`d.status IN (${inList(S.ACTIVE)}) AND d.eta_at < ?`); params.push(...S.ACTIVE, new Date(Date.now() - 600000).toISOString()); }
  if (q.tab === 'reverse') where.push("d.kind = 'return'");
  if (q.zone) { where.push('d.zone_id = ?'); params.push(Number(q.zone)); }
  if (S.CATEGORIES[q.category]) { where.push('d.category = ?'); params.push(q.category); }
  const list = paged({ select: 'd.*', from: 'deliveries d', where, params, search: q.q ? { q: q.q, cols: ['d.code', 'd.pickup_name', 'd.drop_area', '(SELECT code FROM orders WHERE id = d.order_id)', '(SELECT code FROM delivery_partners WHERE id = d.partner_id)'] } : null, defaultSort: 'd.id DESC', page: q.page, pageSize: q.page_size || 25 });
  const counts = {};
  for (const [key, statuses] of Object.entries(TABS)) counts[key] = statuses ? get(`SELECT COUNT(*) AS n FROM deliveries WHERE status IN (${inList(statuses)})`, ...statuses).n : get('SELECT COUNT(*) AS n FROM deliveries').n;
  counts.delayed = get(`SELECT COUNT(*) AS n FROM deliveries WHERE status IN (${inList(S.ACTIVE)}) AND eta_at < ?`, ...S.ACTIVE, new Date(Date.now() - 600000).toISOString()).n;
  return { ...list, rows: list.rows.map((d) => V.forAdmin(d)), counts, zones: all('SELECT id, name FROM service_zones ORDER BY name') };
});
A('GET', '/api/admin/deliveries/:code', (ctx) => {
  const d = deliveryByCode(ctx.params.code);
  C.audit(ctx.actor, 'Viewed delivery record', 'delivery', d.code);
  return { delivery: V.forAdmin(d, true) };
});
A('GET', '/api/admin/deliveries/:code/candidates', (ctx) => {
  const d = deliveryByCode(ctx.params.code);
  const scored = S.UNASSIGNED.includes(d.status) ? E.candidates(d) : [];
  const rows = all(`SELECT p.*, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.status = 'approved' AND p.id IN (SELECT partner_id FROM partner_zones WHERE zone_id = ?) ORDER BY p.online DESC, p.code`, d.zone_id);
  return {
    candidates: rows.map((p) => {
      const hit = scored.find((s) => s.partner.id === p.id);
      const vehicle = E.vehicleOf(p.id);
      const reasons = E.ineligibility(p, d, { manual: true });
      return { code: p.code, name: p.name, online: Boolean(p.online), vehicle: vehicle ? S.VEHICLES[vehicle.type].label : null, eligible: !reasons.length, reasons,
        score: hit ? hit.score : null, pickup_km: hit ? hit.km : null, pickup_eta_min: hit ? Math.round(hit.eta) : null, score_parts: hit ? hit.parts : null };
    }).sort((a, b) => (b.score || -1) - (a.score || -1)),
  };
});
A('POST', '/api/admin/deliveries/:code/assign', (ctx) => {
  const data = validate(ctx.body, { partner_code: { required: true, max: 20, label: 'Partner' }, reason: { required: true, min: 5, max: 200, label: 'Reason' } });
  const d = E.manualAssign(deliveryByCode(ctx.params.code), partnerByCode(data.partner_code), ctx.actor, data.reason, 'manual');
  return { ok: true, delivery: V.forAdmin(d, true) };
});
A('POST', '/api/admin/deliveries/:code/reassign', (ctx) => {
  const data = validate(ctx.body, { partner_code: { max: 20 }, reason: { required: true, min: 5, max: 200, label: 'Reason' } });
  const result = tx(() => {
    let d = deliveryByCode(ctx.params.code);
    const next = data.partner_code ? partnerByCode(data.partner_code) : null;
    if (next && next.id === d.partner_id) throw conflict('This partner already has the delivery.');
    d = E.unassign(d, ctx.actor, `Reassigned by operations: ${data.reason}`, { research: !next });
    if (next) d = E.manualAssign(E.one(d.id), next, ctx.actor, data.reason, 'reassign');
    else C.audit(ctx.actor, 'Sent delivery back to dispatch', 'delivery', d.code, data.reason);
    return d;
  });
  return { ok: true, delivery: V.forAdmin(E.one(result.id), true) };
});
A('POST', '/api/admin/deliveries/:code/cancel', (ctx) => {
  const data = validate(ctx.body, { reason: { required: true, min: 5, max: 200, label: 'Reason' } });
  const d = tx(() => {
    const cancelled = E.cancelDelivery(deliveryByCode(ctx.params.code), ctx.actor, data.reason);
    if (cancelled.kind === 'forward') {
      // The order is cancelled with it, which releases the reserved stock.
      const order = get('SELECT * FROM orders WHERE id = ?', cancelled.order_id);
      if (['new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship'].includes(order.status)) E.orderAction(cancelled, 'cancel', { reason: 'Other', note: `Delivery cancelled by operations: ${data.reason}`.slice(0, 300) });
    }
    C.audit(ctx.actor, 'Cancelled delivery', 'delivery', cancelled.code, data.reason);
    return cancelled;
  });
  return { ok: true, delivery: V.forAdmin(E.one(d.id), true) };
});
A('POST', '/api/admin/deliveries/:code/resolve-failed', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: ['reattempt', 'return'] }, note: { max: 200 } });
  const d = E.resolveFailed(deliveryByCode(ctx.params.code), data.decision, ctx.actor, data.note);
  return { ok: true, delivery: V.forAdmin(d, true) };
});
A('POST', '/api/admin/deliveries/:code/third-party', (ctx) => {
  const data = validate(ctx.body, { name: { required: true, min: 2, max: 60, label: 'Logistics company' }, reference: { required: true, min: 3, max: 60, label: 'Booking reference' }, reason: { required: true, min: 5, max: 200 } });
  const d = tx(() => {
    let cur = deliveryByCode(ctx.params.code);
    if (!S.UNASSIGNED.includes(cur.status)) throw conflict('Only an unassigned delivery can be handed to a third-party logistics company.');
    E.cancelLiveOffers(cur);
    insert('delivery_assignments', { delivery_id: cur.id, partner_id: null, mode: 'third_party', assigned_by: ctx.user.name, reason: `${data.name} · ${data.reference} · ${data.reason}`, assigned_at: nowIso() });
    cur = C.setStatus(cur, 'partner_assigned', ctx.actor, `Handed to third-party logistics: ${data.name} (${data.reference}).`, { third_party_name: data.name, third_party_ref: data.reference, assigned_at: nowIso() });
    C.audit(ctx.actor, 'Assigned delivery to third-party logistics', 'delivery', cur.code, `${data.name} · ${data.reference}`);
    C.notifySeller(cur, `${cur.code} will be collected by ${data.name}`, `Reference ${data.reference}. Share the pickup PIN with their rider.`);
    return cur;
  });
  return { ok: true, delivery: V.forAdmin(d, true) };
});
// A third-party rider does not use the partner app, so operations record the carrier's scans. Each step still needs the
// same code the app would ask for: the seller's pickup PIN, then the customer's delivery code.
A('POST', '/api/admin/deliveries/:code/third-party-update', (ctx) => {
  const data = validate(ctx.body, { step: { required: true, enum: ['picked_up', 'delivered'] }, code: { required: true, max: 12, label: 'Verification code' }, note: { max: 200 } });
  const d = tx(() => {
    let cur = deliveryByCode(ctx.params.code);
    if (!cur.third_party_name) throw conflict('This delivery is not with a third-party logistics company.');
    if (data.step === 'picked_up') {
      if (cur.status !== 'partner_assigned') throw conflict('Pickup has already been recorded.');
      if (!cur.ready_at) throw conflict('The seller has not marked the order ready.');
      if (String(data.code).trim() !== cur.pickup_code) throw bad('That pickup PIN is not correct.', { code: 'Incorrect code.' });
      insert('pickup_confirmations', { delivery_id: cur.id, partner_id: null, method: 'pin', package_count: cur.package_count, confirmed_by: `${ctx.user.name} for ${cur.third_party_name}`, created_at: nowIso() });
      cur = C.setStatus(cur, 'picked_up', ctx.actor, `Collected by ${cur.third_party_name}. ${data.note || ''}`.trim(), { picked_up_at: nowIso() });
      E.orderAction(cur, 'dispatch');
      cur = C.setStatus(cur, 'en_route_to_customer', ctx.actor, 'On the way to the customer.');
      C.notifyCustomer(cur, 'picked_up', 'Order picked up', 'Your order is on the way.');
    } else {
      if (cur.status !== 'en_route_to_customer') throw conflict('Record the pickup first.');
      if (String(data.code).trim() !== cur.drop_code) throw bad('That delivery code is not correct.', { code: 'Incorrect code.' });
      const at = nowIso();
      run('UPDATE deliveries SET arrived_drop_at = ? WHERE id = ?', at, cur.id);
      E.addProof(cur, null, 'otp', { note: `Code confirmed through ${cur.third_party_name}` });
      cur = C.setStatus(cur, 'delivered', ctx.actor, `Delivered by ${cur.third_party_name}. Verified by customer code.`, { completed_at: nowIso() });
      E.endAssignment(cur, 'Delivered');
      E.orderAction(cur, 'deliver');
      insert('settlement_records', { delivery_id: cur.id, customer_fee: cur.customer_fee, partner_earning: 0, cod_amount: cur.cod_amount, cod_state: cur.payment_type === 'cod' ? 'collected' : 'not_applicable', created_at: nowIso() });
      C.notifyCustomer(cur, 'delivered', 'Delivered', null);
    }
    C.audit(ctx.actor, `Third-party update: ${data.step}`, 'delivery', cur.code, data.note);
    return cur;
  });
  return { ok: true, delivery: V.forAdmin(E.one(d.id), true) };
});

/* ---------- Partner management ---------- */
function partnerSummary(p) {
  const vehicle = E.vehicleOf(p.id);
  return {
    code: p.code, name: p.name, mobile_masked: maskMobile(p.mobile), status: p.status, status_label: S.APPLICATION_STATUS[p.status], online: Boolean(p.online), city: p.city,
    vehicle: vehicle ? S.VEHICLES[vehicle.type].label : null, fleet: p.fleet_id ? get('SELECT code, name FROM fleets WHERE id = ?', p.fleet_id) : null, submitted_at: p.submitted_at,
    approved_at: p.approved_at, rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null, is_demo: Boolean(p.is_demo), created_at: p.created_at,
  };
}
A('GET', '/api/admin/partners', (ctx) => {
  const q = ctx.query;
  const where = ['1 = 1']; const params = [];
  if (q.tab === 'applications') where.push("p.status IN ('submitted','under_review','info_required')");
  else if (S.APPLICATION_STATUS[q.tab]) { where.push('p.status = ?'); params.push(q.tab); }
  else if (q.tab === 'online') where.push("p.status = 'approved' AND p.online = 1");
  const list = paged({ select: 'p.*, u.name, u.mobile', from: 'delivery_partners p JOIN users u ON u.id = p.user_id', where, params, search: q.q ? { q: q.q, cols: ['p.code', 'u.name', 'u.mobile', 'p.city'] } : null, defaultSort: 'p.id DESC', page: q.page, pageSize: 25 });
  const counts = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM delivery_partners GROUP BY status').map((r) => [r.status, r.n]));
  return { ...list, rows: list.rows.map(partnerSummary), counts: { ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0), applications: (counts.submitted || 0) + (counts.under_review || 0) + (counts.info_required || 0), online: get("SELECT COUNT(*) AS n FROM delivery_partners WHERE status = 'approved' AND online = 1").n } };
});
A('GET', '/api/admin/partners/:code', (ctx) => {
  const p = partnerByCode(ctx.params.code);
  C.audit(ctx.actor, 'Viewed partner record', 'partner', p.code);
  const vehicle = E.vehicleOf(p.id);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  return {
    partner: {
      ...partnerSummary(p), email: p.email, mobile: p.mobile, mobile_verified: Boolean(p.mobile_verified_at), email_verified: Boolean(p.email_verified_at), status_note: p.status_note,
      language: p.language, emergency_name: p.emergency_name, emergency_phone_masked: maskMobile(p.emergency_phone), categories: parseJson(p.categories, []),
      payout: p.payout_status === 'missing' ? null : { holder: p.payout_holder, bank: p.payout_bank, account_ending: p.payout_last4, ifsc: p.payout_ifsc, status: p.payout_status },
      training_completed_at: p.training_completed_at, documents_valid_until: p.documents_valid_until, fleet_hold: Boolean(p.fleet_hold), last_location_at: p.last_location_at,
      vehicle: vehicle ? { ...vehicle, label: S.VEHICLES[vehicle.type].label } : null,
      zones: all('SELECT z.code, z.name FROM service_zones z JOIN partner_zones pz ON pz.zone_id = z.id WHERE pz.partner_id = ?', p.id),
      documents: all('SELECT id, kind, file_name, mime, size, status, note, uploaded_at, reviewed_at, reviewed_by FROM partner_documents WHERE partner_id = ? ORDER BY id', p.id).map((d) => ({ ...d, kind_label: S.DOCUMENT_KINDS[d.kind] })),
      required_documents: PR.requiredDocuments(vehicle), checklist: PR.checklist(p, p),
      history: all('SELECT status, note, actor, created_at FROM partner_applications WHERE partner_id = ? ORDER BY id', p.id).map((h) => ({ ...h, label: S.APPLICATION_STATUS[h.status] })),
      wallet: PR.wallet(p.id), cash_in_hand: E.cashInHand(p.id),
      activity: { completed_30d: get("SELECT COUNT(*) AS n FROM deliveries WHERE partner_id = ? AND status = 'delivered' AND completed_at > ?", p.id, since).n, active: (E.activeTask(p.id) || {}).code || null,
        availability: all('SELECT online, reason, created_at FROM partner_availability WHERE partner_id = ? ORDER BY id DESC LIMIT 10', p.id) },
      recent_deliveries: all("SELECT code, status, category, completed_at, created_at, partner_earning FROM deliveries WHERE partner_id = ? ORDER BY id DESC LIMIT 10", p.id).map((d) => ({ ...d, status_label: C.label(d.status) })),
    },
  };
});
const DECISIONS = {
  under_review: { from: ['submitted'], to: 'under_review', title: 'Your application is under review' },
  approve: { from: ['submitted', 'under_review'], to: 'approved', title: 'Your application is approved' },
  reject: { from: ['submitted', 'under_review', 'info_required'], to: 'rejected', title: 'Your application was not approved', note: true },
  info_required: { from: ['submitted', 'under_review'], to: 'info_required', title: 'More information is needed for your application', note: true },
  suspend: { from: ['approved'], to: 'suspended', title: 'Your account has been suspended', note: true },
  reinstate: { from: ['suspended', 'expired'], to: 'approved', title: 'Your account is active again' },
};
A('PATCH', '/api/admin/partners/:code/approval', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: Object.keys(DECISIONS) }, note: { max: 500 }, documents_valid_until: { format: 'date' } });
  const def = DECISIONS[data.decision];
  const result = tx(() => {
    const p = partnerByCode(ctx.params.code);
    if (!def.from.includes(p.status)) throw conflict(`This decision is not possible while the application is ${S.APPLICATION_STATUS[p.status].toLowerCase()}.`);
    if (def.note && !data.note) throw bad('Give the partner a reason.', { note: 'Explain the decision.' });
    if (def.to === 'approved') {
      const vehicle = E.vehicleOf(p.id);
      const docs = all('SELECT kind, status FROM partner_documents WHERE partner_id = ?', p.id);
      const unverified = PR.requiredDocuments(vehicle).filter((k) => !docs.some((d) => d.kind === k && d.status === 'verified'));
      if (unverified.length) throw conflict(`Verify these documents before approving: ${unverified.map((k) => S.DOCUMENT_KINDS[k].toLowerCase()).join(', ')}.`);
      if (!vehicle || vehicle.status !== 'verified') throw conflict('Verify the vehicle record before approving.');
      if (data.documents_valid_until && data.documents_valid_until <= istDate()) throw bad('Please correct the highlighted fields.', { documents_valid_until: 'Choose a future date.' });
    }
    if (def.to === 'suspended') {
      const task = E.activeTask(p.id);
      if (task && S.AFTER_PICKUP.includes(task.status)) throw conflict(`${p.code} is carrying ${task.code}. Suspend the account after that delivery is closed.`);
      if (task) E.unassign(task, ctx.actor, 'Partner account suspended');
      if (p.online) E.setOnline(p, false, 'Account suspended');
      run("DELETE FROM sessions WHERE user_id = ? AND user_agent LIKE '[partner]%'", p.user_id); // session revocation
    }
    const patch = { status: def.to, status_note: data.note || null, updated_at: nowIso() };
    if (def.to === 'approved') { patch.approved_at = p.approved_at || nowIso(); patch.documents_valid_until = data.documents_valid_until ? istDayEnd(data.documents_valid_until) : p.documents_valid_until; }
    run(`UPDATE delivery_partners SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(patch), p.id);
    PR.logApplication(p.id, def.to, data.note, ctx.user.name);
    C.notifyPartner(p.id, 'verification', def.title, data.note);
    C.audit(ctx.actor, `Partner application: ${data.decision}`, 'partner', p.code, data.note);
    return p;
  });
  C.publish(['admin', `partner:${result.id}`], { kind: 'partner' });
  return { ok: true, status: def.to, status_label: S.APPLICATION_STATUS[def.to] };
});
A('POST', '/api/admin/partners/:code/documents/:id/review', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: ['verified', 'rejected'] }, note: { max: 300 } });
  const p = partnerByCode(ctx.params.code);
  const doc = get('SELECT * FROM partner_documents WHERE id = ? AND partner_id = ?', Number(ctx.params.id), p.id);
  if (!doc) throw notFound('Document');
  if (data.decision === 'rejected' && !data.note) throw bad('Say why the document was rejected.', { note: 'Explain what is wrong.' });
  run('UPDATE partner_documents SET status = ?, note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?', data.decision, data.note || null, nowIso(), ctx.user.name, doc.id);
  if (data.decision === 'rejected') C.notifyPartner(p.id, 'verification', `${S.DOCUMENT_KINDS[doc.kind]} needs to be uploaded again`, data.note);
  C.audit(ctx.actor, `Document ${data.decision}`, 'partner', p.code, S.DOCUMENT_KINDS[doc.kind]);
  return { ok: true };
});
// Identity documents are never served from a permanent address: each view issues a link that works for five minutes.
A('POST', '/api/admin/partners/:code/documents/:id/link', (ctx) => {
  const p = partnerByCode(ctx.params.code);
  const doc = get('SELECT id, kind FROM partner_documents WHERE id = ? AND partner_id = ?', Number(ctx.params.id), p.id);
  if (!doc) throw notFound('Document');
  C.audit(ctx.actor, 'Opened partner document', 'partner', p.code, S.DOCUMENT_KINDS[doc.kind]);
  return C.signedFileLink('document', doc.id);
});
A('POST', '/api/admin/files/:kind/:id/link', (ctx) => {
  const { kind } = ctx.params; const id = Number(ctx.params.id);
  const row = kind === 'proof' ? get('SELECT id FROM delivery_proofs WHERE id = ? AND storage_key IS NOT NULL', id) : kind === 'evidence' ? get('SELECT id FROM delivery_tickets WHERE id = ? AND evidence_key IS NOT NULL', id) : null;
  if (!row) throw notFound('File');
  C.audit(ctx.actor, `Opened ${kind} file`, kind, String(id));
  return C.signedFileLink(kind, id);
});
route('GET', '/api/files/:kind/:id', { auth: 'public' }, (ctx) => {
  const { kind } = ctx.params; const id = Number(ctx.params.id);
  C.checkFileLink(kind, id, ctx.query.exp, ctx.query.sig);
  const row = kind === 'document' ? get('SELECT storage_key AS key, mime FROM partner_documents WHERE id = ?', id)
    : kind === 'proof' ? get('SELECT storage_key AS key, mime FROM delivery_proofs WHERE id = ?', id)
      : kind === 'evidence' ? get('SELECT evidence_key AS key, evidence_mime AS mime FROM delivery_tickets WHERE id = ?', id) : null;
  if (!row || !row.key) throw notFound('File');
  return reply.bytes(row.mime, C.readFile(row.key));
});
A('POST', '/api/admin/partners/:code/vehicle-review', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: ['verified', 'rejected'] } });
  const p = partnerByCode(ctx.params.code);
  if (!run('UPDATE partner_vehicles SET status = ?, updated_at = ? WHERE partner_id = ?', data.decision, nowIso(), p.id).changes) throw conflict('This partner has no vehicle record.');
  C.audit(ctx.actor, `Vehicle ${data.decision}`, 'partner', p.code);
  return { ok: true };
});
A('POST', '/api/admin/partners/:code/payout-review', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: ['verified', 'rejected'] } });
  const p = partnerByCode(ctx.params.code);
  if (p.payout_status === 'missing') throw conflict('This partner has not added a payout account.');
  run('UPDATE delivery_partners SET payout_status = ? WHERE id = ?', data.decision, p.id);
  C.notifyPartner(p.id, 'payout', data.decision === 'verified' ? 'Payout account verified' : 'Payout account could not be verified', data.decision === 'verified' ? null : 'Check the account details and save them again.');
  C.audit(ctx.actor, `Payout account ${data.decision}`, 'partner', p.code);
  return { ok: true };
});
A('POST', '/api/admin/partners/:code/fleet', (ctx) => {
  const p = partnerByCode(ctx.params.code);
  const fleet = ctx.body.fleet_code ? get('SELECT * FROM fleets WHERE code = ?', String(ctx.body.fleet_code)) : null;
  if (ctx.body.fleet_code && !fleet) throw notFound('Fleet');
  if (E.activeTask(p.id)) throw conflict('Change the fleet when the partner has no active delivery.');
  run('UPDATE delivery_partners SET fleet_id = ?, fleet_hold = 0 WHERE id = ?', fleet ? fleet.id : null, p.id);
  C.audit(ctx.actor, 'Changed partner fleet', 'partner', p.code, fleet ? fleet.code : 'Individual');
  return { ok: true };
});

/* ---------- Zones and pricing ---------- */
const zoneView = (z) => ({
  ...z, pincodes: C.zonePins(z), open_now: z.status === 'active' && C.zoneOpenNow(z), is_demo: Boolean(z.is_demo),
  fees: all('SELECT category, base_fee, free_km, per_km_fee, scheduled_fee, handling_fee, tax_rate, partner_base, partner_per_km, updated_at, updated_by FROM delivery_fee_rules WHERE zone_id = ? ORDER BY category', z.id),
  partners: get('SELECT COUNT(*) AS n FROM partner_zones WHERE zone_id = ?', z.id).n,
  open_deliveries: get("SELECT COUNT(*) AS n FROM deliveries WHERE zone_id = ? AND status NOT IN ('delivered','returned_to_seller','cancelled')", z.id).n,
});
const ZONE_RULES = {
  name: { required: true, min: 2, max: 60 }, city: { required: true, min: 2, max: 60 }, center_lat: { required: true, type: 'number', min: -90, max: 90, label: 'Centre latitude' },
  center_lng: { required: true, type: 'number', min: -180, max: 180, label: 'Centre longitude' }, radius_km: { required: true, type: 'number', min: 0.5, max: 50, label: 'Radius' },
  max_delivery_km: { required: true, type: 'number', min: 0.5, max: 50, label: 'Maximum delivery distance' }, open_time: { required: true, max: 5 }, close_time: { required: true, max: 5 },
  capacity_limit: { required: true, type: 'int', min: 1, max: 100000, label: 'Capacity limit' }, demand_incentive: { type: 'number', min: 0, max: 200, default: 0, label: 'Demand incentive' },
  pincodes: { type: 'array', max: 200 }, status: { enum: ['active', 'suspended'] }, status_note: { max: 200 },
};
function cleanZone(body, partial) {
  // Coordinates keep their full precision; the shared validator would round them to two decimals.
  const raw = { lat: Number(body && body.center_lat), lng: Number(body && body.center_lng) };
  const data = validate(body, ZONE_RULES, { partial });
  if (data.center_lat !== undefined) data.center_lat = raw.lat;
  if (data.center_lng !== undefined) data.center_lng = raw.lng;
  const fields = {};
  for (const key of ['open_time', 'close_time']) if (data[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data[key])) fields[key] = 'Use 24-hour time, for example 07:30.';
  if (data.pincodes !== undefined) {
    const pins = [];
    for (const p of data.pincodes) {
      const pin = String(p && p.pin || '').trim(); const lat = Number(p && p.lat); const lng = Number(p && p.lng);
      if (!/^[1-9]\d{5}$/.test(pin) || !C.validCoord(lat, lng) || !String(p.area || '').trim()) { fields.pincodes = 'Each line needs a 6-digit PIN code, an area name, a latitude and a longitude.'; break; }
      pins.push({ pin, area: String(p.area).trim().slice(0, 60), lat, lng });
    }
    data.pincodes = JSON.stringify(pins);
  }
  if (data.status === 'suspended' && !data.status_note) fields.status_note = 'Say why service is suspended.';
  if (Object.keys(fields).length) throw bad('Please correct the highlighted fields.', fields);
  return data;
}
A('GET', '/api/admin/zones', () => ({ zones: all('SELECT * FROM service_zones ORDER BY name').map(zoneView), categories: S.CATEGORIES }));
A('POST', '/api/admin/zones', (ctx) => {
  const data = cleanZone(ctx.body, false);
  const code = tx(() => {
    const zoneCode = nextCode('ZN', 100);
    const id = insert('service_zones', { code: zoneCode, ...data, pincodes: data.pincodes || '[]', status: data.status || 'active', created_at: nowIso(), updated_at: nowIso() });
    const defaults = { food: [25, 1, 8, 10, 10, 5, 22, 6], grocery: [29, 1.5, 8, 15, 15, 5, 25, 6], ecommerce: [39, 2, 9, 0, 20, 18, 28, 7] };
    for (const [category, v] of Object.entries(defaults)) insert('delivery_fee_rules', { zone_id: id, category, base_fee: v[0], free_km: v[1], per_km_fee: v[2], scheduled_fee: v[3], handling_fee: v[4], tax_rate: v[5], partner_base: v[6], partner_per_km: v[7], updated_at: nowIso(), updated_by: ctx.user.name });
    C.audit(ctx.actor, 'Created delivery zone', 'zone', zoneCode, data.name);
    return zoneCode;
  });
  return reply.created({ ok: true, code });
});
A('PATCH', '/api/admin/zones/:code', (ctx) => {
  const zone = get('SELECT * FROM service_zones WHERE code = ?', ctx.params.code);
  if (!zone) throw notFound('Zone');
  const data = cleanZone(ctx.body, true);
  if (data.status === 'active') data.status_note = null;
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (keys.length) run(`UPDATE service_zones SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => data[k]), nowIso(), zone.id);
  C.audit(ctx.actor, data.status && data.status !== zone.status ? `Zone ${data.status === 'suspended' ? 'suspended' : 'resumed'}` : 'Updated delivery zone', 'zone', zone.code, keys.join(', '));
  C.publish('admin', { kind: 'zone' });
  return { ok: true, zone: zoneView(get('SELECT * FROM service_zones WHERE id = ?', zone.id)) };
});
A('PUT', '/api/admin/zones/:code/fees/:category', (ctx) => {
  const zone = get('SELECT * FROM service_zones WHERE code = ?', ctx.params.code);
  if (!zone || !S.CATEGORIES[ctx.params.category]) throw notFound('Fee rule');
  const money = (label, max = 1000) => ({ required: true, type: 'number', min: 0, max, label });
  const data = validate(ctx.body, { base_fee: money('Base fee'), free_km: money('Included distance', 50), per_km_fee: money('Fee per km', 200), scheduled_fee: money('Scheduled delivery fee'), handling_fee: money('Special handling fee'), tax_rate: money('Tax rate', 28), partner_base: money('Partner base earning'), partner_per_km: money('Partner earning per km', 200) });
  run(`INSERT INTO delivery_fee_rules (zone_id, category, base_fee, free_km, per_km_fee, scheduled_fee, handling_fee, tax_rate, partner_base, partner_per_km, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(zone_id, category) DO UPDATE SET base_fee = excluded.base_fee, free_km = excluded.free_km, per_km_fee = excluded.per_km_fee, scheduled_fee = excluded.scheduled_fee, handling_fee = excluded.handling_fee,
      tax_rate = excluded.tax_rate, partner_base = excluded.partner_base, partner_per_km = excluded.partner_per_km, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  zone.id, ctx.params.category, data.base_fee, data.free_km, data.per_km_fee, data.scheduled_fee, data.handling_fee, data.tax_rate, data.partner_base, data.partner_per_km, nowIso(), ctx.user.name);
  C.audit(ctx.actor, 'Changed delivery fee rule', 'zone', zone.code, `${ctx.params.category}: ${JSON.stringify(data)}`);
  return { ok: true, zone: zoneView(zone) };
});

/* ---------- Finance and settlements ---------- */
A('GET', '/api/admin/finance', (ctx) => {
  const range = resolveRange({ range: ctx.query.range || '30d', from: ctx.query.from, to: ctx.query.to });
  const sum = (sql, ...p) => r2(get(sql, ...p).n || 0);
  const between = [range.fromIso, range.toIso];
  return {
    range: { key: range.key, label: range.label },
    totals: {
      customer_fees: sum("SELECT SUM(customer_fee) AS n FROM deliveries WHERE status = 'delivered' AND completed_at BETWEEN ? AND ?", ...between),
      partner_earnings: sum("SELECT SUM(amount) AS n FROM partner_earning_ledger WHERE created_at BETWEEN ? AND ?", ...between),
      adjustments: sum("SELECT SUM(amount) AS n FROM financial_adjustments WHERE created_at BETWEEN ? AND ?", ...between),
      cod_collected: sum("SELECT SUM(amount) AS n FROM cod_transactions WHERE type = 'collection' AND created_at BETWEEN ? AND ?", ...between),
      cod_with_partners: sum("SELECT SUM(amount) AS n FROM cod_transactions WHERE type = 'collection' AND method = 'cash' AND status = 'pending'"),
      payouts_paid: sum("SELECT SUM(amount) AS n FROM partner_payouts WHERE status = 'paid' AND settled_at BETWEEN ? AND ?", ...between),
      available_to_pay: sum("SELECT SUM(amount) AS n FROM partner_earning_ledger WHERE status = 'available'"),
      held_for_cash: sum("SELECT SUM(amount) AS n FROM partner_earning_ledger WHERE status = 'pending'"),
    },
    settlements: get("SELECT SUM(state = 'open') AS open, SUM(state = 'reconciled') AS reconciled FROM settlement_records"),
    payable: all(`SELECT p.code, u.name, p.payout_status, COALESCE(SUM(l.amount), 0) AS available FROM delivery_partners p JOIN users u ON u.id = p.user_id
      JOIN partner_earning_ledger l ON l.partner_id = p.id AND l.status = 'available' GROUP BY p.id HAVING available > 0 ORDER BY available DESC`).map((r) => ({ ...r, available: r2(r.available) })),
    payouts: all('SELECT o.code, o.amount, o.status, o.reference, o.failure_reason, o.created_at, o.settled_at, o.created_by, p.code AS partner_code FROM partner_payouts o JOIN delivery_partners p ON p.id = o.partner_id ORDER BY o.id DESC LIMIT 50'),
    cod: all(`SELECT c.code, c.type, c.amount, c.method, c.status, c.reference, c.note, c.created_at, c.confirmed_by, p.code AS partner_code, d.code AS delivery_code
      FROM cod_transactions c JOIN delivery_partners p ON p.id = c.partner_id LEFT JOIN deliveries d ON d.id = c.delivery_id ORDER BY c.id DESC LIMIT 80`),
    outstanding_cod: all(`SELECT p.code, u.name FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.id IN (SELECT partner_id FROM cod_transactions WHERE type = 'collection' AND method = 'cash')`)
      .map((p) => ({ ...p, cash_in_hand: E.cashInHand(get('SELECT id FROM delivery_partners WHERE code = ?', p.code).id) })).filter((p) => p.cash_in_hand > 0),
    adjustments: all('SELECT a.code, a.amount, a.reason, a.created_by, a.created_at, p.code AS partner_code, (SELECT code FROM deliveries WHERE id = a.delivery_id) AS delivery_code FROM financial_adjustments a JOIN delivery_partners p ON p.id = a.partner_id ORDER BY a.id DESC LIMIT 30'),
    integration_note: 'No payout provider is connected. A payout here is a record: send the money through your bank, then record its reference.',
  };
});
A('POST', '/api/admin/cod/:code/review', (ctx) => {
  const data = validate(ctx.body, { decision: { required: true, enum: ['confirm', 'dispute'] }, note: { max: 200 } });
  tx(() => {
    const row = get('SELECT * FROM cod_transactions WHERE code = ?', ctx.params.code);
    if (!row) throw notFound('Cash record');
    if (row.status !== 'pending') throw conflict(`This record is already ${row.status}.`);
    if (data.decision === 'dispute') {
      if (!data.note) throw bad('Explain the dispute.', { note: 'Say what does not match.' });
      run("UPDATE cod_transactions SET status = 'disputed', note = ?, confirmed_at = ?, confirmed_by = ? WHERE id = ?", data.note, nowIso(), ctx.user.name, row.id);
      C.notifyPartner(row.partner_id, 'payment', `Cash record ${row.code} is disputed`, data.note);
      C.notifyAdmin('reconciliation_issue', `Cash reconciliation issue: ${row.code}`, data.note);
    } else if (row.type === 'deposit') {
      run("UPDATE cod_transactions SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE id = ?", nowIso(), ctx.user.name, row.id);
      E.allocateDeposits(row.partner_id);
      C.notifyPartner(row.partner_id, 'payment', `Deposit of ₹${row.amount} confirmed`, 'Earnings held against that cash have been released.');
    } else if (row.method === 'upi') {
      E.settleCollection(row, ctx.user.name); // a digital payment at the door is confirmed against the bank statement
    } else throw conflict('Cash collections are settled by confirming the partner\'s deposit.');
    C.audit(ctx.actor, `Cash record ${data.decision}`, 'cod', row.code, data.note);
  });
  return { ok: true };
});
A('POST', '/api/admin/payouts', (ctx) => {
  const data = validate(ctx.body, { partner_code: { required: true, max: 20 } });
  const created = tx(() => {
    const p = partnerByCode(data.partner_code);
    if (p.payout_status !== 'verified') throw conflict('This partner\'s payout account is not verified.');
    const rows = all("SELECT id, amount FROM partner_earning_ledger WHERE partner_id = ? AND status = 'available'", p.id);
    const amount = r2(rows.reduce((s, r) => s + r.amount, 0));
    if (amount <= 0) throw conflict('There is no available balance to pay.');
    const code = nextCode('PAY', 7000);
    const id = insert('partner_payouts', { code, partner_id: p.id, amount, status: 'processing', created_by: ctx.user.name, created_at: nowIso() });
    run("UPDATE partner_earning_ledger SET status = 'in_payout', payout_id = ? WHERE partner_id = ? AND status = 'available'", id, p.id);
    for (const r of all('SELECT DISTINCT delivery_id FROM partner_earning_ledger WHERE payout_id = ? AND delivery_id IS NOT NULL', id)) E.reconcile(r.delivery_id);
    C.notifyPartner(p.id, 'payout', `Payout ${code} of ₹${amount} is being processed`, null);
    C.audit(ctx.actor, 'Created payout', 'payout', code, `${p.code} · ₹${amount} · account ending ${p.payout_last4}`);
    return { code, amount };
  });
  return reply.created({ ok: true, ...created });
});
A('POST', '/api/admin/payouts/:code/settle', (ctx) => {
  const data = validate(ctx.body, { status: { required: true, enum: ['paid', 'failed'] }, reference: { max: 60 }, failure_reason: { max: 200 } });
  tx(() => {
    const payout = get('SELECT * FROM partner_payouts WHERE code = ?', ctx.params.code);
    if (!payout) throw notFound('Payout');
    if (payout.status !== 'processing') throw conflict(`This payout is already ${payout.status}.`);
    if (data.status === 'paid') {
      if (!data.reference || data.reference.length < 4) throw bad('Enter the bank reference of the transfer.', { reference: 'Bank reference is required.' });
      run("UPDATE partner_payouts SET status = 'paid', reference = ?, settled_at = ? WHERE id = ?", data.reference, nowIso(), payout.id);
      run("UPDATE partner_earning_ledger SET status = 'paid' WHERE payout_id = ?", payout.id);
      C.notifyPartner(payout.partner_id, 'payout', `Payout ${payout.code} of ₹${payout.amount} has been paid`, `Reference ${data.reference}`);
    } else {
      if (!data.failure_reason) throw bad('Say why the payout failed.', { failure_reason: 'Reason is required.' });
      // A failed payout puts the money back into the available balance so that it can be paid again.
      run("UPDATE partner_payouts SET status = 'failed', failure_reason = ?, settled_at = ? WHERE id = ?", data.failure_reason, nowIso(), payout.id);
      run("UPDATE partner_earning_ledger SET status = 'available', payout_id = NULL WHERE payout_id = ?", payout.id);
      C.notifyPartner(payout.partner_id, 'payout', `Payout ${payout.code} failed`, `${data.failure_reason}. The amount is back in your available balance.`);
    }
    for (const r of all('SELECT DISTINCT delivery_id FROM partner_earning_ledger WHERE (payout_id = ? OR partner_id = ?) AND delivery_id IS NOT NULL', payout.id, payout.partner_id)) E.reconcile(r.delivery_id);
    C.audit(ctx.actor, `Payout ${data.status}`, 'payout', payout.code, data.reference || data.failure_reason);
  });
  return { ok: true };
});
A('POST', '/api/admin/adjustments', (ctx) => {
  const data = validate(ctx.body, { partner_code: { required: true, max: 20 }, delivery_code: { max: 20 }, amount: { required: true, type: 'number', min: -5000, max: 5000 }, reason: { required: true, min: 5, max: 200 } });
  if (data.amount === 0) throw bad('Please correct the highlighted fields.', { amount: 'Enter an amount other than zero.' });
  const code = tx(() => {
    const p = partnerByCode(data.partner_code);
    const d = data.delivery_code ? get('SELECT id FROM deliveries WHERE code = ? AND id IN (SELECT delivery_id FROM delivery_assignments WHERE partner_id = ?)', data.delivery_code, p.id) : null;
    if (data.delivery_code && !d) throw bad('Please correct the highlighted fields.', { delivery_code: 'That delivery does not belong to this partner.' });
    const adj = nextCode('ADJ', 3000);
    insert('financial_adjustments', { code: adj, partner_id: p.id, delivery_id: d ? d.id : null, amount: data.amount, reason: data.reason, created_by: ctx.user.name, created_at: nowIso() });
    insert('partner_earning_ledger', { txn_code: C.txnCode(), partner_id: p.id, delivery_id: null, type: 'adjustment', amount: data.amount, note: `${adj}: ${data.reason}`, status: 'available', created_at: nowIso() });
    C.notifyPartner(p.id, 'payment', `Adjustment of ₹${data.amount} on your earnings`, data.reason);
    C.audit(ctx.actor, 'Posted earning adjustment', 'partner', p.code, `${adj} · ₹${data.amount} · ${data.reason}`);
    return adj;
  });
  return reply.created({ ok: true, code });
});
A('GET', '/api/admin/finance/reconciliation.csv', (ctx) => {
  const rows = all(`SELECT d.code, o.code AS order_code, d.completed_at, d.status, d.payment_type, s.customer_fee, s.partner_earning, s.cod_amount, s.cod_state, s.earning_state, s.state, s.reconciled_at,
      (SELECT code FROM delivery_partners WHERE id = d.partner_id) AS partner_code FROM settlement_records s JOIN deliveries d ON d.id = s.delivery_id JOIN orders o ON o.id = d.order_id ORDER BY s.id DESC LIMIT 5000`);
  C.audit(ctx.actor, 'Exported reconciliation report', 'finance', null, `${rows.length} rows`);
  return reply.csv('delivery-reconciliation.csv', toCsv([['code', 'Delivery'], ['order_code', 'Order'], ['partner_code', 'Partner'], ['completed_at', 'Completed'], ['status', 'Delivery status'], ['payment_type', 'Payment type'], ['customer_fee', 'Customer delivery fee'], ['partner_earning', 'Partner earning'], ['cod_amount', 'COD amount'], ['cod_state', 'COD state'], ['earning_state', 'Earning state'], ['state', 'Settlement state'], ['reconciled_at', 'Reconciled at']], rows));
});

/* ---------- Complaints, incidents ---------- */
const ALL_CATEGORIES = { ...S.PARTNER_TICKET_CATEGORIES, ...S.COMPLAINT_CATEGORIES };
A('GET', '/api/admin/tickets', (ctx) => {
  const where = ['1 = 1']; const params = [];
  if (['open', 'in_progress', 'resolved'].includes(ctx.query.status)) { where.push('t.status = ?'); params.push(ctx.query.status); }
  if (['partner', 'customer', 'seller', 'fleet'].includes(ctx.query.from)) { where.push('t.raised_by = ?'); params.push(ctx.query.from); }
  const rows = all(`SELECT t.code, t.raised_by, t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at, d.code AS delivery_code, (SELECT code FROM delivery_partners WHERE id = t.partner_id) AS partner_code
    FROM delivery_tickets t LEFT JOIN deliveries d ON d.id = t.delivery_id WHERE ${where.join(' AND ')} ORDER BY (t.status = 'resolved'), (t.priority = 'urgent') DESC, t.id DESC LIMIT 200`, ...params);
  return { tickets: rows.map((t) => ({ ...t, category_label: ALL_CATEGORIES[t.category] || t.category })), counts: Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM delivery_tickets GROUP BY status').map((r) => [r.status, r.n])) };
});
const ticketByCode = (code) => { const t = get('SELECT * FROM delivery_tickets WHERE code = ?', code); if (!t) throw notFound('Ticket'); return t; };
A('GET', '/api/admin/tickets/:code', (ctx) => { const t = ticketByCode(ctx.params.code); return { ticket: { ...PR.ticketDetail(t, ALL_CATEGORIES), id: t.id, raised_by: t.raised_by, partner_code: t.partner_id ? get('SELECT code FROM delivery_partners WHERE id = ?', t.partner_id).code : null } }; });
A('POST', '/api/admin/tickets/:code/reply', (ctx) => {
  const data = validate(ctx.body, { body: { required: true, min: 2, max: 1500, label: 'Reply' }, status: { enum: ['open', 'in_progress', 'resolved'], default: 'in_progress' } });
  const t = ticketByCode(ctx.params.code);
  insert('delivery_ticket_messages', { ticket_id: t.id, author_type: 'support', author_name: ctx.user.name, body: data.body, created_at: nowIso() });
  run('UPDATE delivery_tickets SET status = ?, updated_at = ? WHERE id = ?', data.status, nowIso(), t.id);
  if (t.partner_id && t.raised_by === 'partner') C.notifyPartner(t.partner_id, 'ticket', `Support replied to ${t.code}`, data.body.slice(0, 120));
  if (t.raised_by === 'fleet' && t.fleet_id) C.dnotify('fleet', { fleet_id: t.fleet_id }, 'ticket', `Support replied to ${t.code}`, data.body.slice(0, 120));
  if (t.raised_by === 'customer' && t.delivery_id) C.dnotify('customer', { delivery_id: t.delivery_id }, 'ticket', 'Support replied to your report', data.body.slice(0, 200));
  if (t.raised_by === 'seller' && t.seller_id) require('../db').notify(t.seller_id, 'shipping', `Delivery support replied to ${t.code}`, data.body.slice(0, 120), '/seller/deliveries');
  C.audit(ctx.actor, `Replied to ticket (${data.status})`, 'ticket', t.code);
  return { ok: true, ticket: PR.ticketDetail(ticketByCode(t.code), ALL_CATEGORIES) };
});
A('GET', '/api/admin/incidents', () => ({ incidents: all(`SELECT i.code, i.type, i.description, i.status, i.resolution, i.lat, i.lng, i.created_at, i.resolved_at, (SELECT code FROM delivery_partners WHERE id = i.partner_id) AS partner_code, (SELECT code FROM deliveries WHERE id = i.delivery_id) AS delivery_code FROM incidents i ORDER BY (i.status = 'open') DESC, i.id DESC LIMIT 100`) }));
A('POST', '/api/admin/incidents/:code/resolve', (ctx) => {
  const data = validate(ctx.body, { resolution: { required: true, min: 5, max: 500 } });
  if (!run("UPDATE incidents SET status = 'resolved', resolution = ?, resolved_at = ? WHERE code = ? AND status = 'open'", data.resolution, nowIso(), ctx.params.code).changes) throw conflict('This incident is not open.');
  C.audit(ctx.actor, 'Resolved incident', 'incident', ctx.params.code, data.resolution);
  return { ok: true };
});
A('GET', '/api/admin/notifications', () => ({ notifications: all("SELECT id, type, title, body, read_at, created_at, (SELECT code FROM deliveries WHERE id = n.delivery_id) AS delivery_code FROM delivery_notifications n WHERE audience = 'admin' ORDER BY id DESC LIMIT 80") }));
A('POST', '/api/admin/notifications/read', () => { run("UPDATE delivery_notifications SET read_at = ? WHERE audience = 'admin' AND read_at IS NULL", nowIso()); return { ok: true }; });

/* ---------- Reports ---------- */
function reportData(range) {
  const b = [range.fromIso, range.toIso];
  const total = get('SELECT COUNT(*) AS n FROM deliveries WHERE created_at BETWEEN ? AND ?', ...b).n;
  const st = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM deliveries WHERE created_at BETWEEN ? AND ? GROUP BY status', ...b).map((r) => [r.status, r.n]));
  const closed = (st.delivered || 0) + (st.returned_to_seller || 0);
  const avg = (expr, extra = '') => { const v = get(`SELECT AVG(${expr}) AS m FROM deliveries WHERE created_at BETWEEN ? AND ? ${extra}`, ...b).m; return v === null || v === undefined ? null : r2(v); };
  const mins = (a, c) => `(julianday(${a}) - julianday(${c})) * 1440`;
  const reassigned = get("SELECT COUNT(DISTINCT delivery_id) AS n FROM delivery_assignments WHERE end_reason NOT IN ('Delivered','Returned to seller','Delivery cancelled') AND assigned_at BETWEEN ? AND ?", ...b).n;
  const complaints = get("SELECT COUNT(*) AS n FROM delivery_tickets WHERE raised_by IN ('customer','seller') AND created_at BETWEEN ? AND ?", ...b).n;
  const payouts = get("SELECT COUNT(*) AS n, SUM(status = 'failed') AS failed FROM partner_payouts WHERE status IN ('paid','failed') AND created_at BETWEEN ? AND ?", ...b);
  const rating = get('SELECT AVG(rating) AS m, COUNT(rating) AS n FROM deliveries WHERE rating IS NOT NULL AND created_at BETWEEN ? AND ?', ...b);
  const online = get("SELECT SUM(online = 1) AS online, COUNT(*) AS n FROM delivery_partners WHERE status = 'approved'");
  return {
    range: { key: range.key, label: range.label, from: range.from, to: range.to }, total,
    metrics: {
      success_rate: closed ? Math.round(((st.delivered || 0) / closed) * 100) : null, cancellation_rate: total ? Math.round(((st.cancelled || 0) / total) * 100) : null,
      reassignment_rate: total ? Math.round((reassigned / total) * 100) : null, average_assignment_minutes: avg(mins('assigned_at', 'search_started_at'), 'AND assigned_at IS NOT NULL AND search_started_at IS NOT NULL'),
      average_pickup_wait_minutes: avg(mins('picked_up_at', 'arrived_pickup_at'), 'AND picked_up_at IS NOT NULL AND arrived_pickup_at IS NOT NULL'),
      seller_handover_delay_minutes: avg(`MAX(0, ${mins('ready_at', "datetime(created_at, '+' || prep_minutes || ' minutes')")})`, 'AND ready_at IS NOT NULL'),
      average_delivery_minutes: avg(mins('completed_at', 'COALESCE(ready_at, created_at)'), "AND status = 'delivered'"),
      failed_attempts: get("SELECT COUNT(*) AS n FROM delivery_status_history WHERE status = 'delivery_attempt_failed' AND created_at BETWEEN ? AND ?", ...b).n,
      delayed: get('SELECT COUNT(*) AS n FROM deliveries WHERE delayed_notified_at IS NOT NULL AND created_at BETWEEN ? AND ?', ...b).n,
      cost_per_delivery: avg('partner_earning', "AND status = 'delivered'"), fee_per_delivery: avg('customer_fee', "AND status = 'delivered'"),
      customer_rating: rating.m ? r2(rating.m) : null, ratings: rating.n, complaint_rate: total ? r2((complaints / total) * 100) : null, complaints,
      payout_accuracy: payouts.n ? Math.round(((payouts.n - (payouts.failed || 0)) / payouts.n) * 100) : null, partners_online_share: online.n ? Math.round(((online.online || 0) / online.n) * 100) : null,
    },
    by_zone: all("SELECT z.name, COUNT(d.id) AS total, SUM(d.status = 'delivered') AS delivered FROM service_zones z LEFT JOIN deliveries d ON d.zone_id = z.id AND d.created_at BETWEEN ? AND ? GROUP BY z.id ORDER BY total DESC", ...b),
    by_category: Object.keys(S.CATEGORIES).map((c) => ({ category: S.CATEGORIES[c], ...get("SELECT COUNT(*) AS total, SUM(status = 'delivered') AS delivered FROM deliveries WHERE category = ? AND created_at BETWEEN ? AND ?", c, ...b) })),
    by_status: Object.entries(st).map(([status, n]) => ({ status: C.label(status), total: n })),
    partner_activity: all(`SELECT p.code, u.name, COUNT(d.id) AS completed, COALESCE(SUM(d.partner_earning), 0) AS earnings FROM delivery_partners p JOIN users u ON u.id = p.user_id
      JOIN deliveries d ON d.partner_id = p.id AND d.status = 'delivered' AND d.completed_at BETWEEN ? AND ? GROUP BY p.id ORDER BY completed DESC LIMIT 15`, ...b),
    note: 'Metrics are for finding operational problems. They are not used to rank partners by speed.',
  };
}
A('GET', '/api/admin/reports', (ctx) => reportData(resolveRange({ range: ctx.query.range || '30d', from: ctx.query.from, to: ctx.query.to })));
A('GET', '/api/admin/reports.csv', (ctx) => {
  const data = reportData(resolveRange({ range: ctx.query.range || '30d', from: ctx.query.from, to: ctx.query.to }));
  const rows = [['Total deliveries', data.total], ...Object.entries(data.metrics).map(([k, v]) => [k.replace(/_/g, ' '), v === null ? '' : v])].map(([metric, value]) => ({ metric, value }));
  return reply.csv('delivery-report.csv', toCsv([['metric', 'Metric'], ['value', 'Value']], rows));
});
A('GET', '/api/admin/audit', (ctx) => {
  const list = paged({ select: 'id, actor_type, actor_name, action, entity, entity_ref, detail, created_at', from: 'audit_logs', search: ctx.query.q ? { q: ctx.query.q, cols: ['actor_name', 'action', 'entity_ref', 'detail'] } : null, defaultSort: 'id DESC', page: ctx.query.page, pageSize: 40 });
  return list;
});

/* ---------- Fleets ---------- */
A('GET', '/api/admin/fleets', () => ({
  fleets: all('SELECT * FROM fleets ORDER BY id').map((f) => ({
    code: f.code, name: f.name, status: f.status, join_code: f.join_code, contact_email: f.contact_email, is_demo: Boolean(f.is_demo), created_at: f.created_at,
    members: get('SELECT COUNT(*) AS n FROM delivery_partners WHERE fleet_id = ?', f.id).n,
    managers: all("SELECT u.name, u.email FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'fleet_manager' AND r.fleet_id = ?", f.id),
  })),
}));
function createFleetManager(fleetId, data) {
  const problem = passwordProblems(data.password);
  if (problem) throw bad('Please correct the highlighted fields.', { password: problem });
  if (get('SELECT 1 FROM users WHERE email = ?', data.manager_email)) throw bad('Please correct the highlighted fields.', { manager_email: 'An account with this email already exists.' });
  const userId = insert('users', { email: data.manager_email, password_hash: hashPassword(data.password), name: data.manager_name, email_verified_at: nowIso(), created_at: nowIso() });
  insert('user_roles', { user_id: userId, role: 'fleet_manager', fleet_id: fleetId, created_at: nowIso() });
  return userId;
}
const MANAGER_RULES = { manager_name: { required: true, min: 2, max: 80, label: 'Manager name' }, manager_email: { required: true, format: 'email', lower: true, max: 160, label: 'Manager email' }, password: { required: true, max: 128, label: 'Temporary password' } };
A('POST', '/api/admin/fleets', (ctx) => {
  const data = validate(ctx.body, { name: { required: true, min: 2, max: 80, label: 'Fleet name' }, contact_phone: { format: 'mobile' }, ...MANAGER_RULES });
  const created = tx(() => {
    const code = nextCode('FLT', 300);
    const id = insert('fleets', { code, name: data.name, contact_email: data.manager_email, contact_phone: data.contact_phone, join_code: `FLEET-${randomToken(4).replace(/[^A-Za-z0-9]/g, 'X').toUpperCase()}`, created_at: nowIso() });
    createFleetManager(id, data);
    C.audit(ctx.actor, 'Created fleet', 'fleet', code, data.name);
    return code;
  });
  return reply.created({ ok: true, code: created });
});

/* ---------- Test orders (testing environments only) ---------- */
const sellerByCode = (code) => { const s = get("SELECT * FROM sellers WHERE code = ? AND status = 'approved'", code); if (!s) throw notFound('Seller'); return s; };
A('GET', '/api/admin/test-orders/options', () => {
  if (!C.TEST_TOOLS()) throw new HttpError(403, 'Test orders are disabled in this environment.');
  return { sellers: all("SELECT code, store_name FROM sellers WHERE status = 'approved' ORDER BY id LIMIT 50"), categories: S.CATEGORIES, sample_addresses: T.TEST_CUSTOMERS.map((c) => ({ address: c[2], pincode: c[3] })) };
});
A('POST', '/api/admin/test-orders/quote', (ctx) => { if (!C.TEST_TOOLS()) throw new HttpError(403, 'Test orders are disabled in this environment.'); return T.quote(sellerByCode(ctx.body.seller_code).id, ctx.body); });
A('POST', '/api/admin/test-orders', (ctx) => {
  if (!C.TEST_TOOLS()) throw new HttpError(403, 'Test orders are disabled in this environment.');
  return reply.created(T.createTestOrder(sellerByCode(ctx.body.seller_code).id, ctx.body, ctx.user.name));
});

module.exports = { staffLogin, createFleetManager, MANAGER_RULES, reportData };
