'use strict';
// Delivery network schema. One set of tables serves food, grocery and parcel deliveries; every portal reads and writes
// these same records (and the existing users / sessions / orders / order_items / returns tables).
const { db } = require('../db');

db.exec(`
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL,
  fleet_id INTEGER, created_at TEXT NOT NULL, UNIQUE (user_id, role)
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel TEXT NOT NULL, purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL, user_id INTEGER NOT NULL, response TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (key, user_id)
);
CREATE TABLE IF NOT EXISTS fleets (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, contact_email TEXT, contact_phone TEXT, join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_zones (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, city TEXT NOT NULL, center_lat REAL NOT NULL, center_lng REAL NOT NULL,
  radius_km REAL NOT NULL, pincodes TEXT NOT NULL DEFAULT '[]', max_delivery_km REAL NOT NULL DEFAULT 8, open_time TEXT NOT NULL DEFAULT '00:00',
  close_time TEXT NOT NULL DEFAULT '23:59', capacity_limit INTEGER NOT NULL DEFAULT 200, demand_incentive REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', status_note TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_fee_rules (
  id INTEGER PRIMARY KEY, zone_id INTEGER NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE, category TEXT NOT NULL,
  base_fee REAL NOT NULL, free_km REAL NOT NULL DEFAULT 0, per_km_fee REAL NOT NULL, scheduled_fee REAL NOT NULL DEFAULT 0,
  handling_fee REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 18, partner_base REAL NOT NULL, partner_per_km REAL NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT, UNIQUE (zone_id, category)
);
CREATE TABLE IF NOT EXISTS delivery_partners (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, fleet_id INTEGER REFERENCES fleets(id),
  status TEXT NOT NULL DEFAULT 'draft', status_note TEXT, mobile_verified_at TEXT, city TEXT, home_zone_id INTEGER, language TEXT,
  emergency_name TEXT, emergency_phone TEXT, photo_document_id INTEGER, categories TEXT NOT NULL DEFAULT '["food","grocery","ecommerce"]',
  payout_holder TEXT, payout_bank TEXT, payout_account_enc TEXT, payout_last4 TEXT, payout_ifsc TEXT, payout_status TEXT NOT NULL DEFAULT 'missing',
  training TEXT NOT NULL DEFAULT '{}', training_completed_at TEXT, online INTEGER NOT NULL DEFAULT 0, online_since TEXT,
  last_lat REAL, last_lng REAL, last_location_at TEXT, fleet_hold INTEGER NOT NULL DEFAULT 0, rating_sum INTEGER NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT, approved_at TEXT, documents_valid_until TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_applications (
  id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, status TEXT NOT NULL, note TEXT,
  actor TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_documents (
  id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, kind TEXT NOT NULL, file_name TEXT,
  mime TEXT NOT NULL, size INTEGER NOT NULL, storage_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', note TEXT,
  uploaded_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by TEXT
);
CREATE TABLE IF NOT EXISTS partner_vehicles (
  id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL UNIQUE REFERENCES delivery_partners(id) ON DELETE CASCADE, type TEXT NOT NULL,
  registration_no TEXT, ownership TEXT, status TEXT NOT NULL DEFAULT 'unverified', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_zones (
  partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, zone_id INTEGER NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, PRIMARY KEY (partner_id, zone_id)
);
CREATE TABLE IF NOT EXISTS partner_availability (
  id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, online INTEGER NOT NULL,
  reason TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_location_updates (
  id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, delivery_id INTEGER,
  lat REAL NOT NULL, lng REAL NOT NULL, accuracy_m REAL, source TEXT NOT NULL DEFAULT 'gps', recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_delivery_prefs (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, category TEXT, method TEXT NOT NULL DEFAULT 'immediate', scheduled_for TEXT,
  instructions TEXT, special_handling INTEGER NOT NULL DEFAULT 0, quoted_fee REAL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'forward', order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id INTEGER, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, zone_id INTEGER NOT NULL REFERENCES service_zones(id),
  category TEXT NOT NULL, package_type TEXT, package_count INTEGER NOT NULL DEFAULT 1, weight_g INTEGER, special_handling INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'immediate', scheduled_for TEXT, status TEXT NOT NULL, partner_id INTEGER REFERENCES delivery_partners(id), fleet_id INTEGER,
  third_party_name TEXT, third_party_ref TEXT,
  pickup_name TEXT, pickup_address TEXT, pickup_lat REAL, pickup_lng REAL, pickup_contact TEXT, pickup_instructions TEXT,
  drop_name TEXT, drop_phone TEXT, drop_address TEXT, drop_area TEXT, drop_lat REAL, drop_lng REAL, drop_instructions TEXT, geo_source TEXT,
  contactless INTEGER NOT NULL DEFAULT 0, allow_alternative INTEGER NOT NULL DEFAULT 0,
  distance_km REAL, eta_at TEXT, prep_minutes INTEGER, prep_confirmed INTEGER NOT NULL DEFAULT 0, expected_ready_at TEXT, ready_at TEXT,
  pickup_code TEXT NOT NULL, drop_code TEXT NOT NULL, track_token TEXT NOT NULL UNIQUE,
  payment_type TEXT NOT NULL, cod_amount REAL NOT NULL DEFAULT 0, customer_fee REAL NOT NULL DEFAULT 0, fee_breakdown TEXT,
  partner_earning REAL NOT NULL DEFAULT 0, earning_breakdown TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, failed_assignments INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT, cancel_reason TEXT, search_started_at TEXT, assigned_at TEXT, arrived_pickup_at TEXT, picked_up_at TEXT, arrived_drop_at TEXT,
  completed_at TEXT, delayed_notified_at TEXT, unassigned_notified_at TEXT, rating INTEGER, rating_comment TEXT, rated_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_offers (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered', score REAL, score_detail TEXT, pickup_distance_km REAL, pickup_eta_min REAL, earning REAL NOT NULL,
  earning_breakdown TEXT, expires_at TEXT NOT NULL, responded_at TEXT, decline_reason TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, partner_id INTEGER, mode TEXT NOT NULL,
  assigned_by TEXT, reason TEXT, active INTEGER NOT NULL DEFAULT 1, assigned_at TEXT NOT NULL, ended_at TEXT, end_reason TEXT
);
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, status TEXT NOT NULL, actor_type TEXT NOT NULL,
  actor_name TEXT, actor_user_id INTEGER, note TEXT, lat REAL, lng REAL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pickup_confirmations (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, partner_id INTEGER, method TEXT NOT NULL,
  package_count INTEGER NOT NULL, confirmed_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, partner_id INTEGER, method TEXT NOT NULL,
  recipient_name TEXT, note TEXT, storage_key TEXT, mime TEXT, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_routes (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, leg TEXT NOT NULL, from_lat REAL, from_lng REAL,
  to_lat REAL, to_lng REAL, distance_km REAL, est_minutes REAL, basis TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_eta_records (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, eta_at TEXT NOT NULL, minutes REAL NOT NULL,
  basis TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_earning_ledger (
  id INTEGER PRIMARY KEY, txn_code TEXT NOT NULL UNIQUE, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, delivery_id INTEGER,
  type TEXT NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'pending', payout_id INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_payouts (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', reference TEXT, failure_reason TEXT, created_by TEXT, created_at TEXT NOT NULL, settled_at TEXT
);
CREATE TABLE IF NOT EXISTS cod_transactions (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, delivery_id INTEGER,
  type TEXT NOT NULL, amount REAL NOT NULL, method TEXT, status TEXT NOT NULL DEFAULT 'pending', reference TEXT, note TEXT,
  created_at TEXT NOT NULL, confirmed_at TEXT, confirmed_by TEXT
);
CREATE TABLE IF NOT EXISTS settlement_records (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE, customer_fee REAL NOT NULL, partner_earning REAL NOT NULL,
  cod_amount REAL NOT NULL DEFAULT 0, cod_state TEXT NOT NULL, earning_state TEXT NOT NULL DEFAULT 'unpaid', state TEXT NOT NULL DEFAULT 'open',
  reconciled_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_adjustments (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE, delivery_id INTEGER,
  amount REAL NOT NULL, reason TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_tickets (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, raised_by TEXT NOT NULL, partner_id INTEGER, seller_id INTEGER, fleet_id INTEGER, delivery_id INTEGER,
  category TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL, evidence_key TEXT, evidence_mime TEXT, priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_ticket_messages (
  id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES delivery_tickets(id) ON DELETE CASCADE, author_type TEXT NOT NULL, author_name TEXT,
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, partner_id INTEGER, delivery_id INTEGER, type TEXT NOT NULL, description TEXT NOT NULL,
  lat REAL, lng REAL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT, created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS delivery_notifications (
  id INTEGER PRIMARY KEY, audience TEXT NOT NULL, partner_id INTEGER, fleet_id INTEGER, delivery_id INTEGER, type TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT, read_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY, actor_type TEXT NOT NULL, actor_user_id INTEGER, actor_name TEXT, action TEXT NOT NULL, entity TEXT, entity_ref TEXT,
  detail TEXT, ip TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dl_status ON deliveries (status, zone_id);
CREATE INDEX IF NOT EXISTS idx_dl_partner ON deliveries (partner_id, status);
CREATE INDEX IF NOT EXISTS idx_dl_seller ON deliveries (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dl_order ON deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_offer_partner ON delivery_offers (partner_id, status);
CREATE INDEX IF NOT EXISTS idx_offer_delivery ON delivery_offers (delivery_id, status);
CREATE INDEX IF NOT EXISTS idx_hist_delivery ON delivery_status_history (delivery_id, id);
CREATE INDEX IF NOT EXISTS idx_loc_partner ON partner_location_updates (partner_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ledger_partner ON partner_earning_ledger (partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dnotif ON delivery_notifications (audience, partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit ON audit_logs (created_at);
`);

