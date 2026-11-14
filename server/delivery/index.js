'use strict';
// Delivery network module: one engine for food, grocery and parcel deliveries, shared by every portal.
require('./schema');
require('./routes-partner');
require('./routes-admin');
require('./routes-fleet');
require('./routes-seller');
const { route } = require('../router');
const { get } = require('../db');
const { handleRealtime } = require('./realtime');
const { seedDelivery, DEMO } = require('./seed');
const { startBackground, tick } = require('./engine');
const { TEST_TOOLS } = require('./core');

// Lets the sign-in pages offer the demo accounts. Never enabled in production.
route('GET', '/api/delivery/public-config', { auth: 'public' }, () => {
  const demo = TEST_TOOLS() && get('SELECT 1 FROM users WHERE email = ?', DEMO.admin.email);
  return {
    test_environment: TEST_TOOLS(),
    demo: demo ? { partner: { identifier: DEMO.partners[0].email, password: DEMO.partners[0].password }, fleet: { email: DEMO.fleet.email, password: DEMO.fleet.password }, admin: { email: DEMO.admin.email, password: DEMO.admin.password } } : null,
  };
});
module.exports = { handleRealtime, seedDelivery, startBackground, tick };
