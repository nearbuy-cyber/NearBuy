'use strict';
// Sample delivery network for testing environments: one zone, three approved partners, one applicant, a fleet and a
// control-tower account. Everything is flagged as demo data. Completed sample deliveries are produced by running the
// real workflow, so their history, earnings and settlement rows are genuine records rather than typed-in numbers.
const { get, all, run, tx, insert, nextCode } = require('../db');
const { nowIso, hashPassword, encrypt } = require('../lib');
const S = require('./schema');
const C = require('./core');
const E = require('./engine');
const T = require('./testorders');

const DEMO = {
  admin: { email: 'tower@nearbuy.demo', password: 'Tower123!', name: 'Nisha Kapoor' },
  fleet: { email: 'fleet@nearbuy.demo', password: 'Fleet123!', name: 'Arjun Mehta', fleet: 'SwiftWheels Logistics' },
  partners: [
    { email: 'rohan@nearbuy.demo', password: 'Runner123!', name: 'Rohan Kumar', mobile: '9810011101', vehicle: 'two_wheeler', reg: 'DL3SAB1234', status: 'approved' },
    { email: 'meena@nearbuy.demo', password: 'Runner123!', name: 'Meena Joshi', mobile: '9810011102', vehicle: 'bicycle', status: 'approved', fleet: true },
    { email: 'farhan@nearbuy.demo', password: 'Runner123!', name: 'Farhan Ali', mobile: '9810011103', vehicle: 'ev_two_wheeler', reg: 'DL9EVC4521', status: 'approved', fleet: true },
    { email: 'priya@nearbuy.demo', password: 'Runner123!', name: 'Priya Nair', mobile: '9810011104', vehicle: 'two_wheeler', reg: 'DL5SCD7788', status: 'submitted' },
  ],
};
const PINS = [
  { pin: '110016', area: 'Hauz Khas', lat: 28.5494, lng: 77.2001 }, { pin: '110017', area: 'Saket', lat: 28.5285, lng: 77.219 },
  { pin: '110029', area: 'Safdarjung Enclave', lat: 28.5635, lng: 77.2 }, { pin: '110049', area: 'Andrews Ganj', lat: 28.5612, lng: 77.2255 },
  { pin: '110048', area: 'Greater Kailash', lat: 28.5482, lng: 77.238 }, { pin: '110030', area: 'Mehrauli', lat: 28.5245, lng: 77.1855 },
  { pin: '110024', area: 'Lajpat Nagar', lat: 28.5677, lng: 77.2433 }, { pin: '110020', area: 'Okhla', lat: 28.5355, lng: 77.2732 },
];
const FEES = { food: [25, 1, 8, 10, 10, 5, 22, 6], grocery: [29, 1.5, 8, 15, 15, 5, 25, 6], ecommerce: [39, 2, 9, 0, 20, 18, 28, 7] };
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function createZone(row, pins) {
  const id = insert('service_zones', { code: nextCode('ZN', 100), ...row, pincodes: JSON.stringify(pins), is_demo: 1, created_at: nowIso(), updated_at: nowIso() });
  for (const [category, v] of Object.entries(FEES)) insert('delivery_fee_rules', { zone_id: id, category, base_fee: v[0], free_km: v[1], per_km_fee: v[2], scheduled_fee: v[3], handling_fee: v[4], tax_rate: v[5], partner_base: v[6], partner_per_km: v[7], updated_at: nowIso(), updated_by: 'Demo seed' });
  return id;
}
function staffUser(account, role, fleetId) {
  const userId = insert('users', { email: account.email, password_hash: hashPassword(account.password), name: account.name, email_verified_at: nowIso(), created_at: nowIso() });
  insert('user_roles', { user_id: userId, role, fleet_id: fleetId || null, created_at: nowIso() });
  return userId;
}
function createPartner(p, zoneId, fleetId) {
  const userId = insert('users', { email: p.email, password_hash: hashPassword(p.password), name: p.name, mobile: p.mobile, email_verified_at: nowIso(), created_at: nowIso() });
  insert('user_roles', { user_id: userId, role: 'partner', created_at: nowIso() });
  const approved = p.status === 'approved';
  const training = Object.fromEntries(S.TRAINING_MODULES.map(([k]) => [k, nowIso()]));
  const id = insert('delivery_partners', {
    code: nextCode('DP', 2000), user_id: userId, fleet_id: p.fleet ? fleetId : null, status: p.status, status_note: approved ? 'DEMO DATA: created as approved. No real verification was performed.' : null,
    mobile_verified_at: nowIso(), city: 'New Delhi', home_zone_id: zoneId, language: 'Hindi', emergency_name: 'Demo Contact', emergency_phone: '9810099900',
    payout_holder: p.name, payout_bank: 'Demo Bank of India', payout_account_enc: encrypt('000098765432'), payout_last4: '5432', payout_ifsc: 'DEMO0000001', payout_status: approved ? 'verified' : 'unverified',
    training: JSON.stringify(training), training_completed_at: nowIso(), submitted_at: nowIso(), approved_at: approved ? nowIso() : null, is_demo: 1, created_at: nowIso(), updated_at: nowIso(),
  });
  insert('partner_zones', { partner_id: id, zone_id: zoneId, created_at: nowIso() });
  insert('partner_vehicles', { partner_id: id, type: p.vehicle, registration_no: p.reg || null, ownership: 'own', status: approved ? 'verified' : 'unverified', updated_at: nowIso() });
  const kinds = S.VEHICLES[p.vehicle].needs_licence ? ['photo', 'identity', 'licence', 'vehicle'] : ['photo', 'identity'];
  for (const kind of kinds) {
    const stored = C.storeFile(PLACEHOLDER_PNG);
    const docId = insert('partner_documents', { partner_id: id, kind, file_name: 'DEMO-placeholder.png', mime: stored.mime, size: stored.size, storage_key: stored.key, status: approved ? 'verified' : 'pending', note: 'DEMO DATA: placeholder image, not a real document.', uploaded_at: nowIso(), reviewed_at: approved ? nowIso() : null, reviewed_by: approved ? 'Demo seed' : null });
    if (kind === 'photo') run('UPDATE delivery_partners SET photo_document_id = ? WHERE id = ?', docId, id);
  }
  insert('partner_applications', { partner_id: id, status: 'submitted', note: 'DEMO DATA: sample application.', actor: 'Demo seed', created_at: nowIso() });
  if (approved) insert('partner_applications', { partner_id: id, status: 'approved', note: 'DEMO DATA: sample approval.', actor: 'Demo seed', created_at: nowIso() });
  return id;
}
/** Run one sample delivery through the real engine, from order to verified completion. */
function sampleDelivery(sellerId, partnerId, body) {
  const { applyOrderAction } = require('../routes/orders');
  const owner = get('SELECT u.id, u.name FROM users u JOIN sellers s ON s.owner_user_id = u.id WHERE s.id = ?', sellerId);
  const ctx = { sellerId, seller: get('SELECT * FROM sellers WHERE id = ?', sellerId), user: owner, can: () => true };
  const made = T.createTestOrder(sellerId, body, 'Demo seed');
  const orderId = get('SELECT id FROM orders WHERE code = ?', made.order_code).id;
  const order = () => get('SELECT * FROM orders WHERE id = ?', orderId);
  for (const action of ['accept', 'process', 'pack', 'shipment', 'ready']) applyOrderAction(ctx, order(), action, {});
  let d = get('SELECT * FROM deliveries WHERE code = ?', made.delivery_code);
  const partner = E.partnerById(partnerId);
  E.setOnline(partner, true, 'Demo seed');
  E.recordLocation({ ...partner, online: 1 }, { lat: d.pickup_lat, lng: d.pickup_lng, source: 'test' }, null);
  d = E.one(d.id);
  if (d.status === 'offer_sent') E.cancelLiveOffers(d);
  if (d.status === 'offer_sent') d = C.setStatus(d, 'searching_partner', C.SYSTEM, 'Demo seed: assigning directly.');
  E.manualAssign(E.one(d.id), E.partnerById(partnerId), { type: 'system', name: 'Demo seed' }, 'DEMO DATA: sample delivery');
  const me = E.partnerById(partnerId);
  E.startTrip(me, d.code); E.arrivedAtPickup(me, d.code);
  E.verifyPickup(me, d.code, { method: 'pin', code: d.pickup_code, package_count: d.package_count });
  E.pickedUp(me, d.code);
  E.recordLocation(E.partnerById(partnerId), { lat: d.drop_lat, lng: d.drop_lng, source: 'test' }, E.one(d.id));
  E.arrivedAtDestination(me, d.code);
  E.submitProof(me, d.code, { method: 'otp', code: d.drop_code });
  E.complete(me, d.code, { cod_collected: true, payment_method: 'cash', amount: d.cod_amount });
  E.setOnline(E.partnerById(partnerId), false, 'Demo seed');
  return d.code;
}

