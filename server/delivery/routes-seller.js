'use strict';
// Seller Hub delivery section and the customer's tracking link. Seller routes use the existing Seller Hub session and
// permissions; a customer is identified by the private tracking token of their own order.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode } = require('../db');
const { HttpError, bad, conflict, notFound, nowIso, r2, validate } = require('../lib');
const { rateLimit } = require('../auth');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');
const V = require('./views');
const T = require('./testorders');
const PR = require('./routes-partner');

const inList = (list) => list.map(() => '?').join(',');
const sellerDelivery = (ctx) => { const d = get('SELECT * FROM deliveries WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId); if (!d) throw notFound('Delivery'); return d; };
const sellerActor = (ctx) => ({ type: 'seller', name: ctx.user.name, userId: ctx.user.id });

route('GET', '/api/seller/deliveries', { perm: 'orders.read' }, (ctx) => {
  const rows = all(`SELECT d.*, o.status AS order_status FROM deliveries d JOIN orders o ON o.id = d.order_id WHERE d.seller_id = ?
    AND (d.status NOT IN ('delivered','returned_to_seller','cancelled') OR d.updated_at > ?) ORDER BY d.id DESC LIMIT 200`, ctx.sellerId, new Date(Date.now() - 7 * 86400000).toISOString());
  const group = (d) => {
    if (d.kind === 'return') return d.status === 'returned_to_seller' ? 'completed' : d.status === 'cancelled' ? 'issues' : 'returns';
    if (d.status === 'cancelled' || d.status === 'delivery_attempt_failed' || d.status === 'return_in_progress' || d.status === 'returned_to_seller') return 'issues';
    if (d.status === 'delivered') return 'completed';
    if (S.AFTER_PICKUP.includes(d.status)) return 'handed_over';
    if (d.order_status === 'new') return 'new';
    if (!d.ready_at) return 'preparing';
    return 'ready';
  };
  const board = { new: [], preparing: [], ready: [], handed_over: [], completed: [], returns: [], issues: [] };
  for (const d of rows) board[group(d)].push(V.forSeller(d));
  const pickup = get('SELECT * FROM seller_pickup_locations WHERE seller_id = ? ORDER BY is_default DESC, id LIMIT 1', ctx.sellerId);
  const hit = pickup ? C.zoneForPincode(pickup.pincode) : null;
  return {
    board, can_write: ctx.can('orders.write'), test_tools: C.TEST_TOOLS() && ctx.can('orders.write'), categories: S.CATEGORIES, complaint_categories: S.COMPLAINT_CATEGORIES,
    coverage: !pickup ? { ok: false, message: 'Add a pickup location to use the delivery network.' }
      : !hit ? { ok: false, message: `Your pickup PIN code ${pickup.pincode} is outside the delivery zones. Orders are self-shipped.` }
        : { ok: hit.zone.status === 'active', zone: hit.zone.name, pickup: pickup.name, message: hit.zone.status === 'active' ? `Local orders within ${hit.zone.max_delivery_km} km are delivered by the delivery network.` : `Delivery in ${hit.zone.name} is suspended: ${hit.zone.status_note || ''}` },
  };
});
route('GET', '/api/seller/deliveries/:code', { perm: 'orders.read' }, (ctx) => ({ delivery: V.forSeller(sellerDelivery(ctx)) }));
/** One button for the seller: runs the order steps that are still outstanding up to the wanted stage. */
function advanceOrder(ctx, d, target) {
  const { applyOrderAction } = require('../routes/orders');
  const fresh = () => get('SELECT * FROM orders WHERE id = ? AND seller_id = ?', d.order_id, ctx.sellerId);
  const plan = target === 'preparing' ? { new: 'accept', pending_confirmation: 'process' } : { new: 'accept', pending_confirmation: 'process', processing: 'pack', packed: 'ready' };
  for (let i = 0; i < 6; i += 1) {
    const order = fresh();
    if (order.status === 'packed' && target === 'ready' && !get('SELECT 1 FROM shipments WHERE order_id = ?', order.id)) { applyOrderAction(ctx, order, 'shipment', {}); continue; }
    const action = plan[order.status];
    if (!action) break;
    applyOrderAction(ctx, order, action, {});
  }
  return fresh();
}
route('POST', '/api/seller/deliveries/:code/prepare', { perm: 'orders.write' }, (ctx) => {
  const data = validate(ctx.body, { prep_minutes: { required: true, type: 'int', min: 1, max: 240, label: 'Preparation time' } });
  tx(() => {
    const d = sellerDelivery(ctx);
    if (d.kind !== 'forward' || d.ready_at || !S.UNASSIGNED.includes(d.status)) throw conflict('Preparation time can be set before the order is marked ready.');
    advanceOrder(ctx, d, 'preparing');
    run('UPDATE deliveries SET prep_minutes = ?, prep_confirmed = 1, expected_ready_at = ?, updated_at = ? WHERE id = ?', data.prep_minutes, new Date(Date.now() + data.prep_minutes * 60000).toISOString(), nowIso(), d.id);
    C.refreshEta(d.id);
    insert('delivery_status_history', { delivery_id: d.id, status: d.status, actor_type: 'seller', actor_name: ctx.user.name, actor_user_id: ctx.user.id, note: `Seller confirmed ${data.prep_minutes} minutes of preparation.`, created_at: nowIso() });
    C.notifyCustomer(d, 'preparing', 'Seller is preparing your order', `About ${data.prep_minutes} minutes.`);
    C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  });
  return { ok: true, delivery: V.forSeller(sellerDelivery(ctx)) };
});
route('POST', '/api/seller/deliveries/:code/ready', { perm: 'orders.write' }, (ctx) => {
  tx(() => {
    const d = sellerDelivery(ctx);
    if (d.kind !== 'forward') throw conflict('This is a return pickup.');
    if (d.ready_at) throw conflict('This order is already marked ready for pickup.');
    if (S.FINAL.includes(d.status)) throw conflict(`This delivery is ${C.label(d.status).toLowerCase()}.`);
    const order = advanceOrder(ctx, d, 'ready');
    if (order.status !== 'ready_to_ship') throw conflict('The order could not be marked ready. Check its stock and status in Orders.');
  });
  return { ok: true, delivery: V.forSeller(sellerDelivery(ctx)) };
});
// Authorised seller confirmation: an alternative to the partner typing the pickup PIN.
route('POST', '/api/seller/deliveries/:code/confirm-handover', { perm: 'orders.write' }, (ctx) => {
  const data = validate(ctx.body, { package_count: { required: true, type: 'int', min: 1, max: 50, label: 'Package count' } });
  tx(() => {
    const d = sellerDelivery(ctx);
    if (d.kind !== 'forward' || d.status !== 'pickup_verification_pending' || !d.partner_id) throw conflict('Handover can be confirmed once the delivery partner has arrived and the order is ready.');
    if (data.package_count !== d.package_count) throw bad(`This order has ${d.package_count} package${d.package_count === 1 ? '' : 's'}.`, { package_count: 'Count does not match.' });
    if (E.hasPickupConfirmation(d)) throw conflict('This handover is already verified.');
    insert('pickup_confirmations', { delivery_id: d.id, partner_id: d.partner_id, method: 'seller_confirmation', package_count: data.package_count, confirmed_by: `${ctx.user.name} (seller)`, created_at: nowIso() });
    insert('delivery_status_history', { delivery_id: d.id, status: d.status, actor_type: 'seller', actor_name: ctx.user.name, actor_user_id: ctx.user.id, note: 'Seller confirmed the handover to the delivery partner.', created_at: nowIso() });
    C.notifyPartner(d.partner_id, 'instructions', `Seller confirmed the handover of ${d.code}`, 'Confirm pickup in the app to start the delivery.', d.id);
    C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  });
  return { ok: true, delivery: V.forSeller(sellerDelivery(ctx)) };
});
route('POST', '/api/seller/deliveries/:code/instructions', { perm: 'orders.write' }, (ctx) => {
  const data = validate(ctx.body, { pickup_instructions: { max: 200 } });
  const d = sellerDelivery(ctx);
  if (!([...S.UNASSIGNED, ...S.BEFORE_PICKUP].includes(d.status))) throw conflict('Pickup instructions can be changed before pickup.');
  run('UPDATE deliveries SET pickup_instructions = ?, updated_at = ? WHERE id = ?', data.pickup_instructions, nowIso(), d.id);
  if (d.partner_id) C.notifyPartner(d.partner_id, 'instructions', `Pickup instructions changed for ${d.code}`, data.pickup_instructions, d.id);
  C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  return { ok: true };
});
route('POST', '/api/seller/deliveries/:code/report', { perm: 'orders.write' }, (ctx) => {
  const data = validate(ctx.body, { category: { required: true, enum: Object.keys(S.COMPLAINT_CATEGORIES) }, description: { required: true, min: 10, max: 1500 } });
  const d = sellerDelivery(ctx);
  const t = PR.createTicket({ raisedBy: 'seller', sellerId: ctx.sellerId, deliveryId: d.id, category: data.category, subject: `${S.COMPLAINT_CATEGORIES[data.category]} — ${d.code}`, description: data.description });
  return reply.created({ ok: true, code: t.code });
});
route('GET', '/api/seller/delivery-tickets', { perm: 'orders.read' }, (ctx) => ({ tickets: PR.ticketList("t.seller_id = ? AND t.raised_by = 'seller'", ctx.sellerId).map((t) => ({ ...t, category_label: S.COMPLAINT_CATEGORIES[t.category] })) }));
route('POST', '/api/seller/deliveries/test-orders/quote', { perm: 'orders.write' }, (ctx) => { if (!C.TEST_TOOLS()) throw new HttpError(403, 'Test orders are disabled in this environment.'); return T.quote(ctx.sellerId, ctx.body); });
route('POST', '/api/seller/deliveries/test-orders', { perm: 'orders.write' }, (ctx) => {
  if (!C.TEST_TOOLS()) throw new HttpError(403, 'Test orders are disabled in this environment.');
  return reply.created(T.createTestOrder(ctx.sellerId, ctx.body, ctx.user.name));
});
/** Reverse logistics: collect an approved return from the customer and bring it back to the seller. */
route('POST', '/api/seller/returns/:code/pickup', { perm: 'returns.write' }, (ctx) => {
  const created = tx(() => {
    const ret = get('SELECT * FROM returns WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId);
    if (!ret) throw notFound('Return');
    if (ret.status !== 'approved') throw conflict('A return pickup can be booked once the return is approved.');
    if (get("SELECT 1 FROM deliveries WHERE return_id = ? AND status != 'cancelled'", ret.id)) throw conflict('A pickup has already been booked for this return.');
    const order = get('SELECT * FROM orders WHERE id = ?', ret.order_id);
    const svc = E.serviceability(ctx.sellerId, order.ship_address, order.ship_pincode);
    if (!svc.ok) throw conflict(`The delivery network cannot collect this return. ${svc.reason}`);
    const category = (get("SELECT category FROM deliveries WHERE order_id = ? AND kind = 'forward'", order.id) || {}).category || 'ecommerce';
    const earning = C.quoteEarning(svc.zone, category, svc.distance);
    const at = nowIso();
    const id = insert('deliveries', {
      code: nextCode('DLV', 30000), kind: 'return', order_id: order.id, return_id: ret.id, seller_id: ctx.sellerId, zone_id: svc.zone.id, category, package_type: 'Return parcel', package_count: 1,
      status: 'awaiting_assignment', pickup_name: C.firstName(order.customer_name), pickup_address: `${order.ship_address}, ${order.ship_city} ${order.ship_pincode}`, pickup_lat: svc.to.lat, pickup_lng: svc.to.lng,
      pickup_contact: order.customer_phone, drop_name: svc.pickup.name, drop_phone: svc.pickup.mobile, drop_address: `${svc.pickup.address}, ${svc.pickup.city} ${svc.pickup.pincode}`, drop_area: svc.from.area,
      drop_lat: svc.from.lat, drop_lng: svc.from.lng, geo_source: 'pincode_centroid', distance_km: svc.distance, pickup_code: C.newCode(4), drop_code: C.newCode(4), track_token: require('../lib').randomToken(18),
      payment_type: 'prepaid', partner_earning: earning.total, earning_breakdown: earning, ready_at: at, is_demo: order.is_demo, created_at: at, updated_at: at,
    });
    insert('delivery_status_history', { delivery_id: id, status: 'awaiting_assignment', actor_type: 'seller', actor_name: ctx.user.name, actor_user_id: ctx.user.id, note: `Return pickup booked for ${ret.code}.`, created_at: at });
    insert('return_events', { seller_id: ctx.sellerId, return_id: ret.id, action: 'pickup', title: 'Return pickup booked', note: 'A delivery partner will collect the product from the customer.', actor: ctx.user.name, created_at: at });
    const d = E.startSearch(E.one(id), sellerActor(ctx), 'Return pickup booked by the seller.');
    return { code: d.code, track_url: C.TEST_TOOLS() ? `/track/?t=${d.track_token}` : undefined };
  });
  return reply.created({ ok: true, ...created });
});

/* ---------- Customer tracking (private link) ---------- */
function tracked(ctx) {
  rateLimit(`track:${ctx.ip}`, 300, 60000);
  const token = String(ctx.params.token || '');
  const d = token.length >= 16 ? get('SELECT * FROM deliveries WHERE track_token = ?', token) : null;
  if (!d) throw new HttpError(404, 'This tracking link is not valid.');
  return d;
}
route('GET', '/api/track/:token', { auth: 'public' }, (ctx) => ({ delivery: V.forCustomer(tracked(ctx)), complaint_categories: S.COMPLAINT_CATEGORIES }));
route('POST', '/api/track/:token/preferences', { auth: 'public' }, (ctx) => {
  const d = tracked(ctx);
  const data = validate(ctx.body, { instructions: { max: 200 }, contactless: { type: 'bool' }, allow_alternative: { type: 'bool' } });
  if (d.kind !== 'forward' || [...S.FINAL, 'arrived_at_destination', 'delivery_verification_pending'].includes(d.status)) throw conflict('Delivery preferences can no longer be changed for this order.');
  if (data.contactless && d.payment_type === 'cod') throw conflict('Contactless delivery is not available for cash on delivery.');
  run('UPDATE deliveries SET drop_instructions = ?, contactless = ?, allow_alternative = ?, updated_at = ? WHERE id = ?', data.instructions, data.contactless ? 1 : 0, data.allow_alternative ? 1 : 0, nowIso(), d.id);
  insert('delivery_status_history', { delivery_id: d.id, status: d.status, actor_type: 'customer', actor_name: 'Customer', note: `Delivery preferences updated${data.contactless ? ' · contactless (photo proof consented)' : ''}${data.allow_alternative ? ' · handover to another person authorised' : ''}.`, created_at: nowIso() });
  if (d.partner_id) C.notifyPartner(d.partner_id, 'instructions', `Customer updated delivery instructions for ${d.code}`, data.instructions, d.id);
  C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  return { ok: true, delivery: V.forCustomer(E.one(d.id)) };
});
route('POST', '/api/track/:token/confirm', { auth: 'public' }, (ctx) => { const d = E.customerConfirm(tracked(ctx)); return { ok: true, delivery: V.forCustomer(E.one(d.id)) }; });
route('POST', '/api/track/:token/rating', { auth: 'public' }, (ctx) => {
  const data = validate(ctx.body, { rating: { required: true, type: 'int', min: 1, max: 5 }, comment: { max: 300 } });
  tx(() => {
    const d = tracked(ctx);
    if (d.status !== 'delivered') throw conflict('You can rate the delivery once it is completed.');
    if (d.rating) throw conflict('You have already rated this delivery.');
    run('UPDATE deliveries SET rating = ?, rating_comment = ?, rated_at = ? WHERE id = ?', data.rating, data.comment, nowIso(), d.id);
    if (d.partner_id) run('UPDATE delivery_partners SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', data.rating, d.partner_id);
  });
  return { ok: true, delivery: V.forCustomer(tracked(ctx)) };
});
route('POST', '/api/track/:token/issues', { auth: 'public' }, (ctx) => {
  rateLimit(`track-issue:${ctx.ip}`, 10, 3600000);
  const data = validate(ctx.body, { category: { required: true, enum: Object.keys(S.COMPLAINT_CATEGORIES) }, description: { required: true, min: 10, max: 1500 } });
  const d = tracked(ctx);
  const t = PR.createTicket({ raisedBy: 'customer', deliveryId: d.id, partnerId: null, category: data.category, subject: `${S.COMPLAINT_CATEGORIES[data.category]} — ${d.code}`, description: data.description });
  return reply.created({ ok: true, code: t.code, message: `Report ${t.code} received. Our support team will reply here.` });
});
