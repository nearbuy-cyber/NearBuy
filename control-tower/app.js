// Routely Control Tower — operations, verification, zones, finance and support for the delivery network.
import { h, mount, api, act, money, dt, day, clock, ago, pct, val, title, badge, statusBadge, demoTag, spinner, empty, note, stat, card, kv, btn, brand, table, timeline, tabs, pager, toast, modal, form, formModal, confirmModal, currentRoute, go, onRoute, live, plot, plotLegend } from '/delivery/kit.js';

const root = document.getElementById('app');
const S = { me: null, refresh: null, publicConfig: null };
const NAV = [['/', 'Dashboard'], ['/map', 'Live map'], ['/deliveries', 'Deliveries'], ['/partners', 'Partners'], ['/zones', 'Zones & pricing'], ['/finance', 'Finance'], ['/support', 'Support'], ['/reports', 'Reports'], ['/fleets', 'Fleets'], ['/audit', 'Audit log']];
const qs = (o) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')); const s = p.toString(); return s ? `?${s}` : ''; };

function shell(active, heading, actions, ...body) {
  mount(root, h('div', { class: 'desk' },
    h('aside', { class: 'side' }, brand('Control tower'), NAV.map(([path, label]) => h('a', { class: 'nav', href: `#${path}`, 'aria-current': active === path ? 'page' : null }, label, path === '/' && S.me.unread ? h('span', { class: 'pill' }, S.me.unread) : null)),
      h('div', { class: 'foot' }, h('span', null, S.me.user.name), h('button', { type: 'button', onclick: async () => { await api('/api/tower/logout', { method: 'POST' }).catch(() => {}); S.me = null; render(); } }, 'Sign out'))),
    h('main', { class: 'main stack' }, h('div', { class: 'head' }, h('h1', null, heading), h('div', { class: 'row' }, actions)), ...body)));
}
const busy = (active, heading) => shell(active, heading, null, spinner());
const oops = (active, heading, e, retry) => shell(active, heading, null, h('div', { class: 'card bad stack' }, h('p', null, e.message), btn('Try again', retry)));
async function page(active, heading, load, draw, silent) {
  if (!silent) busy(active, heading);
  const at = location.hash;
  try { const data = await load(); if (location.hash !== at) return; draw(data); } catch (e) { if (e.status === 401) { S.me = null; return render(); } if (!silent) oops(active, heading, e, () => page(active, heading, load, draw)); }
  return undefined;
}

/* ---------- Sign in ---------- */
async function pageLogin() {
  if (!S.publicConfig) S.publicConfig = await api('/api/delivery/public-config').catch(() => ({}));
  const demo = S.publicConfig.demo;
  const f = form([{ name: 'email', label: 'Work email', type: 'email', required: true, autocomplete: 'username' }, { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }],
    { submit: 'Sign in', onSubmit: async (v) => { await api('/api/tower/login', { method: 'POST', body: v }); await boot(); } });
  mount(root, h('div', { class: 'auth' }, h('div', { class: 'panel stack' }, brand('Control tower'), h('div', { class: 'card stack' }, h('h1', null, 'Operations sign in'), h('p', { class: 'muted' }, 'For authorised operations and verification staff only. Every action is recorded.'), f,
    demo ? h('div', { class: 'note test stack tight' }, h('div', null, h('strong', null, 'TEST ENVIRONMENT · '), 'A sample administrator (demo data) is available.'), btn('Fill demo administrator sign-in', () => { f.controls.email.value = demo.admin.email; f.controls.password.value = demo.admin.password; }, 'sm')) : null))));
}

/* ---------- Dashboard ---------- */
function pageDashboard(silent) {
  S.refresh = () => pageDashboard(true);
  return page('/', 'Dashboard', () => api('/api/admin/dashboard'), (d) => shell('/', 'Dashboard', h('span', { class: 'small muted' }, `Live · updated ${clock(new Date().toISOString())}`),
    h('div', { class: 'grid g4' }, stat('Deliveries today', d.today.total, `${d.today.completed} completed`), stat('Active now', d.active), stat('Waiting for a partner', d.pending_assignment), stat('Delayed', d.delayed, 'More than 10 min past ETA'),
      stat('Partners online', d.partners.online, `${d.partners.offline} offline`), stat('Applications to review', d.partners.pending_review), stat('Failed attempts today', d.today.failed_attempts), stat('Delivery fees today', money(d.today.fee_revenue)),
      stat('Average delivery time', val(d.week.average_delivery_minutes, ' min'), 'Last 7 days, from ready to delivered'), stat('Success rate', pct(d.week.success_rate), `${d.week.closed} closed in 7 days`), stat('Open settlements', d.settlements.open, `${money(d.settlements.partner_earnings_unsettled)} partner earnings`), stat('Cash with partners', money(d.settlements.cod_with_partners))),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/deliveries?tab=unassigned' }, 'Unassigned deliveries'), h('a', { class: 'btn', href: '#/partners?tab=applications' }, 'Partner applications'), h('a', { class: 'btn', href: '#/support' }, `Open tickets (${d.open_tickets})`), d.open_incidents ? h('a', { class: 'btn danger', href: '#/support?view=incidents' }, `Open incidents (${d.open_incidents})`) : null),
    card(h('div', { class: 'row between' }, h('h2', null, 'Alerts'), S.me.unread ? btn('Mark all read', async (b) => { await act(b, () => api('/api/admin/notifications/read', { method: 'POST' })); S.me.unread = 0; pageDashboard(true); }, 'sm') : null),
      d.alerts.length ? h('ol', { class: 'tl' }, d.alerts.map((n) => h('li', null, h('div', { class: 't1' }, n.delivery_code ? h('a', { href: `#/deliveries/${n.delivery_code}` }, n.title) : n.title, n.read_at ? null : [' ', badge('New', 'info')]), h('div', { class: 't2' }, [ago(n.created_at), n.body].filter(Boolean).join(' · '))))) : empty('No alerts.'))), silent);
}

/* ---------- Live map ---------- */
function pageMap(silent) {
  S.refresh = () => pageMap(true);
  return page('/map', 'Live map', () => api('/api/admin/map'), (d) => {
    const pts = [];
    for (const x of d.deliveries) { pts.push({ lat: x.pickup.lat, lng: x.pickup.lng, kind: 'pickup', to: x.drop }); pts.push({ lat: x.drop.lat, lng: x.drop.lng, kind: 'drop', label: x.code }); }
    for (const p of d.partners) pts.push({ lat: p.lat, lng: p.lng, kind: p.delivery_code ? 'partner' : 'idle', label: `${p.name} ${p.code}` });
    for (const i of d.incidents) pts.push({ lat: i.lat, lng: i.lng, kind: 'incident', label: i.code });
    shell('/map', 'Live map', h('span', { class: 'small muted' }, `Updated ${clock(new Date().toISOString())} · this view is audited`),
      card(null, plot(pts, d.zones.map((z) => ({ lat: z.center_lat, lng: z.center_lng, km: z.radius_km, label: `${z.name}${z.status === 'active' ? '' : ' (suspended)'}`, off: z.status !== 'active' })), { height: 420 }), plotLegend(['pickup', 'drop', 'partner', 'idle', 'incident'])),
      h('div', { class: 'cols' }, card(`Open deliveries (${d.deliveries.length})`, table([{ label: 'Delivery', render: (x) => h('a', { href: `#/deliveries/${x.code}` }, x.code) }, { label: 'Status', render: (x) => statusBadge(x.status, x.status_label) }, { label: 'Route', render: (x) => `${x.pickup.name} → ${x.drop.area}` }, { label: 'Partner', render: (x) => (x.partner ? `${x.partner.first_name} ${x.partner.code || ''}` : '—') }, { label: 'ETA', render: (x) => (x.delayed ? badge(`Late · ${clock(x.eta_at)}`, 'bad') : clock(x.eta_at)) }], d.deliveries, { emptyText: 'No open deliveries.', onRow: (x) => go(`/deliveries/${x.code}`) })),
        card(`Partners online (${d.partners.length})`, table([{ label: 'Partner', render: (p) => h('a', { href: `#/partners/${p.code}` }, `${p.name} · ${p.code}`) }, { label: 'On', render: (p) => p.delivery_code || 'Idle' }, { label: 'Location', render: (p) => ago(p.at) }], d.partners, { emptyText: 'No partner is online with a recent location.' }))));
  }, silent);
}

