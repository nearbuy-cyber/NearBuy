// Routely Fleet — portal for logistics companies. Shows only the signed-in manager's own fleet.
import { h, mount, api, act, money, dt, day, ago, pct, val, badge, statusBadge, demoTag, spinner, empty, note, stat, card, btn, brand, table, tabs, toast, form, formModal, currentRoute, go, onRoute, live, plot, plotLegend } from '/delivery/kit.js';

const root = document.getElementById('app');
const S = { me: null, refresh: null, publicConfig: null, stopLive: null };
const NAV = [['/', 'Overview'], ['/roster', 'Roster'], ['/deliveries', 'Deliveries'], ['/performance', 'Performance'], ['/settlements', 'Settlements'], ['/support', 'Support'], ['/users', 'Fleet users']];

function shell(active, heading, actions, ...body) {
  mount(root, h('div', { class: 'desk' },
    h('aside', { class: 'side' }, brand('Fleet'), NAV.map(([path, label]) => h('a', { class: 'nav', href: `#${path}`, 'aria-current': active === path ? 'page' : null }, label, path === '/' && S.me.unread ? h('span', { class: 'pill' }, S.me.unread) : null)),
      h('div', { class: 'foot' }, h('span', null, `${S.me.user.name} · ${S.me.fleet.name}`), h('button', { type: 'button', onclick: async () => { await api('/api/fleet/logout', { method: 'POST' }).catch(() => {}); S.me = null; render(); } }, 'Sign out'))),
    h('main', { class: 'main stack' }, h('div', { class: 'head' }, h('h1', null, heading, ' ', demoTag(S.me.fleet.is_demo)), h('div', { class: 'row' }, actions)), ...body)));
}
async function page(active, heading, load, draw, silent) {
  if (!silent) shell(active, heading, null, spinner());
  const at = location.hash;
  try { const d = await load(); if (location.hash === at) draw(d); } catch (e) { if (e.status === 401) { S.me = null; return render(); } if (!silent) shell(active, heading, null, h('div', { class: 'card bad stack' }, h('p', null, e.message), btn('Try again', () => page(active, heading, load, draw)))); }
  return undefined;
}
async function pageLogin() {
  if (!S.publicConfig) S.publicConfig = await api('/api/delivery/public-config').catch(() => ({}));
  const demo = S.publicConfig.demo;
  const f = form([{ name: 'email', label: 'Work email', type: 'email', required: true, autocomplete: 'username' }, { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }], { submit: 'Sign in', onSubmit: async (v) => { await api('/api/fleet/login', { method: 'POST', body: v }); await boot(); } });
  mount(root, h('div', { class: 'auth' }, h('div', { class: 'panel stack' }, brand('Fleet'), h('div', { class: 'card stack' }, h('h1', null, 'Fleet manager sign in'), h('p', { class: 'muted' }, 'Manage your delivery partners, see their assignments and settlement reports. Fleet accounts are created by the network operations team.'), f,
    demo ? h('div', { class: 'note test stack tight' }, h('div', null, h('strong', null, 'TEST ENVIRONMENT · '), 'A sample fleet (demo data) is available.'), btn('Fill demo fleet sign-in', () => { f.controls.email.value = demo.fleet.email; f.controls.password.value = demo.fleet.password; }, 'sm')) : null))));
}
const deliveryCols = [{ label: 'Delivery', render: (x) => h('div', null, h('strong', null, x.code), ' ', demoTag(x.is_demo), h('div', { class: 'small muted' }, x.category_label)) }, { label: 'Status', render: (x) => statusBadge(x.status, x.status_label) }, { label: 'Member', render: (x) => (x.partner ? `${x.partner.first_name} · ${x.partner.code}` : '—') },
  { label: 'Route', render: (x) => `${x.pickup_name} → ${x.drop_area}` }, { label: 'Distance', render: (x) => `${x.distance_km} km` }, { label: 'Earning', right: true, render: (x) => money(x.earning) }, { label: 'When', render: (x) => dt(x.completed_at || x.assigned_at || x.created_at) }];

