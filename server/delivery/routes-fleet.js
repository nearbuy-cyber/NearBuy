'use strict';
// Fleet / logistics company portal API. Every query is scoped to the signed-in manager's fleet: other fleets, sellers
// and customer details are never reachable from here.
const { route, reply } = require('../router');
const { get, all, run, tx, insert } = require('../db');
const { bad, conflict, notFound, nowIso, r2, validate, toCsv, istDate, istDayStart, istDayEnd, addDays, maskMobile, isYmd } = require('../lib');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');
const V = require('./views');
const PR = require('./routes-partner');
const AD = require('./routes-admin');
const { fleetRoute: F, endPortalSession } = require('./auth');

const FLEET_TICKETS = { roster: 'Fleet member or roster', settlement: 'Settlement or invoice', delivery: 'Delivery problem', account: 'Fleet account', other: 'Other' };
const inList = (list) => list.map(() => '?').join(',');
const member = (ctx, code) => {
  const p = get('SELECT p.*, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.code = ? AND p.fleet_id = ?', String(code).toUpperCase(), ctx.fleet.id);
  if (!p) throw notFound('Fleet member');
  return p;
};

route('POST', '/api/fleet/login', { auth: 'public' }, AD.staffLogin('fleet', 'fleet_manager'));
route('POST', '/api/fleet/logout', { auth: 'public' }, (ctx) => { endPortalSession(ctx, 'fleet'); return { ok: true }; });
F('GET', '/api/fleet/me', (ctx) => ({
  user: { name: ctx.user.name, email: ctx.user.email }, fleet: { code: ctx.fleet.code, name: ctx.fleet.name, join_code: ctx.fleet.join_code, is_demo: Boolean(ctx.fleet.is_demo) },
  ticket_categories: FLEET_TICKETS, unread: get("SELECT COUNT(*) AS n FROM delivery_notifications WHERE audience = 'fleet' AND fleet_id = ? AND read_at IS NULL", ctx.fleet.id).n,
}));
F('GET', '/api/fleet/overview', (ctx) => {
  const id = ctx.fleet.id;
  const today = [istDayStart(istDate()), istDayEnd(istDate())];
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const members = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM delivery_partners WHERE fleet_id = ? GROUP BY status', id).map((r) => [r.status, r.n]));
  const closed = get("SELECT SUM(status = 'delivered') AS ok, COUNT(*) AS n FROM deliveries WHERE fleet_id = ? AND status IN ('delivered','returned_to_seller') AND completed_at > ?", id, week);
  return {
    members: { total: Object.values(members).reduce((a, b) => a + b, 0), approved: members.approved || 0, in_review: (members.submitted || 0) + (members.under_review || 0) + (members.info_required || 0), suspended: members.suspended || 0,
      online: get("SELECT COUNT(*) AS n FROM delivery_partners WHERE fleet_id = ? AND status = 'approved' AND online = 1", id).n, on_hold: get('SELECT COUNT(*) AS n FROM delivery_partners WHERE fleet_id = ? AND fleet_hold = 1', id).n },
    active_assignments: get(`SELECT COUNT(*) AS n FROM deliveries WHERE fleet_id = ? AND status IN (${inList(S.ACTIVE)})`, id, ...S.ACTIVE).n,
    completed_today: get("SELECT COUNT(*) AS n FROM deliveries WHERE fleet_id = ? AND status = 'delivered' AND completed_at BETWEEN ? AND ?", id, ...today).n,
    week: { completed: closed.ok || 0, success_rate: closed.n ? Math.round((closed.ok / closed.n) * 100) : null,
      earnings: r2(get('SELECT COALESCE(SUM(l.amount), 0) AS n FROM partner_earning_ledger l JOIN delivery_partners p ON p.id = l.partner_id WHERE p.fleet_id = ? AND l.created_at > ?', id, week).n) },
    live: all(`SELECT * FROM deliveries WHERE fleet_id = ? AND status IN (${inList(S.ACTIVE)}) ORDER BY id DESC LIMIT 50`, id, ...S.ACTIVE).map(V.forFleet),
    notifications: all("SELECT id, type, title, body, read_at, created_at FROM delivery_notifications WHERE audience = 'fleet' AND fleet_id = ? ORDER BY id DESC LIMIT 8", id),
  };
});
F('GET', '/api/fleet/roster', (ctx) => {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  return {
    join_code: ctx.fleet.join_code,
    members: all('SELECT p.*, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.fleet_id = ? ORDER BY p.code', ctx.fleet.id).map((p) => {
      const vehicle = E.vehicleOf(p.id);
      const active = E.activeTask(p.id);
      const blockers = [];
      if (p.status !== 'approved') blockers.push(S.APPLICATION_STATUS[p.status]);
      if (p.fleet_hold) blockers.push('On fleet hold');
      if (!vehicle) blockers.push('No vehicle');
      return {
        code: p.code, name: p.name, mobile_masked: maskMobile(p.mobile), status: p.status, status_label: S.APPLICATION_STATUS[p.status], eligible: !blockers.length, blockers,
        online: Boolean(p.online), on_hold: Boolean(p.fleet_hold), vehicle: vehicle ? S.VEHICLES[vehicle.type].label : null, active_delivery: active ? active.code : null,
        completed_30d: get("SELECT COUNT(*) AS n FROM deliveries WHERE partner_id = ? AND status = 'delivered' AND completed_at > ?", p.id, since).n,
        rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null, documents_valid_until: p.documents_valid_until,
        location: p.online && p.last_location_at ? { lat: p.last_lat, lng: p.last_lng, at: p.last_location_at } : null,
      };
    }),
  };
});
F('POST', '/api/fleet/roster/:code/hold', (ctx) => {
  const data = validate(ctx.body, { hold: { type: 'bool' }, reason: { max: 200 } });
  const p = member(ctx, ctx.params.code);
  if (data.hold && !data.reason) throw bad('Give a reason for the hold.', { reason: 'Reason is required.' });
  tx(() => {
    if (data.hold) {
      const task = E.activeTask(p.id);
      if (task) throw conflict(`${p.code} is on delivery ${task.code}. Put the member on hold after it is closed.`);
      if (p.online) E.setOnline(p, false, 'Fleet hold');
    }
    run('UPDATE delivery_partners SET fleet_hold = ? WHERE id = ?', data.hold ? 1 : 0, p.id);
    C.notifyPartner(p.id, 'fleet', data.hold ? 'Your fleet manager put your account on hold' : 'Your fleet hold has been lifted', data.reason);
    C.audit(ctx.actor, data.hold ? 'Fleet hold placed' : 'Fleet hold lifted', 'partner', p.code, data.reason);
  });
  return { ok: true };
});
F('POST', '/api/fleet/roster/:code/remove', (ctx) => {
  const data = validate(ctx.body, { reason: { required: true, min: 5, max: 200 } });
  const p = member(ctx, ctx.params.code);
  if (E.activeTask(p.id)) throw conflict('Remove the member when they have no active delivery.');
  run('UPDATE delivery_partners SET fleet_id = NULL, fleet_hold = 0 WHERE id = ?', p.id);
  C.notifyPartner(p.id, 'fleet', `You are no longer part of ${ctx.fleet.name}`, 'You can continue as an individual partner.');
  C.audit(ctx.actor, 'Removed fleet member', 'partner', p.code, data.reason);
  return { ok: true };
});
F('GET', '/api/fleet/deliveries', (ctx) => {
  const statuses = ctx.query.tab === 'completed' ? ['delivered', 'returned_to_seller'] : ctx.query.tab === 'all' ? Object.keys(S.DELIVERY_STATUS) : S.ACTIVE;
  return { deliveries: all(`SELECT * FROM deliveries WHERE fleet_id = ? AND status IN (${inList(statuses)}) ORDER BY id DESC LIMIT 200`, ctx.fleet.id, ...statuses).map(V.forFleet) };
});
F('GET', '/api/fleet/performance', (ctx) => {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  return {
    period: 'Last 30 days',
    members: all('SELECT p.id, p.code, u.name, p.rating_sum, p.rating_count FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.fleet_id = ? ORDER BY p.code', ctx.fleet.id).map((p) => {
      const d = get("SELECT COUNT(*) AS n, AVG((julianday(completed_at) - julianday(assigned_at)) * 1440) AS m FROM deliveries WHERE partner_id = ? AND fleet_id = ? AND status = 'delivered' AND completed_at > ?", p.id, ctx.fleet.id, since);
      const offers = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM delivery_offers WHERE partner_id = ? AND created_at > ? GROUP BY status', p.id, since).map((r) => [r.status, r.n]));
      const answered = (offers.accepted || 0) + (offers.declined || 0) + (offers.expired || 0);
      return { code: p.code, name: p.name, completed: d.n, average_minutes: d.m ? Math.round(d.m) : null, acceptance_rate: answered ? Math.round(((offers.accepted || 0) / answered) * 100) : null,
        failed_attempts: get("SELECT COUNT(*) AS n FROM delivery_status_history h JOIN deliveries x ON x.id = h.delivery_id WHERE x.partner_id = ? AND h.status = 'delivery_attempt_failed' AND h.created_at > ?", p.id, since).n,
        rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null };
    }),
    note: 'Use these figures to support members and spot problems, not to push for speed.',
  };
});
F('GET', '/api/fleet/settlements', (ctx) => ({
  members: all('SELECT p.id, p.code, u.name, p.payout_status FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.fleet_id = ? ORDER BY p.code', ctx.fleet.id).map((p) => ({ code: p.code, name: p.name, payout_account: p.payout_status, ...PR.wallet(p.id), cash_in_hand: E.cashInHand(p.id) })),
  payouts: all('SELECT o.code, o.amount, o.status, o.reference, o.failure_reason, o.created_at, o.settled_at, p.code AS partner_code FROM partner_payouts o JOIN delivery_partners p ON p.id = o.partner_id WHERE p.fleet_id = ? ORDER BY o.id DESC LIMIT 100', ctx.fleet.id),
  note: 'Earnings are paid to each member\'s verified payout account. Fleet-level invoicing is a report of completed work.',
}));
F('GET', '/api/fleet/invoice.csv', (ctx) => {
  const month = /^\d{4}-\d{2}$/.test(ctx.query.month || '') ? ctx.query.month : istDate().slice(0, 7);
  const from = `${month}-01`;
  if (!isYmd(from)) throw bad('Choose a valid month.');
  const next = addDays(from, 32).slice(0, 7);
  const rows = all(`SELECT d.code, d.completed_at, d.category, d.distance_km, d.partner_earning, d.pickup_name, d.drop_area, p.code AS partner_code, u.name AS partner_name
    FROM deliveries d JOIN delivery_partners p ON p.id = d.partner_id JOIN users u ON u.id = p.user_id WHERE d.fleet_id = ? AND d.status = 'delivered' AND d.completed_at >= ? AND d.completed_at < ? ORDER BY d.completed_at`,
  ctx.fleet.id, istDayStart(from), istDayStart(`${next}-01`));
  C.audit(ctx.actor, 'Exported fleet invoice report', 'fleet', ctx.fleet.code, `${month} · ${rows.length} rows`);
  return reply.csv(`fleet-${ctx.fleet.code}-${month}.csv`, toCsv([['code', 'Delivery'], ['completed_at', 'Completed'], ['partner_code', 'Partner ID'], ['partner_name', 'Partner'], [(r) => S.CATEGORIES[r.category], 'Category'], ['pickup_name', 'Pickup'], ['drop_area', 'Drop area'], ['distance_km', 'Distance (km)'], ['partner_earning', 'Earning (INR)']], rows));
});
const fleetTicket = (ctx) => { const t = get("SELECT * FROM delivery_tickets WHERE code = ? AND fleet_id = ? AND raised_by = 'fleet'", ctx.params.code, ctx.fleet.id); if (!t) throw notFound('Ticket'); return t; };
F('GET', '/api/fleet/tickets', (ctx) => ({ tickets: PR.ticketList("t.fleet_id = ? AND t.raised_by = 'fleet'", ctx.fleet.id).map((t) => ({ ...t, category_label: FLEET_TICKETS[t.category] })) }));
F('POST', '/api/fleet/tickets', (ctx) => {
  const data = validate(ctx.body, { category: { required: true, enum: Object.keys(FLEET_TICKETS) }, subject: { required: true, min: 4, max: 120 }, description: { required: true, min: 10, max: 1500 } });
  const t = PR.createTicket({ raisedBy: 'fleet', fleetId: ctx.fleet.id, category: data.category, subject: data.subject, description: data.description });
  return reply.created({ ok: true, code: t.code });
});
F('GET', '/api/fleet/tickets/:code', (ctx) => ({ ticket: PR.ticketDetail(fleetTicket(ctx), FLEET_TICKETS) }));
F('POST', '/api/fleet/tickets/:code/messages', (ctx) => {
  const t = fleetTicket(ctx);
  const data = validate(ctx.body, { body: { required: true, min: 2, max: 1500, label: 'Message' } });
  insert('delivery_ticket_messages', { ticket_id: t.id, author_type: 'fleet', author_name: ctx.user.name, body: data.body, created_at: nowIso() });
  run("UPDATE delivery_tickets SET status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END, updated_at = ? WHERE id = ?", nowIso(), t.id);
  C.publish('admin', { kind: 'ticket' });
  return { ok: true, ticket: PR.ticketDetail(fleetTicket(ctx), FLEET_TICKETS) };
});
F('GET', '/api/fleet/users', (ctx) => ({ users: all("SELECT u.id, u.name, u.email, u.last_login_at FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'fleet_manager' AND r.fleet_id = ? ORDER BY u.id", ctx.fleet.id).map((u) => ({ ...u, you: u.id === ctx.user.id })) }));
F('POST', '/api/fleet/users', (ctx) => {
  const data = validate(ctx.body, AD.MANAGER_RULES);
  tx(() => { AD.createFleetManager(ctx.fleet.id, data); C.audit(ctx.actor, 'Added fleet user', 'fleet', ctx.fleet.code, data.manager_email); });
  return reply.created({ ok: true });
});
F('DELETE', '/api/fleet/users/:id', (ctx) => {
  const id = Number(ctx.params.id);
  if (id === ctx.user.id) throw bad('You cannot remove your own access.');
  if (!run("DELETE FROM user_roles WHERE user_id = ? AND role = 'fleet_manager' AND fleet_id = ?", id, ctx.fleet.id).changes) throw notFound('Fleet user');
  run("DELETE FROM sessions WHERE user_id = ? AND user_agent LIKE '[fleet]%'", id);
  C.audit(ctx.actor, 'Removed fleet user', 'fleet', ctx.fleet.code, String(id));
  return { ok: true };
});
F('POST', '/api/fleet/notifications/read', (ctx) => { run("UPDATE delivery_notifications SET read_at = ? WHERE audience = 'fleet' AND fleet_id = ? AND read_at IS NULL", nowIso(), ctx.fleet.id); return { ok: true }; });