/* ---------- Deliveries ---------- */
function testOrderModal(done) {
  api('/api/admin/test-orders/options').then((o) => {
    const quoteBox = h('div');
    const f = form([
      { name: 'seller_code', label: 'Seller', type: 'select', required: true, options: o.sellers.map((s) => [s.code, `${s.store_name} (${s.code})`]) },
      { name: 'category', label: 'Delivery category', type: 'select', required: true, options: Object.entries(o.categories) }, { name: 'payment', label: 'Payment', type: 'select', required: true, options: [['prepaid', 'Prepaid'], ['cod', 'Cash on delivery']] },
      { name: 'method', label: 'Delivery method', type: 'select', options: [['immediate', 'Immediate'], ['scheduled', 'Scheduled slot']] }, { name: 'scheduled_for', label: 'Scheduled for', type: 'datetime-local', hint: 'Only for a scheduled delivery.' },
      { name: 'address', label: 'Delivery address', hint: `Leave empty to use a sample address. Serviceable PIN codes come from the zone, e.g. ${o.sample_addresses.slice(0, 3).map((a) => a.pincode).join(', ')}.` }, { name: 'pincode', label: 'PIN code', max: 6, inputmode: 'numeric' },
      { name: 'special_handling', type: 'checkbox', label: 'Special handling (fragile)' }, { el: quoteBox },
    ], { submit: 'Create test order', intro: note('TEST TOOL: creates an order flagged as test data from the seller\'s real stock. There is no customer checkout on this site yet, so this is how a delivery starts in a test environment.', 'test'),
      onSubmit: async (v) => { const body = { ...v, scheduled_for: v.scheduled_for ? new Date(v.scheduled_for).toISOString() : undefined }; const r = await api('/api/admin/test-orders', { method: 'POST', body }); close(); toast(r.message || `Created ${r.delivery_code}.`, 'ok'); done(r); } });
    const close = modal('Create a test order', h('div', { class: 'stack' }, f, btn('Show the delivery fee first', async (b) => { const v = f.values(); const q = await act(b, () => api('/api/admin/test-orders/quote', { method: 'POST', body: { ...v, scheduled_for: v.scheduled_for ? new Date(v.scheduled_for).toISOString() : undefined } })); if (q) mount(quoteBox, note(`${q.zone} · ${q.distance_km} km · customer pays ${money(q.fee.total)} · about ${q.estimated_minutes} min`, 'ok')); }, 'sm')));
  }).catch((e) => toast(e.message, 'bad'));
}
function pageDeliveries(silent) {
  const q = currentRoute().query; const tab = q.tab || 'all';
  S.refresh = () => pageDeliveries(true);
  const nav = (o) => go(`/deliveries${qs({ ...q, ...o })}`);
  return page('/deliveries', 'Deliveries', () => api('/api/admin/deliveries', { query: { tab, q: q.q, zone: q.zone, category: q.category, page: q.page } }), (d) => {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search delivery, order, partner or area', value: q.q || '', 'aria-label': 'Search deliveries', style: 'max-width:320px' });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') nav({ q: search.value.trim(), page: undefined }); });
    const sel = (name, options, label) => { const s = h('select', { class: 'input', 'aria-label': label, style: 'max-width:200px' }, options.map(([v, l]) => h('option', { value: v, selected: String(q[name] || '') === String(v) }, l))); s.addEventListener('change', () => nav({ [name]: s.value, page: undefined })); return s; };
    shell('/deliveries', 'Deliveries', S.me.test_tools ? btn('Create test order', () => testOrderModal((r) => go(`/deliveries/${r.delivery_code}`)), 'primary') : null,
      tabs([['all', 'All'], ['unassigned', 'Unassigned'], ['active', 'Active'], ['delayed', 'Delayed'], ['failed', 'Failed'], ['returns', 'Returns'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']].map(([k, l]) => [k, l, d.counts[k]]).concat([['reverse', 'Return pickups']]), tab, (k) => go(`/deliveries${qs({ tab: k })}`)),
      h('div', { class: 'row' }, search, sel('zone', [['', 'All zones'], ...d.zones.map((z) => [z.id, z.name])], 'Zone'), sel('category', [['', 'All categories'], ...Object.entries(S.me.categories)], 'Category')),
      table([{ label: 'Delivery', render: (x) => h('div', null, h('strong', null, x.code), ' ', demoTag(x.is_demo), h('div', { class: 'small muted' }, `${x.order_code} · ${x.category_label}${x.kind === 'return' ? ' · return pickup' : ''}`)) },
        { label: 'Status', render: (x) => h('div', null, statusBadge(x.status, x.status_label), x.delayed ? [' ', badge('Late', 'bad')] : null, x.failed_assignments ? h('div', { class: 'tiny muted' }, `${x.failed_assignments} failed offers`) : null) },
        { label: 'Route', render: (x) => h('div', null, x.pickup.name, h('div', { class: 'small muted' }, `→ ${x.drop.area} · ${x.distance_km} km`)) }, { label: 'Partner', render: (x) => (x.partner ? `${x.partner.first_name}${x.partner.code ? ` · ${x.partner.code}` : ' (third party)'}` : '—') },
        { label: 'Payment', render: (x) => (x.payment_type === 'cod' ? `COD ${money(x.cod_amount)}` : 'Prepaid') }, { label: 'Created', render: (x) => dt(x.created_at) }], d.rows, { emptyText: 'No deliveries match.', onRow: (x) => go(`/deliveries/${x.code}`) }),
      pager(d, (p) => nav({ page: p })));
  }, silent);
}
function assignModal(d, mode, done) {
  api(`/api/admin/deliveries/${d.code}/candidates`).then(({ candidates }) => {
    const reason = h('input', { class: 'input', placeholder: 'Reason (recorded in the audit log)', 'aria-label': 'Reason' });
    const close = modal(mode === 'assign' ? `Assign ${d.code}` : `Reassign ${d.code}`, h('div', { class: 'stack' },
      h('p', { class: 'small muted' }, 'Partners in this zone, best match first. The score combines time to pickup (40%), distance (15%), fair share of work (30%) and vehicle fit (15%).'), reason,
      table([{ label: 'Partner', render: (c) => h('div', null, h('strong', null, c.name), h('div', { class: 'small muted' }, `${c.code} · ${c.vehicle || 'no vehicle'}`)) }, { label: 'State', render: (c) => (c.eligible ? badge(c.online ? 'Eligible · online' : 'Eligible', 'ok') : h('div', null, badge('Not eligible', 'bad'), h('div', { class: 'tiny muted' }, c.reasons.join(' ')))) },
        { label: 'Match', render: (c) => (c.score === null ? '—' : h('div', null, h('strong', null, Math.round(c.score * 100)), h('div', { class: 'tiny muted' }, `${c.pickup_km} km · ${c.pickup_eta_min} min to pickup`))) },
        { label: '', render: (c) => (c.eligible ? btn('Assign', async (b) => { const r = await act(b, () => api(`/api/admin/deliveries/${d.code}/${mode}`, { method: 'POST', body: { partner_code: c.code, reason: reason.value.trim() } }), `Assigned to ${c.name}.`); if (r) { close(); done(); } }, 'sm primary') : null) }], candidates, { emptyText: 'No approved partner serves this zone.' }),
      mode === 'reassign' ? btn('Remove partner and send back to automatic dispatch', async (b) => { const r = await act(b, () => api(`/api/admin/deliveries/${d.code}/reassign`, { method: 'POST', body: { reason: reason.value.trim() } }), 'Sent back to dispatch.'); if (r) { close(); done(); } }) : null), { wide: true });
  }).catch((e) => toast(e.message, 'bad'));
}
function pageDelivery(code, silent) {
  S.refresh = () => pageDelivery(code, true);
  const again = () => pageDelivery(code, true);
  return page('/deliveries', `Delivery ${code}`, () => api(`/api/admin/deliveries/${code}`), ({ delivery: d }) => {
    const unassigned = ['awaiting_assignment', 'searching_partner', 'offer_sent', 'reassignment_required'].includes(d.status);
    const beforePickup = ['partner_assigned', 'en_route_to_pickup', 'arrived_at_pickup', 'pickup_verification_pending'].includes(d.status);
    const final = ['delivered', 'returned_to_seller', 'cancelled'].includes(d.status);
    const third = d.partner && d.partner.third_party;
    const actions = [
      unassigned && !third ? btn('Assign partner', () => assignModal(d, 'assign', again), 'primary') : null,
      beforePickup && !third ? btn('Reassign', () => assignModal(d, 'reassign', again)) : null,
      unassigned && !third ? btn('Use third-party logistics', () => formModal('Hand to a third-party logistics company', [{ name: 'name', label: 'Logistics company', required: true }, { name: 'reference', label: 'Booking reference', required: true }, { name: 'reason', label: 'Reason', required: true }],
        { submit: 'Record booking', intro: 'No logistics provider is integrated. Book the pickup with the company yourself, record it here, and update its progress manually.', onSubmit: async (v) => { await api(`/api/admin/deliveries/${code}/third-party`, { method: 'POST', body: v }); again(); } })) : null,
      third && !final ? btn('Update third-party progress', () => formModal('Third-party progress', [{ name: 'step', label: 'Step', type: 'select', required: true, options: [['picked_up', 'Picked up from seller'], ['delivered', 'Delivered to customer']] }, { name: 'code', label: 'Verification code', required: true, hint: 'Pickup PIN from the seller, or delivery code from the customer.' }, { name: 'note', label: 'Note' }],
        { submit: 'Record', onSubmit: async (v) => { await api(`/api/admin/deliveries/${code}/third-party-update`, { method: 'POST', body: v }); again(); } })) : null,
      d.status === 'delivery_attempt_failed' ? btn('Decide: retry or return', () => formModal('Failed delivery attempt', [{ name: 'decision', label: 'Decision', type: 'select', required: true, options: [['reattempt', 'Try the delivery again'], ['return', 'Return the package to the seller']] }, { name: 'note', label: 'Note for the partner' }],
        { submit: 'Confirm decision', intro: `Reported by the partner: ${d.failure_reason}`, onSubmit: async (v) => { await api(`/api/admin/deliveries/${code}/resolve-failed`, { method: 'POST', body: v }); again(); } }), 'primary') : null,
      (unassigned || beforePickup) ? btn('Cancel delivery', () => formModal('Cancel this delivery', [{ name: 'reason', label: 'Reason', type: 'textarea', required: true, max: 200 }], { submit: 'Cancel delivery', danger: true, intro: 'The order is cancelled too, and the seller and customer are notified.', onSubmit: async (v) => { await api(`/api/admin/deliveries/${code}/cancel`, { method: 'POST', body: v }); again(); } }), 'danger') : null,
    ];
    const pts = [{ lat: d.pickup.lat, lng: d.pickup.lng, kind: 'pickup', label: 'Pickup', to: d.drop }, { lat: d.drop.lat, lng: d.drop.lng, kind: 'drop', label: 'Drop' }, d.partner_location ? { lat: d.partner_location.lat, lng: d.partner_location.lng, kind: 'partner', label: d.partner.first_name } : null];
    const fb = d.fee_breakdown; const eb = d.earning_breakdown;
    shell('/deliveries', `Delivery ${d.code}`, actions,
      h('div', { class: 'row' }, statusBadge(d.status, d.status_label), demoTag(d.is_demo), d.delayed ? badge('Late', 'bad') : null, badge(d.category_label, 'info'), d.kind === 'return' ? badge('Return pickup', 'warn') : null, h('a', { href: '#/deliveries', class: 'small' }, '← All deliveries'),
        d.track_url ? h('a', { class: 'small', href: d.track_url, target: '_blank', rel: 'noopener' }, 'Open customer tracking page (test)') : null),
      h('div', { class: 'cols' },
        h('div', { class: 'stack' },
          card('Route and live position', plot(pts), plotLegend(), kv([['Pickup', `${d.pickup.name} — ${d.pickup.address}`], ['Drop', `${d.drop.name || ''} — ${d.drop.address}`], ['Customer phone', d.drop.phone_masked], ['Instructions', d.drop.instructions], ['Distance', `${d.distance_km} km`], ['ETA', d.eta_at ? dt(d.eta_at) : null], ['Partner location', d.partner_location ? `Updated ${ago(d.partner_location.at)}${d.partner_location.stale ? ' (stale)' : ''}` : null]])),
          card('Timeline — every status change with time and actor', timeline(d.timeline)),
          card('Dispatch record', h('h3', null, 'Offers'), table([{ label: 'Partner', key: 'partner_code' }, { label: 'Result', render: (o) => h('div', null, statusBadge(o.status), o.decline_reason ? h('div', { class: 'tiny muted' }, o.decline_reason) : null) }, { label: 'Score', render: (o) => Math.round(o.score * 100) }, { label: 'To pickup', render: (o) => `${o.pickup_distance_km} km · ${Math.round(o.pickup_eta_min)} min` }, { label: 'Sent', render: (o) => dt(o.created_at) }], d.offers, { emptyText: 'No offers were sent.' }),
            h('h3', null, 'Assignments'), table([{ label: 'Partner', render: (a) => a.partner_code || 'Third party' }, { label: 'Mode', render: (a) => title(a.mode) }, { label: 'By', render: (a) => h('div', null, a.assigned_by || 'Dispatch engine', a.reason ? h('div', { class: 'tiny muted' }, a.reason) : null) }, { label: 'From', render: (a) => dt(a.assigned_at) }, { label: 'Ended', render: (a) => (a.active ? badge('Current', 'ok') : `${dt(a.ended_at)} · ${a.end_reason || ''}`) }], d.assignments, { emptyText: 'Not assigned yet.' }))),
        h('div', { class: 'stack' },
          card('Summary', kv([['Order', d.order_code], ['Seller', d.seller], ['Partner', d.partner ? (d.partner.code ? h('a', { href: `#/partners/${d.partner.code}` }, `${d.partner.first_name} · ${d.partner.code}`) : `${d.partner.first_name} · ref ${d.partner.reference}`) : 'Not assigned'], ['Package', `${d.package_count} × ${d.package_type}`], ['Method', d.method === 'scheduled' ? `Scheduled · ${dt(d.scheduled_for)}` : 'Immediate'], ['Payment', d.payment_type === 'cod' ? `Cash on delivery · ${money(d.cod_amount)}` : 'Prepaid'], ['Ready at', d.ready_at ? dt(d.ready_at) : 'Not ready yet'], ['Attempts', d.attempt_count], ['Customer rating', d.rating ? `${d.rating} ★` : null], ['Failure reason', d.failure_reason], ['Cancel reason', d.cancel_reason]]),
            h('div', { class: 'small' }, 'Items: ', d.items.map((i) => `${i.qty} × ${i.title}`).join(', ') || '—')),
          card('Money', kv([['Customer delivery fee', money(d.customer_fee)], fb ? ['Fee make-up', `base ${money(fb.base)} + distance ${money(fb.distance)}${fb.scheduled ? ` + slot ${money(fb.scheduled)}` : ''}${fb.handling ? ` + handling ${money(fb.handling)}` : ''} + tax ${money(fb.tax)}`] : null, ['Partner earning', money(d.partner_earning)], eb ? ['Earning make-up', `base ${money(eb.base)} + distance ${money(eb.distance)}${eb.incentive ? ` + incentive ${money(eb.incentive)}` : ''}`] : null,
            ['Settlement', d.settlement ? statusBadge(d.settlement.state) : 'Created on completion'], d.settlement ? ['Earning', title(d.settlement.earning_state)] : null, d.settlement && d.settlement.cod_state !== 'not_applicable' ? ['Cash', title(d.settlement.cod_state)] : null, d.settlement && d.settlement.reconciled_at ? ['Reconciled', dt(d.settlement.reconciled_at)] : null]),
            d.cod.length ? table([{ label: 'Cash record', key: 'code' }, { label: 'Type', render: (c) => title(c.type) }, { label: 'Status', render: (c) => statusBadge(c.status) }, { label: 'Amount', right: true, render: (c) => money(c.amount) }], d.cod) : null),
          card('Verification', h('h3', null, 'Pickup'), d.pickup_confirmations.length ? d.pickup_confirmations.map((p) => h('div', { class: 'small' }, `${title(p.method)} · ${p.package_count} package(s) · ${p.confirmed_by} · ${dt(p.created_at)}`)) : h('div', { class: 'small muted' }, 'Not verified yet.'),
            h('h3', null, 'Delivery proof'), d.proofs.length ? d.proofs.map((p) => h('div', { class: 'row between small' }, h('span', null, `${title(p.method)}${p.recipient_name ? ` · ${p.recipient_name}` : ''} · ${p.note || ''} · ${dt(p.created_at)}`),
              p.has_file ? btn('View photo', async (b) => { const r = await act(b, () => api(`/api/admin/files/proof/${p.id}/link`, { method: 'POST' })); if (r) window.open(r.url, '_blank', 'noopener'); }, 'sm') : null)) : h('div', { class: 'small muted' }, 'No proof submitted yet.')),
          card('ETA records', d.eta_records.length ? h('div', { class: 'stack tight small' }, d.eta_records.map((e) => h('div', null, `${clock(e.created_at)} → ETA ${clock(e.eta_at)} (${Math.round(e.minutes)} min) · ${e.basis}`))) : empty('No ETA calculated yet.')))));
  }, silent);
}

