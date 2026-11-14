'use strict';
// What each audience is allowed to see of a delivery. Each view discloses only what that role needs for the task.
const { get, all, parseJson } = require('../db');
const { maskMobile, r2 } = require('../lib');
const S = require('./schema');
const C = require('./core');

const history = (id) => all('SELECT status, actor_type, actor_name, note, created_at FROM delivery_status_history WHERE delivery_id = ? ORDER BY id', id)
  .map((h) => ({ ...h, label: C.label(h.status) }));
const itemsOf = (orderId) => all('SELECT title, variant_label, qty FROM order_items WHERE order_id = ?', orderId);
const orderCode = (orderId) => (get('SELECT code FROM orders WHERE id = ?', orderId) || {}).code;
function partnerCard(partnerId, { phone = false } = {}) {
  if (!partnerId) return null;
  const p = get('SELECT p.id, p.code, p.rating_sum, p.rating_count, p.last_lat, p.last_lng, p.last_location_at, u.name, u.mobile FROM delivery_partners p JOIN users u ON u.id = p.user_id WHERE p.id = ?', partnerId);
  const v = get('SELECT type, registration_no FROM partner_vehicles WHERE partner_id = ?', partnerId);
  return {
    code: p.code, first_name: C.firstName(p.name), vehicle: v ? S.VEHICLES[v.type].label : null, vehicle_number_ending: v && v.registration_no ? v.registration_no.slice(-4) : null,
    rating: p.rating_count ? r2(p.rating_sum / p.rating_count) : null, phone_masked: phone ? maskMobile(p.mobile) : undefined,
  };
}
function liveLocation(d) {
  if (!d.partner_id || !S.ACTIVE.includes(d.status)) return null; // location is shared only while the delivery is in progress
  const p = get('SELECT last_lat, last_lng, last_location_at FROM delivery_partners WHERE id = ?', d.partner_id);
  return p.last_location_at ? { lat: p.last_lat, lng: p.last_lng, at: p.last_location_at, stale: Date.now() - Date.parse(p.last_location_at) > 120000 } : null;
}
const base = (d) => ({
  code: d.code, kind: d.kind, order_code: orderCode(d.order_id), status: d.status, status_label: C.label(d.status), category: d.category, category_label: S.CATEGORIES[d.category],
  package_type: d.package_type, package_count: d.package_count, weight_kg: d.weight_g ? r2(d.weight_g / 1000) : null, special_handling: Boolean(d.special_handling),
  method: d.method, scheduled_for: d.scheduled_for, distance_km: d.distance_km, eta_at: d.eta_at, payment_type: d.payment_type, cod_amount: d.cod_amount,
  created_at: d.created_at, assigned_at: d.assigned_at, picked_up_at: d.picked_up_at, completed_at: d.completed_at, is_demo: Boolean(d.is_demo),
});
const pickupPoint = (d) => ({ name: d.pickup_name, address: d.pickup_address, lat: d.pickup_lat, lng: d.pickup_lng });

