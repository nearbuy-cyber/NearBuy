'use strict';
// Onboarding, settings, team, notifications, support tickets, learning progress and the activity log.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, parseJson, paged, notify, logActivity } = require('../db');
const { HttpError, bad, notFound, conflict, forbidden, nowIso, validate, encrypt, verifyPassword, maskMobile, INDIAN_STATES, BUSINESS_TYPES } = require('../lib');
const { ROLES, ROLE_PERMISSIONS, ALL_PERMISSIONS, issueToken, rateLimit } = require('../auth');
const { sendMail, devPreviewEnabled, smtpConfigured } = require('../mail');

// Auto-approval is a demo convenience: on by default in development, and only on in production when asked for explicitly.
const autoReview = () => (process.env.DEMO_AUTO_REVIEW ? process.env.DEMO_AUTO_REVIEW === '1' : process.env.NODE_ENV !== 'production');
const SELLER_STATUS = {
  pending_verification: 'Pending verification', not_started: 'Not started', action_required: 'Action required', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected',
};
const NOTIFICATION_TYPES = {
  order: 'New orders and order updates', inventory: 'Low-stock and out-of-stock alerts', listing: 'Listing approvals and quality checks', return: 'Return requests',
  payment: 'Sales, settlements and payouts', shipping: 'Shipment and delivery problems', support: 'Support ticket replies',
};

/* ---------- Views ---------- */
function businessView(sellerId) {
  const p = get('SELECT * FROM seller_business_profiles WHERE seller_id = ?', sellerId) || {};
  return { legal_name: p.legal_name || '', business_type: p.business_type || '', gstin: p.gstin || '', pan_masked: p.pan_last4 ? `••••••${p.pan_last4}` : '', has_pan: Boolean(p.pan_enc), address: p.address || '', city: p.city || '', state: p.state || '', pincode: p.pincode || '', updated_at: p.updated_at };
}
const pickupView = (l) => ({ id: l.id, name: l.name, contact_person: l.contact_person, mobile: l.mobile, address: l.address, city: l.city, state: l.state, pincode: l.pincode, is_default: Boolean(l.is_default) });
const pickups = (sellerId) => all('SELECT * FROM seller_pickup_locations WHERE seller_id = ? ORDER BY is_default DESC, id', sellerId).map(pickupView);
function bankView(sellerId) {
  const b = get('SELECT * FROM seller_bank_accounts WHERE seller_id = ?', sellerId);
  return b ? { holder_name: b.holder_name, bank_name: b.bank_name, account_masked: `•••• •••• ${b.account_last4}`, ifsc: b.ifsc, verification_status: b.verification_status, updated_at: b.updated_at } : null;
}
function storeView(seller) {
  return { store_name: seller.store_name, store_description: seller.store_description || '', contact_email: seller.contact_email || '', contact_phone: seller.contact_phone || '', logo_upload_id: seller.store_logo_upload_id };
}
function onboardingState(seller) {
  const sellerId = seller.id;
  const business = businessView(sellerId);
  const store = storeView(seller);
  const productCount = get('SELECT COUNT(*) AS n FROM products WHERE seller_id = ?', sellerId).n;
  const done = {
    business: Boolean(business.legal_name && business.gstin && business.has_pan && business.address && business.pincode),
    pickup: pickups(sellerId).length > 0,
    bank: Boolean(bankView(sellerId)),
    store: Boolean(store.store_name && store.store_description.length >= 20 && store.contact_email),
    product: productCount > 0,
  };
  done.review = Boolean(seller.onboarding_submitted_at) && ['under_review', 'approved'].includes(seller.status);
  const steps = [
    { key: 'business', title: 'Business information', hint: 'Legal name, GSTIN, PAN and registered address' },
    { key: 'pickup', title: 'Pickup location', hint: 'Where orders are collected from' },
    { key: 'bank', title: 'Bank and settlement', hint: 'Account for settlement payouts' },
    { key: 'store', title: 'Store information', hint: 'Display name, description and contact' },
    { key: 'product', title: 'Add first product', hint: 'Create your first listing' },
    { key: 'review', title: 'Final review', hint: 'Check everything and submit' },
  ].map((s) => ({ ...s, done: done[s.key] }));
  return { steps, remaining: steps.filter((s) => !s.done).map((s) => s.title), completed: steps.filter((s) => s.done).length, total: steps.length, product_count: productCount };
}
function markInProgress(ctx) {
  if (ctx.seller.status === 'not_started' || ctx.seller.status === 'rejected') run("UPDATE sellers SET status = 'action_required', status_note = 'Complete the remaining onboarding steps and submit for review.' WHERE id = ?", ctx.sellerId);
}