/* ---------- Partners ---------- */
function pagePartners(silent) {
  const q = currentRoute().query; const tab = q.tab || 'all';
  S.refresh = () => pagePartners(true);
  return page('/partners', 'Delivery partners', () => api('/api/admin/partners', { query: { tab, q: q.q, page: q.page } }), (d) => {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search name, partner ID, mobile or city', value: q.q || '', 'aria-label': 'Search partners', style: 'max-width:320px' });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(`/partners${qs({ tab, q: search.value.trim() })}`); });
    shell('/partners', 'Delivery partners', null,
      tabs([['all', 'All', d.counts.all], ['applications', 'To review', d.counts.applications], ['online', 'Online', d.counts.online], ['approved', 'Approved', d.counts.approved || 0], ['info_required', 'Info required', d.counts.info_required || 0], ['draft', 'Draft', d.counts.draft || 0], ['suspended', 'Suspended', d.counts.suspended || 0], ['rejected', 'Rejected', d.counts.rejected || 0], ['expired', 'Expired', d.counts.expired || 0]], tab, (k) => go(`/partners${qs({ tab: k })}`)), search,
      table([{ label: 'Partner', render: (p) => h('div', null, h('strong', null, p.name), ' ', demoTag(p.is_demo), h('div', { class: 'small muted' }, `${p.code} · ${p.mobile_masked}`)) }, { label: 'Status', render: (p) => h('div', null, statusBadge(p.status, p.status_label), p.online ? [' ', badge('Online', 'ok')] : null) },
        { label: 'Vehicle', key: 'vehicle' }, { label: 'City', key: 'city' }, { label: 'Fleet', render: (p) => (p.fleet ? p.fleet.name : 'Individual') }, { label: 'Rating', render: (p) => (p.rating ? `${p.rating} ★` : '—') }, { label: 'Submitted', render: (p) => (p.submitted_at ? day(p.submitted_at) : '—') }], d.rows, { emptyText: 'No partners match.', onRow: (p) => go(`/partners/${p.code}`) }),
      pager(d, (p) => go(`/partners${qs({ ...q, page: p })}`)));
  }, silent);
}
function pagePartner(code, silent) {
  S.refresh = () => pagePartner(code, true);
  const again = () => pagePartner(code, true);
  const post = (path, body, done, method = 'POST') => async (b) => { const r = await act(b, () => api(`/api/admin/partners/${code}/${path}`, { method, body }), done); if (r) again(); };
  const decide = (decision, label, needNote, extra = []) => () => formModal(label, [...extra, { name: 'note', label: needNote ? 'Reason shown to the partner' : 'Note for the partner', type: 'textarea', required: needNote, max: 500 }],
    { submit: label, danger: ['reject', 'suspend'].includes(decision), onSubmit: async (v) => { await api(`/api/admin/partners/${code}/approval`, { method: 'PATCH', body: { decision, ...v } }); toast('Decision recorded.', 'ok'); again(); } });
  return page('/partners', `Partner ${code}`, () => api(`/api/admin/partners/${code}`), ({ partner: p }) => {
    const st = p.status;
    const actions = [
      st === 'submitted' ? btn('Start review', post('approval', { decision: 'under_review' }, 'Marked under review.', 'PATCH')) : null,
      ['submitted', 'under_review'].includes(st) ? btn('Approve', decide('approve', 'Approve partner', false, [{ name: 'documents_valid_until', label: 'Documents valid until', type: 'date', hint: 'The account expires on this date until documents are renewed.' }]), 'primary') : null,
      ['submitted', 'under_review'].includes(st) ? btn('Ask for more information', decide('info_required', 'Request more information', true)) : null,
      ['submitted', 'under_review', 'info_required'].includes(st) ? btn('Reject', decide('reject', 'Reject application', true), 'danger') : null,
      st === 'approved' ? btn('Suspend', decide('suspend', 'Suspend partner', true), 'danger') : null,
      ['suspended', 'expired'].includes(st) ? btn('Reinstate', decide('reinstate', 'Reinstate partner', false), 'primary') : null,
    ];
    const review = (path, body) => async (b) => { const r = await act(b, () => api(`/api/admin/partners/${code}/${path}`, { method: 'POST', body })); if (r) again(); };
    shell('/partners', `${p.name} · ${p.code}`, actions,
      h('div', { class: 'row' }, statusBadge(st, p.status_label), demoTag(p.is_demo), p.online ? badge('Online', 'ok') : badge('Offline'), p.fleet_hold ? badge('Fleet hold', 'warn') : null, h('a', { class: 'small', href: '#/partners' }, '← All partners')),
      p.status_note ? note(p.status_note, st === 'approved' ? '' : 'warn') : null,
      h('div', { class: 'cols' },
        h('div', { class: 'stack' },
          card('Application checklist', p.checklist.map((c) => h('div', { class: 'row between' }, h('span', null, c.label), c.done ? badge('Complete', 'ok') : badge(c.hint || 'Incomplete', 'warn')))),
          card('Documents — private, opened through a 5-minute link, each view is audited', p.required_documents.map((k) => {
            const doc = p.documents.find((x) => x.kind === k);
            if (!doc) return h('div', { class: 'row between' }, h('span', null, S.me.document_kinds[k]), badge('Not uploaded', 'bad'));
            return h('div', { class: 'card flat stack tight' }, h('div', { class: 'row between' }, h('strong', null, doc.kind_label), statusBadge(doc.status)), h('div', { class: 'small muted' }, `${doc.file_name || 'file'} · ${Math.round(doc.size / 1024)} KB · uploaded ${dt(doc.uploaded_at)}${doc.reviewed_by ? ` · checked by ${doc.reviewed_by}` : ''}${doc.note ? ` · ${doc.note}` : ''}`),
              h('div', { class: 'row' }, btn('Open document', async (b) => { const r = await act(b, () => api(`/api/admin/partners/${code}/documents/${doc.id}/link`, { method: 'POST' })); if (r) window.open(r.url, '_blank', 'noopener'); }, 'sm'),
                doc.status !== 'verified' ? btn('Mark verified', review(`documents/${doc.id}/review`, { decision: 'verified' }), 'sm primary') : null,
                doc.status !== 'rejected' ? btn('Reject', () => formModal(`Reject ${doc.kind_label}`, [{ name: 'note', label: 'What is wrong with it?', required: true }], { submit: 'Reject document', danger: true, onSubmit: async (v) => { await api(`/api/admin/partners/${code}/documents/${doc.id}/review`, { method: 'POST', body: { decision: 'rejected', ...v } }); again(); } }), 'sm danger') : null));
          })),
          card('Recent deliveries', table([{ label: 'Delivery', render: (x) => h('a', { href: `#/deliveries/${x.code}` }, x.code) }, { label: 'Status', render: (x) => statusBadge(x.status, x.status_label) }, { label: 'Category', render: (x) => S.me.categories[x.category] }, { label: 'Date', render: (x) => dt(x.completed_at || x.created_at) }, { label: 'Earning', right: true, render: (x) => money(x.partner_earning) }], p.recent_deliveries, { emptyText: 'No deliveries yet.' })),
          card('Application history', timeline(p.history.map((x) => ({ label: x.label, created_at: x.created_at, actor: x.actor, note: x.note }))))),
        h('div', { class: 'stack' },
          card('Profile', kv([['Mobile', `${p.mobile} ${p.mobile_verified ? '✓ verified' : '(not verified)'}`], ['Email', `${p.email} ${p.email_verified ? '✓ verified' : '(not verified)'}`], ['City', p.city], ['Language', p.language], ['Zones', p.zones.map((z) => z.name).join(', ')], ['Emergency contact', p.emergency_name ? `${p.emergency_name} · ${p.emergency_phone_masked}` : null], ['Training', p.training_completed_at ? `Completed ${day(p.training_completed_at)}` : 'Not completed'], ['Documents valid until', p.documents_valid_until ? day(p.documents_valid_until) : null], ['Rating', p.rating ? `${p.rating} ★` : null], ['Last location', p.last_location_at ? ago(p.last_location_at) : null]])),
          card('Vehicle', p.vehicle ? [kv([['Type', p.vehicle.label], ['Registration', p.vehicle.registration_no], ['Ownership', title(p.vehicle.ownership)], ['Record', statusBadge(p.vehicle.status)]]), h('div', { class: 'row' }, p.vehicle.status !== 'verified' ? btn('Verify vehicle', review('vehicle-review', { decision: 'verified' }), 'sm primary') : null, p.vehicle.status !== 'rejected' ? btn('Reject vehicle', review('vehicle-review', { decision: 'rejected' }), 'sm danger') : null)] : empty('No vehicle.')),
          card('Payout account', p.payout ? [kv([['Holder', p.payout.holder], ['Bank', p.payout.bank], ['Account', `•••• ${p.payout.account_ending}`], ['IFSC', p.payout.ifsc], ['Record', statusBadge(p.payout.status)]]), h('div', { class: 'row' }, p.payout.status !== 'verified' ? btn('Verify payout account', review('payout-review', { decision: 'verified' }), 'sm primary') : null, p.payout.status !== 'rejected' ? btn('Reject', review('payout-review', { decision: 'rejected' }), 'sm danger') : null)] : empty('No payout account.')),
          card('Wallet', kv([['Available', money(p.wallet.available)], ['Pending (cash orders)', money(p.wallet.pending)], ['In payout', money(p.wallet.in_payout)], ['Paid', money(p.wallet.paid)], ['Cash in hand', money(p.cash_in_hand)], ['Completed in 30 days', p.activity.completed_30d], ['Active delivery', p.activity.active ? h('a', { href: `#/deliveries/${p.activity.active}` }, p.activity.active) : 'None']]),
            btn('Add earning adjustment', () => adjustmentModal(p.code, again), 'sm')),
          card('Fleet', h('div', null, p.fleet ? `${p.fleet.name} (${p.fleet.code})` : 'Individual partner'), btn('Change fleet', async () => { const { fleets } = await api('/api/admin/fleets'); formModal('Change fleet', [{ name: 'fleet_code', label: 'Fleet', type: 'select', value: p.fleet ? p.fleet.code : '', options: [['', 'Individual (no fleet)'], ...fleets.map((f) => [f.code, f.name])] }], { submit: 'Save', onSubmit: async (v) => { await api(`/api/admin/partners/${code}/fleet`, { method: 'POST', body: { fleet_code: v.fleet_code || null } }); again(); } }); }, 'sm')),
          card('Availability log', p.activity.availability.length ? h('div', { class: 'stack tight small' }, p.activity.availability.map((a) => h('div', null, `${dt(a.created_at)} · ${a.online ? 'Online' : 'Offline'}${a.reason ? ` · ${a.reason}` : ''}`))) : empty('Never online.')))));
  }, silent);
}
function adjustmentModal(partnerCode, done) {
  formModal('Earning adjustment', [{ name: 'partner_code', label: 'Partner ID', required: true, value: partnerCode }, { name: 'amount', label: 'Amount (₹) — negative to deduct', type: 'number', required: true, step: '0.01' }, { name: 'delivery_code', label: 'Related delivery' }, { name: 'reason', label: 'Reason shown to the partner', required: true }],
    { submit: 'Post adjustment', intro: 'Adjustments are separate ledger entries; they never rewrite a delivery\'s original earning.', onSubmit: async (v) => { const r = await api('/api/admin/adjustments', { method: 'POST', body: v }); toast(`Adjustment ${r.code} posted.`, 'ok'); done(); } });
}