/** Delivery as the assigned partner sees it. The full address is shown for the leg in progress; codes are never shown. */
function forPartner(d) {
  const afterPickup = S.AFTER_PICKUP.includes(d.status) || S.FINAL.includes(d.status);
  const isReturn = d.kind === 'return';
  const showDrop = afterPickup && !S.FINAL.includes(d.status);
  const proof = get('SELECT method, created_at FROM delivery_proofs WHERE delivery_id = ? AND verified = 1 AND created_at >= ? ORDER BY id DESC LIMIT 1', d.id, d.arrived_drop_at || '9999');
  return {
    ...base(d),
    pickup: { ...pickupPoint(d), contact: isReturn ? null : d.pickup_contact, contact_masked: isReturn ? maskMobile(d.pickup_contact) : null, instructions: d.pickup_instructions },
    drop: showDrop
      ? { name: C.firstName(d.drop_name), address: d.drop_address, area: d.drop_area, lat: d.drop_lat, lng: d.drop_lng, instructions: d.drop_instructions, phone_masked: isReturn ? null : maskMobile(d.drop_phone), contact: isReturn ? d.drop_phone : null }
      : { area: d.drop_area, approximate: true },
    contactless: Boolean(d.contactless), allow_alternative: Boolean(d.allow_alternative),
    items: isReturn ? [] : itemsOf(d.order_id), ready: Boolean(d.ready_at) || isReturn, expected_ready_at: d.expected_ready_at,
    pickup_verified: Boolean(d.arrived_pickup_at && get('SELECT 1 FROM pickup_confirmations WHERE delivery_id = ? AND partner_id = ? AND created_at >= ?', d.id, d.partner_id, d.arrived_pickup_at)),
    arrived_at_destination: Boolean(d.arrived_drop_at), proof: proof || null,
    earning: d.partner_earning, earning_breakdown: parseJson(d.earning_breakdown, {}), failure_reason: d.failure_reason,
    feedback: d.rating ? 'received' : S.FINAL.includes(d.status) ? 'awaited' : null, timeline: history(d.id),
  };
}
function offerForPartner(offer, d) {
  return {
    id: offer.id, expires_at: offer.expires_at, seconds_left: Math.max(0, Math.round((Date.parse(offer.expires_at) - Date.now()) / 1000)),
    delivery_code: d.code, category: d.category, category_label: S.CATEGORIES[d.category], package_type: d.package_type, package_count: d.package_count,
    weight_kg: d.weight_g ? r2(d.weight_g / 1000) : null, pickup: pickupPoint(d), drop_area: d.drop_area,
    pickup_distance_km: offer.pickup_distance_km, pickup_eta_min: Math.max(1, Math.round(offer.pickup_eta_min)),
    trip_distance_km: d.distance_km, total_minutes: Math.max(1, Math.round(offer.pickup_eta_min + C.travelMin(d.distance_km, 'two_wheeler') + 5)),
    earning: offer.earning, earning_breakdown: parseJson(offer.earning_breakdown, {}), payment_type: d.payment_type, cod_amount: d.cod_amount,
    ready: Boolean(d.ready_at), expected_ready_at: d.expected_ready_at, method: d.method, scheduled_for: d.scheduled_for,
  };
}
/** Delivery as the seller sees it: their own order, the partner's first name and vehicle, and the code the seller must share. */
function forSeller(d) {
  const order = get('SELECT code, status, total, customer_ref, payment_method FROM orders WHERE id = ?', d.order_id);
  const returningToSeller = d.kind === 'return' || d.status === 'return_in_progress';
  return {
    ...base(d), order_status: order.status, order_total: order.total, customer_ref: order.customer_ref, drop_area: d.drop_area,
    prep_minutes: d.prep_minutes, expected_ready_at: d.expected_ready_at, ready_at: d.ready_at, items: itemsOf(d.order_id),
    partner: d.third_party_name ? { first_name: d.third_party_name, vehicle: 'Third-party logistics', third_party: true } : partnerCard(d.partner_id, { phone: true }),
    partner_location: liveLocation(d), pickup: pickupPoint(d),
    // The seller holds the pickup PIN for a forward delivery, and the return code when a package comes back.
    pickup_pin: d.kind === 'forward' && [...S.UNASSIGNED, ...S.BEFORE_PICKUP].includes(d.status) ? d.pickup_code : null,
    return_code: returningToSeller && !S.FINAL.includes(d.status) ? (d.kind === 'return' ? d.drop_code : d.pickup_code) : null,
    partner_arrived: Boolean(d.arrived_pickup_at) && S.BEFORE_PICKUP.includes(d.status), return_arrived: d.status === 'return_in_progress' && Boolean(d.arrived_drop_at),
    failure_reason: d.failure_reason, cancel_reason: d.cancel_reason, timeline: history(d.id),
  };
}
const CUSTOMER_STEPS = [
  ['confirmed', 'Order confirmed', ['awaiting_assignment', 'searching_partner', 'offer_sent', 'reassignment_required']],
  ['assigned', 'Delivery partner assigned', ['partner_assigned', 'en_route_to_pickup']],
  ['at_pickup', 'Partner at pickup point', ['arrived_at_pickup', 'pickup_verification_pending']],
  ['on_the_way', 'Order picked up — on the way', ['picked_up', 'en_route_to_customer']],
  ['arriving', 'Partner has arrived', ['arrived_at_destination', 'delivery_verification_pending']],
  ['delivered', 'Delivered', ['delivered']],
];
/** Delivery as the customer sees it through their private tracking link. */
function forCustomer(d) {
  const order = get('SELECT code, total, subtotal, shipping_charge, payment_method, placed_at FROM orders WHERE id = ?', d.order_id);
  const seller = get('SELECT store_name FROM sellers WHERE id = ?', d.seller_id);
  const rows = history(d.id);
  const reached = (statuses) => rows.find((h) => statuses.includes(h.status));
  const current = CUSTOMER_STEPS.findIndex((s) => s[2].includes(d.status));
  const isReturn = d.kind === 'return';
  return {
    code: d.code, kind: d.kind, order_code: order.code, store: seller.store_name, status: d.status, status_label: C.label(d.status), category_label: S.CATEGORIES[d.category],
    placed_at: order.placed_at, eta_at: S.FINAL.includes(d.status) ? null : d.eta_at, method: d.method, scheduled_for: d.scheduled_for,
    steps: CUSTOMER_STEPS.map(([key, label, statuses], i) => ({ key, label, done: current > i || d.status === 'delivered', current: current === i && d.status !== 'delivered', at: (reached(statuses) || {}).created_at || null })),
    exception: ['delivery_attempt_failed', 'return_in_progress', 'returned_to_seller', 'cancelled'].includes(d.status) ? { status: d.status, label: C.label(d.status), reason: d.status === 'cancelled' ? d.cancel_reason : d.failure_reason } : null,
    items: itemsOf(d.order_id), totals: { subtotal: order.subtotal, delivery_fee: order.shipping_charge, total: order.total, payment_method: order.payment_method },
    fee_breakdown: parseJson(d.fee_breakdown, null), payment_type: d.payment_type, cod_amount: d.cod_amount,
    address: d.kind === 'forward' ? d.drop_address : d.pickup_address, instructions: d.drop_instructions, contactless: Boolean(d.contactless), allow_alternative: Boolean(d.allow_alternative),
    partner: d.third_party_name ? { first_name: d.third_party_name, vehicle: 'Third-party logistics' } : partnerCard(d.partner_id),
    partner_location: liveLocation(d), pickup: { lat: d.pickup_lat, lng: d.pickup_lng, name: isReturn ? 'Your address' : seller.store_name },
    drop: { lat: d.drop_lat, lng: d.drop_lng },
    // The customer holds the delivery code (or, for a return pickup, the code that releases the package).
    delivery_code: !isReturn && !S.FINAL.includes(d.status) ? d.drop_code : null,
    return_pickup_code: isReturn && [...S.UNASSIGNED, ...S.BEFORE_PICKUP].includes(d.status) ? d.pickup_code : null,
    can_confirm: d.status === 'delivery_verification_pending' && !isReturn, can_edit_preferences: !isReturn && ![...S.FINAL, 'arrived_at_destination', 'delivery_verification_pending'].includes(d.status),
    rating: d.rating, can_rate: d.status === 'delivered' && !d.rating,
    return_pickups: d.kind === 'forward' ? all("SELECT code, status, track_token FROM deliveries WHERE order_id = ? AND kind = 'return' AND status != 'cancelled'", d.order_id).map((r) => ({ code: r.code, status_label: C.label(r.status), url: `/track/?t=${r.track_token}` })) : [],
    notifications: all("SELECT type, title, body, created_at FROM delivery_notifications WHERE audience = 'customer' AND delivery_id = ? ORDER BY id DESC LIMIT 20", d.id),
  };
}
/** Fleet managers see their own members' work, and only the area of a delivery — never the customer's name, phone or address. */
function forFleet(d) {
  return { ...base(d), pickup_name: d.pickup_name, drop_area: d.drop_area, partner: partnerCard(d.partner_id), earning: d.partner_earning, partner_location: liveLocation(d), pickup: pickupPoint(d) };
}
function forAdmin(d, full = false) {
  const view = {
    ...base(d), zone_id: d.zone_id, seller: (get('SELECT store_name FROM sellers WHERE id = ?', d.seller_id) || {}).store_name, pickup: pickupPoint(d),
    drop: { area: d.drop_area, lat: d.drop_lat, lng: d.drop_lng }, partner: d.third_party_name ? { first_name: d.third_party_name, third_party: true, reference: d.third_party_ref } : partnerCard(d.partner_id),
    partner_location: liveLocation(d), customer_fee: d.customer_fee, partner_earning: d.partner_earning, failed_assignments: d.failed_assignments, attempt_count: d.attempt_count,
    ready_at: d.ready_at, search_started_at: d.search_started_at, delayed: Boolean(d.eta_at && !S.FINAL.includes(d.status) && Date.parse(d.eta_at) < Date.now() - 600000),
    failure_reason: d.failure_reason, cancel_reason: d.cancel_reason, rating: d.rating,
  };
  if (!full) return view;
  return {
    ...view, drop: { ...view.drop, address: d.drop_address, name: d.drop_name, phone_masked: maskMobile(d.drop_phone), instructions: d.drop_instructions },
    fee_breakdown: parseJson(d.fee_breakdown, null), earning_breakdown: parseJson(d.earning_breakdown, null), items: itemsOf(d.order_id), timeline: history(d.id),
    offers: all('SELECT o.id, o.status, o.score, o.score_detail, o.pickup_distance_km, o.pickup_eta_min, o.created_at, o.responded_at, o.decline_reason, p.code AS partner_code FROM delivery_offers o JOIN delivery_partners p ON p.id = o.partner_id WHERE o.delivery_id = ? ORDER BY o.id', d.id).map((o) => ({ ...o, score_detail: parseJson(o.score_detail, {}) })),
    assignments: all('SELECT a.mode, a.assigned_by, a.reason, a.active, a.assigned_at, a.ended_at, a.end_reason, p.code AS partner_code FROM delivery_assignments a LEFT JOIN delivery_partners p ON p.id = a.partner_id WHERE a.delivery_id = ? ORDER BY a.id', d.id),
    pickup_confirmations: all('SELECT method, package_count, confirmed_by, created_at FROM pickup_confirmations WHERE delivery_id = ? ORDER BY id', d.id),
    proofs: all('SELECT id, method, recipient_name, note, verified, created_at, storage_key IS NOT NULL AS has_file FROM delivery_proofs WHERE delivery_id = ? ORDER BY id', d.id),
    eta_records: all('SELECT eta_at, minutes, basis, created_at FROM delivery_eta_records WHERE delivery_id = ? ORDER BY id DESC LIMIT 12', d.id),
    settlement: get('SELECT * FROM settlement_records WHERE delivery_id = ?', d.id) || null,
    cod: all('SELECT code, type, amount, method, status, created_at FROM cod_transactions WHERE delivery_id = ?', d.id),
    track_url: C.TEST_TOOLS() ? `/track/?t=${d.track_token}` : null,
  };
}

module.exports = { history, itemsOf, partnerCard, liveLocation, forPartner, offerForPartner, forSeller, forCustomer, forFleet, forAdmin };
