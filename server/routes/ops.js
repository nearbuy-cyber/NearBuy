'use strict';
// Marketplace operations API — the staff-side actions a seller cannot perform for themselves:
// approving seller accounts and listings, replying to support tickets and confirming payouts.
// There is no staff console in this build. The API is disabled unless OPS_API_KEY is set, and every call
// must send that key in the X-Ops-Key header. It is never exposed to the Seller Hub browser app.
const crypto = require('node:crypto');
const { route } = require('../router');
const { get, all, run, tx, insert, notify } = require('../db');
const { HttpError, bad, notFound, conflict, validate, nowIso } = require('../lib');

function requireOps(ctx) {
  const key = process.env.OPS_API_KEY || '';
  if (key.length < 16) throw new HttpError(503, 'The operations API is disabled. Set OPS_API_KEY (16+ characters) on the server to enable it.');
  const given = String(ctx.req.headers['x-ops-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Invalid operations key.');
  ctx.staff = String(ctx.req.headers['x-ops-staff'] || 'Marketplace staff').slice(0, 60);
}
const ops = (method, path, handler) => route(method, path, { auth: 'ops' }, (ctx) => { requireOps(ctx); return handler(ctx); });
const audit = (sellerId, ctx, action, entity, ref, detail) => insert('activity_logs', { seller_id: sellerId, user_id: null, actor: `${ctx.staff} (marketplace)`, action, entity, entity_ref: ref, detail, created_at: nowIso() });

ops('GET', '/api/ops/sellers', (ctx) => ({ sellers: all(`SELECT s.code, s.store_name, s.business_name, s.status, s.status_note, s.onboarding_submitted_at, s.created_at, u.email AS owner_email
  FROM sellers s JOIN users u ON u.id = s.owner_user_id ${ctx.query.status ? 'WHERE s.status = ?' : ''} ORDER BY s.id DESC LIMIT 200`, ...(ctx.query.status ? [ctx.query.status] : [])) }));

ops('POST', '/api/ops/sellers/:code/review', (ctx) => {
  const seller = get('SELECT * FROM sellers WHERE code = ?', ctx.params.code);
  if (!seller) throw notFound('Seller not found.');
  const body = validate(ctx.body, { decision: { required: true, enum: ['approve', 'reject', 'action_required'] }, note: { max: 500 } });
  if (body.decision !== 'approve' && !body.note) throw bad('Give the seller a reason.', { note: 'Explain what the seller needs to do.' });
  const status = { approve: 'approved', reject: 'rejected', action_required: 'action_required' }[body.decision];
  run('UPDATE sellers SET status = ?, status_note = ? WHERE id = ?', status, body.note || 'Approved by the marketplace team.', seller.id);
  notify(seller.id, 'account', { approve: 'Seller account approved', reject: 'Seller account rejected', action_required: 'Action required on your seller account' }[body.decision], body.note || 'You can now sell on NearBuy.', '/seller/account-status');
  audit(seller.id, ctx, `Account review: ${status}`, 'seller', seller.code, body.note || '');
  return { ok: true, code: seller.code, status };
});

ops('GET', '/api/ops/listings', () => ({ listings: all(`SELECT p.code, p.title, p.category, p.brand, p.price, p.status, p.updated_at, s.code AS seller_code, s.store_name
  FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.status = 'pending_approval' ORDER BY p.updated_at LIMIT 200`) }));

ops('POST', '/api/ops/listings/:code/review', (ctx) => {
  const product = get('SELECT * FROM products WHERE code = ?', ctx.params.code);
  if (!product) throw notFound('Listing not found.');
  if (product.status !== 'pending_approval') throw conflict(`This listing is ${product.status.replace(/_/g, ' ')}, not pending approval.`);
  const body = validate(ctx.body, { decision: { required: true, enum: ['approve', 'reject'] }, note: { max: 500 } });
  if (body.decision === 'reject' && !body.note) throw bad('Give the seller a reason.', { note: 'Explain why the listing was rejected.' });
  const status = body.decision === 'approve' ? 'active' : 'rejected';
  run('UPDATE products SET status = ?, qc_notes = ?, updated_at = ? WHERE id = ?', status, JSON.stringify(body.decision === 'reject' ? [body.note] : []), nowIso(), product.id);
  notify(product.seller_id, 'listing', body.decision === 'approve' ? `Listing is live: ${product.title}` : `Listing rejected: ${product.title}`, body.note || 'Approved by the catalogue team.', `/seller/products/${product.code}`);
  audit(product.seller_id, ctx, `Listing ${status === 'active' ? 'approved' : 'rejected'}`, 'product', product.code, body.note || '');
  return { ok: true, code: product.code, status };
});

ops('GET', '/api/ops/tickets', (ctx) => ({ tickets: all(`SELECT t.code, t.subject, t.category, t.assigned_team, t.priority, t.status, t.updated_at, s.code AS seller_code, s.store_name
  FROM support_tickets t JOIN sellers s ON s.id = t.seller_id ${ctx.query.status ? 'WHERE t.status = ?' : "WHERE t.status NOT IN ('resolved','closed')"} ORDER BY t.updated_at DESC LIMIT 200`, ...(ctx.query.status ? [ctx.query.status] : [])) }));

ops('POST', '/api/ops/tickets/:code/reply', (ctx) => {
  const ticket = get('SELECT * FROM support_tickets WHERE code = ?', ctx.params.code);
  if (!ticket) throw notFound('Ticket not found.');
  if (ticket.status === 'closed') throw conflict('This ticket is closed. The seller must reopen it first.');
  const body = validate(ctx.body, { message: { required: true, min: 2, max: 4000 }, status: { enum: ['in_progress', 'waiting_for_seller', 'resolved'], default: 'in_progress' } });
  tx(() => {
    insert('ticket_messages', { seller_id: ticket.seller_id, ticket_id: ticket.id, author_type: 'support', author_name: `${ctx.staff} · ${ticket.assigned_team}`, body: body.message, created_at: nowIso() });
    run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', body.status, nowIso(), ticket.id);
  });
  notify(ticket.seller_id, 'support', `New reply on ${ticket.code}`, body.message.slice(0, 140), `/seller/support/tickets/${ticket.code}`);
  return { ok: true, code: ticket.code, status: body.status };
});

ops('POST', '/api/ops/tickets/:code/status', (ctx) => {
  const ticket = get('SELECT * FROM support_tickets WHERE code = ?', ctx.params.code);
  if (!ticket) throw notFound('Ticket not found.');
  const body = validate(ctx.body, { status: { required: true, enum: ['open', 'in_progress', 'waiting_for_seller', 'resolved', 'closed'] } });
  if (body.status === ticket.status) throw conflict('The ticket already has that status.');
  tx(() => {
    run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', body.status, nowIso(), ticket.id);
    insert('ticket_messages', { seller_id: ticket.seller_id, ticket_id: ticket.id, author_type: 'system', author_name: 'System', body: `Status changed to ${body.status.replace(/_/g, ' ')} by ${ctx.staff}.`, created_at: nowIso() });
  });
  notify(ticket.seller_id, 'support', `Ticket ${ticket.code} is now ${body.status.replace(/_/g, ' ')}`, ticket.subject, `/seller/support/tickets/${ticket.code}`);
  return { ok: true, code: ticket.code, status: body.status };
});

// Record that finance has actually transferred a settlement. The reference is the bank's UTR for the transfer.
ops('POST', '/api/ops/settlements/:code/paid', (ctx) => {
  const settlement = get('SELECT * FROM settlements WHERE code = ?', ctx.params.code);
  if (!settlement) throw notFound('Settlement not found.');
  if (settlement.is_demo) throw conflict('Demo settlements cannot be marked as paid: no money is owed for demo data.');
  if (settlement.status !== 'awaiting_payout') throw conflict(`This settlement is ${settlement.status.replace(/_/g, ' ')}.`);
  const body = validate(ctx.body, { payout_reference: { required: true, min: 6, max: 40, label: 'Bank reference (UTR)' } });
  run("UPDATE settlements SET status = 'paid', payout_reference = ? WHERE id = ?", body.payout_reference, settlement.id);
  notify(settlement.seller_id, 'payment', `Settlement ${settlement.code} paid`, `Bank reference ${body.payout_reference}.`, `/seller/payments/settlements/${settlement.code}`);
  audit(settlement.seller_id, ctx, 'Settlement marked as paid', 'settlement', settlement.code, `Reference ${body.payout_reference}`);
  return { ok: true, code: settlement.code, status: 'paid' };
});

module.exports = { requireOps };