/* ---------- Zones ---------- */
const pinsToText = (pins) => pins.map((p) => `${p.pin}, ${p.area}, ${p.lat}, ${p.lng}`).join('\n');
const textToPins = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [pin, area, lat, lng] = l.split(',').map((x) => x.trim()); return { pin, area, lat: Number(lat), lng: Number(lng) }; });
function zoneForm(z, done) {
  formModal(z ? `Edit ${z.name}` : 'New delivery zone', [
    { name: 'name', label: 'Zone name', required: true, value: z && z.name }, { name: 'city', label: 'City', required: true, value: z && z.city },
    { name: 'center_lat', label: 'Centre latitude', type: 'number', step: 'any', required: true, value: z && z.center_lat }, { name: 'center_lng', label: 'Centre longitude', type: 'number', step: 'any', required: true, value: z && z.center_lng },
    { name: 'radius_km', label: 'Zone radius (km)', type: 'number', step: 'any', required: true, value: z ? z.radius_km : 6 }, { name: 'max_delivery_km', label: 'Maximum delivery distance (km)', type: 'number', step: 'any', required: true, value: z ? z.max_delivery_km : 7 },
    { name: 'open_time', label: 'Opens (24-hour)', required: true, value: z ? z.open_time : '07:00' }, { name: 'close_time', label: 'Closes (24-hour)', required: true, value: z ? z.close_time : '23:00' },
    { name: 'capacity_limit', label: 'Capacity: open deliveries allowed at once', type: 'number', required: true, value: z ? z.capacity_limit : 100 }, { name: 'demand_incentive', label: 'Demand incentive per delivery (₹)', type: 'number', step: '0.01', value: z ? z.demand_incentive : 0, hint: 'Added to partner earnings in this zone.' },
    { name: 'pins', label: 'Serviceable PIN codes', type: 'textarea', value: z ? pinsToText(z.pincodes) : '', hint: 'One per line: PIN, area name, latitude, longitude. No geocoding provider is connected, so addresses are located by their PIN code.' },
  ], { wide: true, submit: z ? 'Save zone' : 'Create zone', onSubmit: async (v) => { const { pins, ...rest } = v; const body = { ...rest, pincodes: textToPins(pins) }; if (z) await api(`/api/admin/zones/${z.code}`, { method: 'PATCH', body }); else await api('/api/admin/zones', { method: 'POST', body }); toast('Zone saved.', 'ok'); done(); } });
}
function pageZones(silent) {
  S.refresh = null;
  return page('/zones', 'Zones & pricing', () => api('/api/admin/zones'), (d) => shell('/zones', 'Zones & pricing', btn('New zone', () => zoneForm(null, () => pageZones(true)), 'primary'),
    card(null, plot([], d.zones.map((z) => ({ lat: z.center_lat, lng: z.center_lng, km: z.radius_km, label: z.name, off: z.status !== 'active' })), { height: 260 }), h('div', { class: 'legend' }, 'Zone circles drawn to scale from their centre and radius. No street map provider is connected.')),
    d.zones.map((z) => card(h('div', { class: 'row between' }, h('h2', null, `${z.name}, ${z.city} `, demoTag(z.is_demo)), h('div', { class: 'row' }, statusBadge(z.status, z.status === 'active' ? (z.open_now ? 'Active · open now' : 'Active · closed now') : 'Suspended'),
      btn('Edit', () => zoneForm(z, () => pageZones(true)), 'sm'),
      z.status === 'active' ? btn('Suspend service', () => formModal(`Suspend ${z.name}`, [{ name: 'status_note', label: 'Reason', required: true }], { submit: 'Suspend zone', danger: true, intro: 'New orders in this zone are refused until service resumes. Deliveries already in progress continue.', onSubmit: async (v) => { await api(`/api/admin/zones/${z.code}`, { method: 'PATCH', body: { status: 'suspended', ...v } }); pageZones(true); } }), 'sm danger')
        : btn('Resume service', async (b) => { const r = await act(b, () => api(`/api/admin/zones/${z.code}`, { method: 'PATCH', body: { status: 'active' } }), 'Service resumed.'); if (r) pageZones(true); }, 'sm primary'))),
    z.status_note ? note(z.status_note, 'warn') : null,
    h('div', { class: 'grid g4' }, stat('Hours', `${z.open_time}–${z.close_time}`), stat('Max delivery distance', `${z.max_delivery_km} km`, `Zone radius ${z.radius_km} km`), stat('Open deliveries', `${z.open_deliveries} / ${z.capacity_limit}`, 'Capacity limit'), stat('Partners', z.partners, `Demand incentive ${money(z.demand_incentive)}`)),
    h('div', { class: 'small muted' }, `PIN codes: ${z.pincodes.map((p) => `${p.pin} ${p.area}`).join(' · ') || 'none — no address can be served yet'}`),
    table([{ label: 'Category', render: (f) => h('strong', null, d.categories[f.category]) }, { label: 'Customer base fee', render: (f) => money(f.base_fee) }, { label: 'Included km', key: 'free_km' }, { label: 'Per extra km', render: (f) => money(f.per_km_fee) }, { label: 'Slot fee', render: (f) => money(f.scheduled_fee) }, { label: 'Handling fee', render: (f) => money(f.handling_fee) }, { label: 'Tax', render: (f) => `${f.tax_rate}%` }, { label: 'Partner base', render: (f) => money(f.partner_base) }, { label: 'Partner per km', render: (f) => money(f.partner_per_km) },
      { label: '', render: (f) => btn('Edit', () => formModal(`${d.categories[f.category]} pricing — ${z.name}`, [['base_fee', 'Customer base fee (₹)'], ['free_km', 'Distance included in base fee (km)'], ['per_km_fee', 'Fee per extra km (₹)'], ['scheduled_fee', 'Scheduled slot fee (₹)'], ['handling_fee', 'Special handling fee (₹)'], ['tax_rate', 'Tax rate (%)'], ['partner_base', 'Partner base earning (₹)'], ['partner_per_km', 'Partner earning per km (₹)']].map(([name, label]) => ({ name, label, type: 'number', step: '0.01', required: true, value: f[name] })),
        { submit: 'Save pricing', intro: 'Applies to new orders. Existing deliveries keep the fee and earning they were created with.', onSubmit: async (v) => { await api(`/api/admin/zones/${z.code}/fees/${f.category}`, { method: 'PUT', body: v }); toast('Pricing saved.', 'ok'); pageZones(true); } }), 'sm') }], z.fees)))), silent);
}

