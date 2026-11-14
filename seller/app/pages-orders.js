// Orders, returns and shipping.
import { h, icon, api, ApiError, can, navigate, reload, toast, download, formModal, confirmDialog, busy, banner, demoBanner, integrationNote, badge, statusBadge, demoTag, thumb, pageHead, card, statCard, tabs, subnav, dataTable, pager, searchBox, selectFilter, emptyState, kv, timeline, inr, num, fmtDate, fmtDateTime, ago, hrefWith, setQuery, currentQuery, todayYmd } from './core.js';

/* ---------- Orders ---------- */
const ORDER_TABS = [['all', 'All orders'], ['new', 'New'], ['pending_confirmation', 'Pending confirmation'], ['processing', 'Processing'], ['ready_to_ship', 'Ready to ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const FLOW = [['new', 'New'], ['pending_confirmation', 'Confirmed'], ['processing', 'Processing'], ['packed', 'Packed'], ['ready_to_ship', 'Ready to ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const NEXT_BULK = { new: ['accept', 'Accept selected'], pending_confirmation: ['process', 'Start processing selected'], processing: ['pack', 'Mark selected as packed'] };

function dueBadge(o) {
  if (!o.dispatch_by || !['new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship'].includes(o.status)) return null;
  const hours = (new Date(o.dispatch_by).getTime() - Date.now()) / 3600000;
  if (hours < 0) return badge('Dispatch overdue', 'red');
  if (hours < 24) return badge(`Dispatch in ${Math.max(1, Math.round(hours))} h`, 'amber');
  return null;
}
function dateRangeInputs() {
  const q = currentQuery();
  const from = h('input.input.sm', { type: 'date', value: q.from || '', max: todayYmd(), 'aria-label': 'Placed from', style: { width: 'auto' } });
  const to = h('input.input.sm', { type: 'date', value: q.to || '', max: todayYmd(), 'aria-label': 'Placed until', style: { width: 'auto' } });
  const apply = () => { if (from.value && to.value && from.value > to.value) { toast('The start date must be on or before the end date.', 'error'); return; } setQuery({ from: from.value, to: to.value, page: null }); };
  from.addEventListener('change', apply); to.addEventListener('change', apply);
  return h('div.row', from, h('span.muted.small', 'to'), to);
}

export async function orders(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const data = await api('/orders', { query: { tab, q: q.q, from: q.from, to: q.to, overdue: q.overdue, sort: q.sort, page: q.page } });
  const write = can('orders.write');
  const bulk = write && NEXT_BULK[tab];
  const selected = new Set();
  const bulkBtn = bulk ? h('button.btn.navy.sm', { type: 'button', disabled: true, onClick: () => busy(bulkBtn, async () => {
    const r = await api('/orders/bulk-action', { method: 'POST', body: { action: bulk[0], codes: [...selected] } });
    if (r.done) toast(`${r.done} order${r.done === 1 ? '' : 's'} updated.`, 'success');
    if (r.failed.length) toast(`${r.failed.length} could not be updated: ${r.failed.map((f) => `${f.code} — ${f.message}`).join('; ')}`, 'error', 9000);
    reload();
  }) }, bulk[1]) : null;
  const syncBulk = () => { if (bulkBtn) { bulkBtn.disabled = selected.size === 0; bulkBtn.textContent = selected.size ? `${bulk[1]} (${selected.size})` : bulk[1]; } };
  const simulate = data.can_simulate ? h('button.btn', { type: 'button', title: 'Creates a sample order marked DEMO DATA so that you can test the workflow', onClick: (e) => busy(e.currentTarget, async () => { const r = await api('/orders/simulate', { method: 'POST', body: {} }); toast(r.message || `Test order ${r.code} created (DEMO DATA).`, 'success'); if (r.code) navigate(`/seller/orders/${r.code}`); else reload(); }) }, icon('plus', 'sm'), 'Create test order') : null;
  const filtered = q.q || q.from || q.to || q.overdue;
  const columns = [
    bulk ? { label: '', width: '36px', render: (o) => h('input', { type: 'checkbox', 'aria-label': `Select ${o.code}`, style: { accentColor: 'var(--orange)' }, onChange: (e) => { if (e.target.checked) selected.add(o.code); else selected.delete(o.code); syncBulk(); } }) } : null,
    { label: 'Order', sort: 'code', render: (o) => h('div', h('a.strong', { href: `/seller/orders/${o.code}` }, o.code), ' ', demoTag(o.is_demo), h('div.small.muted.nowrap', fmtDateTime(o.placed_at))) },
    { label: 'Product', render: (o) => h('div.cell-product', thumb(o.image_id, o.title), h('div', h('span.strong', o.title), h('small', `SKU ${o.sku} · Qty ${o.qty}${o.line_count > 1 ? ` · +${o.line_count - 1} more item${o.line_count > 2 ? 's' : ''}` : ''}`))) },
    { label: 'Amount', sort: 'total', align: 'right', render: (o) => h('div', h('div.strong', inr(o.total)), h('div.tiny.muted', o.payment_method)) },
    { label: 'Ship to', render: (o) => h('div', o.ship_city, h('div.small.muted', o.ship_pincode)) },
    { label: 'Dispatch by', sort: 'dispatch', render: (o) => h('div', h('span.nowrap', fmtDate(o.dispatch_by)), h('div', dueBadge(o))) },
    { label: 'Status', render: (o) => statusBadge(o.status, o.status_label) },
    { label: '', cls: 'actions', render: (o) => h('a.btn.sm', { href: `/seller/orders/${o.code}` }, 'View') },
  ].filter(Boolean);
  return h('div.stack',
    pageHead({ title: 'Orders', subtitle: 'Accept, pack and dispatch orders. Each step is checked on the server, so an order cannot skip a stage.', trail: ['Orders'], actions: [h('button.btn', { type: 'button', onClick: () => download('/orders/export.csv', { tab, q: q.q, from: q.from, to: q.to, overdue: q.overdue }) }, icon('download', 'sm'), 'Export CSV'), simulate] }),
    h('div.card', tabs(ORDER_TABS.map(([key, label]) => ({ key, label, count: data.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })),
      h('div.toolbar', searchBox('Search by order ID, product or SKU'), dateRangeInputs(), h('label.check.small', h('input', { type: 'checkbox', checked: q.overdue === '1', onChange: (e) => setQuery({ overdue: e.target.checked ? '1' : null, page: null }) }), h('span', 'Overdue only')), filtered ? h('a.btn.sm.ghost', { href: hrefWith({ q: null, from: null, to: null, overdue: null, page: null }) }, 'Clear filters') : null, h('span.spacer'), bulkBtn),
      dataTable({ rows: data.rows, sort: q.sort, rowKey: 'code', columns, empty: emptyState(filtered ? { ico: 'search', title: 'No orders match your filters', text: 'Try different dates or clear the filters.' } : tab === 'all' ? { ico: 'cart', title: 'No orders yet', text: 'Orders appear here when customers buy your active listings. You can create a labelled test order to try the workflow.', action: simulate ? null : undefined } : { ico: 'cart', title: `No ${ORDER_TABS.find((t) => t[0] === tab)[1].toLowerCase()} orders`, text: 'Orders move here as they reach this stage.' }) }),
      data.rows.length ? pager(data) : null));
}

async function runOrderAction(code, action) {
  const post = async (extra = {}) => { const r = await api(`/orders/${code}/actions`, { method: 'POST', body: { action: action.key, ...extra } }); toast(r.message, 'success'); reload(); return r; };
  if (action.blocked) { toast(action.blocked, 'error'); return; }
  if (action.key === 'cancel') {
    const { order } = await api(`/orders/${code}`);
    await formModal({ title: `Cancel order ${code}?`, subtitle: 'Reserved stock is released back to inventory. This cannot be undone.', submitLabel: 'Cancel order', danger: true, fields: [
      { name: 'reason', label: 'Cancellation reason', type: 'select', options: order.cancel_reasons, required: true }, { name: 'note', label: 'Note (optional)', type: 'textarea', rows: 2, maxlength: 300 }], onSubmit: (v) => post(v) });
    return;
  }
  if (action.key === 'fail') { await formModal({ title: 'Record failed delivery', subtitle: 'Use this when the carrier reports that the delivery attempt failed.', submitLabel: 'Record failed delivery', danger: true, fields: [{ name: 'reason', label: 'Reason reported by the carrier', required: true, placeholder: 'e.g. Customer not available' }], onSubmit: (v) => post(v) }); return; }
  const prompts = {
    dispatch: ['Mark this order as dispatched?', 'Confirm that the package has been handed to the carrier. Stock is deducted from inventory at this point.', 'Mark as shipped'],
    deliver: ['Record delivery?', 'Confirm that the carrier has delivered the package. The sale and marketplace fees are then written to your payments ledger.', 'Mark as delivered'],
    rto: ['Record return to seller?', 'The package is coming back to you. Stock is added back to inventory and the order is closed without a sale.', 'Record return'],
  }[action.key];
  if (prompts && !(await confirmDialog({ title: prompts[0], message: prompts[1], confirmLabel: action.label, danger: action.key === 'rto' }))) return;
  try { await post(); } catch (err) { toast(err.message, 'error'); }
}

export async function orderDetail(ctx) {
  const { order: o } = await api(`/orders/${ctx.params.code}`);
  const cancelled = o.status === 'cancelled';
  const at = FLOW.findIndex(([key]) => key === o.status);
  const stepper = h('div.stepper', FLOW.map(([key, label], i) => h(`div.step${!cancelled && i < at ? '.done' : ''}${!cancelled && i === at ? (o.status === 'delivered' ? '.done' : '.current') : ''}`, { dataset: { n: i + 1 } }, label)), cancelled ? h('div.step.cancelled', { dataset: { n: '' } }, 'Cancelled') : null);
  const actions = o.actions.map((a) => h(`button.btn${a.danger ? '.danger' : a.key === 'cancel' ? '' : '.primary'}`, { type: 'button', title: a.blocked || '', 'aria-disabled': a.blocked ? 'true' : null, dataset: { action: a.key }, onClick: (e) => busy(e.currentTarget, () => runOrderAction(o.code, a)) }, a.label));
  const sh = o.shipment;
  const tax = o.tax;
  return h('div.stack.lg',
    pageHead({ title: `Order ${o.code}`, trail: [['Orders', '/seller/orders'], o.code], tag: [statusBadge(o.status, o.status_label), ' ', demoTag(o.is_demo), ' ', dueBadge(o)], subtitle: `Placed ${fmtDateTime(o.placed_at)} · Dispatch by ${fmtDate(o.dispatch_by)}`, actions: [
      h('button.btn', { type: 'button', disabled: !o.documents.invoice, title: o.documents.invoice ? 'Download tax invoice (PDF)' : 'Available once the order is accepted', onClick: () => download(`/orders/${o.code}/invoice.pdf`) }, icon('receipt', 'sm'), 'Invoice'),
      h('button.btn', { type: 'button', disabled: !o.documents.label, title: o.documents.label ? 'Download shipping label (PDF)' : 'Generate a shipment record first', onClick: async () => { if (await download(`/orders/${o.code}/label.pdf`)) reload(); } }, icon('printer', 'sm'), 'Shipping label')] }),
    h('div.card', h('div.card-body.stack', stepper, o.cancellation ? banner('error', [h('b', 'Cancelled. '), `${o.cancellation.reason}${o.cancellation.note ? ` — ${o.cancellation.note}` : ''} · ${o.cancellation.by || ''} · ${fmtDateTime(o.cancellation.at)}`]) : null,
      o.stock_state === 'none' && !cancelled && o.status === 'new' ? banner('warn', 'There is not enough stock to reserve this order. Update inventory before accepting it, or cancel it.') : null,
      actions.length ? h('div.row.wrap', h('span.small.muted', 'Next step:'), actions) : h('p.small.muted', cancelled || o.status === 'delivered' ? 'This order is closed. No further actions are available.' : can('orders.write') ? 'No action is available at this stage.' : 'Your role can view orders but not change them.'))),
    h('div.grid.main-side',
      h('div.stack',
        card({ title: 'Items', flush: true, body: h('div', dataTable({ rows: o.items, columns: [
          { label: 'Product', render: (it) => h('div.cell-product', thumb(it.image_id, it.title), h('div', it.product_code ? h('a', { href: `/seller/products/${it.product_code}` }, it.title) : h('span.strong', it.title), h('small', `${it.variant_label ? `${it.variant_label} · ` : ''}SKU ${it.sku}`))) },
          { label: 'Qty', align: 'right', render: (it) => num(it.qty) }, { label: 'Unit price', align: 'right', render: (it) => inr(it.unit_price) }, { label: 'Taxable value', align: 'right', render: (it) => inr(it.taxable_value) }, { label: `GST`, align: 'right', render: (it) => `${inr(it.tax_amount)} (${it.gst_rate}%)` }, { label: 'Total', align: 'right', render: (it) => h('b', inr(it.line_total)) }] }),
          h('div.card-foot', h('div', { style: { maxWidth: '360px', marginLeft: 'auto' } }, kv([['Taxable value', inr(tax.taxable_value)], tax.igst ? ['IGST', inr(tax.igst)] : null, tax.cgst ? ['CGST', inr(tax.cgst)] : null, tax.sgst ? ['SGST', inr(tax.sgst)] : null, ['Shipping charged to customer', inr(o.shipping_charge)], ['Order total', h('b', { style: { fontSize: '16px' } }, inr(o.total))]]), h('div.tiny.muted', { style: { marginTop: '6px' } }, tax.basis)))) }),
        card({ title: 'Shipment', actions: sh ? h('a.btn.sm', { href: `/seller/shipping/shipments/${sh.code}` }, 'Open shipment') : null, body: sh ? h('div.stack', kv([['Shipment ID', sh.code], ['Status', statusBadge(sh.status, sh.status_label)], ['Carrier', sh.carrier], ['Package', `${num(sh.weight_g)} g · ${sh.dimensions || '—'}`], ['Pickup from', sh.pickup ? `${sh.pickup.name}, ${sh.pickup.city} ${sh.pickup.pincode}` : '—'], ['Label generated', sh.label_generated_at ? fmtDateTime(sh.label_generated_at) : 'Not yet'], ['Dispatched', fmtDateTime(sh.dispatched_at)], ['Delivered', fmtDateTime(sh.delivered_at)]]), timeline(sh.timeline, { doneAll: true }))
          : emptyState({ ico: 'truck', title: 'No shipment record yet', text: 'A shipment record is generated after the order is packed. It holds the package details and the shipping label.' }) }),
        o.returns.length ? card({ title: 'Returns', flush: true, body: h('div.list', o.returns.map((r) => h('a.list-row', { href: `/seller/returns/${r.code}` }, h('div.grow', h('b.strong', r.code), h('div.small.muted', `Requested ${fmtDate(r.requested_at)}`)), statusBadge(r.status, { new: 'New request', received: 'Product received' }[r.status])))) }) : null),
      h('div.stack',
        card({ title: 'Customer', body: h('div.stack.sm', kv([['Customer ref', o.customer.ref], ['Name', o.customer.name], ['Phone', o.customer.phone], ['Ship to', `${o.customer.city}, ${o.customer.state} ${o.customer.pincode}`]]), h('p.tiny.muted', icon('lock', 'sm'), ' Name and phone are masked. The full address is printed only on the shipping label.')) }),
        card({ title: 'Payment', body: kv([['Method', o.payment.method], ['Status', statusBadge(o.payment.status === 'paid' ? 'paid' : 'pending', o.payment.status === 'paid' ? 'Paid by customer' : 'Collect on delivery')], ['Stock', { reserved: 'Reserved', deducted: 'Deducted from inventory', released: 'Released back', none: 'Not reserved', restocked: 'Returned to inventory' }[o.stock_state] || o.stock_state]]) }),
        can('payments.read') || o.fees_estimate ? card({ title: o.status === 'delivered' ? 'Settlement breakdown' : 'Estimated settlement', subtitle: o.status === 'delivered' ? 'Written to your payments ledger' : 'Posted to the ledger when delivered', body: o.fees_estimate ? kv([['Sale amount', inr(o.fees_estimate.gross)], ['Platform fee', inr(-o.fees_estimate.platform_fee)], ['Shipping fee', inr(-o.fees_estimate.shipping_fee)], ['GST on fees', inr(-o.fees_estimate.tax)], ['Net to you', h('b', inr(o.fees_estimate.net))]]) : h('p.muted', 'Not available.') }) : null,
        card({ title: 'Order timeline', body: timeline(o.timeline, { doneAll: true }) }))));
}

/* ---------- Returns ---------- */
const RETURN_TABS = [['all', 'All returns'], ['new', 'New requests'], ['under_review', 'Under review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['refunds', 'Refunds'], ['completed', 'Completed']];
export async function returns(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const data = await api('/returns', { query: { tab, q: q.q, sort: q.sort, page: q.page } });
  const simulate = data.can_simulate ? h('button.btn', { type: 'button', title: 'Creates a sample return request marked DEMO DATA against a delivered order', onClick: (e) => busy(e.currentTarget, async () => { const r = await api('/returns/simulate', { method: 'POST', body: {} }); toast(r.message || 'Test return created (DEMO DATA).', 'success'); if (r.code) navigate(`/seller/returns/${r.code}`); else reload(); }) }, icon('plus', 'sm'), 'Create test return') : null;
  return h('div.stack', pageHead({ title: 'Returns', subtitle: 'Review return requests, record received products and track refunds.', trail: ['Returns'], actions: [simulate] }),
    h('div.card', tabs(RETURN_TABS.map(([key, label]) => ({ key, label, count: data.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })),
      h('div.toolbar', searchBox('Search by return ID, order ID, product or reason'), h('span.spacer'), h('span.small.muted', `${data.total} return${data.total === 1 ? '' : 's'}`)),
      dataTable({ rows: data.rows, sort: q.sort, rowKey: 'code', columns: [
        { label: 'Return', render: (r) => h('div', h('a.strong', { href: `/seller/returns/${r.code}` }, r.code), ' ', demoTag(r.is_demo), h('div.small.muted', h('a', { href: `/seller/orders/${r.order_code}` }, r.order_code))) },
        { label: 'Product', render: (r) => h('div.cell-product', thumb(r.image_id, r.product), h('div', h('span.strong', r.product), h('small', `SKU ${r.sku} · Qty ${r.qty}`))) },
        { label: 'Reason', render: (r) => r.reason }, { label: 'Requested', sort: 'requested', render: (r) => h('span.nowrap', fmtDate(r.requested_at)) }, { label: 'Refund', align: 'right', render: (r) => h('div', h('div.strong', inr(r.refund_amount)), h('div.tiny.muted', r.refund_status_label)) },
        { label: 'Status', render: (r) => statusBadge(r.status, r.status_label) }, { label: '', cls: 'actions', render: (r) => h('a.btn.sm', { href: `/seller/returns/${r.code}` }, r.status === 'new' || r.status === 'under_review' ? 'Review' : 'View') }],
        empty: emptyState(q.q ? { ico: 'search', title: 'No returns match your search' } : { ico: 'undo', title: tab === 'all' ? 'No return requests' : `No ${RETURN_TABS.find((t) => t[0] === tab)[1].toLowerCase()}`, text: 'Return requests from customers appear here for you to review.' }) }),
      data.rows.length ? pager(data) : null));
}

async function runReturnAction(code, action) {
  const post = async (extra = {}) => { const r = await api(`/returns/${code}/actions`, { method: 'POST', body: { action: action.key, ...extra } }); toast(r.message, 'success'); reload(); return r; };
  if (action.key === 'reject') return formModal({ title: 'Reject return request', subtitle: 'The customer is shown this reason, so be specific.', submitLabel: 'Reject request', danger: true, fields: [{ name: 'reason', label: 'Reason for rejection', type: 'textarea', rows: 3, required: true, hint: 'At least 10 characters.' }], onSubmit: (v) => post(v) });
  if (action.key === 'receive') return formModal({ title: 'Record received product', subtitle: 'Confirm that the returned product has reached you and note its condition.', submitLabel: 'Record as received', fields: [
    { name: 'condition', label: 'Condition', type: 'select', options: ['Sellable — restock', 'Damaged — do not restock', 'Used — do not restock'], required: true, hint: 'Sellable items are added back to available stock.' }, { name: 'note', label: 'Inspection note (optional)', type: 'textarea', rows: 2, maxlength: 300 }], onSubmit: (v) => post(v) });
  if (action.key === 'approve' || action.key === 'review') return formModal({ title: action.key === 'approve' ? 'Approve return request' : 'Start review', subtitle: action.key === 'approve' ? 'The customer will be asked to send the product back.' : 'Marks the request as under review.', submitLabel: action.label, fields: [{ name: 'note', label: 'Note (optional)', type: 'textarea', rows: 2, maxlength: 300 }], onSubmit: (v) => post(v) });
  if (action.key === 'refund' && !(await confirmDialog({ title: 'Record refund deduction?', message: 'This writes the refund as a deduction in your payments ledger and completes the return. No money is moved by this system — the customer refund itself is made by the payment provider.', confirmLabel: 'Record refund' }))) return undefined;
  try { return await post(); } catch (err) { toast(err.message, 'error'); return undefined; }
}

export async function returnDetail(ctx) {
  const { return: r } = await api(`/returns/${ctx.params.code}`);
  const actions = (r.actions || []).map((a) => h(`button.btn${a.key === 'reject' ? '.danger' : '.primary'}`, { type: 'button', dataset: { action: a.key }, onClick: (e) => busy(e.currentTarget, () => runReturnAction(r.code, a)) }, a.label));
  return h('div.stack.lg',
    pageHead({ title: `Return ${r.code}`, trail: [['Returns', '/seller/returns'], r.code], tag: [statusBadge(r.status, r.status_label), ' ', demoTag(r.is_demo)], subtitle: `Requested ${fmtDateTime(r.requested_at)} · Order ${r.order_code}`, actions }),
    r.reject_reason ? banner('error', [h('b', 'Rejected: '), r.reject_reason]) : null,
    h('div.grid.main-side',
      h('div.stack',
        card({ title: 'Return request', body: h('div.stack', h('div.cell-product', thumb(r.image_id, r.product, 'lg'), h('div', r.product_code ? h('a', { href: `/seller/products/${r.product_code}` }, r.product) : h('span.strong', r.product), h('small', `${r.variant_label ? `${r.variant_label} · ` : ''}SKU ${r.sku} · Qty ${r.qty}`))),
          kv([['Return reason', r.reason], ['Customer comments', r.description], ['Product condition', r.condition_note || 'Not received yet'], ['Restocked', r.condition_note ? (r.restocked ? 'Yes — added back to available stock' : 'No') : '—']])) }),
        card({ title: 'Action history', body: timeline(r.history, { doneAll: true }) })),
      h('div.stack',
        card({ title: 'Refund', body: h('div.stack.sm', kv([['Refund amount', h('b', inr(r.refund_amount))], ['Refund status', statusBadge(r.refund_status === 'recorded' ? 'recorded' : r.refund_status === 'pending' ? 'pending' : '', r.refund_status_label)], r.refund ? ['Refund ID', r.refund.code] : null, r.refund && r.refund.recorded_at ? ['Recorded', fmtDateTime(r.refund.recorded_at)] : null]),
          h('p.tiny.muted', 'A refund is recorded as a deduction in your ledger. Returning money to the customer needs a payment-gateway integration and is not performed by this system.')) }),
        card({ title: 'Order', actions: h('a.btn.sm', { href: `/seller/orders/${r.order.code}` }, 'Open order'), body: kv([['Order ID', r.order.code], ['Placed', fmtDate(r.order.placed_at)], ['Delivered', fmtDate(r.order.delivered_at)], ['Order total', inr(r.order.total)], ['Payment', r.order.payment_method], ['Customer', `${r.order.customer_ref} · PIN ${r.order.pincode}`]]) }))));
}

/* ---------- Shipping ---------- */
export const SHIP_NAV = [['Overview', '/seller/shipping'], ['Shipments', '/seller/shipping/shipments'], ['Shipping labels', '/seller/shipping/labels'], ['Tracking', '/seller/shipping/tracking'], ['Pickup locations', '/seller/shipping/pickup-locations'], ['Package settings', '/seller/shipping/package-settings'], ['Carrier integration', '/seller/shipping/carriers']];
const SHIP_TABS = [['all', 'All'], ['pending', 'Pending dispatch'], ['pickup', 'Ready for pickup'], ['transit', 'In transit'], ['delivered', 'Delivered'], ['failed', 'Failed delivery'], ['returned', 'Returned']];
const carrierNote = () => integrationNote('Carrier booking, pickup scheduling and live tracking are not connected. Shipments are recorded as self-ship, and every status here is entered by your team. Connecting a courier needs an authorised logistics API (for example a courier aggregator account).');

export async function shippingOverview() {
  const d = await api('/shipping/overview');
  const c = d.counts;
  return h('div.stack', pageHead({ title: 'Shipping', subtitle: 'Shipment records, labels and pickup locations for your orders.', trail: ['Shipping'], actions: [h('a.btn.primary', { href: '/seller/orders?tab=processing' }, 'Orders to pack')] }), subnav(SHIP_NAV), carrierNote(),
    h('div.grid.c4', statCard({ label: 'Awaiting shipment record', value: num(d.orders_awaiting_shipment), hint: 'Accepted orders not yet packed', ico: 'box', tone: 'amber', href: '/seller/orders?tab=processing' }), statCard({ label: 'Pending dispatch', value: num(c.pending_dispatch + c.ready_for_pickup), hint: `${c.ready_for_pickup} ready for pickup`, ico: 'truck', href: '/seller/shipping/shipments?tab=pending' }),
      statCard({ label: 'In transit', value: num(c.in_transit), hint: `${c.failed_delivery} failed delivery`, ico: 'pin', tone: 'violet', href: '/seller/shipping/shipments?tab=transit' }), statCard({ label: 'Dispatch overdue', value: num(d.overdue), hint: 'Past the dispatch-by date', ico: 'alert', tone: 'red', href: '/seller/orders?overdue=1' })),
    card({ title: 'Recent shipments', flush: true, actions: h('a.btn.sm', { href: '/seller/shipping/shipments' }, 'View all'), body: dataTable({ rows: d.recent, columns: [
      { label: 'Shipment', render: (s) => h('div', h('a.strong', { href: `/seller/shipping/shipments/${s.code}` }, s.code), ' ', demoTag(s.order.is_demo), h('div.small.muted', h('a', { href: `/seller/orders/${s.order.code}` }, s.order.code))) }, { label: 'Destination', render: (s) => `${s.order.ship_city}, ${s.order.ship_pincode}` }, { label: 'Package', render: (s) => `${num(s.weight_g)} g · ${s.dimensions || '—'}` },
      { label: 'Created', render: (s) => h('span.nowrap', fmtDate(s.created_at)) }, { label: 'Status', render: (s) => statusBadge(s.status, s.status_label) }],
      empty: emptyState({ ico: 'truck', title: 'No shipments yet', text: 'A shipment record is created when you pack an order and choose "Generate shipment record".' }) }) }));
}

export async function shipments(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const data = await api('/shipments', { query: { tab, q: q.q, sort: q.sort, page: q.page } });
  return h('div.stack', pageHead({ title: 'Shipments', subtitle: 'Every shipment record and where it stands.', trail: [['Shipping', '/seller/shipping'], 'Shipments'] }), subnav(SHIP_NAV),
    h('div.card', tabs(SHIP_TABS.map(([key, label]) => ({ key, label, count: data.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })),
      h('div.toolbar', searchBox('Search by shipment ID, order ID or product'), h('span.spacer'), h('span.small.muted', `${data.total} shipment${data.total === 1 ? '' : 's'}`)),
      dataTable({ rows: data.rows, sort: q.sort, columns: [
        { label: 'Shipment', render: (s) => h('div', h('a.strong', { href: `/seller/shipping/shipments/${s.code}` }, s.code), ' ', demoTag(s.is_demo), h('div.small.muted', h('a', { href: `/seller/orders/${s.order_code}` }, s.order_code))) }, { label: 'Product', render: (s) => s.title },
        { label: 'Destination', render: (s) => `${s.ship_city}, ${s.ship_pincode}` }, { label: 'Package', render: (s) => `${num(s.weight_g)} g` }, { label: 'Dispatch by', render: (s) => h('span.nowrap', fmtDate(s.dispatch_by)) }, { label: 'Updated', sort: 'updated', render: (s) => h('span.nowrap.small.muted', ago(s.updated_at)) },
        { label: 'Status', render: (s) => statusBadge(s.status, s.status_label) }, { label: '', cls: 'actions', render: (s) => h('a.btn.sm', { href: `/seller/shipping/shipments/${s.code}` }, 'View') }],
        empty: emptyState({ ico: 'truck', title: q.q ? 'No shipments match your search' : 'No shipments here', text: 'Shipment records are generated from packed orders.' }) }), data.rows.length ? pager(data) : null));
}

export async function shipmentDetail(ctx) {
  const { shipment: s, actions } = await api(`/shipments/${ctx.params.code}`);
  const buttons = (actions || []).map((a) => h(`button.btn${a.danger ? '.danger' : '.primary'}`, { type: 'button', onClick: (e) => busy(e.currentTarget, () => runOrderAction(s.order.code, a)) }, a.label));
  return h('div.stack.lg', pageHead({ title: `Shipment ${s.code}`, trail: [['Shipping', '/seller/shipping'], ['Shipments', '/seller/shipping/shipments'], s.code], tag: [statusBadge(s.status, s.status_label), ' ', demoTag(s.order.is_demo)], subtitle: `For order ${s.order.code} · Created ${fmtDateTime(s.created_at)}`, actions: [
    h('button.btn', { type: 'button', onClick: async () => { if (await download(`/orders/${s.order.code}/label.pdf`)) reload(); } }, icon('printer', 'sm'), 'Download label'), ...buttons] }),
    h('div.grid.c2', card({ title: 'Shipment details', body: kv([['Carrier', s.carrier], ['Reference', s.reference], ['Package weight', `${num(s.weight_g)} g`], ['Dimensions', s.dimensions], ['Pickup location', s.pickup ? `${s.pickup.name}, ${s.pickup.city} ${s.pickup.pincode}` : '—'], ['Destination', `${s.order.ship_city}, ${s.order.ship_state} ${s.order.ship_pincode}`], ['Label generated', s.label_generated_at ? fmtDateTime(s.label_generated_at) : 'Not yet'], ['Dispatched', fmtDateTime(s.dispatched_at)], ['Delivered', fmtDateTime(s.delivered_at)],
      ['Order', h('span', h('a', { href: `/seller/orders/${s.order.code}` }, s.order.code), ' ', statusBadge(s.order.status, s.order.status_label))], ['Order value', `${inr(s.order.total)} · ${s.order.payment_method}`]]) }),
      card({ title: 'Tracking history', subtitle: 'Entered by your team — not a live carrier feed', body: timeline(s.timeline, { doneAll: true }) })), carrierNote());
}

export async function shippingLabels(ctx) {
  const q = ctx.query;
  const data = await api('/shipments', { query: { labels: '1', q: q.q, page: q.page } });
  return h('div.stack', pageHead({ title: 'Shipping labels', subtitle: 'Download an A6 label with the delivery address and a scannable shipment barcode.', trail: [['Shipping', '/seller/shipping'], 'Shipping labels'] }), subnav(SHIP_NAV),
    h('div.card', h('div.toolbar', searchBox('Search by shipment ID or order ID')),
      dataTable({ rows: data.rows, columns: [{ label: 'Shipment', render: (s) => h('div', h('a.strong', { href: `/seller/shipping/shipments/${s.code}` }, s.code), ' ', demoTag(s.is_demo), h('div.small.muted', s.order_code)) }, { label: 'Product', render: (s) => s.title }, { label: 'Destination', render: (s) => `${s.ship_city}, ${s.ship_pincode}` },
        { label: 'Label', render: (s) => (s.label_generated_at ? h('span.small', `Generated ${fmtDateTime(s.label_generated_at)}`) : badge('Not downloaded yet', 'amber')) }, { label: 'Status', render: (s) => statusBadge(s.status, s.status_label) },
        { label: '', cls: 'actions', render: (s) => h('button.btn.sm', { type: 'button', onClick: async () => { if (await download(`/orders/${s.order_code}/label.pdf`)) reload(); } }, icon('download', 'sm'), 'Label PDF') }],
        empty: emptyState({ ico: 'printer', title: 'No labels available', text: 'Labels can be downloaded once an order has a shipment record.' }) }), data.rows.length ? pager(data) : null));
}

export async function shippingTracking(ctx) {
  const code = (ctx.query.code || '').trim().toUpperCase();
  const input = h('input.input', { name: 'code', placeholder: 'Shipment ID or order ID, e.g. SHP-70012 or ORD-240012', value: code, 'aria-label': 'Shipment or order ID' });
  const form = h('form.row', { onSubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) { toast('Enter a shipment ID or an order ID.', 'error'); return; } setQuery({ code: v.toUpperCase() }, { replace: false }); } }, input, h('button.btn.primary', { type: 'submit' }, icon('search', 'sm'), 'Track'));
  let result = h('div.card', emptyState({ ico: 'pin', title: 'Track a shipment', text: 'Enter a shipment ID or order ID to see its recorded status history.' }));
  if (code) {
    try {
      let shipmentCode = code;
      if (code.startsWith('ORD-')) { const { order } = await api(`/orders/${code}`); if (!order.shipment) throw new ApiError(404, { error: `Order ${code} does not have a shipment record yet.` }); shipmentCode = order.shipment.code; }
      const { shipment: s } = await api(`/shipments/${shipmentCode}`);
      result = card({ title: `${s.code} · ${s.status_label}`, subtitle: `Order ${s.order.code} to ${s.order.ship_city}, ${s.order.ship_pincode}`, actions: h('a.btn.sm', { href: `/seller/shipping/shipments/${s.code}` }, 'Open shipment'), body: timeline(s.timeline, { doneAll: true }) });
    } catch (err) { result = h('div.card', emptyState({ ico: 'search', title: 'Nothing found', text: err.status === 404 ? `No shipment or order with the ID ${code} exists in your account.` : err.message })); }
  }
  return h('div.stack', pageHead({ title: 'Shipment tracking', subtitle: 'Status history recorded in the Seller Hub.', trail: [['Shipping', '/seller/shipping'], 'Tracking'] }), subnav(SHIP_NAV), card({ body: form }), result,
    integrationNote('This page shows the statuses your team recorded. Live courier scans (out for delivery, hub transfers, proof of delivery) need a carrier tracking API.'));
}

export async function shippingCarriers() {
  const d = await api('/shipping/overview');
  const rows = [['Courier booking and AWB generation', 'Courier or aggregator API account', 'Not connected'], ['Pickup scheduling', 'Courier pickup API', 'Not connected'], ['Live tracking and proof of delivery', 'Carrier tracking webhooks', 'Not connected'], ['Serviceability and rate lookup by PIN code', 'Courier rate-card API', 'Not connected'], ['Shipping label with scannable barcode', 'Built in (Code 39 shipment ID)', 'Available'], ['Shipment records and status history', 'Built in', 'Available']];
  return h('div.stack', pageHead({ title: 'Carrier integration', subtitle: 'What works today and what needs a logistics partner.', trail: [['Shipping', '/seller/shipping'], 'Carrier integration'] }), subnav(SHIP_NAV),
    banner('', [h('b', 'Current mode: self-ship. '), d.integration.note]),
    h('div.card', dataTable({ rows, columns: [{ label: 'Capability', render: (r) => h('b.strong', r[0]) }, { label: 'Depends on', render: (r) => r[1] }, { label: 'Status', render: (r) => badge(r[2], r[2] === 'Available' ? 'green' : '') }] })),
    carrierNote());
}