/* ---------- Onboarding ---------- */
route('GET', '/api/onboarding', { perm: 'settings.read' }, (ctx) => {
  const seller = get('SELECT * FROM sellers WHERE id = ?', ctx.sellerId);
  return {
    status: seller.status, status_label: SELLER_STATUS[seller.status], status_note: seller.status_note, submitted_at: seller.onboarding_submitted_at,
    ...onboardingState(seller), business: businessView(ctx.sellerId), pickup_locations: pickups(ctx.sellerId), bank: bankView(ctx.sellerId), store: storeView(seller),
    first_product: get('SELECT code, title, status FROM products WHERE seller_id = ? ORDER BY id LIMIT 1', ctx.sellerId) || null,
    states: INDIAN_STATES, business_types: BUSINESS_TYPES, can_manage: ctx.can('settings.manage'), auto_review: autoReview(), statuses: SELLER_STATUS,
  };
});
route('POST', '/api/onboarding/submit', { perm: 'settings.manage' }, (ctx) => {
  const seller = get('SELECT * FROM sellers WHERE id = ?', ctx.sellerId);
  if (['under_review', 'approved'].includes(seller.status)) throw conflict(`Your account is already ${SELLER_STATUS[seller.status].toLowerCase()}.`);
  const state = onboardingState(seller);
  const missing = state.steps.filter((s) => s.key !== 'review' && !s.done).map((s) => s.title);
  if (missing.length) throw conflict(`Complete these steps before submitting: ${missing.join(', ')}.`);
  if (!validate(ctx.body, { confirm: { type: 'bool' } }).confirm) throw bad('Please correct the highlighted fields.', { confirm: 'Confirm that the information is accurate.' });
  tx(() => {
    run("UPDATE sellers SET status = 'under_review', status_note = 'Submitted for marketplace review.', onboarding_submitted_at = ? WHERE id = ?", nowIso(), ctx.sellerId);
    logActivity(ctx, 'Submitted onboarding for review', 'account', seller.code);
    if (autoReview()) {
      run("UPDATE sellers SET status = 'approved', status_note = ? WHERE id = ?", 'Approved automatically in demo review mode. GSTIN, PAN and bank details were format-checked only — they were not verified with any authority.', ctx.sellerId);
      notify(ctx.sellerId, 'account', 'Seller account approved (demo review)', 'No KYC provider is connected, so this approval is automatic and for demonstration only.', '/seller/account-status');
    } else notify(ctx.sellerId, 'account', 'Onboarding submitted', 'Your details are under review by the marketplace team.', '/seller/account-status');
  });
  const fresh = get('SELECT status, status_note FROM sellers WHERE id = ?', ctx.sellerId);
  return { status: fresh.status, status_label: SELLER_STATUS[fresh.status], status_note: fresh.status_note };
});

