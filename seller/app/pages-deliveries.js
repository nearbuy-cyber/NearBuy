// Seller Hub — local deliveries carried by the delivery partner network: prepare, mark ready, hand over, track.
import { h, api, can, navigate, reload, toast, formModal, busy, banner, badge, statusBadge, demoTag, pageHead, card, emptyState, kv, timeline, inr, fmtDateTime, ago } from './core.js';

const LANES = [['new', 'New orders', 'Accept and set the preparation time'], ['preparing', 'Preparing', 'Pack, then mark ready for pickup'], ['ready', 'Ready for pickup', 'Waiting for the delivery partner'], ['handed_over', 'Handed over', 'On the way to the customer'],
  ['returns', 'Return pickups', 'Coming back from customers'], ['issues', 'Issues', 'Failed, returned or cancelled'], ['completed', 'Completed', 'Last 7 days']];
const clock = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) : '—');
const tone = (s) => (['delivered'].includes(s) ? 'green' : ['cancelled', 'delivery_attempt_failed', 'return_in_progress', 'returned_to_seller'].includes(s) ? 'red' : ['awaiting_assignment', 'searching_partner', 'offer_sent', 'reassignment_required'].includes(s) ? 'amber' : 'blue');
const dBadge = (d) => badge(d.status_label, tone(d.status));

// Live updates: the server tells this page that one of the seller's deliveries changed; the page then re-reads it.
let stream = null; let timer = null;
function watch() {
  if (stream) return;
  stream = new EventSource('/api/realtime?portal=seller');
  stream.addEventListener('change', () => {
    if (!location.pathname.startsWith('/seller/deliveries')) { stream.close(); stream = null; return; }
    if (document.querySelector('.modal-backdrop, dialog[open], .modal') || ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) return;
    clearTimeout(timer); timer = setTimeout(reload, 300);
  });
  stream.onerror = () => { if (stream) stream.close(); stream = null; };
}
const post = (code, path, body) => api(`/seller/deliveries/${code}/${path}`, { method: 'POST', body: body || {} });
const prepare = (d) => formModal({ title: `Preparation time — ${d.order_code}`, subtitle: 'The order is accepted and the customer sees an updated arrival estimate. A partner is assigned so that they arrive when it is ready.', submitLabel: 'Accept and start preparing',
  fields: [{ name: 'prep_minutes', label: 'Minutes until the order is ready', type: 'number', value: d.prep_minutes, min: 1, max: 240, required: true }], onSubmit: async (v) => { await post(d.code, 'prepare', { prep_minutes: Number(v.prep_minutes) }); toast('Preparation time confirmed.', 'success'); reload(); } });
const markReady = (d) => async () => { await post(d.code, 'ready'); toast('Order marked ready for pickup.', 'success'); reload(); };
const handover = (d) => formModal({ title: `Confirm handover — ${d.code}`, subtitle: `Use this instead of the pickup PIN. Check that ${d.partner ? d.partner.first_name : 'the delivery partner'} is the person shown here before handing over.`, submitLabel: 'Confirm handover',
  fields: [{ name: 'package_count', label: 'Number of packages handed over', type: 'number', value: d.package_count, min: 1, required: true }], onSubmit: async (v) => { await post(d.code, 'confirm-handover', { package_count: Number(v.package_count) }); toast('Handover confirmed.', 'success'); reload(); } });