/* ---------- Finance ---------- */
function pageFinance(silent) {
  const range = currentRoute().query.range || '30d';
  S.refresh = () => pageFinance(true);
  const again = () => pageFinance(true);
  return page('/finance', 'Finance & settlements', () => api('/api/admin/finance', { query: { range } }), (d) => {
    const t = d.totals;
    shell('/finance', 'Finance & settlements', [btn('Add adjustment', () => adjustmentModal('', again)), h('a', { class: 'btn', href: `/api/admin/finance/reconciliation.csv?range=${range}`, download: '' }, 'Reconciliation CSV')],
      tabs([['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']], range, (k) => go(`/finance?range=${k}`)), note(d.integration_note),
      h('div', { class: 'grid g4' }, stat('Customer delivery fees', money(t.customer_fees), d.range.label), stat('Partner earnings', money(t.partner_earnings), d.range.label), stat('Adjustments', money(t.adjustments), d.range.label), stat('Payouts paid', money(t.payouts_paid), d.range.label),
        stat('Available to pay', money(t.available_to_pay), 'Now'), stat('Held for cash deposit', money(t.held_for_cash), 'Now'), stat('Cash with partners', money(t.cod_with_partners), 'Now'), stat('Settlements', `${d.settlements.reconciled || 0} reconciled`, `${d.settlements.open || 0} open`)),
      card('Partner payouts due', table([{ label: 'Partner', render: (p) => h('a', { href: `#/partners/${p.code}` }, `${p.name} · ${p.code}`) }, { label: 'Payout account', render: (p) => statusBadge(p.payout_status) }, { label: 'Available', right: true, render: (p) => money(p.available) },
        { label: '', render: (p) => btn('Create payout', async (b) => { const r = await act(b, () => api('/api/admin/payouts', { method: 'POST', body: { partner_code: p.code } })); if (r) { toast(`Payout ${r.code} for ${money(r.amount)} created.`, 'ok'); again(); } }, 'sm primary') }], d.payable, { emptyText: 'No partner has an available balance.' })),
      card('Payouts', table([{ label: 'Payout', render: (p) => h('div', null, h('strong', null, p.code), h('div', { class: 'small muted' }, `${p.partner_code} · ${dt(p.created_at)} · by ${p.created_by}`)) }, { label: 'Status', render: (p) => h('div', null, statusBadge(p.status), h('div', { class: 'small muted' }, p.status === 'paid' ? `Ref ${p.reference} · ${dt(p.settled_at)}` : p.failure_reason || '')) }, { label: 'Amount', right: true, render: (p) => money(p.amount) },
        { label: '', render: (p) => (p.status === 'processing' ? h('div', { class: 'row' }, btn('Mark paid', () => formModal(`Payout ${p.code}`, [{ name: 'reference', label: 'Bank reference of the transfer', required: true }], { submit: 'Mark paid', onSubmit: async (v) => { await api(`/api/admin/payouts/${p.code}/settle`, { method: 'POST', body: { status: 'paid', ...v } }); again(); } }), 'sm primary'),
          btn('Failed', () => formModal(`Payout ${p.code} failed`, [{ name: 'failure_reason', label: 'Why did it fail?', required: true }], { submit: 'Mark failed', danger: true, intro: 'The amount returns to the partner\'s available balance.', onSubmit: async (v) => { await api(`/api/admin/payouts/${p.code}/settle`, { method: 'POST', body: { status: 'failed', ...v } }); again(); } }), 'sm danger')) : null) }], d.payouts, { emptyText: 'No payouts yet.' })),
      card('Cash on delivery', d.outstanding_cod.length ? h('div', { class: 'note warn' }, 'Cash outstanding: ', d.outstanding_cod.map((p) => `${p.name} (${p.code}) ${money(p.cash_in_hand)}`).join(' · ')) : null,
        table([{ label: 'Record', render: (c) => h('div', null, h('strong', null, c.code), h('div', { class: 'small muted' }, `${title(c.type)} · ${c.partner_code}${c.delivery_code ? ` · ${c.delivery_code}` : ''} · ${dt(c.created_at)}`)) }, { label: 'How', render: (c) => h('div', null, title(c.method || ''), h('div', { class: 'small muted' }, [c.reference && `Ref ${c.reference}`, c.note].filter(Boolean).join(' · '))) }, { label: 'Status', render: (c) => h('div', null, statusBadge(c.status), c.confirmed_by ? h('div', { class: 'tiny muted' }, c.confirmed_by) : null) }, { label: 'Amount', right: true, render: (c) => money(c.amount) },
          { label: '', render: (c) => (c.status === 'pending' && (c.type === 'deposit' || c.method === 'upi') ? h('div', { class: 'row' }, btn('Confirm', async (b) => { const r = await act(b, () => api(`/api/admin/cod/${c.code}/review`, { method: 'POST', body: { decision: 'confirm' } }), 'Confirmed.'); if (r) again(); }, 'sm primary'),
            btn('Dispute', () => formModal(`Dispute ${c.code}`, [{ name: 'note', label: 'What does not match?', required: true }], { submit: 'Mark disputed', danger: true, onSubmit: async (v) => { await api(`/api/admin/cod/${c.code}/review`, { method: 'POST', body: { decision: 'dispute', ...v } }); again(); } }), 'sm danger')) : null) }], d.cod, { emptyText: 'No cash-on-delivery records.' })),
      card('Adjustments', table([{ label: 'Adjustment', render: (a) => h('div', null, h('strong', null, a.code), h('div', { class: 'small muted' }, `${a.partner_code}${a.delivery_code ? ` · ${a.delivery_code}` : ''} · ${dt(a.created_at)} · by ${a.created_by}`)) }, { label: 'Reason', key: 'reason' }, { label: 'Amount', right: true, render: (a) => money(a.amount) }], d.adjustments, { emptyText: 'No adjustments.' })));
  }, silent);
}