/* ---------- Settings ---------- */
route('GET', '/api/settings', { perm: 'settings.read' }, (ctx) => {
  const seller = get('SELECT * FROM sellers WHERE id = ?', ctx.sellerId);
  const manage = ctx.can('settings.manage');
  return {
    seller: { code: seller.code, status: seller.status, status_label: SELLER_STATUS[seller.status], status_note: seller.status_note, created_at: seller.created_at },
    business: businessView(ctx.sellerId), store: storeView(seller), pickup_locations: pickups(ctx.sellerId),
    // Bank details are visible only to roles that manage settings or view payments, and always masked.
    bank: manage || ctx.can('payments.read') ? bankView(ctx.sellerId) : undefined,
    notification_prefs: Object.fromEntries(Object.keys(NOTIFICATION_TYPES).map((k) => [k, parseJson(seller.notification_prefs, {})[k] !== false])), notification_types: NOTIFICATION_TYPES,
    package_settings: parseJson(seller.package_settings, {}), low_stock_default: seller.low_stock_default,
    states: INDIAN_STATES, business_types: BUSINESS_TYPES, can_manage: manage, can_edit_pickups: manage || ctx.can('shipping.write'),
    me: { name: ctx.user.name, email: ctx.user.email, mobile: ctx.user.mobile, role: ctx.role, role_label: ROLES[ctx.role].label },
  };
});
route('PUT', '/api/settings/business', { perm: 'settings.manage' }, (ctx) => {
  const existing = get('SELECT * FROM seller_business_profiles WHERE seller_id = ?', ctx.sellerId) || {};
  const data = validate(ctx.body, {
    legal_name: { required: true, min: 2, max: 120, label: 'Business legal name' },
    business_type: { required: true, enum: BUSINESS_TYPES, label: 'Business type' },
    gstin: { required: true, format: 'gstin', upper: true, label: 'GSTIN' },
    pan: { required: !existing.pan_enc, format: 'pan', upper: true, label: 'PAN' },
    address: { required: true, min: 8, max: 240, label: 'Business address' },
    city: { required: true, min: 2, max: 60 },
    state: { required: true, enum: INDIAN_STATES },
    pincode: { required: true, format: 'pincode', label: 'PIN code' },
  });
  // Characters 3–12 of a GSTIN are the holder's PAN; when a new PAN is supplied the two must agree.
  if (data.pan && data.gstin.slice(2, 12) !== data.pan) throw bad('Please correct the highlighted fields.', { pan: 'PAN does not match the PAN embedded in the GSTIN (characters 3–12).' });
  if (!data.pan && existing.pan_last4 && data.gstin.slice(8, 12) !== existing.pan_last4) throw bad('Please correct the highlighted fields.', { pan: 'The GSTIN has changed. Re-enter the PAN so the two can be matched.' });
  tx(() => {
    const patch = { legal_name: data.legal_name, business_type: data.business_type, gstin: data.gstin, address: data.address, city: data.city, state: data.state, pincode: data.pincode, updated_at: nowIso() };
    if (data.pan) { patch.pan_enc = encrypt(data.pan); patch.pan_last4 = data.pan.slice(-4); }
    if (existing.seller_id) run(`UPDATE seller_business_profiles SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')} WHERE seller_id = ?`, ...Object.values(patch), ctx.sellerId);
    else insert('seller_business_profiles', { seller_id: ctx.sellerId, ...patch });
    run('UPDATE sellers SET business_name = ?, business_type = ? WHERE id = ?', data.legal_name, data.business_type, ctx.sellerId);
    markInProgress(ctx);
    logActivity(ctx, 'Updated business profile', 'settings', 'business');
  });
  return { ok: true, business: businessView(ctx.sellerId), message: 'Business information saved.' };
});
route('PUT', '/api/settings/store', { perm: 'settings.manage' }, (ctx) => {
  const data = validate(ctx.body, {
    store_name: { required: true, min: 3, max: 60, label: 'Store display name' },
    store_description: { required: true, min: 20, max: 600, label: 'Store description' },
    contact_email: { required: true, format: 'email', lower: true, max: 160, label: 'Contact email' },
    contact_phone: { required: true, format: 'mobile', label: 'Contact phone' },
    logo_upload_id: { type: 'int' },
  });
  if (data.logo_upload_id && !get("SELECT 1 FROM uploads WHERE id = ? AND seller_id = ? AND kind = 'logo'", data.logo_upload_id, ctx.sellerId)) throw bad('Please correct the highlighted fields.', { logo_upload_id: 'Upload the logo again.' });
  tx(() => {
    run('UPDATE sellers SET store_name = ?, store_description = ?, contact_email = ?, contact_phone = ?, store_logo_upload_id = ? WHERE id = ?', data.store_name, data.store_description, data.contact_email, data.contact_phone, data.logo_upload_id || null, ctx.sellerId);
    markInProgress(ctx);
    logActivity(ctx, 'Updated store profile', 'settings', 'store');
  });
  return { ok: true, store: storeView(get('SELECT * FROM sellers WHERE id = ?', ctx.sellerId)), message: 'Store information saved.' };
});
route('PUT', '/api/settings/bank', { perm: 'settings.manage' }, (ctx) => {
  rateLimit(`bank:${ctx.sellerId}`, 10, 3600000);
  const existing = get('SELECT * FROM seller_bank_accounts WHERE seller_id = ?', ctx.sellerId);
  const data = validate(ctx.body, {
    holder_name: { required: true, min: 2, max: 120, label: 'Account holder name' },
    bank_name: { required: true, min: 2, max: 80, label: 'Bank name' },
    account_number: { required: true, format: 'account', label: 'Account number' },
    confirm_account_number: { required: true, max: 20, label: 'Confirm account number' },
    ifsc: { required: true, format: 'ifsc', upper: true, label: 'IFSC code' },
    current_password: { max: 128 },
  });
  if (data.account_number !== data.confirm_account_number) throw bad('Please correct the highlighted fields.', { confirm_account_number: 'Account numbers do not match.' });
  if (existing) {
    // Replacing payout details is a sensitive change: re-check the password.
    const row = get('SELECT password_hash FROM users WHERE id = ?', ctx.user.id);
    if (!data.current_password || !verifyPassword(data.current_password, row.password_hash)) throw bad('Please correct the highlighted fields.', { current_password: 'Enter your current password to change bank details.' });
  }
  tx(() => {
    const row = { holder_name: data.holder_name, bank_name: data.bank_name, account_enc: encrypt(data.account_number), account_last4: data.account_number.slice(-4), ifsc: data.ifsc, verification_status: 'unverified', updated_at: nowIso() };
    if (existing) run(`UPDATE seller_bank_accounts SET ${Object.keys(row).map((k) => `${k} = ?`).join(', ')} WHERE seller_id = ?`, ...Object.values(row), ctx.sellerId);
    else insert('seller_bank_accounts', { seller_id: ctx.sellerId, ...row });
    markInProgress(ctx);
    notify(ctx.sellerId, 'security', existing ? 'Bank account changed' : 'Bank account added', `Account ending ${row.account_last4} · ${data.bank_name}. If this was not you, change your password now.`, '/seller/payments/bank-account');
    logActivity(ctx, existing ? 'Changed bank account' : 'Added bank account', 'settings', 'bank', `Account ending ${row.account_last4}`);
  });
  return { ok: true, bank: bankView(ctx.sellerId), message: 'Bank details saved. Status: not verified — account verification needs a banking integration.' };
});

