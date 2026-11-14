'use strict';
// Delivery engine: creates delivery records for orders, finds and scores eligible partners, runs the offer flow,
// moves a delivery through pickup and drop verification, and posts earnings, cash and settlement records.
const { get, all, run, tx, insert, nextCode, parseJson } = require('../db');
const { HttpError, bad, conflict, nowIso, r2, randomToken } = require('../lib');
const S = require('./schema');
const C = require('./core');

const one = (id) => get('SELECT * FROM deliveries WHERE id = ?', id);
const partnerById = (id) => (id ? get('SELECT p.*, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.id = ?', id) : null);
const vehicleOf = (partnerId) => get('SELECT * FROM partner_vehicles WHERE partner_id = ?', partnerId);
const activeTask = (partnerId) => get(`SELECT * FROM deliveries WHERE partner_id = ? AND status IN (${S.ACTIVE.map(() => '?').join(',')}) ORDER BY id LIMIT 1`, partnerId, ...S.ACTIVE);
const COD_CASH_LIMIT = () => Number(process.env.DELIVERY_COD_CASH_LIMIT || 3000);

/* ---------- Orders bridge ---------- */
function systemCtx(sellerId) {
  return { sellerId, seller: get('SELECT * FROM sellers WHERE id = ?', sellerId), user: { id: null, name: 'Delivery network' }, can: () => true, system: true };
}
function orderAction(d, action, body) {
  const order = get('SELECT * FROM orders WHERE id = ?', d.order_id);
  return require('../routes/orders').applyOrderAction(systemCtx(d.seller_id), order, action, body || {});
}
const PACKAGE_TYPE = { food: 'Sealed food bag', grocery: 'Grocery bags', ecommerce: 'Parcel box' };
const DEFAULT_PREP = { food: 15, grocery: 10, ecommerce: 20 };

/** Can the network deliver from this seller to this address? Returns the reason when it cannot. */
function serviceability(sellerId, address, pincode) {
  const pickup = get('SELECT * FROM seller_pickup_locations WHERE seller_id = ? ORDER BY is_default DESC, id LIMIT 1', sellerId);
  if (!pickup) return { ok: false, reason: 'The seller has no pickup location.' };
  const from = C.geocode(pickup.address, pickup.pincode);
  if (!from) return { ok: false, reason: `The pickup PIN code ${pickup.pincode} is outside every delivery zone.` };
  const to = C.geocode(address, pincode);
  if (!to) return { ok: false, reason: `PIN code ${pincode} is outside every delivery zone.` };
  if (to.zone.id !== from.zone.id) return { ok: false, reason: 'The pickup point and the delivery address are in different delivery zones.' };
  const zone = from.zone;
  if (zone.status !== 'active') return { ok: false, reason: `Delivery in ${zone.name} is temporarily suspended${zone.status_note ? `: ${zone.status_note}` : '.'}` };
  if (!C.zoneOpenNow(zone)) return { ok: false, reason: `${zone.name} delivers between ${zone.open_time} and ${zone.close_time}.` };
  const distance = C.roadKm(from.lat, from.lng, to.lat, to.lng);
  if (distance > zone.max_delivery_km) return { ok: false, reason: `The address is ${distance} km from the pickup point; ${zone.name} delivers up to ${zone.max_delivery_km} km.` };
  const open = get(`SELECT COUNT(*) AS n FROM deliveries WHERE zone_id = ? AND status NOT IN ('delivered','returned_to_seller','cancelled')`, zone.id).n;
  if (open >= zone.capacity_limit) return { ok: false, reason: `${zone.name} has reached its capacity of ${zone.capacity_limit} open deliveries.` };
  return { ok: true, zone, pickup, from, to, distance };
}
function inferCategory(orderId) {
  const cats = all('SELECT DISTINCT category FROM order_items WHERE order_id = ?', orderId).map((r) => r.category);
  return cats.length && cats.every((c) => c === 'Grocery') ? 'grocery' : 'ecommerce';
}
/** Create the delivery record of an order. Returns null when the order is outside the network (it then stays self-shipped). */
function ensureDelivery(order, { strict = false } = {}) {
  const existing = get("SELECT * FROM deliveries WHERE order_id = ? AND kind = 'forward'", order.id);
  if (existing) return existing;
  const svc = serviceability(order.seller_id, order.ship_address, order.ship_pincode);
  if (!svc.ok) { if (strict) throw conflict(svc.reason); return null; }
  const prefs = get('SELECT * FROM order_delivery_prefs WHERE order_id = ?', order.id) || {};
  const category = prefs.category || inferCategory(order.id);
  if (!get('SELECT 1 FROM delivery_fee_rules WHERE zone_id = ? AND category = ?', svc.zone.id, category)) { if (strict) throw conflict(`${S.CATEGORIES[category]} delivery is not configured in ${svc.zone.name}.`); return null; }
  const items = all('SELECT oi.qty, p.package FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?', order.id);
  const weight = items.reduce((sum, i) => sum + (parseJson(i.package, {}).weight_g || 500) * i.qty, 0);
  const units = items.reduce((sum, i) => sum + i.qty, 0);
  const scheduled = prefs.method === 'scheduled';
  const fee = C.quoteFee(svc.zone, category, svc.distance, { scheduled, special: Boolean(prefs.special_handling) });
  const earning = C.quoteEarning(svc.zone, category, svc.distance);
  const cod = order.payment_method === 'Cash on delivery';
  const prep = DEFAULT_PREP[category];
  const at = nowIso();
  const id = insert('deliveries', {
    code: nextCode('DLV', 30000), kind: 'forward', order_id: order.id, seller_id: order.seller_id, zone_id: svc.zone.id, category,
    package_type: PACKAGE_TYPE[category], package_count: category === 'grocery' ? Math.max(1, Math.ceil(units / 5)) : 1, weight_g: Math.round(weight),
    special_handling: prefs.special_handling ? 1 : 0, method: scheduled ? 'scheduled' : 'immediate', scheduled_for: scheduled ? prefs.scheduled_for : null,
    status: 'awaiting_assignment', pickup_name: svc.pickup.name, pickup_address: `${svc.pickup.address}, ${svc.pickup.city} ${svc.pickup.pincode}`,
    pickup_lat: svc.from.lat, pickup_lng: svc.from.lng, pickup_contact: svc.pickup.mobile, pickup_instructions: null,
    drop_name: order.customer_name, drop_phone: order.customer_phone, drop_address: `${order.ship_address}, ${order.ship_city} ${order.ship_pincode}`,
    drop_area: svc.to.area, drop_lat: svc.to.lat, drop_lng: svc.to.lng, drop_instructions: prefs.instructions || null, geo_source: svc.to.source,
    distance_km: svc.distance, prep_minutes: prep, expected_ready_at: new Date(Date.now() + prep * 60000).toISOString(),
    pickup_code: C.newCode(4), drop_code: C.newCode(4), track_token: randomToken(18), payment_type: cod ? 'cod' : 'prepaid', cod_amount: cod ? order.total : 0,
    customer_fee: order.shipping_charge, fee_breakdown: fee, partner_earning: earning.total, earning_breakdown: earning,
    is_demo: order.is_demo, created_at: at, updated_at: at,
  });
  insert('delivery_status_history', { delivery_id: id, status: 'awaiting_assignment', actor_type: 'system', actor_name: 'Delivery network', note: 'Delivery created. Waiting for the seller to prepare the order.', created_at: at });
  insert('delivery_routes', { delivery_id: id, leg: 'pickup_to_drop', from_lat: svc.from.lat, from_lng: svc.from.lng, to_lat: svc.to.lat, to_lng: svc.to.lng, distance_km: svc.distance, est_minutes: r2(C.travelMin(svc.distance, 'two_wheeler')), basis: 'straight_line_x1.35', created_at: at });
  C.refreshEta(id);
  const d = one(id);
  C.notifyCustomer(d, 'order_confirmed', order.status === 'new' ? 'Order placed' : 'Order confirmed', order.status === 'new' ? 'Waiting for the seller to accept your order.' : 'The seller has accepted your order and is preparing it.');
  C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  return d;
}
/** Called after every seller order action so that the delivery record follows the order. */
function onOrderChanged(sellerId, orderId, user) {
  const order = get('SELECT * FROM orders WHERE id = ? AND seller_id = ?', orderId, sellerId);
  if (!order) return;
  let d = get("SELECT * FROM deliveries WHERE order_id = ? AND kind = 'forward'", order.id);
  if (!d && ['pending_confirmation', 'processing', 'packed', 'ready_to_ship'].includes(order.status)) d = ensureDelivery(order);
  if (!d) return;
  const actor = { type: 'seller', name: user && user.name, userId: user && user.id };
  const shipment = get('SELECT id, carrier FROM shipments WHERE order_id = ?', order.id);
  if (shipment && shipment.carrier !== 'Routely delivery network') run("UPDATE shipments SET carrier = 'Routely delivery network', reference = ? WHERE id = ?", d.code, shipment.id);
  if (order.status === 'cancelled' && !S.FINAL.includes(d.status)) cancelDelivery(d, actor, order.cancel_reason || 'Order cancelled by the seller');
  else if (order.status === 'ready_to_ship' && !d.ready_at) markReady(d, actor);
  else if (order.status === 'processing' && d.status === 'awaiting_assignment') C.notifyCustomer(d, 'preparing', 'Seller is preparing your order', null);
}
const hasNetworkDelivery = (orderId) => Boolean(get("SELECT 1 FROM deliveries WHERE order_id = ? AND kind = 'forward' AND status != 'cancelled'", orderId));

