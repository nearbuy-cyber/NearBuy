// Customer order tracking. The private link in the address bar identifies one order; nothing else is reachable from it.
import { h, mount, api, act, money, dt, clock, ago, mins, badge, statusBadge, spinner, empty, note, card, kv, btn, toast, form, formModal, live, plot, plotLegend } from '/delivery/kit.js';

const root = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t') || '';
const frame = (...body) => mount(root, h('div', { class: 'phone', style: 'padding-bottom:40px' }, h('header', { class: 'top' }, h('div', { class: 'brand' }, h('img', { src: '/delivery/logo.svg', alt: '', width: 34, height: 34 }), h('span', null, 'Order tracking', h('small', null, 'Delivered by Routely')))), h('main', { class: 'stack' }, ...body)));
let categories = {};

function draw(d) {
  const post = (path, body) => api(`/api/track/${token}/${path}`, { method: 'POST', body });
  const eta = mins(d.eta_at);
  const isReturn = d.kind === 'return';
  const pts = [{ lat: d.pickup.lat, lng: d.pickup.lng, kind: 'pickup', label: d.pickup.name, to: d.drop }, { lat: d.drop.lat, lng: d.drop.lng, kind: 'drop', label: isReturn ? d.store : 'Your address' }, d.partner_location ? { lat: d.partner_location.lat, lng: d.partner_location.lng, kind: 'partner', label: d.partner.first_name } : null];
  const stars = () => { let picked = 0; const row = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Rating' }); const paint = () => [...row.children].forEach((b, i) => { b.classList.toggle('on', i < picked); b.setAttribute('aria-checked', String(i + 1 === picked)); });
    for (let i = 1; i <= 5; i += 1) row.append(h('button', { type: 'button', role: 'radio', 'aria-label': `${i} star${i > 1 ? 's' : ''}`, onclick: () => { picked = i; paint(); } }, '★'));
    const comment = h('input', { class: 'input', placeholder: 'Anything to add? (optional)', maxlength: 300, 'aria-label': 'Comment' });
    return h('div', { class: 'stack tight' }, row, comment, btn('Submit rating', async (b) => { if (!picked) return toast('Choose 1 to 5 stars.', 'bad'); const r = await act(b, () => post('rating', { rating: picked, comment: comment.value.trim() || undefined }), 'Thank you for your rating.'); if (r) draw(r.delivery); return undefined; }, 'primary')); };
  frame(
    h('div', { class: 'row between' }, h('div', null, h('h1', null, isReturn ? 'Return pickup' : d.status === 'delivered' ? 'Delivered' : 'Your order'), h('div', { class: 'small muted' }, `${d.store} · Order ${d.order_code}`)), statusBadge(d.status, d.status_label)),
    d.exception ? h('div', { class: 'card bad stack tight' }, h('strong', null, d.exception.label), d.exception.reason ? h('p', null, d.exception.reason) : null, h('p', { class: 'small' }, d.exception.status === 'delivery_attempt_failed' ? 'Our team is deciding the next step and will try to reach you.' : d.exception.status === 'cancelled' ? 'This delivery was cancelled.' : 'The package is going back to the seller.')) : null,
    !d.exception && d.eta_at ? h('div', { class: 'card accent' }, h('div', { class: 'small muted' }, d.method === 'scheduled' && d.scheduled_for ? `Scheduled delivery · ${dt(d.scheduled_for)}` : 'Estimated arrival'), h('div', { style: 'font-size:28px;font-weight:800' }, eta > 0 ? `${clock(d.eta_at)} · about ${eta} min` : `${clock(d.eta_at)} · arriving`), h('div', { class: 'small muted' }, 'The estimate updates as the order is prepared and the partner moves.')) : null,
    d.delivery_code && !d.exception ? card(null, h('div', { class: 'small muted center' }, 'Your delivery code'), h('div', { class: 'codebox', 'aria-label': `Delivery code ${d.delivery_code.split('').join(' ')}` }, d.delivery_code), h('p', { class: 'small muted center' }, 'Give this code to the delivery partner only when you receive your order.')) : null,
    d.return_pickup_code ? card(null, h('div', { class: 'small muted center' }, 'Return pickup code'), h('div', { class: 'codebox' }, d.return_pickup_code), h('p', { class: 'small muted center' }, 'Give this code to the delivery partner when you hand over the product.')) : null,
    d.can_confirm ? h('div', { class: 'card accent stack' }, h('strong', null, 'Your delivery partner has arrived'), h('p', { class: 'small' }, 'Share the delivery code, or confirm here once the order is in your hands.'), btn('I have received my order', async (b) => { const r = await act(b, () => post('confirm'), 'Thank you. Receipt confirmed.'); if (r) draw(r.delivery); }, 'primary big block')) : null,
    card('Progress', h('ol', { class: 'tl' }, d.steps.map((s) => h('li', { style: s.done || s.current ? '' : 'opacity:.45' }, h('div', { class: 't1' }, s.label, s.current ? [' ', badge('Now', 'ok')] : null), h('div', { class: 't2' }, s.at ? dt(s.at) : s.done ? '' : 'Pending'))))),
    d.partner ? card('Delivery partner', h('div', { class: 'row between' }, h('div', null, h('strong', null, d.partner.first_name), h('div', { class: 'small muted' }, [d.partner.vehicle, d.partner.vehicle_number_ending ? `number ending ${d.partner.vehicle_number_ending}` : null, d.partner.rating ? `${d.partner.rating} ★` : null].filter(Boolean).join(' · '))), badge('Verified partner', 'ok')),
      h('p', { class: 'small muted' }, 'For your privacy and theirs, phone numbers are not shared. Use "Report a problem" below if you need help.'),
      d.partner_location ? [plot(pts, [], { height: 240 }), plotLegend(), h('div', { class: 'small muted' }, `Partner location updated ${ago(d.partner_location.at)}${d.partner_location.stale ? ' — waiting for a new update' : ''}.`)] : h('div', { class: 'small muted' }, 'Live location is shown while your order is on the way.')) : (d.exception ? null : card('Delivery partner', h('p', { class: 'muted' }, 'A delivery partner will be assigned when your order is nearly ready.'))),
    d.can_edit_preferences ? card('Delivery preferences', form([{ name: 'instructions', label: 'Instructions for the delivery partner', value: d.instructions, max: 200, placeholder: 'Landmark, gate, floor…' },
      d.payment_type === 'cod' ? null : { name: 'contactless', type: 'checkbox', value: d.contactless, label: 'Contactless delivery: leave the order at my door. I agree to a photo of the package as proof of delivery.' },
      { name: 'allow_alternative', type: 'checkbox', value: d.allow_alternative, label: 'If I am not available, the order may be handed to another person at my address.' }], { submit: 'Save preferences', onSubmit: async (v) => { const r = await post('preferences', v); toast('Preferences saved.', 'ok'); draw(r.delivery); } })) : null,
    d.can_rate ? card('Rate your delivery', stars()) : d.rating ? card('Your rating', h('div', null, `${'★'.repeat(d.rating)}${'☆'.repeat(5 - d.rating)}`)) : null,
    card('Order', d.items.length ? h('div', { class: 'stack tight' }, d.items.map((i) => h('div', { class: 'row between' }, h('span', null, `${i.qty} × ${i.title}${i.variant_label ? ` (${i.variant_label})` : ''}`)))) : null,
      kv([['Deliver to', d.address], ['Items', money(d.totals.subtotal)], ['Delivery fee', money(d.totals.delivery_fee)], ['Total', h('strong', null, money(d.totals.total))], ['Payment', d.payment_type === 'cod' ? `Cash on delivery — pay ${money(d.cod_amount)} at the door` : `Paid (${d.totals.payment_method})`]]),
      d.fee_breakdown ? h('div', { class: 'small muted' }, `Delivery fee: base ${money(d.fee_breakdown.base)} + distance ${money(d.fee_breakdown.distance)}${d.fee_breakdown.scheduled ? ` + slot ${money(d.fee_breakdown.scheduled)}` : ''}${d.fee_breakdown.handling ? ` + handling ${money(d.fee_breakdown.handling)}` : ''} + tax ${money(d.fee_breakdown.tax)}. Shown to you before the order was placed.`) : null),
    d.return_pickups.length ? card('Return pickups', d.return_pickups.map((r) => h('a', { class: 'row between', href: r.url }, h('span', null, r.code), badge(r.status_label, 'info')))) : null,
    d.notifications.length ? card('Updates', h('ol', { class: 'tl' }, d.notifications.map((n) => h('li', null, h('div', { class: 't1' }, n.title), h('div', { class: 't2' }, [dt(n.created_at), n.body].filter(Boolean).join(' · ')))))) : null,
    btn('Report a problem', () => formModal('Report a delivery problem', [{ name: 'category', label: 'What went wrong?', type: 'select', required: true, options: Object.entries(categories) }, { name: 'description', label: 'Tell us what happened', type: 'textarea', required: true, max: 1500 }],
      { submit: 'Send report', onSubmit: async (v) => { const r = await post('issues', v); toast(r.message, 'ok'); } }), 'block'));
}
async function load(silent) {
  if (!/^[\w-]{16,}$/.test(token)) return frame(h('div', { class: 'card stack' }, h('h1', null, 'Tracking link needed'), h('p', null, 'Open the tracking link from your order confirmation. Each link is private to one order.')));
  if (!silent) frame(spinner());
  if (silent && (document.querySelector('.modal-back') || ['INPUT', 'TEXTAREA'].includes((document.activeElement || {}).tagName))) return undefined;
  try { const r = await api(`/api/track/${token}`); categories = r.complaint_categories; draw(r.delivery); } catch (e) { if (!silent) frame(h('div', { class: 'card bad stack' }, h('h1', null, e.status === 404 ? 'Link not valid' : 'Could not load'), h('p', null, e.message), btn('Try again', () => load()))); }
  return undefined;
}
load();
if (/^[\w-]{16,}$/.test(token)) { live({ portal: 'track', t: token }, () => load(true)); setInterval(() => load(true), 30000); }