const PICKUP_SCHEMA = {
  name: { required: true, min: 2, max: 80, label: 'Pickup location name' }, contact_person: { required: true, min: 2, max: 80, label: 'Contact person' },
  mobile: { required: true, format: 'mobile', label: 'Mobile number' }, address: { required: true, min: 8, max: 240 }, pincode: { required: true, format: 'pincode', label: 'PIN code' },
  city: { required: true, min: 2, max: 60 }, state: { required: true, enum: INDIAN_STATES }, is_default: { type: 'bool' },
};
const canEditPickups = (ctx) => { if (!ctx.can('settings.manage') && !ctx.can('shipping.write')) throw forbidden('Your role does not have permission to change pickup locations.'); };
route('GET', '/api/settings/pickup-locations', { perm: 'settings.read' }, (ctx) => ({ pickup_locations: pickups(ctx.sellerId), states: INDIAN_STATES, can_edit: ctx.can('settings.manage') || ctx.can('shipping.write') }));
route('POST', '/api/settings/pickup-locations', (ctx) => {
  canEditPickups(ctx);
  const data = validate(ctx.body, PICKUP_SCHEMA);
  const count = get('SELECT COUNT(*) AS n FROM seller_pickup_locations WHERE seller_id = ?', ctx.sellerId).n;
  if (count >= 10) throw conflict('You can have at most 10 pickup locations.');
  const id = tx(() => {
    const makeDefault = data.is_default || count === 0;
    if (makeDefault) run('UPDATE seller_pickup_locations SET is_default = 0 WHERE seller_id = ?', ctx.sellerId);
    const newId = insert('seller_pickup_locations', { seller_id: ctx.sellerId, ...data, is_default: makeDefault ? 1 : 0, created_at: nowIso() });
    // The first pickup location also becomes the address of the primary warehouse.
    const wh = get('SELECT * FROM warehouses WHERE seller_id = ? ORDER BY id LIMIT 1', ctx.sellerId);
    if (!wh) insert('warehouses', { seller_id: ctx.sellerId, code: 'WH-01', name: data.name, pickup_location_id: newId, city: data.city, pincode: data.pincode, created_at: nowIso() });
    else if (!wh.pickup_location_id) run('UPDATE warehouses SET pickup_location_id = ?, city = ?, pincode = ? WHERE id = ?', newId, data.city, data.pincode, wh.id);
    markInProgress(ctx);
    logActivity(ctx, 'Added pickup location', 'settings', data.name);
    return newId;
  });
  return reply.created({ id, pickup_locations: pickups(ctx.sellerId), message: 'Pickup location saved.' });
});
route('PUT', '/api/settings/pickup-locations/:id', (ctx) => {
  canEditPickups(ctx);
  const loc = get('SELECT * FROM seller_pickup_locations WHERE id = ? AND seller_id = ?', Number(ctx.params.id), ctx.sellerId);
  if (!loc) throw notFound('Pickup location');
  const data = validate(ctx.body, PICKUP_SCHEMA);
  tx(() => {
    if (data.is_default) run('UPDATE seller_pickup_locations SET is_default = 0 WHERE seller_id = ?', ctx.sellerId);
    run('UPDATE seller_pickup_locations SET name = ?, contact_person = ?, mobile = ?, address = ?, pincode = ?, city = ?, state = ?, is_default = ? WHERE id = ? AND seller_id = ?', data.name, data.contact_person, data.mobile, data.address, data.pincode, data.city, data.state, data.is_default || loc.is_default ? 1 : 0, loc.id, ctx.sellerId);
    logActivity(ctx, 'Updated pickup location', 'settings', data.name);
  });
  return { ok: true, pickup_locations: pickups(ctx.sellerId), message: 'Pickup location updated.' };
});
route('DELETE', '/api/settings/pickup-locations/:id', (ctx) => {
  canEditPickups(ctx);
  const loc = get('SELECT * FROM seller_pickup_locations WHERE id = ? AND seller_id = ?', Number(ctx.params.id), ctx.sellerId);
  if (!loc) throw notFound('Pickup location');
  if (get("SELECT 1 FROM shipments WHERE pickup_location_id = ? AND seller_id = ? AND status NOT IN ('delivered', 'returned')", loc.id, ctx.sellerId)) throw conflict('This location has open shipments and cannot be removed yet.');
  if (get('SELECT COUNT(*) AS n FROM seller_pickup_locations WHERE seller_id = ?', ctx.sellerId).n <= 1) throw conflict('Keep at least one pickup location. Add another before removing this one.');
  tx(() => {
    run('DELETE FROM seller_pickup_locations WHERE id = ? AND seller_id = ?', loc.id, ctx.sellerId);
    run('UPDATE warehouses SET pickup_location_id = NULL WHERE pickup_location_id = ? AND seller_id = ?', loc.id, ctx.sellerId);
    if (loc.is_default) run('UPDATE seller_pickup_locations SET is_default = 1 WHERE id = (SELECT id FROM seller_pickup_locations WHERE seller_id = ? ORDER BY id LIMIT 1)', ctx.sellerId);
    logActivity(ctx, 'Removed pickup location', 'settings', loc.name);
  });
  return { ok: true, pickup_locations: pickups(ctx.sellerId), message: 'Pickup location removed.' };
});
route('PUT', '/api/settings/notifications', { perm: 'settings.manage' }, (ctx) => {
  const prefs = {};
  for (const key of Object.keys(NOTIFICATION_TYPES)) prefs[key] = ctx.body[key] !== false && ctx.body[key] !== 'false';
  run('UPDATE sellers SET notification_prefs = ? WHERE id = ?', JSON.stringify(prefs), ctx.sellerId);
  logActivity(ctx, 'Updated notification preferences', 'settings', 'notifications');
  return { ok: true, notification_prefs: prefs, message: 'Notification preferences saved.' };
});
route('PUT', '/api/settings/package', (ctx) => {
  canEditPickups(ctx);
  const data = validate(ctx.body, {
    default_weight_g: { type: 'int', required: true, min: 1, max: 50000, label: 'Default weight' }, default_length_cm: { type: 'number', required: true, min: 1, max: 300, label: 'Length' },
    default_width_cm: { type: 'number', required: true, min: 1, max: 300, label: 'Width' }, default_height_cm: { type: 'number', required: true, min: 1, max: 300, label: 'Height' },
    packaging_type: { required: true, enum: ['Corrugated box', 'Poly mailer', 'Padded envelope', 'Custom packaging'], label: 'Packaging type' },
    fragile_handling: { type: 'bool' },
  });
  run('UPDATE sellers SET package_settings = ? WHERE id = ?', JSON.stringify(data), ctx.sellerId);
  logActivity(ctx, 'Updated package settings', 'settings', 'package');
  return { ok: true, package_settings: data, message: 'Package settings saved.' };
});
route('PUT', '/api/settings/profile', { auth: 'session' }, (ctx) => {
  const data = validate(ctx.body, { name: { required: true, min: 2, max: 80, label: 'Full name' }, mobile: { required: true, format: 'mobile', label: 'Mobile number' } });
  run('UPDATE users SET name = ?, mobile = ? WHERE id = ?', data.name, data.mobile, ctx.user.id);
  return { ok: true, message: 'Profile updated.' };
});