/* ---------- Support ---------- */
function pageSupport(parts, silent) {
  const q = currentRoute().query;
  S.refresh = () => pageSupport(parts, true);
  if (parts[1]) {
    const code = parts[1];
    return page('/support', `Ticket ${code}`, () => api(`/api/admin/tickets/${code}`), ({ ticket: t }) => shell('/support', `Ticket ${t.code}`, null,
      h('div', { class: 'row' }, statusBadge(t.status), t.priority === 'urgent' ? badge('Urgent', 'bad') : null, badge(`From ${t.raised_by}`, 'info'), badge(t.category_label), h('a', { class: 'small', href: '#/support' }, '← All tickets')),
      card(t.subject, h('p', null, t.description), kv([['Raised', dt(t.created_at)], ['Delivery', t.delivery_code ? h('a', { href: `#/deliveries/${t.delivery_code}` }, t.delivery_code) : null], ['Partner', t.partner_code ? h('a', { href: `#/partners/${t.partner_code}` }, t.partner_code) : null]]),
        t.has_evidence ? btn('Open evidence file', async (b) => { const r = await act(b, () => api(`/api/admin/files/evidence/${t.id}/link`, { method: 'POST' })); if (r) window.open(r.url, '_blank', 'noopener'); }, 'sm') : null),
      card('Conversation', t.messages.length ? t.messages.map((m) => h('div', { class: `note ${m.author_type === 'support' ? 'ok' : ''}` }, h('strong', null, `${m.author_name} (${m.author_type})`), ` · ${dt(m.created_at)}`, h('div', null, m.body))) : empty('No messages yet.'),
        form([{ name: 'body', label: 'Reply', type: 'textarea', required: true, max: 1500 }, { name: 'status', label: 'Set status', type: 'select', value: 'in_progress', options: [['in_progress', 'In progress'], ['resolved', 'Resolved'], ['open', 'Open']] }], { submit: 'Send reply', onSubmit: async (v) => { await api(`/api/admin/tickets/${code}/reply`, { method: 'POST', body: v }); toast('Reply sent.', 'ok'); pageSupport(parts, true); } }))), silent);
  }
  const view = q.view || 'tickets';
  const pick = tabs([['tickets', 'Tickets & complaints'], ['incidents', 'Safety incidents']], view, (k) => go(`/support${qs({ view: k })}`));
  if (view === 'incidents') return page('/support', 'Support', () => api('/api/admin/incidents'), (d) => shell('/support', 'Support', null, pick,
    table([{ label: 'Incident', render: (i) => h('div', null, h('strong', null, i.code), h('div', { class: 'small muted' }, `${title(i.type)} · ${dt(i.created_at)}`)) }, { label: 'Who', render: (i) => h('div', null, i.partner_code ? h('a', { href: `#/partners/${i.partner_code}` }, i.partner_code) : '—', i.delivery_code ? h('div', null, h('a', { href: `#/deliveries/${i.delivery_code}` }, i.delivery_code)) : null) },
      { label: 'Report', render: (i) => h('div', null, i.description, i.lat ? h('div', { class: 'small muted' }, `Last location ${i.lat.toFixed(4)}, ${i.lng.toFixed(4)}`) : null, i.resolution ? h('div', { class: 'small' }, `Resolution: ${i.resolution}`) : null) }, { label: 'Status', render: (i) => statusBadge(i.status) },
      { label: '', render: (i) => (i.status === 'open' ? btn('Resolve', () => formModal(`Resolve ${i.code}`, [{ name: 'resolution', label: 'What was done?', type: 'textarea', required: true }], { submit: 'Resolve incident', onSubmit: async (v) => { await api(`/api/admin/incidents/${i.code}/resolve`, { method: 'POST', body: v }); pageSupport(parts, true); } }), 'sm primary') : null) }], d.incidents, { emptyText: 'No safety incidents reported.' })), silent);
  return page('/support', 'Support', () => api('/api/admin/tickets', { query: { status: q.status, from: q.from } }), (d) => shell('/support', 'Support', null, pick,
    h('div', { class: 'row' }, tabs([['', 'All'], ['open', 'Open', d.counts.open || 0], ['in_progress', 'In progress', d.counts.in_progress || 0], ['resolved', 'Resolved', d.counts.resolved || 0]], q.status || '', (k) => go(`/support${qs({ status: k, from: q.from })}`)), tabs([['', 'Everyone'], ['customer', 'Customers'], ['seller', 'Sellers'], ['partner', 'Partners'], ['fleet', 'Fleets']], q.from || '', (k) => go(`/support${qs({ status: q.status, from: k })}`))),
    table([{ label: 'Ticket', render: (t) => h('div', null, h('strong', null, t.subject), h('div', { class: 'small muted' }, `${t.code} · ${t.category_label}`)) }, { label: 'From', render: (t) => title(t.raised_by) }, { label: 'Status', render: (t) => h('div', null, statusBadge(t.status), t.priority === 'urgent' ? [' ', badge('Urgent', 'bad')] : null) }, { label: 'Delivery', key: 'delivery_code' }, { label: 'Updated', render: (t) => ago(t.updated_at) }], d.tickets, { emptyText: 'No tickets.', onRow: (t) => go(`/support/${t.code}`) })), silent);
}