function pageOverview(silent) {
  S.refresh = () => pageOverview(true);
  return page('/', S.me.fleet.name, () => api('/api/fleet/overview'), (d) => shell('/', S.me.fleet.name, null,
    h('div', { class: 'grid g4' }, stat('Members', d.members.total, `${d.members.approved} approved`), stat('Online now', d.members.online), stat('Active assignments', d.active_assignments), stat('Completed today', d.completed_today),
      stat('Applications in review', d.members.in_review), stat('On hold / suspended', `${d.members.on_hold} / ${d.members.suspended}`), stat('Completed in 7 days', d.week.completed, `Success rate ${pct(d.week.success_rate)}`), stat('Member earnings, 7 days', money(d.week.earnings))),
    card('Live assignments', (() => { const pts = []; d.live.forEach((x) => { pts.push({ lat: x.pickup.lat, lng: x.pickup.lng, kind: 'pickup', label: x.code }); if (x.partner_location) pts.push({ lat: x.partner_location.lat, lng: x.partner_location.lng, kind: 'partner', label: x.partner.first_name }); }); return d.live.length ? [plot(pts), plotLegend(['pickup', 'partner'])] : null; })(),
      table(deliveryCols, d.live, { emptyText: 'No member is on a delivery right now.' }), h('p', { class: 'small muted' }, 'Fleet managers see the pickup point and the drop area only — never the customer\'s name, phone number or address.')),
    card(h('div', { class: 'row between' }, h('h2', null, 'Notifications'), S.me.unread ? btn('Mark read', async (b) => { await act(b, () => api('/api/fleet/notifications/read', { method: 'POST' })); S.me.unread = 0; pageOverview(true); }, 'sm') : null),
      d.notifications.length ? h('ol', { class: 'tl' }, d.notifications.map((n) => h('li', null, h('div', { class: 't1' }, n.title), h('div', { class: 't2' }, [ago(n.created_at), n.body].filter(Boolean).join(' · '))))) : empty('No notifications.'))), silent);
}
function pageRoster(silent) {
  S.refresh = () => pageRoster(true);
  const again = () => pageRoster(true);
  return page('/roster', 'Roster', () => api('/api/fleet/roster'), (d) => shell('/roster', 'Roster', null,
    h('div', { class: 'card accent row between' }, h('div', null, h('strong', null, 'Fleet join code: '), h('span', { class: 'mono' }, d.join_code), h('div', { class: 'small muted' }, 'A new partner enters this code when registering in the partner app. Their documents are still verified by the network before they can deliver.')), h('a', { class: 'btn', href: '/runner/#/register', target: '_blank', rel: 'noopener' }, 'Partner registration')),
    table([{ label: 'Member', render: (m) => h('div', null, h('strong', null, m.name), h('div', { class: 'small muted' }, `${m.code} · ${m.mobile_masked}`)) }, { label: 'Application', render: (m) => statusBadge(m.status, m.status_label) },
      { label: 'Eligibility', render: (m) => (m.eligible ? badge(m.online ? 'Eligible · online' : 'Eligible · offline', m.online ? 'ok' : '') : h('div', null, badge('Not eligible', 'bad'), h('div', { class: 'tiny muted' }, m.blockers.join(', ')))) },
      { label: 'Vehicle', key: 'vehicle' }, { label: 'Now', render: (m) => m.active_delivery || '—' }, { label: '30 days', right: true, render: (m) => m.completed_30d }, { label: 'Rating', render: (m) => (m.rating ? `${m.rating} ★` : '—') }, { label: 'Documents valid', render: (m) => (m.documents_valid_until ? day(m.documents_valid_until) : '—') },
      { label: '', render: (m) => h('div', { class: 'row' }, m.on_hold ? btn('Lift hold', async (b) => { const r = await act(b, () => api(`/api/fleet/roster/${m.code}/hold`, { method: 'POST', body: { hold: false } }), 'Hold lifted.'); if (r) again(); }, 'sm primary')
        : btn('Hold', () => formModal(`Put ${m.name} on hold`, [{ name: 'reason', label: 'Reason', required: true }], { submit: 'Place hold', intro: 'The member is taken offline and receives no offers until you lift the hold.', onSubmit: async (v) => { await api(`/api/fleet/roster/${m.code}/hold`, { method: 'POST', body: { hold: true, ...v } }); again(); } }), 'sm'),
      btn('Remove', () => formModal(`Remove ${m.name} from the fleet`, [{ name: 'reason', label: 'Reason', required: true }], { submit: 'Remove from fleet', danger: true, intro: 'The partner keeps their account and continues as an individual partner.', onSubmit: async (v) => { await api(`/api/fleet/roster/${m.code}/remove`, { method: 'POST', body: v }); again(); } }), 'sm danger')) }], d.members, { emptyText: 'No members yet. Share the join code with your delivery partners.' })), silent);
}
function pageDeliveries(silent) {
  const tab = currentRoute().query.tab || 'active';
  S.refresh = () => pageDeliveries(true);
  return page('/deliveries', 'Deliveries', () => api('/api/fleet/deliveries', { query: { tab } }), (d) => shell('/deliveries', 'Deliveries', null, tabs([['active', 'Active'], ['completed', 'Completed'], ['all', 'All']], tab, (k) => go(`/deliveries?tab=${k}`)), table(deliveryCols, d.deliveries, { emptyText: 'No deliveries here.' })), silent);
}
function pagePerformance() {
  S.refresh = null;
  return page('/performance', 'Performance', () => api('/api/fleet/performance'), (d) => shell('/performance', 'Performance', null, h('div', { class: 'small muted' }, d.period), note(d.note),
    table([{ label: 'Member', render: (m) => `${m.name} · ${m.code}` }, { label: 'Completed', key: 'completed', right: true }, { label: 'Avg. delivery time', render: (m) => val(m.average_minutes, ' min') }, { label: 'Offer acceptance', render: (m) => pct(m.acceptance_rate) }, { label: 'Failed attempts', key: 'failed_attempts', right: true }, { label: 'Rating', render: (m) => (m.rating ? `${m.rating} ★` : '—') }], d.members, { emptyText: 'No members yet.' })));
}
function pageSettlements() {
  S.refresh = null;
  const month = h('input', { class: 'input', type: 'month', value: new Date().toISOString().slice(0, 7), 'aria-label': 'Invoice month', style: 'max-width:180px' });
  return page('/settlements', 'Settlements', () => api('/api/fleet/settlements'), (d) => shell('/settlements', 'Settlements', [month, btn('Download invoice report (CSV)', () => { location.href = `/api/fleet/invoice.csv?month=${month.value}`; })], note(d.note),
    card('Member balances', table([{ label: 'Member', render: (m) => `${m.name} · ${m.code}` }, { label: 'Payout account', render: (m) => statusBadge(m.payout_account) }, { label: 'Available', right: true, render: (m) => money(m.available) }, { label: 'Pending', right: true, render: (m) => money(m.pending) }, { label: 'In payout', right: true, render: (m) => money(m.in_payout) }, { label: 'Paid', right: true, render: (m) => money(m.paid) }, { label: 'Cash in hand', right: true, render: (m) => money(m.cash_in_hand) }], d.members, { emptyText: 'No members yet.' })),
    card('Payouts', table([{ label: 'Payout', render: (p) => h('div', null, h('strong', null, p.code), h('div', { class: 'small muted' }, `${p.partner_code} · ${dt(p.created_at)}`)) }, { label: 'Status', render: (p) => h('div', null, statusBadge(p.status), h('div', { class: 'small muted' }, p.status === 'paid' ? `Ref ${p.reference}` : p.failure_reason || '')) }, { label: 'Amount', right: true, render: (p) => money(p.amount) }], d.payouts, { emptyText: 'No payouts yet.' }))));
}
function pageSupport(parts) {
  S.refresh = null;
  const cats = S.me.ticket_categories;
  if (parts[1]) return page('/support', `Ticket ${parts[1]}`, () => api(`/api/fleet/tickets/${parts[1]}`), ({ ticket: t }) => shell('/support', `Ticket ${t.code}`, null, h('div', { class: 'row' }, statusBadge(t.status), badge(t.category_label, 'info'), h('a', { class: 'small', href: '#/support' }, '← All tickets')),
    card(t.subject, h('p', null, t.description), h('div', { class: 'small muted' }, dt(t.created_at))),
    card('Conversation', t.messages.length ? t.messages.map((m) => h('div', { class: `note ${m.author_type === 'support' ? 'ok' : ''}` }, h('strong', null, m.author_type === 'support' ? 'Network support' : m.author_name), ` · ${dt(m.created_at)}`, h('div', null, m.body))) : empty('No replies yet.'),
      form([{ name: 'body', label: 'Add a message', type: 'textarea', required: true }], { submit: 'Send', onSubmit: async (v) => { await api(`/api/fleet/tickets/${t.code}/messages`, { method: 'POST', body: v }); pageSupport(parts); } }))));
  return page('/support', 'Support', () => api('/api/fleet/tickets'), (d) => shell('/support', 'Support', btn('New ticket', () => formModal('New support ticket', [{ name: 'category', label: 'Topic', type: 'select', required: true, options: Object.entries(cats) }, { name: 'subject', label: 'Subject', required: true, max: 120 }, { name: 'description', label: 'Details', type: 'textarea', required: true }],
    { submit: 'Send to network support', onSubmit: async (v) => { const r = await api('/api/fleet/tickets', { method: 'POST', body: v }); go(`/support/${r.code}`); } }), 'primary'),
  table([{ label: 'Ticket', render: (t) => h('div', null, h('strong', null, t.subject), h('div', { class: 'small muted' }, `${t.code} · ${t.category_label}`)) }, { label: 'Status', render: (t) => statusBadge(t.status) }, { label: 'Updated', render: (t) => ago(t.updated_at) }], d.tickets, { emptyText: 'No tickets raised.', onRow: (t) => go(`/support/${t.code}`) })));
}
function pageUsers() {
  S.refresh = null;
  return page('/users', 'Fleet users', () => api('/api/fleet/users'), (d) => shell('/users', 'Fleet users', btn('Add user', () => formModal('Add a fleet user', [{ name: 'manager_name', label: 'Name', required: true }, { name: 'manager_email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true, hint: 'At least 8 characters with upper and lower case letters and a number.' }],
    { submit: 'Add user', onSubmit: async (v) => { await api('/api/fleet/users', { method: 'POST', body: v }); toast('User added.', 'ok'); pageUsers(); } }), 'primary'),
  table([{ label: 'User', render: (u) => h('div', null, h('strong', null, u.name), u.you ? [' ', badge('You', 'ok')] : null, h('div', { class: 'small muted' }, u.email)) }, { label: 'Last sign-in', render: (u) => (u.last_login_at ? dt(u.last_login_at) : 'Never') },
    { label: '', render: (u) => (u.you ? null : btn('Remove access', async (b) => { const r = await act(b, () => api(`/api/fleet/users/${u.id}`, { method: 'DELETE' }), 'Access removed.'); if (r) pageUsers(); }, 'sm danger')) }], d.users)));
}
function render() {
  if (!S.me) return pageLogin();
  const r = currentRoute();
  return ({ undefined: pageOverview, roster: pageRoster, deliveries: pageDeliveries, performance: pagePerformance, settlements: pageSettlements, support: () => pageSupport(r.parts), users: pageUsers }[r.parts[0]] || (() => go('/')))();
}
let started = false;
async function boot() {
  try { S.me = await api('/api/fleet/me'); } catch (e) { if (e.status !== 401) toast(e.message, 'bad'); S.me = null; }
  if (S.me && !S.stopLive) S.stopLive = live({ portal: 'fleet' }, () => { if (!S.me || document.querySelector('.modal-back')) return; api('/api/fleet/me').then((m) => { S.me = m; }).catch(() => {}); if (S.refresh) S.refresh(); });
  if (!started) { started = true; onRoute(() => { window.scrollTo(0, 0); render(); }); } else render();
}
boot();