/* ---------- Team and roles ---------- */
route('GET', '/api/roles', { perm: 'settings.read' }, () => ({
  roles: Object.entries(ROLES).map(([key, r]) => ({ key, ...r, permissions: ROLE_PERMISSIONS[key] })), permissions: ALL_PERMISSIONS,
}));
const teamList = (sellerId) => all(`SELECT m.id, m.role, m.status, m.created_at, u.name, u.email, u.mobile, u.last_login_at, (s.owner_user_id = u.id) AS is_owner
  FROM seller_team_members m JOIN users u ON u.id = m.user_id JOIN sellers s ON s.id = m.seller_id WHERE m.seller_id = ? AND m.status != 'removed' ORDER BY is_owner DESC, m.id`, sellerId)
  .map((m) => ({ ...m, is_owner: Boolean(m.is_owner), role_label: ROLES[m.role].label, mobile: maskMobile(m.mobile) }));
async function sendInvite(ctx, user, role) {
  const token = issueToken(user.id, 'team_invite', 72);
  const link = `${ctx.baseUrl}/seller/reset-password?token=${token}`;
  const result = await sendMail({
    to: user.email, purpose: 'team_invite', subject: `You have been invited to ${ctx.seller.store_name} on NearBuy Seller Hub`, link,
    text: `Hello ${user.name},\n\n${ctx.user.name} invited you to join ${ctx.seller.store_name} as ${ROLES[role].label}.\nSet your password to accept (valid for 72 hours):\n${link}`,
  });
  return { delivered: result.delivered, dev_link: !result.delivered && devPreviewEnabled() ? link : undefined, mail_configured: smtpConfigured() };
}
route('GET', '/api/team', { perm: 'team.manage' }, (ctx) => ({ members: teamList(ctx.sellerId), roles: Object.entries(ROLES).map(([key, r]) => ({ key, ...r })) }));
route('POST', '/api/team', { perm: 'team.manage' }, async (ctx) => {
  const data = validate(ctx.body, {
    name: { required: true, min: 2, max: 80, label: 'Full name' }, email: { required: true, format: 'email', lower: true, max: 160 },
    role: { required: true, enum: Object.keys(ROLES).filter((r) => r !== 'owner') },
  });
  if (get('SELECT 1 FROM users WHERE email = ?', data.email)) throw bad('Please correct the highlighted fields.', { email: 'This email already has a NearBuy Seller Hub account.' });
  if (get("SELECT COUNT(*) AS n FROM seller_team_members WHERE seller_id = ? AND status != 'removed'", ctx.sellerId).n >= 25) throw conflict('A store can have at most 25 team members.');
  const user = tx(() => {
    const userId = insert('users', { email: data.email, name: data.name, created_at: nowIso() });
    insert('seller_team_members', { seller_id: ctx.sellerId, user_id: userId, role: data.role, status: 'invited', invited_by: ctx.user.id, created_at: nowIso() });
    logActivity(ctx, 'Invited team member', 'team', data.email, ROLES[data.role].label);
    return { id: userId, email: data.email, name: data.name };
  });
  const invite = await sendInvite(ctx, user, data.role);
  return reply.created({ members: teamList(ctx.sellerId), invite, message: invite.delivered ? `Invitation emailed to ${data.email}.` : 'Team member added, but the invitation email could not be sent because no email provider is configured.' });
});
function findMember(ctx) {
  const m = get('SELECT m.*, u.email, u.name FROM seller_team_members m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.seller_id = ?', Number(ctx.params.id), ctx.sellerId);
  if (!m || m.status === 'removed') throw notFound('Team member');
  if (m.user_id === ctx.seller.owner_user_id) throw conflict('The store owner cannot be changed or removed.');
  return m;
}
route('PATCH', '/api/team/:id', { perm: 'team.manage' }, (ctx) => {
  const m = findMember(ctx);
  const data = validate(ctx.body, { role: { required: true, enum: Object.keys(ROLES).filter((r) => r !== 'owner') } });
  run('UPDATE seller_team_members SET role = ? WHERE id = ? AND seller_id = ?', data.role, m.id, ctx.sellerId);
  logActivity(ctx, 'Changed team role', 'team', m.email, `${ROLES[m.role].label} → ${ROLES[data.role].label}`);
  return { ok: true, members: teamList(ctx.sellerId), message: `${m.name} is now ${ROLES[data.role].label}.` };
});
route('POST', '/api/team/:id/resend-invite', { perm: 'team.manage' }, async (ctx) => {
  const m = findMember(ctx);
  if (m.status !== 'invited') throw conflict('This person has already accepted their invitation.');
  rateLimit(`invite:${m.id}`, 5, 3600000);
  const invite = await sendInvite(ctx, { id: m.user_id, email: m.email, name: m.name }, m.role);
  return { invite, message: invite.delivered ? 'Invitation sent again.' : 'The invitation email could not be sent because no email provider is configured.' };
});
route('DELETE', '/api/team/:id', { perm: 'team.manage' }, (ctx) => {
  const m = findMember(ctx);
  tx(() => {
    run('DELETE FROM sessions WHERE user_id = ?', m.user_id);
    if (m.status === 'invited') run('DELETE FROM users WHERE id = ?', m.user_id); // never signed in: remove the placeholder account
    else run("UPDATE seller_team_members SET status = 'removed' WHERE id = ? AND seller_id = ?", m.id, ctx.sellerId);
    logActivity(ctx, 'Removed team member', 'team', m.email);
  });
  return { ok: true, members: teamList(ctx.sellerId), message: `${m.name} no longer has access.` };
});