/* ---------- Reports, fleets, audit ---------- */
function pageReports() {
  const range = currentRoute().query.range || '30d';
  S.refresh = null;
  return page('/reports', 'Reports', () => api('/api/admin/reports', { query: { range } }), (d) => {
    const m = d.metrics;
    shell('/reports', 'Reports', h('a', { class: 'btn', href: `/api/admin/reports.csv?range=${range}`, download: '' }, 'Download CSV'),
      tabs([['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']], range, (k) => go(`/reports?range=${k}`)), h('div', { class: 'small muted' }, `${d.range.label} · ${d.total} deliveries created`), note(d.note),
      h('div', { class: 'grid g4' }, stat('Delivery success rate', pct(m.success_rate)), stat('Cancellation rate', pct(m.cancellation_rate)), stat('Reassignment rate', pct(m.reassignment_rate)), stat('Failed attempts', m.failed_attempts),
        stat('Average assignment time', val(m.average_assignment_minutes, ' min')), stat('Average pickup wait', val(m.average_pickup_wait_minutes, ' min')), stat('Seller handover delay', val(m.seller_handover_delay_minutes, ' min'), 'Beyond promised preparation time'), stat('Average delivery time', val(m.average_delivery_minutes, ' min')),
        stat('Delayed deliveries', m.delayed), stat('Cost per delivery', m.cost_per_delivery === null ? '—' : money(m.cost_per_delivery), 'Partner earning'), stat('Fee per delivery', m.fee_per_delivery === null ? '—' : money(m.fee_per_delivery)), stat('Customer rating', m.customer_rating ? `${m.customer_rating} ★` : '—', `${m.ratings} ratings`),
        stat('Complaint rate', val(m.complaint_rate, '%'), `${m.complaints} complaints`), stat('Payout accuracy', pct(m.payout_accuracy)), stat('Partners online now', pct(m.partners_online_share), 'Share of approved partners')),
      h('div', { class: 'grid g3 collapse' }, card('By zone', table([{ label: 'Zone', key: 'name' }, { label: 'Total', key: 'total', right: true }, { label: 'Delivered', right: true, render: (r) => r.delivered || 0 }], d.by_zone)), card('By category', table([{ label: 'Category', key: 'category' }, { label: 'Total', key: 'total', right: true }, { label: 'Delivered', right: true, render: (r) => r.delivered || 0 }], d.by_category)), card('By status', table([{ label: 'Status', key: 'status' }, { label: 'Total', key: 'total', right: true }], d.by_status))),
      card('Partner activity', table([{ label: 'Partner', render: (p) => h('a', { href: `#/partners/${p.code}` }, `${p.name} · ${p.code}`) }, { label: 'Completed', key: 'completed', right: true }, { label: 'Earnings', right: true, render: (p) => money(p.earnings) }], d.partner_activity, { emptyText: 'No completed deliveries in this period.' })));
  });
}
function pageFleets() {
  S.refresh = null;
  return page('/fleets', 'Fleets', () => api('/api/admin/fleets'), (d) => shell('/fleets', 'Fleets', btn('Add fleet', () => formModal('Add a fleet company', [{ name: 'name', label: 'Fleet name', required: true }, { name: 'contact_phone', label: 'Contact mobile', type: 'tel', max: 10 }, { name: 'manager_name', label: 'Manager name', required: true }, { name: 'manager_email', label: 'Manager email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true, hint: 'Share it with the manager securely. At least 8 characters with upper and lower case letters and a number.' }],
    { submit: 'Create fleet', onSubmit: async (v) => { const r = await api('/api/admin/fleets', { method: 'POST', body: v }); toast(`Fleet ${r.code} created.`, 'ok'); pageFleets(); } }), 'primary'),
  h('p', { class: 'muted small' }, 'A fleet manager signs in at ', h('a', { href: '/fleet/' }, '/fleet/'), ' and sees only that fleet\'s members. Partners join a fleet with its join code when they register.'),
  table([{ label: 'Fleet', render: (f) => h('div', null, h('strong', null, f.name), ' ', demoTag(f.is_demo), h('div', { class: 'small muted' }, f.code)) }, { label: 'Status', render: (f) => statusBadge(f.status) }, { label: 'Join code', render: (f) => h('span', { class: 'mono' }, f.join_code) }, { label: 'Members', key: 'members', right: true }, { label: 'Managers', render: (f) => f.managers.map((m) => `${m.name} (${m.email})`).join(', ') }], d.fleets, { emptyText: 'No fleets yet.' })));
}
function pageAudit() {
  const q = currentRoute().query;
  S.refresh = null;
  return page('/audit', 'Audit log', () => api('/api/admin/audit', { query: { q: q.q, page: q.page } }), (d) => {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Search actor, action or record', value: q.q || '', 'aria-label': 'Search audit log', style: 'max-width:320px' });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(`/audit${qs({ q: search.value.trim() })}`); });
    shell('/audit', 'Audit log', null, h('p', { class: 'muted small' }, 'Sensitive actions by partners, fleet managers and operations staff. Entries cannot be edited.'), search,
      table([{ label: 'When', render: (a) => h('span', { class: 'nowrap' }, dt(a.created_at)) }, { label: 'Who', render: (a) => h('div', null, a.actor_name, h('div', { class: 'tiny muted' }, a.actor_type)) }, { label: 'Action', key: 'action' }, { label: 'Record', render: (a) => [a.entity, a.entity_ref].filter(Boolean).join(' ') }, { label: 'Detail', key: 'detail' }], d.rows, { emptyText: 'No entries.' }), pager(d, (p) => go(`/audit${qs({ q: q.q, page: p })}`)));
  });
}

/* ---------- Router ---------- */
function render() {
  if (!S.me) return pageLogin();
  const r = currentRoute();
  switch (r.parts[0]) {
    case undefined: return pageDashboard();
    case 'map': return pageMap();
    case 'deliveries': return r.parts[1] ? pageDelivery(r.parts[1]) : pageDeliveries();
    case 'partners': return r.parts[1] ? pagePartner(r.parts[1]) : pagePartners();
    case 'zones': return pageZones();
    case 'finance': return pageFinance();
    case 'support': return pageSupport(r.parts);
    case 'reports': return pageReports();
    case 'fleets': return pageFleets();
    case 'audit': return pageAudit();
    default: return go('/');
  }
}
let started = false;
async function boot() {
  try { S.me = await api('/api/tower/me'); } catch (e) { if (e.status !== 401) toast(e.message, 'bad'); S.me = null; }
  if (S.me && !S.stopLive) S.stopLive = live({ portal: 'admin' }, async () => { if (!S.me || document.querySelector('.modal-back') || ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) return; api('/api/tower/me').then((m) => { S.me = m; }).catch(() => {}); if (S.refresh) S.refresh(); });
  if (!started) { started = true; onRoute(() => { window.scrollTo(0, 0); render(); }); } else render();
}
boot();