function seedDelivery() {
  // A control-tower account can always be created from the environment, including in production.
  if (process.env.DELIVERY_ADMIN_EMAIL && process.env.DELIVERY_ADMIN_PASSWORD && !get("SELECT 1 FROM user_roles WHERE role = 'admin'")) {
    const email = process.env.DELIVERY_ADMIN_EMAIL.toLowerCase();
    if (!get('SELECT 1 FROM users WHERE email = ?', email)) staffUser({ email, password: process.env.DELIVERY_ADMIN_PASSWORD, name: process.env.DELIVERY_ADMIN_NAME || 'Operations administrator' }, 'admin');
  }
  const wanted = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : process.env.NODE_ENV !== 'production';
  if (!wanted || get('SELECT 1 FROM service_zones LIMIT 1') || get('SELECT 1 FROM users WHERE email = ?', DEMO.admin.email)) return false;
  const ids = tx(() => {
    const zoneId = createZone({ name: 'South Delhi', city: 'New Delhi', center_lat: 28.548, center_lng: 77.222, radius_km: 8, max_delivery_km: 9, open_time: '00:00', close_time: '23:59', capacity_limit: 200, demand_incentive: 5 }, PINS);
    createZone({ name: 'Gurugram Central', city: 'Gurugram', center_lat: 28.4595, center_lng: 77.0266, radius_km: 6, max_delivery_km: 7, open_time: '07:00', close_time: '23:00', capacity_limit: 100, demand_incentive: 0, status: 'suspended', status_note: 'DEMO DATA: launch pending' },
      [{ pin: '122001', area: 'Gurugram Sector 14', lat: 28.4682, lng: 77.0445 }, { pin: '122002', area: 'DLF Phase 2', lat: 28.4877, lng: 77.0886 }]);
    staffUser(DEMO.admin, 'admin');
    const fleetId = insert('fleets', { code: nextCode('FLT', 300), name: DEMO.fleet.fleet, contact_email: DEMO.fleet.email, contact_phone: '9810022200', join_code: 'FLEET-SWIFT1', is_demo: 1, created_at: nowIso() });
    staffUser(DEMO.fleet, 'fleet_manager', fleetId);
    return { zoneId, partners: DEMO.partners.map((p) => createPartner(p, zoneId, fleetId)) };
  });
  let samples = 0;
  const seller = get("SELECT s.id FROM sellers s JOIN users u ON u.id = s.owner_user_id WHERE u.email = 'owner@nearbuy.demo'");
  if (seller && C.TEST_TOOLS() && process.env.DELIVERY_SEED_HISTORY !== '0') {
    const plan = [[0, 'grocery', 'prepaid', 1], [0, 'ecommerce', 'cod', 3], [2, 'food', 'prepaid', 0], [2, 'grocery', 'cod', 4]];
    for (const [who, category, payment, addr] of plan) {
      try {
        const c = T.TEST_CUSTOMERS[addr];
        sampleDelivery(seller.id, ids.partners[who], { category, payment, customer_name: c[0], customer_phone: c[1], address: c[2], pincode: c[3] });
        samples += 1;
      } catch (err) { console.error('[nearbuy:delivery] sample delivery skipped:', err.message); }
    }
    run("UPDATE delivery_notifications SET read_at = ? WHERE read_at IS NULL", nowIso());
  }
  console.log(`[nearbuy] Demo delivery network created: control tower ${DEMO.admin.email} / ${DEMO.admin.password}, fleet ${DEMO.fleet.email} / ${DEMO.fleet.password}, partner ${DEMO.partners[0].email} / ${DEMO.partners[0].password}; ${samples} sample deliveries. All flagged DEMO DATA.`);
  return true;
}
module.exports = { seedDelivery, DEMO };