/* ---------- Activity log ---------- */
route('GET', '/api/activity', { perm: 'activity.read' }, (ctx) => {
  const where = ['seller_id = ?'];
  const params = [ctx.sellerId];
  if (ctx.query.entity) { where.push('entity = ?'); params.push(String(ctx.query.entity)); }
  return paged({ select: 'id, actor, action, entity, entity_ref, detail, created_at', from: 'activity_logs', where, params, search: { q: ctx.query.q, cols: ['actor', 'action', 'entity_ref', 'detail'] }, defaultSort: 'id DESC', page: ctx.query.page, pageSize: ctx.query.page_size || 20 });
});

/* ---------- Notifications ---------- */
route('GET', '/api/notifications', (ctx) => {
  const where = ['seller_id = ?'];
  const params = [ctx.sellerId];
  if (ctx.query.unread === '1') where.push('read_at IS NULL');
  if (ctx.query.type) { where.push('type = ?'); params.push(String(ctx.query.type)); }
  const list = paged({ select: 'id, type, title, body, link, read_at, created_at', from: 'notifications', where, params, defaultSort: 'id DESC', page: ctx.query.page, pageSize: ctx.query.page_size || 15 });
  return { ...list, unread: get('SELECT COUNT(*) AS n FROM notifications WHERE seller_id = ? AND read_at IS NULL', ctx.sellerId).n };
});
route('POST', '/api/notifications/read', (ctx) => {
  if (ctx.body.all) run('UPDATE notifications SET read_at = ? WHERE seller_id = ? AND read_at IS NULL', nowIso(), ctx.sellerId);
  else {
    const ids = validate(ctx.body, { ids: { type: 'array', of: 'int', min: 1, max: 100 } }).ids;
    for (const id of ids) run('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND seller_id = ?', nowIso(), id, ctx.sellerId);
  }
  return { ok: true, unread: get('SELECT COUNT(*) AS n FROM notifications WHERE seller_id = ? AND read_at IS NULL', ctx.sellerId).n };
});