/* ---------- Dispatch ---------- */
function cashInHand(partnerId) {
  const held = get("SELECT COALESCE(SUM(amount), 0) AS n FROM cod_transactions WHERE partner_id = ? AND type = 'collection' AND method = 'cash'", partnerId).n;
  const deposited = get("SELECT COALESCE(SUM(amount), 0) AS n FROM cod_transactions WHERE partner_id = ? AND type = 'deposit' AND status = 'confirmed'", partnerId).n;
  return r2(held - deposited);
}
/** Every reason a partner cannot take a delivery. An empty list means the partner is eligible. */
function ineligibility(partner, d, { manual = false } = {}) {
  const reasons = [];
  if (partner.status !== 'approved') reasons.push(`Account is ${S.APPLICATION_STATUS[partner.status].toLowerCase()}`);
  if (partner.fleet_hold) reasons.push('On hold by fleet manager');
  if (!partner.online) reasons.push('Offline');
  if (!get('SELECT 1 FROM partner_zones WHERE partner_id = ? AND zone_id = ?', partner.id, d.zone_id)) reasons.push('Does not operate in this zone');
  const vehicle = vehicleOf(partner.id);
  const spec = vehicle && S.VEHICLES[vehicle.type];
  if (!spec) reasons.push('No vehicle on record');
  else {
    if ((d.weight_g || 0) / 1000 > spec.max_kg) reasons.push(`Package is too heavy for a ${spec.label.toLowerCase()}`);
    if (d.distance_km > spec.max_km) reasons.push(`Route is too long for a ${spec.label.toLowerCase()}`);
  }
  if (!parseJson(partner.categories, []).includes(d.category)) reasons.push(`Has not opted in to ${S.CATEGORIES[d.category].toLowerCase()} deliveries`);
  if (activeTask(partner.id)) reasons.push('Has another active delivery');
  if (d.payment_type === 'cod' && cashInHand(partner.id) + d.cod_amount > COD_CASH_LIMIT()) reasons.push('Cash in hand would exceed the deposit limit');
  const fresh = partner.last_location_at && Date.now() - Date.parse(partner.last_location_at) < C.CONFIG.locationFreshMs();
  if (!fresh) { if (!manual) reasons.push('No recent location'); }
  else {
    const zone = get('SELECT * FROM service_zones WHERE id = ?', d.zone_id);
    if (C.haversineKm(partner.last_lat, partner.last_lng, zone.center_lat, zone.center_lng) > zone.radius_km * 1.25) reasons.push('Currently outside the zone');
  }
  return reasons;
}
const clamp = (n) => Math.max(0, Math.min(1, n));
function scoreCandidate(partner, d, zone) {
  const vehicle = vehicleOf(partner.id);
  const spec = S.VEHICLES[vehicle.type];
  const km = C.roadKm(partner.last_lat, partner.last_lng, d.pickup_lat, d.pickup_lng);
  const eta = C.travelMin(km, vehicle.type);
  const dayStart = new Date(Date.now() - 86400000).toISOString();
  const done = get("SELECT COUNT(*) AS n, MAX(completed_at) AS last FROM deliveries WHERE partner_id = ? AND status = 'delivered' AND completed_at > ?", partner.id, dayStart);
  const idleSince = [done.last, partner.online_since].filter(Boolean).sort().pop();
  const idleMin = idleSince ? (Date.now() - Date.parse(idleSince)) / 60000 : 0;
  const parts = {
    time_to_pickup: clamp(1 - eta / 30),
    distance: clamp(1 - km / (zone.radius_km * 1.5)),
    fair_share: clamp(0.5 / (1 + done.n) + 0.5 * clamp(idleMin / 60)),
    vehicle_fit: clamp(1 - ((d.weight_g || 0) / 1000) / spec.max_kg) * 0.5 + (d.distance_km <= spec.max_km / 2 ? 0.5 : 0.25),
  };
  const score = 0.4 * parts.time_to_pickup + 0.15 * parts.distance + 0.3 * parts.fair_share + 0.15 * parts.vehicle_fit;
  return { partner, km, eta, score: Number(score.toFixed(4)), parts: { ...parts, deliveries_last_24h: done.n, idle_minutes: Math.round(idleMin) } };
}
function candidates(d) {
  const zone = get('SELECT * FROM service_zones WHERE id = ?', d.zone_id);
  const retryAfter = new Date(Date.now() - 120000).toISOString();
  const rows = all(`SELECT p.*, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id
    WHERE p.status = 'approved' AND p.online = 1 AND p.id IN (SELECT partner_id FROM partner_zones WHERE zone_id = ?)`, d.zone_id);
  return rows.filter((p) => {
    if (ineligibility(p, d).length) return false;
    if (get("SELECT 1 FROM delivery_offers WHERE partner_id = ? AND status = 'offered'", p.id)) return false; // one live offer at a time
    // A partner who declined is not asked again; one whose offer timed out may be asked again after two minutes.
    return !get("SELECT 1 FROM delivery_offers WHERE delivery_id = ? AND partner_id = ? AND (status = 'declined' OR (status = 'expired' AND responded_at > ?))", d.id, p.id, retryAfter);
  }).map((p) => scoreCandidate(p, d, zone)).sort((a, b) => b.score - a.score);
}
function dueForSearch(d) {
  if (d.status !== 'awaiting_assignment' && d.status !== 'reassignment_required') return false;
  if (d.method === 'scheduled' && d.scheduled_for && Date.parse(d.scheduled_for) - Date.now() > 20 * 60000) return false;
  if (d.kind === 'return' || d.ready_at || d.status === 'reassignment_required') return true;
  // Food is assigned shortly before it is ready so that it does not wait on the counter.
  return d.category === 'food' && d.prep_confirmed && Date.parse(d.expected_ready_at) - Date.now() <= 8 * 60000;
}
function startSearch(d, actor = C.SYSTEM, note) {
  d = C.setStatus(d, 'searching_partner', actor, note || 'Looking for an eligible delivery partner.', { search_started_at: d.search_started_at || nowIso() });
  return offerNext(d);
}
function offerNext(d) {
  if (d.status !== 'searching_partner') return d;
  const list = candidates(d);
  if (!list.length) return d;
  const best = list[0];
  const breakdown = parseJson(d.earning_breakdown, {});
  const offerId = insert('delivery_offers', {
    delivery_id: d.id, partner_id: best.partner.id, score: best.score, score_detail: { ...best.parts, candidates: list.length }, pickup_distance_km: best.km,
    pickup_eta_min: r2(best.eta), earning: d.partner_earning, earning_breakdown: breakdown,
    expires_at: new Date(Date.now() + C.CONFIG.offerSeconds() * 1000).toISOString(), created_at: nowIso(),
  });
  C.notifyPartner(best.partner.id, 'new_offer', 'New delivery offer', `${S.CATEGORIES[d.category]} · ₹${d.partner_earning} · ${d.distance_km} km`, d.id);
  return C.setStatus(d, 'offer_sent', C.SYSTEM, `Offer #${offerId} sent to ${best.partner.code} (score ${best.score}, ${list.length} eligible).`);
}
function offerFailed(offer, status, note, reason) {
  run('UPDATE delivery_offers SET status = ?, responded_at = ?, decline_reason = ? WHERE id = ?', status, nowIso(), reason || null, offer.id);
  let d = one(offer.delivery_id);
  if (d.status !== 'offer_sent') return d;
  const failed = d.failed_assignments + 1;
  d = C.setStatus(d, 'searching_partner', status === 'declined' ? { type: 'partner', name: note.by } : C.SYSTEM, note.text, { failed_assignments: failed });
  if (failed === 3) C.notifyAdmin('repeated_failed_assignment', `Repeated failed assignment: ${d.code}`, 'Three offers were declined or timed out. Consider assigning a partner manually.', d.id);
  return offerNext(d);
}
function assignTo(d, partner, mode, actor, reason, earning) {
  const patch = { partner_id: partner.id, fleet_id: partner.fleet_id || null, assigned_at: nowIso(), third_party_name: null, third_party_ref: null };
  if (earning) patch.partner_earning = earning;
  // The WHERE clause is the lock: the update succeeds for one partner only.
  const changed = run(`UPDATE deliveries SET partner_id = ? WHERE id = ? AND partner_id IS NULL AND status IN ('offer_sent','searching_partner','awaiting_assignment','reassignment_required')`, partner.id, d.id).changes;
  if (changed !== 1) throw conflict('This delivery has already been assigned to another partner.');
  insert('delivery_assignments', { delivery_id: d.id, partner_id: partner.id, mode, assigned_by: actor.name || 'System', reason: reason || null, assigned_at: nowIso() });
  d = C.setStatus(d, 'partner_assigned', actor, mode === 'auto' ? `${partner.code} accepted the offer.` : `Assigned to ${partner.code} (${mode}).${reason ? ` ${reason}` : ''}`, patch);
  C.notifyPartner(partner.id, 'assignment_confirmed', 'Assignment confirmed', `${d.code}: collect from ${d.pickup_name}.`, d.id);
  C.notifySeller(d, `Delivery partner assigned to ${d.code}`, `${C.firstName(partner.name)} will collect the order.`);
  C.notifyCustomer(d, 'partner_assigned', 'Delivery partner assigned', `${C.firstName(partner.name)} will deliver your order.`);
  return d;
}
function acceptOffer(partner, offerId) {
  return tx(() => {
    const offer = get('SELECT * FROM delivery_offers WHERE id = ? AND partner_id = ?', offerId, partner.id);
    if (!offer) throw new HttpError(404, 'Offer not found.');
    const taken = run("UPDATE delivery_offers SET status = 'accepted', responded_at = ? WHERE id = ? AND status = 'offered' AND expires_at > ?", nowIso(), offer.id, nowIso()).changes;
    if (taken !== 1) throw conflict(offer.status === 'accepted' ? 'You have already accepted this offer.' : 'This offer is no longer available.');
    const d = one(offer.delivery_id);
    const fresh = partnerById(partner.id);
    const reasons = ineligibility(fresh, d);
    if (reasons.length) throw conflict(`You cannot take this delivery right now: ${reasons.join(', ')}.`);
    return assignTo(d, fresh, 'auto', { type: 'partner', name: fresh.name, userId: fresh.user_id }, null, offer.earning);
  });
}
function declineOffer(partner, offerId, reason) {
  return tx(() => {
    const offer = get("SELECT * FROM delivery_offers WHERE id = ? AND partner_id = ? AND status = 'offered'", offerId, partner.id);
    if (!offer) throw conflict('This offer is no longer open.');
    return offerFailed(offer, 'declined', { by: partner.code, text: `${partner.code} declined the offer.` }, reason);
  });
}
function cancelLiveOffers(d) {
  for (const offer of all("SELECT * FROM delivery_offers WHERE delivery_id = ? AND status = 'offered'", d.id)) {
    run("UPDATE delivery_offers SET status = 'cancelled', responded_at = ? WHERE id = ?", nowIso(), offer.id);
    C.publish(`partner:${offer.partner_id}`, { kind: 'offer' });
  }
}
/** Authorised manual assignment by an administrator. Always written to the audit log. */
function manualAssign(d, partner, actor, reason, mode = 'manual') {
  return tx(() => {
    if (!S.UNASSIGNED.includes(d.status)) throw conflict(`A partner can be assigned only while the delivery is unassigned (it is ${C.label(d.status).toLowerCase()}).`);
    const reasons = ineligibility(partner, d, { manual: true });
    if (reasons.length) throw conflict(`${partner.code} cannot take this delivery: ${reasons.join(', ')}.`);
    cancelLiveOffers(d);
    const next = assignTo(one(d.id), partner, mode, actor, reason);
    C.audit(actor, mode === 'reassign' ? 'Reassigned delivery' : 'Manually assigned delivery', 'delivery', d.code, `${partner.code}${reason ? ` — ${reason}` : ''}`);
    return next;
  });
}
function endAssignment(d, reason) {
  run('UPDATE delivery_assignments SET active = 0, ended_at = ?, end_reason = ? WHERE delivery_id = ? AND active = 1', nowIso(), reason, d.id);
}
/** Take a delivery away from its partner before pickup and look for another one. */
function unassign(d, actor, reason, { research = true } = {}) {
  return tx(() => {
    if (!S.BEFORE_PICKUP.includes(d.status)) throw conflict('A delivery can be reassigned only before the package is picked up.');
    const previous = d.partner_id;
    endAssignment(d, reason);
    d = C.setStatus(d, 'reassignment_required', actor, reason, { partner_id: null, fleet_id: null, third_party_name: null, third_party_ref: null, assigned_at: null, arrived_pickup_at: null });
    if (previous) { C.notifyPartner(previous, 'assignment_removed', `Delivery ${d.code} was removed from your tasks`, reason, d.id); C.publish(`partner:${previous}`, { kind: 'delivery', code: d.code }); }
    C.notifySeller(d, `Finding a new delivery partner for ${d.code}`, reason);
    return research && dueForSearch(d) ? startSearch(d, C.SYSTEM, 'Searching again after reassignment.') : d;
  });
}
function cancelDelivery(d, actor, reason) {
  return tx(() => {
    if (S.FINAL.includes(d.status)) throw conflict(`This delivery is already ${C.label(d.status).toLowerCase()}.`);
    if (S.AFTER_PICKUP.includes(d.status)) throw conflict('The package has been picked up. Record a failed attempt or a return instead of cancelling.');
    cancelLiveOffers(d);
    endAssignment(d, 'Delivery cancelled');
    const previous = d.partner_id;
    d = C.setStatus(d, 'cancelled', actor, reason, { cancel_reason: reason });
    if (previous) C.notifyPartner(previous, 'assignment_removed', `Delivery ${d.code} was cancelled`, reason, d.id);
    C.notifyCustomer(d, 'issue', 'Delivery cancelled', reason);
    return d;
  });
}
function markReady(d, actor) {
  run('UPDATE deliveries SET ready_at = ?, expected_ready_at = ? WHERE id = ?', nowIso(), nowIso(), d.id);
  d = one(d.id);
  C.notifyCustomer(d, 'ready', 'Order packed and ready for pickup', null);
  if (d.status === 'arrived_at_pickup') return C.setStatus(d, 'pickup_verification_pending', actor, 'Order is ready. Waiting for handover verification.');
  if (dueForSearch(d)) return startSearch(d, actor, 'Seller marked the order ready for pickup.');
  C.refreshEta(d.id);
  C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
  return d;
}