function testOrder(categories) {
  const fields = [
    { name: 'category', label: 'Delivery category', type: 'select', options: Object.entries(categories), required: true, placeholderOption: false }, { name: 'payment', label: 'Payment', type: 'select', options: [['prepaid', 'Prepaid'], ['cod', 'Cash on delivery']], required: true, placeholderOption: false },
    { name: 'method', label: 'Delivery method', type: 'select', options: [['immediate', 'Immediate'], ['scheduled', 'Scheduled slot']], placeholderOption: false }, { name: 'scheduled_for', label: 'Scheduled for', type: 'datetime-local', hint: 'Only for a scheduled delivery.' },
    { name: 'address', label: 'Delivery address', hint: 'Leave both empty to use a sample local address.' }, { name: 'pincode', label: 'PIN code', inputmode: 'numeric', maxlength: 6 },
    { name: 'instructions', label: 'Delivery instructions', full: true }, { name: 'special_handling', label: 'Special handling (fragile)', type: 'checkbox', full: true },
  ];
  return formModal({ title: 'Create a test order', submitLabel: 'Create test order', wide: true, fields,
    intro: h('div.stack.sm', banner('', [h('b', 'TEST TOOL. '), 'The customer storefront has no checkout yet, so a local order is created here from your real stock and flagged as test data. The delivery fee is calculated from the zone pricing when the order is placed.'])),
    onSubmit: async (v) => {
      const body = { ...v, special_handling: Boolean(v.special_handling), scheduled_for: v.scheduled_for ? new Date(v.scheduled_for).toISOString() : undefined };
      for (const k of Object.keys(body)) if (body[k] === '') delete body[k];
      const r = await api('/seller/deliveries/test-orders', { method: 'POST', body: { ...body, address: body.address, pincode: body.pincode } });
      toast(`${r.order_code} created · delivery fee ${inr(r.fee.total)}.`, 'success'); navigate(`/seller/deliveries/${r.delivery_code}`);
    } });
}
function tile(d, write) {
  const action = !write ? null
    : d.kind === 'forward' && !d.ready_at && d.order_status === 'new' ? h('button.btn.sm.primary', { type: 'button', onClick: () => prepare(d) }, 'Accept · set prep time')
      : d.kind === 'forward' && !d.ready_at && !['cancelled', 'delivered'].includes(d.status) ? h('button.btn.sm.primary', { type: 'button', onClick: (e) => busy(e.currentTarget, markReady(d)) }, 'Mark ready for pickup')
        : d.partner_arrived && d.status === 'pickup_verification_pending' ? h('button.btn.sm.primary', { type: 'button', onClick: () => handover(d) }, 'Confirm handover') : null;
  return h('div.card', h('div.card-body.stack.sm',
    h('div.row.between', h('a.strong', { href: `/seller/deliveries/${d.code}` }, d.order_code), demoTag(d.is_demo)), h('div', dBadge(d), d.partner_arrived ? [' ', badge('Partner at your door', 'green')] : null, d.return_arrived ? [' ', badge('Return has arrived', 'amber')] : null),
    h('div.small.muted', `${d.category_label} · ${d.items.reduce((n, i) => n + i.qty, 0)} item(s) · ${d.payment_type === 'cod' ? 'Cash on delivery' : 'Prepaid'} · to ${d.drop_area}`),
    d.partner ? h('div.small', h('b', d.partner.first_name), ` · ${d.partner.vehicle || ''}${d.eta_at && !d.picked_up_at ? '' : ''}`) : ['delivered', 'cancelled', 'returned_to_seller'].includes(d.status) ? null : h('div.small.muted', 'No partner assigned yet'),
    d.pickup_pin && d.partner ? h('div.small', 'Pickup PIN: ', h('b', { style: { letterSpacing: '.2em', fontSize: '16px' } }, d.pickup_pin)) : null,
    d.return_code ? h('div.small', 'Return code: ', h('b', { style: { letterSpacing: '.2em', fontSize: '16px' } }, d.return_code)) : null, action));
}
export async function deliveries() {
  const d = await api('/seller/deliveries');
  watch();
  const total = LANES.reduce((n, [k]) => n + d.board[k].length, 0);
  return h('div.stack.lg',
    pageHead({ title: 'Deliveries', subtitle: 'Local orders carried by the delivery partner network. Updates appear here as they happen.', trail: ['Deliveries'],
      actions: [h('a.btn', { href: '/seller/deliveries/tickets' }, 'Delivery issues'), d.test_tools ? h('button.btn.primary', { type: 'button', onClick: () => testOrder(d.categories) }, 'Create test order') : null] }),
    banner(d.coverage.ok ? '' : 'warn', [h('b', d.coverage.ok ? `Zone: ${d.coverage.zone} · pickup from ${d.coverage.pickup}. ` : 'Not covered. '), d.coverage.message]),
    total ? h('div', { style: { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(260px, 1fr)', gap: '14px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'start' } },
      LANES.map(([key, label, hint]) => h('section.stack.sm', { 'aria-label': label }, h('div', h('b', `${label} `), h('span.muted', d.board[key].length), h('div.tiny.muted', hint)), d.board[key].length ? d.board[key].map((x) => tile(x, d.can_write)) : h('div.small.muted', { style: { padding: '12px', border: '1px dashed var(--line, #d7dce5)', borderRadius: '10px' } }, 'Nothing here'))))
      : emptyState({ ico: 'truck', title: 'No local deliveries yet', text: 'When a customer in your delivery zone places an order, it appears here with its preparation, pickup and delivery status.' }));
}
export async function deliveryDetail(ctx) {
  const [{ delivery: d }, board] = await Promise.all([api(`/seller/deliveries/${ctx.params.code}`), api('/seller/deliveries')]);
  watch();
  const write = can('orders.write');
  const closed = ['delivered', 'returned_to_seller', 'cancelled'].includes(d.status);
  const beforeReady = d.kind === 'forward' && !d.ready_at && !closed;
  const actions = write ? [
    beforeReady ? h('button.btn', { type: 'button', onClick: () => prepare(d) }, d.order_status === 'new' ? 'Accept · set prep time' : 'Change prep time') : null,
    beforeReady ? h('button.btn.primary', { type: 'button', onClick: (e) => busy(e.currentTarget, markReady(d)) }, 'Mark ready for pickup') : null,
    d.partner_arrived && d.status === 'pickup_verification_pending' ? h('button.btn.primary', { type: 'button', onClick: () => handover(d) }, 'Confirm handover') : null,
    d.pickup_pin ? h('button.btn', { type: 'button', onClick: () => formModal({ title: 'Pickup instructions', submitLabel: 'Save', fields: [{ name: 'pickup_instructions', label: 'Instructions for the delivery partner', type: 'textarea', rows: 3, maxlength: 200, value: d.pickup.instructions || '' }], onSubmit: async (v) => { await post(d.code, 'instructions', v); toast('Instructions saved.', 'success'); reload(); } }) }, 'Pickup instructions') : null,
    h('button.btn', { type: 'button', onClick: () => formModal({ title: 'Report a delivery issue', submitLabel: 'Send to delivery support', fields: [{ name: 'category', label: 'Issue', type: 'select', options: Object.entries(board.complaint_categories), required: true }, { name: 'description', label: 'What happened?', type: 'textarea', rows: 4, required: true }],
      onSubmit: async (v) => { const r = await post(d.code, 'report', v); toast(`Ticket ${r.code} sent to delivery support.`, 'success'); } }) }, 'Report an issue'),
  ] : [];
  const p = d.partner;
  return h('div.stack.lg',
    pageHead({ title: `Delivery ${d.code}`, trail: [['Deliveries', '/seller/deliveries'], d.code], tag: [dBadge(d), ' ', demoTag(d.is_demo)], subtitle: `Order ${d.order_code} · ${d.category_label}${d.kind === 'return' ? ' · return pickup' : ''}`, actions }),
    closed ? banner('', 'This delivery is closed. Its record can no longer be changed.') : null,
    d.failure_reason && !closed ? banner('warn', [h('b', 'Delivery attempt failed: '), d.failure_reason, ' The operations team decides whether to retry or return the package to you.']) : null,
    d.cancel_reason ? banner('error', [h('b', 'Cancelled: '), d.cancel_reason]) : null,
    h('div.grid.main-side',
      h('div.stack',
        d.pickup_pin ? card({ title: 'Pickup PIN', subtitle: 'Tell this PIN to the delivery partner when you hand over the packages. Do not share it earlier.', body: h('div.stack.sm', h('div', { style: { fontSize: '34px', fontWeight: '800', letterSpacing: '.3em' }, 'aria-label': `Pickup PIN ${d.pickup_pin.split('').join(' ')}` }, d.pickup_pin),
          h('p.small.muted', d.partner_arrived ? 'The delivery partner has arrived. Check the name and vehicle on the right, then share the PIN or use "Confirm handover".' : d.ready_at ? 'Waiting for the delivery partner to arrive.' : 'Mark the order ready when it is packed.')) }) : null,
        d.return_code ? card({ title: 'Return code', subtitle: 'The package is coming back to you. Give this code to the delivery partner after you receive it.', body: h('div', { style: { fontSize: '34px', fontWeight: '800', letterSpacing: '.3em' } }, d.return_code) }) : null,
        card({ title: 'Packages', body: h('div.stack.sm', d.items.length ? d.items.map((i) => h('div', `${i.qty} × ${i.title}${i.variant_label ? ` (${i.variant_label})` : ''}`)) : h('p.muted', 'Return parcel'),
          kv([['Package count', d.package_count], ['Package type', d.package_type], ['Weight', d.weight_kg ? `${d.weight_kg} kg` : null], ['Special handling', d.special_handling ? 'Yes' : 'No'], ['Order value', inr(d.order_total)], ['Payment', d.payment_type === 'cod' ? `Cash on delivery — partner collects ${inr(d.cod_amount)}` : 'Prepaid']].filter((x) => x[1] !== null))) }),
        card({ title: 'Delivery timeline', body: timeline(d.timeline.map((e) => ({ title: e.label, note: e.note, created_at: e.created_at, actor: e.actor_name })), { doneAll: true }) })),
      h('div.stack',
        card({ title: 'Delivery partner', body: p ? h('div.stack.sm', kv([['Name', h('b', p.first_name)], ['Vehicle', p.vehicle], p.vehicle_number_ending ? ['Number plate ending', p.vehicle_number_ending] : null, p.rating ? ['Rating', `${p.rating} ★`] : null, p.phone_masked ? ['Phone', p.phone_masked] : null, p.third_party ? ['Type', 'Third-party logistics'] : null]),
          d.partner_location ? h('p.small.muted', `Live location updated ${ago(d.partner_location.at)}.`) : null, d.eta_at && !closed ? h('p.small', 'Customer arrival estimate: ', h('b', clock(d.eta_at))) : null,
          h('p.tiny.muted', 'Hand the order only to this partner. The partner\'s phone number is masked for privacy.')) : h('p.muted', closed ? 'No partner was assigned.' : 'A partner is being found. You will be notified when one is assigned.') }),
        card({ title: 'Schedule', body: kv([['Method', d.method === 'scheduled' ? `Scheduled · ${fmtDateTime(d.scheduled_for)}` : 'Immediate'], ['Preparation time', `${d.prep_minutes} min`], ['Expected ready', d.expected_ready_at ? fmtDateTime(d.expected_ready_at) : '—'], ['Marked ready', d.ready_at ? fmtDateTime(d.ready_at) : 'Not yet'], ['Partner assigned', d.assigned_at ? fmtDateTime(d.assigned_at) : '—'], ['Picked up', d.picked_up_at ? fmtDateTime(d.picked_up_at) : '—'], ['Completed', d.completed_at ? fmtDateTime(d.completed_at) : '—']]) }),
        card({ title: 'Destination', actions: h('a.btn.sm', { href: `/seller/orders/${d.order_code}` }, 'Open order'), body: kv([['Customer ref', d.customer_ref], ['Drop area', d.drop_area], ['Distance', `${d.distance_km} km`], ['Pickup from', d.pickup.name]]) }))));
}
export async function deliveryTickets() {
  const { tickets } = await api('/seller/delivery-tickets');
  return h('div.stack.lg', pageHead({ title: 'Delivery issues', subtitle: 'Issues you reported to delivery support. Replies arrive in your notifications.', trail: [['Deliveries', '/seller/deliveries'], 'Issues'] }),
    tickets.length ? h('div.card', h('div.list', tickets.map((t) => h('div.list-row', h('div.grow', h('b.strong', t.subject), h('div.small.muted', `${t.code} · ${t.category_label} · updated ${ago(t.updated_at)}`)), statusBadge(t.status)))))
      : emptyState({ ico: 'lifebuoy', title: 'No delivery issues reported', text: 'Open a delivery and choose "Report an issue" if a pickup or handover goes wrong.' }));
}