/* ---------- Support tickets ---------- */
const TICKET_CATEGORIES = {
  account: { label: 'Account support', team: 'Seller Onboarding Desk', priority: 'High' },
  listing: { label: 'Listing support', team: 'Catalogue Quality', priority: 'Medium' },
  order: { label: 'Order support', team: 'Order Operations', priority: 'Medium' },
  payment: { label: 'Payment support', team: 'Seller Finance', priority: 'High' },
  return: { label: 'Return support', team: 'Returns Desk', priority: 'Medium' },
  technical: { label: 'Technical support', team: 'Platform Support', priority: 'Low' },
};
const TICKET_STATUS = { open: 'Open', in_progress: 'In progress', waiting_for_seller: 'Waiting for seller', resolved: 'Resolved', closed: 'Closed' };
const ticketRow = (t) => ({ code: t.code, category: t.category, category_label: TICKET_CATEGORIES[t.category].label, subject: t.subject, related_type: t.related_type, related_ref: t.related_ref, assigned_team: t.assigned_team, priority: t.priority, status: t.status, status_label: TICKET_STATUS[t.status], created_at: t.created_at, updated_at: t.updated_at, created_by: t.created_by, is_demo: Boolean(t.is_demo) });
route('GET', '/api/support/meta', { perm: 'support.use' }, () => ({ categories: TICKET_CATEGORIES, statuses: TICKET_STATUS, desk_connected: false }));
route('GET', '/api/support/tickets', { perm: 'support.use' }, (ctx) => {
  const where = ['seller_id = ?'];
  const params = [ctx.sellerId];
  if (TICKET_STATUS[ctx.query.status]) { where.push('status = ?'); params.push(ctx.query.status); }
  if (ctx.query.status === 'active') where.push("status NOT IN ('resolved', 'closed')");
  if (TICKET_CATEGORIES[ctx.query.category]) { where.push('category = ?'); params.push(ctx.query.category); }
  const list = paged({ select: '*', from: 'support_tickets', where, params, search: { q: ctx.query.q, cols: ['code', 'subject', 'related_ref'] }, sortMap: { created: 'created_at', updated: 'updated_at' }, sort: ctx.query.sort, defaultSort: 'updated_at DESC', page: ctx.query.page, pageSize: ctx.query.page_size });
  const counts = { all: 0 };
  for (const key of Object.keys(TICKET_STATUS)) counts[key] = 0;
  for (const row of all('SELECT status, COUNT(*) AS n FROM support_tickets WHERE seller_id = ? GROUP BY status', ctx.sellerId)) { counts[row.status] = row.n; counts.all += row.n; }
  return { ...list, rows: list.rows.map(ticketRow), counts };
});
route('POST', '/api/support/tickets', { perm: 'support.use' }, (ctx) => {
  rateLimit(`ticket:${ctx.sellerId}`, 30, 3600000);
  const data = validate(ctx.body, {
    category: { required: true, enum: Object.keys(TICKET_CATEGORIES), label: 'Issue category' },
    related_type: { enum: ['order', 'product', 'none'], default: 'none' }, related_ref: { max: 40, label: 'Related order or product' },
    subject: { required: true, min: 6, max: 140 }, description: { required: true, min: 20, max: 3000 }, attachment_upload_id: { type: 'int' },
  });
  if (data.related_type !== 'none') {
    if (!data.related_ref) throw bad('Please correct the highlighted fields.', { related_ref: `Enter the ${data.related_type} ID, or choose "Not related".` });
    const found = data.related_type === 'order' ? get('SELECT code FROM orders WHERE code = ? AND seller_id = ?', data.related_ref.toUpperCase(), ctx.sellerId) : get('SELECT code FROM products WHERE (code = ? OR sku = ?) AND seller_id = ?', data.related_ref.toUpperCase(), data.related_ref, ctx.sellerId);
    if (!found) throw bad('Please correct the highlighted fields.', { related_ref: `No ${data.related_type} with that ID was found in your account.` });
    data.related_ref = found.code;
  } else data.related_ref = null;
  if (data.attachment_upload_id && !get("SELECT 1 FROM uploads WHERE id = ? AND seller_id = ? AND kind = 'attachment'", data.attachment_upload_id, ctx.sellerId)) throw bad('Please correct the highlighted fields.', { attachment: 'Upload the attachment again.' });
  const cat = TICKET_CATEGORIES[data.category];
  const priority = /urgent|blocked|cannot|payout|not received/i.test(`${data.subject} ${data.description}`) ? 'High' : cat.priority;
  const code = tx(() => {
    const ticketCode = nextCode('TKT', 8000);
    const id = insert('support_tickets', { seller_id: ctx.sellerId, code: ticketCode, category: data.category, related_type: data.related_type === 'none' ? null : data.related_type, related_ref: data.related_ref, subject: data.subject, description: data.description, attachment_upload_id: data.attachment_upload_id, assigned_team: cat.team, priority, status: 'open', created_by: ctx.user.name, created_at: nowIso(), updated_at: nowIso() });
    insert('ticket_messages', { seller_id: ctx.sellerId, ticket_id: id, author_type: 'seller', author_name: ctx.user.name, body: data.description, created_at: nowIso() });
    insert('ticket_messages', { seller_id: ctx.sellerId, ticket_id: id, author_type: 'system', author_name: 'System', body: `Ticket logged and routed to ${cat.team} with ${priority.toLowerCase()} priority. A live support desk is not connected to this build, so replies arrive only when marketplace staff respond through the operations API.`, created_at: nowIso() });
    logActivity(ctx, 'Raised support ticket', 'support', ticketCode, data.subject);
    return ticketCode;
  });
  notify(ctx.sellerId, 'support', `Ticket ${code} created`, data.subject, `/seller/support/tickets/${code}`);
  return reply.created({ code, message: `Ticket ${code} created and routed to ${cat.team}.` });
});
function ticketDetail(ctx, code) {
  const t = get('SELECT * FROM support_tickets WHERE code = ? AND seller_id = ?', code, ctx.sellerId);
  if (!t) throw notFound('Ticket');
  const attachment = t.attachment_upload_id ? get('SELECT id, mime, original_name, size FROM uploads WHERE id = ? AND seller_id = ?', t.attachment_upload_id, ctx.sellerId) : null;
  return { ticket: { ...ticketRow(t), description: t.description, attachment }, messages: all('SELECT author_type, author_name, body, created_at FROM ticket_messages WHERE ticket_id = ? AND seller_id = ? ORDER BY id', t.id, ctx.sellerId), can_reply: t.status !== 'closed', can_close: t.status !== 'closed', can_reopen: ['resolved', 'closed'].includes(t.status), _id: t.id };
}
route('GET', '/api/support/tickets/:code', { perm: 'support.use' }, (ctx) => { const d = ticketDetail(ctx, ctx.params.code); delete d._id; return d; });
route('POST', '/api/support/tickets/:code/replies', { perm: 'support.use' }, (ctx) => {
  const d = ticketDetail(ctx, ctx.params.code);
  if (d.ticket.status === 'closed') throw conflict('This ticket is closed. Reopen it to reply.');
  const data = validate(ctx.body, { body: { required: true, min: 2, max: 3000, label: 'Reply' } });
  tx(() => {
    insert('ticket_messages', { seller_id: ctx.sellerId, ticket_id: d._id, author_type: 'seller', author_name: ctx.user.name, body: data.body, created_at: nowIso() });
    // A seller reply hands the ticket back to the support team.
    const next = ['waiting_for_seller', 'resolved'].includes(d.ticket.status) ? 'in_progress' : d.ticket.status;
    run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ? AND seller_id = ?', next, nowIso(), d._id, ctx.sellerId);
  });
  const fresh = ticketDetail(ctx, ctx.params.code); delete fresh._id;
  return { ...fresh, message: 'Reply added.' };
});
route('POST', '/api/support/tickets/:code/status', { perm: 'support.use' }, (ctx) => {
  const d = ticketDetail(ctx, ctx.params.code);
  const action = ctx.body.action;
  let next;
  if (action === 'close') { if (d.ticket.status === 'closed') throw conflict('This ticket is already closed.'); next = 'closed'; }
  else if (action === 'reopen') { if (!['resolved', 'closed'].includes(d.ticket.status)) throw conflict('Only resolved or closed tickets can be reopened.'); next = 'open'; }
  else throw bad('Unknown ticket action.');
  tx(() => {
    run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ? AND seller_id = ?', next, nowIso(), d._id, ctx.sellerId);
    insert('ticket_messages', { seller_id: ctx.sellerId, ticket_id: d._id, author_type: 'system', author_name: 'System', body: next === 'closed' ? `Ticket closed by ${ctx.user.name}.` : `Ticket reopened by ${ctx.user.name}.`, created_at: nowIso() });
    logActivity(ctx, next === 'closed' ? 'Closed support ticket' : 'Reopened support ticket', 'support', d.ticket.code);
  });
  const fresh = ticketDetail(ctx, ctx.params.code); delete fresh._id;
  return { ...fresh, message: next === 'closed' ? 'Ticket closed.' : 'Ticket reopened.' };
});