/* ---------- Partner workflow ---------- */
function own(partner, code) {
  const d = get('SELECT * FROM deliveries WHERE code = ? AND partner_id = ?', code, partner.id);
  if (!d) throw new HttpError(404, 'Delivery not found.');
  return d;
}
const partnerActor = (partner) => ({ type: 'partner', name: partner.name || partner.code, userId: partner.user_id });
function expect(d, statuses, action) {
  if (!statuses.includes(d.status)) throw conflict(`"${action}" is not possible while the delivery is ${C.label(d.status).toLowerCase()}.`);
}
/** Geofence check: the partner's latest location must be recent and close to the target point. */
function requireNear(partner, lat, lng, what) {
  const p = get('SELECT last_lat, last_lng, last_location_at FROM delivery_partners WHERE id = ?', partner.id);
  if (!p.last_location_at || Date.now() - Date.parse(p.last_location_at) > C.CONFIG.locationFreshMs()) throw new HttpError(409, `Your location has not been updated recently. Turn on location and try again when you are at the ${what}.`, { code: 'location_stale' });
  const metres = Math.round(C.haversineKm(p.last_lat, p.last_lng, lat, lng) * 1000);
  if (metres > C.CONFIG.geofenceM()) throw new HttpError(409, `You are about ${metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`} from the ${what}. You can mark arrival within ${C.CONFIG.geofenceM()} m.`, { code: 'outside_geofence', distance_m: metres });
  return metres;
}
const returning = (d) => d.kind === 'return' || d.status === 'return_in_progress';
function startTrip(partner, code) {
  return tx(() => { const d = own(partner, code); expect(d, ['partner_assigned'], 'Start trip'); return C.setStatus(d, 'en_route_to_pickup', partnerActor(partner), 'Partner is on the way to the pickup point.'); });
}
function arrivedAtPickup(partner, code) {
  return tx(() => {
    let d = own(partner, code);
    expect(d, ['partner_assigned', 'en_route_to_pickup'], 'Arrived at pickup');
    const metres = requireNear(partner, d.pickup_lat, d.pickup_lng, 'pickup point');
    d = C.setStatus(d, 'arrived_at_pickup', partnerActor(partner), `Arrival confirmed ${metres} m from the pickup point.`, { arrived_pickup_at: nowIso() });
    if (d.kind === 'forward') C.notifySeller(d, `Delivery partner has arrived for ${d.code}`, 'Share the pickup PIN and hand over the order.');
    C.notifyCustomer(d, 'at_pickup', d.kind === 'forward' ? 'Delivery partner reached the pickup point' : 'Delivery partner has arrived to collect your return', null);
    if (d.ready_at || d.kind === 'return') d = C.setStatus(d, 'pickup_verification_pending', C.SYSTEM, 'Waiting for handover verification.');
    return d;
  });
}
const attempts = new Map();
function limitAttempts(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) { attempts.set(key, { n: 1, reset: now + 600000 }); return; }
  entry.n += 1;
  if (entry.n > 6) throw new HttpError(429, 'Too many incorrect codes. Wait a few minutes or contact support.');
}
const codeMatches = (given, expected) => String(given || '').trim() === expected || String(given || '').trim().endsWith(`:${expected}`);
function verifyPickup(partner, code, body) {
  return tx(() => {
    const d = own(partner, code);
    if (d.status === 'arrived_at_pickup') throw conflict('The seller has not marked this order ready yet. Ask the seller, or report "Seller not ready" in Support.');
    expect(d, ['pickup_verification_pending'], 'Verify pickup');
    const method = body.method === 'qr' ? 'qr' : 'pin';
    const count = Number(body.package_count);
    if (!Number.isInteger(count) || count < 1) throw bad('Count the packages you were given.', { package_count: 'Enter the number of packages.' });
    limitAttempts(`pickup:${d.id}`);
    if (!codeMatches(body.code, d.pickup_code)) throw bad(method === 'qr' ? 'That QR code does not belong to this order.' : 'That pickup PIN is not correct.', { code: 'Incorrect code.' });
    if (count !== d.package_count) throw bad(`The package count does not match this order (${d.package_count} expected). Check with the ${d.kind === 'return' ? 'customer' : 'seller'} before leaving.`, { package_count: 'Count does not match.' });
    attempts.delete(`pickup:${d.id}`);
    insert('pickup_confirmations', { delivery_id: d.id, partner_id: partner.id, method, package_count: count, confirmed_by: partnerActor(partner).name, created_at: nowIso() });
    C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
    return d;
  });
}
function hasPickupConfirmation(d) {
  return Boolean(get('SELECT 1 FROM pickup_confirmations WHERE delivery_id = ? AND partner_id = ? AND created_at >= ?', d.id, d.partner_id, d.arrived_pickup_at || d.created_at));
}
function pickedUp(partner, code) {
  return tx(() => {
    let d = own(partner, code);
    expect(d, ['pickup_verification_pending'], 'Confirm pickup');
    if (!hasPickupConfirmation(d)) throw conflict('The handover has not been verified. Enter the pickup PIN or ask the seller to confirm the handover.');
    const actor = partnerActor(partner);
    d = C.setStatus(d, 'picked_up', actor, `${d.package_count} package${d.package_count === 1 ? '' : 's'} collected after verification.`, { picked_up_at: nowIso() });
    if (d.kind === 'forward') {
      orderAction(d, 'dispatch');
      C.notifySeller(d, `Pickup confirmed for ${d.code}`, 'The order is on its way to the customer.');
      C.notifyCustomer(d, 'picked_up', 'Order picked up', 'Your order is on the way.');
      return C.setStatus(d, 'en_route_to_customer', actor, 'On the way to the customer.');
    }
    C.notifyCustomer(d, 'picked_up', 'Return collected', 'Your return is on its way back to the seller.');
    return C.setStatus(d, 'return_in_progress', actor, 'Return collected from the customer.');
  });
}
function arrivedAtDestination(partner, code) {
  return tx(() => {
    let d = own(partner, code);
    expect(d, ['en_route_to_customer', 'return_in_progress'], 'Arrived at destination');
    const backToSeller = d.kind === 'forward' && d.status === 'return_in_progress';
    const target = backToSeller ? [d.pickup_lat, d.pickup_lng] : [d.drop_lat, d.drop_lng];
    const metres = requireNear(partner, target[0], target[1], 'destination');
    if (d.status === 'return_in_progress') {
      run('UPDATE deliveries SET arrived_drop_at = ?, updated_at = ? WHERE id = ?', nowIso(), nowIso(), d.id);
      C.notifySeller(d, `Return ${d.code} has arrived`, 'Give the return code to the delivery partner to receive the package.');
      C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
      return one(d.id);
    }
    d = C.setStatus(d, 'arrived_at_destination', partnerActor(partner), `Arrival confirmed ${metres} m from the delivery address.`, { arrived_drop_at: nowIso() });
    C.notifyCustomer(d, 'arriving', 'Your delivery partner has arrived', d.contactless ? 'Contactless delivery: the order will be left at your door.' : 'Share your delivery code to receive the order.');
    return C.setStatus(d, 'delivery_verification_pending', C.SYSTEM, 'Waiting for delivery verification.');
  });
}
/** The code the receiver holds: the customer's delivery code, or the seller's code when a package comes back. */
const receiverCode = (d) => (d.kind === 'forward' && d.status === 'return_in_progress' ? d.pickup_code : d.drop_code);
function proofStage(d) {
  if (d.status === 'delivery_verification_pending') return true;
  return d.status === 'return_in_progress' && Boolean(d.arrived_drop_at);
}
function addProof(d, partnerId, method, fields) {
  return insert('delivery_proofs', { delivery_id: d.id, partner_id: partnerId, method, verified: 1, created_at: nowIso(), ...fields });
}
function submitProof(partner, code, body, file) {
  return tx(() => {
    const d = own(partner, code);
    if (!proofStage(d)) throw conflict('Delivery proof can be submitted after you have arrived at the destination.');
    const method = String(body.method || '');
    if (method === 'otp' || method === 'qr') {
      limitAttempts(`drop:${d.id}`);
      if (!codeMatches(body.code, receiverCode(d))) throw bad(method === 'qr' ? 'That QR code does not belong to this delivery.' : 'That delivery code is not correct.', { code: 'Incorrect code.' });
      attempts.delete(`drop:${d.id}`);
      addProof(d, partner.id, method, { note: 'Code verified' });
    } else if (method === 'photo') {
      if (returning(d) || !d.contactless) throw conflict('Photo proof is allowed only when the customer has asked for contactless delivery.');
      if (!file) throw bad('Attach a photograph of the delivered package.');
      const stored = C.storeFile(file);
      addProof(d, partner.id, 'photo', { storage_key: stored.key, mime: stored.mime, note: 'Contactless delivery requested by the customer' });
    } else if (method === 'alternative') {
      if (returning(d) || !d.allow_alternative) throw conflict('The customer has not authorised handing this order to someone else.');
      const name = String(body.recipient_name || '').trim().slice(0, 80);
      const relation = String(body.relation || '').trim().slice(0, 60);
      if (name.length < 2 || relation.length < 2) throw bad('Record who received the order.', { recipient_name: 'Enter the name and their relation to the customer.' });
      addProof(d, partner.id, 'alternative', { recipient_name: name, note: `Authorised alternative recipient (${relation})` });
    } else throw bad('Choose how the delivery was verified.');
    C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
    return d;
  });
}
const validProof = (d) => get('SELECT * FROM delivery_proofs WHERE delivery_id = ? AND verified = 1 AND created_at >= ? ORDER BY id DESC LIMIT 1', d.id, d.arrived_drop_at || '9999');
function postEarnings(d, partnerId, held) {
  const b = parseJson(d.earning_breakdown, {});
  const status = held ? 'pending' : 'available';
  const add = (type, amount, note) => { if (amount > 0) insert('partner_earning_ledger', { txn_code: C.txnCode(), partner_id: partnerId, delivery_id: d.id, type, amount: r2(amount), note, status, created_at: nowIso() }); };
  add('base', b.base || d.partner_earning, 'Base task earning');
  add('distance', b.distance || 0, `Distance component (${d.distance_km} km)`);
  add('incentive', b.incentive || 0, 'Zone demand incentive');
}
function complete(partner, code, body) {
  return tx(() => {
    let d = own(partner, code);
    if (!proofStage(d)) throw conflict('Complete the delivery after you have arrived and verified the handover.');
    const proof = validProof(d);
    if (!proof) throw conflict('This delivery has not been verified yet. Submit the delivery code or another permitted proof first.');
    const actor = partnerActor(partner);
    if (returning(d)) {
      const forward = d.kind === 'forward';
      d = C.setStatus(d, 'returned_to_seller', actor, 'Package received back by the seller after verification.', { completed_at: nowIso() });
      endAssignment(d, 'Returned to seller');
      if (forward) orderAction(d, 'rto');
      else if (d.return_id) insert('return_events', { seller_id: d.seller_id, return_id: d.return_id, action: 'pickup', title: 'Return delivered to seller', note: `${d.code} handed over by the delivery partner.`, actor: 'Delivery network', created_at: nowIso() });
      postEarnings(d, partner.id, false);
      insert('settlement_records', { delivery_id: d.id, customer_fee: 0, partner_earning: d.partner_earning, cod_amount: 0, cod_state: 'not_applicable', created_at: nowIso() });
      C.notifySeller(d, `Return ${d.code} received`, null);
      return d;
    }
    const cod = d.payment_type === 'cod';
    let method = null;
    if (cod) {
      method = body.payment_method === 'upi' ? 'upi' : body.payment_method === 'cash' ? 'cash' : null;
      if (!body.cod_collected || !method) throw bad(`Confirm that you collected ₹${d.cod_amount} from the customer.`, { cod_collected: 'Confirm the payment collected.' });
      if (r2(Number(body.amount)) !== r2(d.cod_amount)) throw bad(`The amount to collect is ₹${d.cod_amount}.`, { amount: 'Amount does not match.' });
      insert('cod_transactions', { code: nextCode('COD', 80000), partner_id: partner.id, delivery_id: d.id, type: 'collection', amount: d.cod_amount, method, status: 'pending', note: method === 'cash' ? 'Cash collected from customer' : 'Customer paid digitally at the door (to be confirmed)', created_at: nowIso() });
    }
    d = C.setStatus(d, 'delivered', actor, `Delivered. Verified by ${proof.method === 'otp' ? 'customer code' : proof.method === 'qr' ? 'QR code' : proof.method === 'photo' ? 'photo (contactless)' : proof.method === 'recipient' ? 'customer confirmation' : 'authorised alternative recipient'}.`, { completed_at: nowIso() });
    endAssignment(d, 'Delivered');
    orderAction(d, 'deliver');
    // Delivery completion and money are separate records: earnings of a cash order stay pending until the cash is deposited.
    postEarnings(d, partner.id, cod);
    insert('settlement_records', { delivery_id: d.id, customer_fee: d.customer_fee, partner_earning: d.partner_earning, cod_amount: d.cod_amount, cod_state: cod ? 'collected' : 'not_applicable', created_at: nowIso() });
    C.notifyCustomer(d, 'delivered', 'Delivered', 'Your order has been delivered. Tell us how it went.');
    C.notifySeller(d, `${d.code} delivered`, 'The customer has received the order.');
    C.notifyPartner(partner.id, 'earning', `₹${d.partner_earning} earned for ${d.code}`, cod ? 'Released to your wallet when the cash is deposited.' : 'Added to your available earnings.', d.id);
    return d;
  });
}
function failAttempt(partner, code, reason) {
  return tx(() => {
    let d = own(partner, code);
    expect(d, ['en_route_to_customer', 'arrived_at_destination', 'delivery_verification_pending'], 'Report failed attempt');
    d = C.setStatus(d, 'delivery_attempt_failed', partnerActor(partner), reason, { failure_reason: reason, attempt_count: d.attempt_count + 1 });
    orderAction(d, 'fail', { reason });
    C.notifyAdmin('failed_delivery', `Delivery attempt failed: ${d.code}`, reason, d.id);
    C.notifyCustomer(d, 'issue', 'Delivery attempt was unsuccessful', 'Our team will contact you or try again.');
    return d;
  });
}
/** Administrator decision after a failed attempt: try again, or carry the package back to the seller. */
function resolveFailed(d, decision, actor, note) {
  return tx(() => {
    expect(d, ['delivery_attempt_failed'], 'Resolve failed attempt');
    if (decision === 'reattempt') {
      orderAction(d, 'reattempt');
      d = C.setStatus(d, 'en_route_to_customer', actor, note || 'Re-attempt authorised.', { arrived_drop_at: null });
      C.notifyCustomer(d, 'reattempt', 'We are trying your delivery again', null);
    } else {
      d = C.setStatus(d, 'return_in_progress', actor, note || 'Return to seller authorised.', { arrived_drop_at: null });
      C.notifySeller(d, `${d.code} is being returned to you`, d.failure_reason);
    }
    if (d.partner_id) C.notifyPartner(d.partner_id, 'instructions', decision === 'reattempt' ? `Try ${d.code} again` : `Return ${d.code} to the seller`, note, d.id);
    C.audit(actor, `Failed delivery: ${decision}`, 'delivery', d.code, note);
    return d;
  });
}
/** Customer confirms on the tracking page that the order is in their hands. */
function customerConfirm(d) {
  return tx(() => {
    if (d.status !== 'delivery_verification_pending') throw conflict('You can confirm once the delivery partner has arrived.');
    addProof(d, d.partner_id, 'recipient', { recipient_name: d.drop_name, note: 'Confirmed by the customer on the tracking page' });
    C.publish(C.deliveryTopics(d), { kind: 'delivery', code: d.code, status: d.status });
    return d;
  });
}
function recordLocation(partner, body, delivery) {
  const lat = Number(body.lat); const lng = Number(body.lng);
  if (!C.validCoord(lat, lng)) throw bad('That location is not valid.');
  const source = body.source === 'test' ? 'test' : 'gps';
  if (source === 'test' && !C.TEST_TOOLS()) throw new HttpError(403, 'Test locations are not accepted here.');
  // Location is collected only for operational periods: while online or while a delivery is in progress.
  if (!partner.online && !delivery) throw conflict('Location is not collected while you are offline.');
  const at = nowIso();
  run('UPDATE delivery_partners SET last_lat = ?, last_lng = ?, last_location_at = ? WHERE id = ?', lat, lng, at, partner.id);
  insert('partner_location_updates', { partner_id: partner.id, delivery_id: delivery ? delivery.id : null, lat, lng, accuracy_m: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null, source, recorded_at: at });
  if (delivery) { C.refreshEta(delivery.id); C.publish([`delivery:${delivery.id}`, `seller:${delivery.seller_id}`], { kind: 'location', code: delivery.code }); }
  C.publish(['admin', partner.fleet_id ? `fleet:${partner.fleet_id}` : null], { kind: 'location' });
  return { ok: true, recorded_at: at };
}
function setOnline(partner, online, reason) {
  run('UPDATE delivery_partners SET online = ?, online_since = ?, updated_at = ? WHERE id = ?', online ? 1 : 0, online ? nowIso() : null, nowIso(), partner.id);
  insert('partner_availability', { partner_id: partner.id, online: online ? 1 : 0, reason: reason || null, created_at: nowIso() });
  if (!online) for (const offer of all("SELECT * FROM delivery_offers WHERE partner_id = ? AND status = 'offered'", partner.id)) offerFailed(offer, 'expired', { text: `${partner.code} went offline before answering.` });
  C.publish(['admin', `partner:${partner.id}`, partner.fleet_id ? `fleet:${partner.fleet_id}` : null], { kind: 'availability' });
}

/* ---------- Money ---------- */
/** Bring a delivery's settlement record up to date. It is reconciled only when both the cash and the earning are settled. */
function reconcile(deliveryId) {
  const rec = get('SELECT * FROM settlement_records WHERE delivery_id = ?', deliveryId);
  if (!rec) return;
  const rows = all("SELECT status FROM partner_earning_ledger WHERE delivery_id = ? AND type IN ('base','distance','incentive','tip')", deliveryId);
  const earning = rows.length && rows.every((r) => r.status === 'paid') ? 'paid' : rows.some((r) => r.status === 'in_payout') ? 'in_payout' : 'unpaid';
  const done = earning === 'paid' && ['not_applicable', 'deposited'].includes(rec.cod_state);
  run('UPDATE settlement_records SET earning_state = ?, state = ?, reconciled_at = ? WHERE id = ?', earning, done ? 'reconciled' : 'open', done ? (rec.reconciled_at || nowIso()) : null, rec.id);
}
/** Match confirmed deposits against cash collections, oldest first, and release the earnings held against them. */
function allocateDeposits(partnerId) {
  let budget = get("SELECT COALESCE(SUM(amount), 0) AS n FROM cod_transactions WHERE partner_id = ? AND type = 'deposit' AND status = 'confirmed'", partnerId).n;
  for (const col of all("SELECT * FROM cod_transactions WHERE partner_id = ? AND type = 'collection' AND method = 'cash' ORDER BY id", partnerId)) {
    if (budget + 0.001 < col.amount) break;
    budget -= col.amount;
    if (col.status !== 'confirmed') settleCollection(col, 'Cash deposit matched');
  }
}
function settleCollection(col, by) {
  run("UPDATE cod_transactions SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE id = ?", nowIso(), by, col.id);
  run("UPDATE partner_earning_ledger SET status = 'available' WHERE delivery_id = ? AND status = 'pending'", col.delivery_id);
  run("UPDATE settlement_records SET cod_state = 'deposited' WHERE delivery_id = ?", col.delivery_id);
  reconcile(col.delivery_id);
}

/* ---------- Background job ---------- */
function tick() {
  const now = nowIso();
  for (const offer of all("SELECT * FROM delivery_offers WHERE status = 'offered' AND expires_at <= ?", now)) {
    const p = get('SELECT code FROM delivery_partners WHERE id = ?', offer.partner_id);
    tx(() => offerFailed(offer, 'expired', { text: `Offer to ${p.code} expired without an answer.` }));
    C.notifyPartner(offer.partner_id, 'offer_expired', 'A delivery offer expired', null, offer.delivery_id);
  }
  for (const d of all("SELECT * FROM deliveries WHERE status IN ('awaiting_assignment','reassignment_required') AND third_party_name IS NULL")) if (dueForSearch(d)) tx(() => startSearch(d));
  for (const d of all("SELECT * FROM deliveries WHERE status = 'searching_partner'")) {
    tx(() => offerNext(d));
    if (!d.unassigned_notified_at && d.search_started_at && Date.now() - Date.parse(d.search_started_at) > 300000) {
      run('UPDATE deliveries SET unassigned_notified_at = ? WHERE id = ?', now, d.id);
      C.notifyAdmin('unassigned_order', `Unassigned for 5 minutes: ${d.code}`, 'No eligible partner has accepted this delivery yet.', d.id);
    }
  }
  for (const d of all(`SELECT * FROM deliveries WHERE delayed_notified_at IS NULL AND eta_at IS NOT NULL AND eta_at < ? AND status IN (${S.ACTIVE.map(() => '?').join(',')})`, new Date(Date.now() - 600000).toISOString(), ...S.ACTIVE)) {
    run('UPDATE deliveries SET delayed_notified_at = ? WHERE id = ?', now, d.id);
    C.notifyAdmin('delayed_delivery', `Delayed delivery: ${d.code}`, `More than 10 minutes past the estimate while ${C.label(d.status).toLowerCase()}.`, d.id);
    C.notifyCustomer(d, 'issue', 'Your delivery is running late', 'We are sorry for the delay. The estimate has been updated.');
  }
}
let lastPrune = 0;
function housekeeping() {
  if (Date.now() - lastPrune < 3600000) return;
  lastPrune = Date.now();
  // Retention: location points, used codes and replay keys are deleted after their operational purpose has ended.
  run('DELETE FROM partner_location_updates WHERE recorded_at < ?', new Date(Date.now() - C.CONFIG.locationRetentionDays() * 86400000).toISOString());
  run('DELETE FROM otp_codes WHERE created_at < ?', new Date(Date.now() - 86400000).toISOString());
  run('DELETE FROM idempotency_keys WHERE created_at < ?', new Date(Date.now() - 86400000).toISOString());
  // Partners whose documents have passed their validity date are moved to Expired and taken offline.
  for (const p of all("SELECT * FROM delivery_partners WHERE status = 'approved' AND documents_valid_until IS NOT NULL AND documents_valid_until < ?", nowIso())) {
    run("UPDATE delivery_partners SET status = 'expired', status_note = 'Verification documents have expired. Upload current documents.', online = 0 WHERE id = ?", p.id);
    insert('partner_applications', { partner_id: p.id, status: 'expired', note: 'Documents passed their validity date.', actor: 'System', created_at: nowIso() });
    C.notifyPartner(p.id, 'verification', 'Your documents have expired', 'Upload current documents to continue delivering.');
  }
}
let timer = null;
function startBackground() {
  if (timer || process.env.DELIVERY_BACKGROUND === '0') return;
  timer = setInterval(() => { try { tick(); housekeeping(); } catch (err) { console.error('[nearbuy:delivery] background job failed', err); } }, 2000);
  timer.unref();
}

module.exports = {
  one, own, partnerById, vehicleOf, activeTask, serviceability, ensureDelivery, onOrderChanged, hasNetworkDelivery, orderAction, cashInHand, ineligibility,
  candidates, dueForSearch, startSearch, offerNext, acceptOffer, declineOffer, cancelLiveOffers, manualAssign, assignTo, endAssignment, unassign, cancelDelivery, markReady,
  startTrip, arrivedAtPickup, verifyPickup, hasPickupConfirmation, pickedUp, arrivedAtDestination, submitProof, validProof, complete, failAttempt,
  resolveFailed, customerConfirm, recordLocation, setOnline, reconcile, allocateDeposits, settleCollection, postEarnings, addProof, receiverCode,
  tick, housekeeping, startBackground, COD_CASH_LIMIT, PACKAGE_TYPE, DEFAULT_PREP,
};