const CATEGORIES = { food: 'Food', grocery: 'Grocery & essentials', ecommerce: 'Parcel' };
const VEHICLES = {
  bicycle: { label: 'Bicycle', speed_kmh: 12, max_kg: 8, max_km: 5, needs_licence: false },
  ev_two_wheeler: { label: 'Electric two-wheeler', speed_kmh: 20, max_kg: 20, max_km: 12, needs_licence: false },
  two_wheeler: { label: 'Two-wheeler', speed_kmh: 22, max_kg: 20, max_km: 15, needs_licence: true },
  three_wheeler: { label: 'Three-wheeler cargo', speed_kmh: 18, max_kg: 150, max_km: 20, needs_licence: true },
};
const APPLICATION_STATUS = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', info_required: 'Additional information required',
  approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended', expired: 'Expired',
};
const DELIVERY_STATUS = {
  awaiting_assignment: 'Awaiting assignment', searching_partner: 'Searching for partner', offer_sent: 'Offer sent', partner_assigned: 'Partner assigned',
  en_route_to_pickup: 'Partner en route to pickup', arrived_at_pickup: 'Arrived at pickup', pickup_verification_pending: 'Pickup verification pending',
  picked_up: 'Picked up', en_route_to_customer: 'En route to customer', arrived_at_destination: 'Arrived at destination',
  delivery_verification_pending: 'Delivery verification pending', delivered: 'Delivered successfully', delivery_attempt_failed: 'Delivery attempt failed',
  reassignment_required: 'Reassignment required', return_in_progress: 'Return in progress', returned_to_seller: 'Returned to seller', cancelled: 'Cancelled',
};
const UNASSIGNED = ['awaiting_assignment', 'searching_partner', 'offer_sent', 'reassignment_required'];
const BEFORE_PICKUP = ['partner_assigned', 'en_route_to_pickup', 'arrived_at_pickup', 'pickup_verification_pending'];
const AFTER_PICKUP = ['picked_up', 'en_route_to_customer', 'arrived_at_destination', 'delivery_verification_pending', 'delivery_attempt_failed', 'return_in_progress'];
const ACTIVE = [...BEFORE_PICKUP, ...AFTER_PICKUP];
const FINAL = ['delivered', 'returned_to_seller', 'cancelled'];
const DOCUMENT_KINDS = { photo: 'Profile photograph', identity: 'Identity document', licence: 'Driving licence', vehicle: 'Vehicle registration document' };
const TRAINING_MODULES = [
  ['workflow', 'Delivery workflow', 'Accept a task, reach the pickup point, verify the order with the seller, deliver it and verify the handover with the customer. A task is complete only after verification.'],
  ['communication', 'Customer communication', 'Be polite and brief. Contact customers only about their delivery, through the app. Never ask a customer for personal details.'],
  ['handling', 'Package handling', 'Check the package count at pickup. Keep food upright and sealed, cold items insulated and parcels dry. Report damage before you leave the pickup point.'],
  ['safety', 'Road and personal safety', 'Wear a helmet, follow traffic rules and never use the phone while riding. No delivery is worth a risk: earnings are never based on speed.'],
  ['privacy', 'Privacy and data protection', 'Addresses and phone numbers are shown only for the delivery in progress. Do not copy, photograph or share them. Location is collected only while you are online.'],
  ['payments', 'Cash and payment procedures', 'Collect exactly the cash-on-delivery amount shown in the app, confirm it in the app and deposit it as instructed. Cash in hand is reconciled separately from earnings.'],
  ['reporting', 'Complaint and emergency reporting', 'Use Support for pickup, address or payment problems. In an emergency call 112 first, then report the safety incident in the app.'],
];
const PARTNER_TICKET_CATEGORIES = {
  pickup_unreachable: 'Cannot reach pickup location', seller_not_ready: 'Seller not ready', order_unavailable: 'Order not available',
  customer_unavailable: 'Customer unavailable', wrong_address: 'Incorrect delivery address', package_damage: 'Package damage', payment: 'Payment issue',
  app_issue: 'App or navigation problem', safety: 'Safety incident', other: 'Other issue',
};
const COMPLAINT_CATEGORIES = {
  delayed: 'Delayed delivery', missing_parcel: 'Missing parcel', incorrect_delivery: 'Incorrect delivery', partner_conduct: 'Partner conduct complaint',
  seller_handover: 'Seller handover complaint', refund: 'Refund or replacement request', other: 'Other delivery complaint',
};

module.exports = {
  CATEGORIES, VEHICLES, APPLICATION_STATUS, DELIVERY_STATUS, UNASSIGNED, BEFORE_PICKUP, AFTER_PICKUP, ACTIVE, FINAL, DOCUMENT_KINDS, TRAINING_MODULES,
  PARTNER_TICKET_CATEGORIES, COMPLAINT_CATEGORIES,
};
