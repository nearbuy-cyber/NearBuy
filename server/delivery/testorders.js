'use strict';
// Test orders for a local delivery. The marketplace has no connected customer checkout yet, so an order for a nearby
// address is created here from the seller's real catalogue and stock. Every such order is flagged as test data.
const { get, all, run, tx, insert } = require('../db');
const { bad, conflict, nowIso, r2, validate } = require('../lib');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');

const TEST_CUSTOMERS = [
  ['Kavya Suri', '9810455512', 'C-14 Green Park Extension', '110016'], ['Imran Sheikh', '9811277345', 'Flat 6, J Block, Saket', '110017'],
  ['Neha Arora', '9899012277', '22 Safdarjung Enclave, B-2 Block', '110029'], ['Tarun Bedi', '9818844120', 'E-41 Greater Kailash I', '110048'],
  ['Shalini Rao', '9871003456', '9 Andrews Ganj Extension', '110049'], ['Dev Malhotra', '9810998871', 'House 3, Ward 2, Mehrauli', '110030'],
];
const RULES = {
  category: { required: true, enum: Object.keys(S.CATEGORIES), label: 'Delivery category' }, payment: { required: true, enum: ['prepaid', 'cod'], label: 'Payment type' },
  method: { enum: ['immediate', 'scheduled'], default: 'immediate' }, scheduled_for: { max: 40 }, customer_name: { min: 2, max: 80 }, customer_phone: { format: 'mobile' },
  address: { min: 5, max: 200 }, pincode: { format: 'pincode' }, instructions: { max: 200 }, special_handling: { type: 'bool' },
};
function resolveInput(sellerId, body) {
  const data = validate(body, RULES);
  const pick = TEST_CUSTOMERS[Math.floor(Math.random() * TEST_CUSTOMERS.length)];
  const customer = { name: data.customer_name || pick[0], phone: data.customer_phone || pick[1], address: data.address || pick[2], pincode: data.pincode || pick[3] };
  if ((data.address && !data.pincode) || (data.pincode && !data.address)) throw bad('Please correct the highlighted fields.', { address: 'Enter both the address and its PIN code, or leave both empty.' });
  let scheduledFor = null;
  if (data.method === 'scheduled') {
    const at = Date.parse(data.scheduled_for || '');
    if (!at || at < Date.now() + 15 * 60000 || at > Date.now() + 3 * 86400000) throw bad('Please correct the highlighted fields.', { scheduled_for: 'Choose a slot between 15 minutes and 3 days from now.' });
    scheduledFor = new Date(at).toISOString();
  }
  const svc = E.serviceability(sellerId, customer.address, customer.pincode);
  if (!svc.ok) throw conflict(svc.reason);
  const fee = C.quoteFee(svc.zone, data.category, svc.distance, { scheduled: data.method === 'scheduled', special: data.special_handling });
  return { data, customer, scheduledFor, svc, fee };
}
/** Delivery fee for an address, shown before the order is placed. */
function quote(sellerId, body) {
  const { svc, fee, customer } = resolveInput(sellerId, body);
  const eta = Math.round(E.DEFAULT_PREP[body.category] + 8 + C.travelMin(svc.distance, 'two_wheeler') + 5);
  return { serviceable: true, zone: svc.zone.name, distance_km: svc.distance, fee, estimated_minutes: eta, drop_area: svc.to.area, address: `${customer.address}, ${customer.pincode}` };
}
function createTestOrder(sellerId, body, actorName) {
  const { data, customer, scheduledFor, svc, fee } = resolveInput(sellerId, body);
  const candidates = all(`SELECT i.id, p.category FROM inventory i JOIN products p ON p.id = i.product_id WHERE i.seller_id = ? AND p.status = 'active' AND (i.on_hand - i.reserved) > 1`, sellerId);
  if (!candidates.length) throw conflict('A test order needs at least one active listing with stock.');
  const grocery = candidates.filter((c) => c.category === 'Grocery');
  const pool = data.category === 'grocery' && grocery.length ? grocery : candidates;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return tx(() => {
    const { createOrder } = require('../routes/orders');
    const order = createOrder(sellerId, {
      lines: [{ inventoryId: pick.id, qty: 1 }], paymentMethod: data.payment === 'cod' ? 'Cash on delivery' : 'Prepaid', isDemo: true, applyPromotions: true,
      customer: { ref: `CUST-T${String(Date.now()).slice(-5)}`, name: customer.name, phone: customer.phone, address: customer.address, city: svc.zone.city, state: 'Delhi', pincode: customer.pincode },
    });
    // The delivery fee quoted to the customer replaces the default shipping charge of the order.
    run('UPDATE orders SET shipping_charge = ?, total = ? WHERE id = ?', fee.total, r2(order.subtotal + fee.total), order.id);
    insert('order_delivery_prefs', { order_id: order.id, category: data.category, method: data.method, scheduled_for: scheduledFor, instructions: data.instructions, special_handling: data.special_handling ? 1 : 0, quoted_fee: fee.total, created_at: nowIso() });
    const d = E.ensureDelivery(get('SELECT * FROM orders WHERE id = ?', order.id), { strict: true });
    C.audit({ type: 'system', name: actorName }, 'Created test order', 'order', order.code, `TEST DATA · ${S.CATEGORIES[data.category]} · ${data.payment}`);
    return { order_code: order.code, delivery_code: d.code, fee, track_url: `/track/?t=${d.track_token}`, message: `Test order ${order.code} placed (TEST DATA). Delivery fee ₹${fee.total}.` };
  });
}
module.exports = { quote, createTestOrder, TEST_CUSTOMERS };