/* ---------- Learning progress ---------- */
route('GET', '/api/learning/progress', { auth: 'session' }, (ctx) => {
  const rows = all('SELECT lesson_id, completed_at, bookmarked FROM learning_progress WHERE user_id = ?', ctx.user.id);
  return { completed: rows.filter((r) => r.completed_at).map((r) => r.lesson_id), bookmarked: rows.filter((r) => r.bookmarked).map((r) => r.lesson_id) };
});
route('POST', '/api/learning/progress', { auth: 'session' }, (ctx) => {
  const data = validate(ctx.body, { lesson_id: { required: true, max: 80 }, completed: { type: 'bool' }, bookmarked: { type: 'bool' } }, { partial: true });
  if (!/^[a-z0-9-]{3,80}$/.test(data.lesson_id || '')) throw bad('Unknown lesson.');
  run('INSERT OR IGNORE INTO learning_progress (user_id, lesson_id) VALUES (?, ?)', ctx.user.id, data.lesson_id);
  if (data.completed !== undefined) run('UPDATE learning_progress SET completed_at = ? WHERE user_id = ? AND lesson_id = ?', data.completed ? nowIso() : null, ctx.user.id, data.lesson_id);
  if (data.bookmarked !== undefined) run('UPDATE learning_progress SET bookmarked = ? WHERE user_id = ? AND lesson_id = ?', data.bookmarked ? 1 : 0, ctx.user.id, data.lesson_id);
  const rows = all('SELECT lesson_id, completed_at, bookmarked FROM learning_progress WHERE user_id = ?', ctx.user.id);
  return { completed: rows.filter((r) => r.completed_at).map((r) => r.lesson_id), bookmarked: rows.filter((r) => r.bookmarked).map((r) => r.lesson_id) };
});

module.exports = { SELLER_STATUS, TICKET_CATEGORIES, TICKET_STATUS, onboardingState, HttpError };
