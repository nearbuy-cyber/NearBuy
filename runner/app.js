// Routely Partner — the delivery partner app. Every number and status on these screens is read from the server.
import { withSession } from '/delivery/session.js';
import { h, mount, api, act, money, dt, day, clock, ago, mins, pct, val, badge, statusBadge, demoTag, spinner, empty, note, stat, card, kv, btn, brand, table, timeline, tabs, toast, modal, form, formModal, confirmModal, currentRoute, go, onRoute, live, plot, plotLegend, mapsLink, readFileInput, svg } from '/delivery/kit.js';

const root = document.getElementById('app');
const S = { me: null, config: null, publicConfig: null, stopLive: null, watch: null, lastSent: 0, geo: 'idle', timers: [] };
const approved = () => S.me && S.me.partner.status === 'approved';
const every = (ms, fn) => { const t = setInterval(fn, ms); S.timers.push(t); return t; };
const clearTimers = () => { S.timers.forEach(clearInterval); S.timers = []; };

/* ---------- Session ---------- */
async function loadMe() {
  try { S.me = await api('/api/partners/me'); S.config = S.me.config; } catch (e) { if (e.status === 401) S.me = null; else throw e; }
  return S.me;
}
async function signOut() { stopLocation(); if (S.stopLive) S.stopLive(); S.stopLive = null; try { await api('/api/partners/logout', { method: 'POST' }); } catch { /* already signed out */ } S.me = null; go('/login'); }

/* ---------- Location (only while online or on a delivery) ---------- */
async function sendLocation(lat, lng, accuracy, source) {
  try { await api('/api/partners/location', { method: 'POST', body: { lat, lng, accuracy, source } }); S.lastSent = Date.now(); return true; } catch (e) { if (e.status !== 409 && e.status !== 429) console.warn(e.message); return false; }
}
function startLocation() {
  if (S.watch !== null || !navigator.geolocation) { if (!navigator.geolocation) S.geo = 'unsupported'; return; }
  S.watch = navigator.geolocation.watchPosition((pos) => {
    S.geo = 'on';
    if (Date.now() - S.lastSent > 8000) sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
  }, (err) => { S.geo = err.code === 1 ? 'denied' : 'error'; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function stopLocation() { if (S.watch !== null && navigator.geolocation) navigator.geolocation.clearWatch(S.watch); S.watch = null; S.geo = 'idle'; }
const geoNote = () => (S.geo === 'denied' ? note('Location permission is blocked. Allow location for this site in your browser settings — arrival at pickup and drop is confirmed by GPS.', 'warn')
  : S.geo === 'unsupported' || S.geo === 'error' ? note('Your device is not reporting a location right now. Arrival can be confirmed once GPS is available.', 'warn') : null);
/** Testing environments only: lets a tester place the partner at a point, because a tester cannot ride to it. */
function testLocation(points, refresh) {
  if (!S.config.test_tools) return null;
  return h('div', { class: 'note test stack tight' }, h('div', null, h('strong', null, 'TEST TOOL · '), 'Place this partner at a point instead of using GPS. Not available in production.'),
    h('div', { class: 'row' }, points.filter((p) => p && Number.isFinite(p.lat)).map((p) => btn(p.label, async (b) => { const ok = await act(b, () => api('/api/partners/location', { method: 'POST', body: { lat: p.lat, lng: p.lng, source: 'test' } })); if (ok) { toast(`Test location set: ${p.label}`, 'ok'); if (refresh) refresh(); } }, 'sm'))));
}

/* ---------- Shell ---------- */
const ICON = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10', tasks: 'M4 7h16v12H4zM8 7V4h8v3M4 12h16', earn: 'M4 6h16v12H4zM12 9v6M9.5 10.5h3.2a1.3 1.3 0 0 1 0 2.6h-1.4a1.3 1.3 0 0 0 0 2.6h3.2',
  perf: 'M4 19V9M10 19V5M16 19v-7M21 19H3', help: 'M12 21a9 9 0 1 0-9-9c0 1.6.4 3 1.1 4.3L3 21l4.8-1.1A9 9 0 0 0 12 21zM9.8 9.5a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7M12 16.3v.2', me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
};
const icon = (d) => svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d }));
function shell(active, heading, ...body) {
  const nav = approved()
    ? [['/', 'Home', 'home'], ['/tasks', 'Tasks', 'tasks'], ['/earnings', 'Earnings', 'earn'], ['/performance', 'Performance', 'perf'], ['/support', 'Support', 'help'], ['/profile', 'Profile', 'me']]
    : [['/', 'Application', 'home'], ['/support', 'Support', 'help'], ['/profile', 'Profile', 'me']];
  mount(root, h('div', { class: 'phone' },
    h('header', { class: 'top' }, brand('Partner'), h('div', { class: 'row' }, demoTag(S.me.partner.is_demo), h('a', { class: 'btn sm', href: '#/notifications', 'aria-label': `Notifications, ${S.me.unread_notifications} unread` }, 'Alerts', S.me.unread_notifications ? badge(S.me.unread_notifications, 'bad') : null))),
    h('main', { class: 'stack' }, heading ? h('h1', null, heading) : null, ...body)),
  h('div', { class: 'tabbar' }, h('nav', { 'aria-label': 'Main' }, nav.map(([path, label, ic]) => h('a', { href: `#${path}`, 'aria-current': active === path ? 'page' : null }, icon(ICON[ic]), label)))));
}
const loading = (active, heading) => shell(active, heading, spinner());
const failed = (active, heading, e, retry) => shell(active, heading, h('div', { class: 'card bad stack' }, h('p', null, e.message), btn('Try again', retry)));

/* ---------- Sign in, register, reset ---------- */
function authPage(heading, sub, ...body) {
  mount(root, h('div', { class: 'auth' }, h('div', { class: 'panel stack' }, brand('Partner', '#/login'), h('div', { class: 'card stack' }, h('h1', null, heading), sub ? h('p', { class: 'muted' }, sub) : null, ...body))));
}
const testCode = (r) => (r && r.test_code ? note(`${r.test_note} Code: ${r.test_code}`, 'test') : null);
async function pageLogin() {
  if (!S.publicConfig) S.publicConfig = await api('/api/delivery/public-config').catch(() => ({}));
  let mode = 'password';
  const draw = () => {
    const demo = S.publicConfig.demo;
    const pw = form([{ name: 'identifier', label: 'Mobile number or email', required: true, autocomplete: 'username' }, { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }],
      { submit: 'Sign in', onSubmit: async (v) => { await api('/api/partners/login', { method: 'POST', body: v }); await enter(); } });
    const otpBox = h('div', { class: 'stack' });
    const askOtp = () => mount(otpBox, form([{ name: 'mobile', label: 'Mobile number', type: 'tel', inputmode: 'numeric', required: true, max: 10, autocomplete: 'tel-national' }], {
      submit: 'Send one-time code', onSubmit: async (v) => {
        const r = await api('/api/partners/login/otp', { method: 'POST', body: v });
        mount(otpBox, testCode(r) || note('A code has been sent to your mobile number.', 'ok'), form([{ name: 'code', label: 'One-time code', inputmode: 'numeric', required: true, code: true, max: 6, autocomplete: 'one-time-code' }],
          { submit: 'Verify and sign in', onSubmit: async (c) => { await api('/api/partners/login/otp/verify', { method: 'POST', body: { mobile: v.mobile, code: c.code } }); await enter(); } }), btn('Use a different number', askOtp, 'ghost sm'));
      } }));
    askOtp();
    authPage('Sign in', 'Deliver food, groceries and parcels in your area.',
      tabs([['password', 'Password'], ['otp', 'One-time code']], mode, (m) => { mode = m; draw(); }), mode === 'password' ? pw : otpBox,
      h('div', { class: 'row between small' }, h('a', { href: '#/forgot' }, 'Forgot password?'), h('a', { href: '#/register' }, 'Become a delivery partner')),
      demo ? h('div', { class: 'note test stack tight' }, h('div', null, h('strong', null, 'TEST ENVIRONMENT · '), 'A sample approved partner (demo data) is available.'),
        btn('Fill demo partner sign-in', () => { mode = 'password'; draw(); const f = root.querySelector('form'); f.controls.identifier.value = demo.partner.identifier; f.controls.password.value = demo.partner.password; }, 'sm')) : null);
  };
  draw();
}
function pageRegister() {
  authPage('Become a delivery partner', 'Create your account, then complete your profile, vehicle and documents. You can deliver after your application is approved.',
    form([
      { name: 'name', label: 'Full name', required: true, autocomplete: 'name', max: 80 }, { name: 'mobile', label: 'Mobile number', type: 'tel', inputmode: 'numeric', required: true, max: 10, hint: '10-digit Indian mobile number', autocomplete: 'tel-national' },
      { name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email' }, { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 8 characters with an uppercase letter, a lowercase letter and a number.' },
      { name: 'fleet_code', label: 'Fleet code', hint: 'Only if a logistics company asked you to join their fleet.' },
      { name: 'accept_terms', type: 'checkbox', label: 'I agree to the delivery partner terms and to the use of my location while I am online or on a delivery.' },
    ], { submit: 'Create account', onSubmit: async (v) => { await api('/api/partners/applications', { method: 'POST', body: v }); await enter(); } }),
    h('p', { class: 'small' }, 'Already registered? ', h('a', { href: '#/login' }, 'Sign in')));
}
function pageForgot() {
  const box = h('div', { class: 'stack' });
  const ask = () => mount(box, form([{ name: 'identifier', label: 'Mobile number or email', required: true }], { submit: 'Send reset code', onSubmit: async (v) => {
    const r = await api('/api/partners/password/forgot', { method: 'POST', body: v });
    mount(box, testCode(r) || note(r.message, 'ok'), form([{ name: 'code', label: 'Reset code', required: true, code: true, max: 6, inputmode: 'numeric' }, { name: 'password', label: 'New password', type: 'password', required: true, autocomplete: 'new-password' }],
      { submit: 'Change password', onSubmit: async (c) => { const out = await api('/api/partners/password/reset', { method: 'POST', body: { identifier: v.identifier, ...c } }); toast(out.message, 'ok'); go('/login'); } }));
  } }));
  ask();
  authPage('Reset your password', 'We send a one-time code to your registered mobile number or email.', box, h('p', { class: 'small' }, h('a', { href: '#/login' }, 'Back to sign in')));
}
async function enter() {
  await loadMe();
  startLive();
  go('/');
}

/* ---------- Onboarding (application) ---------- */
function uploadRow(kind, doc, done) {
  const input = h('input', { type: 'file', class: 'input', accept: kind === 'photo' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf', 'aria-label': `Choose ${S.config.document_kinds[kind]}` });
  const editable = S.me.partner.editable || !doc || doc.status === 'rejected';
  return h('div', { class: 'card flat stack tight' }, h('div', { class: 'row between' }, h('strong', null, S.config.document_kinds[kind]), doc ? statusBadge(doc.status, doc.status === 'pending' ? 'Uploaded — awaiting check' : null) : badge('Not uploaded', 'warn')),
    doc ? h('div', { class: 'small muted' }, `${doc.file_name || 'File'} · ${Math.max(1, Math.round(doc.size / 1024))} KB · ${dt(doc.uploaded_at)}`, doc.note ? ` · ${doc.note}` : '') : null,
    doc ? h('a', { class: 'small', href: withSession(`/api/partners/documents/${doc.id}/file`), target: '_blank', rel: 'noopener' }, 'View my upload') : null,
    editable && (!doc || doc.status !== 'verified') ? h('div', { class: 'row' }, h('div', { class: 'grow' }, input), btn(doc ? 'Replace' : 'Upload', async (b) => {
      const r = await act(b, async () => { const file = await readFileInput(input); return api('/api/partners/documents', { method: 'POST', query: { kind, name: file.name }, raw: file }); }, 'Uploaded.');
      if (r) { await loadMe(); done(); }
    }, 'primary')) : null);
}
function pageApplication() {
  S.refresh = async () => { await loadMe(); if (approved()) return render(); draw(); };
  const draw = () => {
    const { partner: p, user: u, checklist, vehicle, documents } = S.me;
    const step = (key) => checklist.find((c) => c.key === key);
    const head = (key, n) => h('div', { class: 'row between' }, h('h2', null, `${n}. ${step(key).label}`), step(key).done ? badge('Done', 'ok') : badge('To do', 'warn'));
    const reload = async () => { await loadMe(); draw(); };
    const save = (path, method) => async (v) => { await api(path, { method, body: v }); toast('Saved.', 'ok'); await reload(); };
    const locked = !p.editable;
    const verifyBlock = (channel, label, isDone, value) => {
      if (isDone) return h('div', { class: 'row between' }, h('span', null, `${label}: `, h('strong', null, value)), badge('Verified', 'ok'));
      const box = h('div', { class: 'stack tight' });
      mount(box, h('div', { class: 'row between' }, h('span', null, `${label}: `, h('strong', null, value)), btn('Send code', async (b) => {
        const r = await act(b, () => api(`/api/partners/verify/${channel}/request`, { method: 'POST' }));
        if (r) mount(box, testCode(r) || note(`Code sent to your ${label.toLowerCase()}.`, 'ok'), form([{ name: 'code', label: `Code sent to ${value}`, required: true, code: true, max: 6, inputmode: 'numeric' }], { submit: 'Verify', onSubmit: async (v) => { await api(`/api/partners/verify/${channel}/confirm`, { method: 'POST', body: v }); toast('Verified.', 'ok'); await reload(); } }));
      }, 'sm primary')));
      return box;
    };
    const banner = {
      draft: note('Complete the five steps below, then submit your application. You cannot receive delivery offers until it is approved.'),
      info_required: h('div', { class: 'card warn stack tight' }, h('strong', null, 'More information is needed'), h('p', null, p.status_note || 'Check the items below and resubmit.')),
      submitted: h('div', { class: 'card accent stack tight' }, h('strong', null, 'Application submitted'), h('p', null, 'Our verification team will check your documents. You will be notified here.')),
      under_review: h('div', { class: 'card accent stack tight' }, h('strong', null, 'Application under review'), h('p', null, 'Verification staff are checking your details.')),
      rejected: h('div', { class: 'card bad stack tight' }, h('strong', null, 'Application not approved'), h('p', null, p.status_note || ''), h('p', { class: 'small' }, 'You can correct your details and submit again.')),
      suspended: h('div', { class: 'card bad stack tight' }, h('strong', null, 'Account suspended'), h('p', null, p.status_note || ''), h('p', { class: 'small' }, 'You cannot go online. Contact support if you think this is a mistake.')),
      expired: h('div', { class: 'card warn stack tight' }, h('strong', null, 'Documents expired'), h('p', null, p.status_note || 'Your documents need to be renewed. Contact support to continue.')),
    }[p.status];
    const doneCount = checklist.filter((c) => c.done).length;
    shell('/', 'Your application',
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, `Partner ID ${p.code}`), statusBadge(p.status, p.status_label)),
      banner, h('div', { class: 'steps', role: 'img', 'aria-label': `${doneCount} of ${checklist.length} steps complete` }, checklist.map((c) => h('span', { class: c.done ? 'on' : '' }))),
      card(head('account', 1), verifyBlock('mobile', 'Mobile', u.mobile_verified, u.mobile), verifyBlock('email', 'Email', u.email_verified, u.email)),
      card(head('profile', 2), form([
        { name: 'city', label: 'City', required: true, value: p.city, max: 60 },
        { name: 'home_zone_id', label: 'Preferred operating zone', type: 'select', required: true, value: p.home_zone_id, options: [['', 'Choose a zone'], ...S.config.zones.map((z) => [z.id, `${z.name}, ${z.city}${z.status === 'active' ? '' : ' (not open yet)'}`])] },
        { name: 'language', label: 'Language', type: 'select', required: true, value: p.language || 'Hindi', options: S.config.languages },
        { name: 'emergency_name', label: 'Emergency contact name', required: true, value: p.emergency_name, max: 80 }, { name: 'emergency_phone', label: 'Emergency contact number', type: 'tel', inputmode: 'numeric', required: true, value: p.emergency_phone, max: 10 },
      ], { submit: 'Save profile', onSubmit: (v) => save('/api/partners/profile', 'PATCH')({ ...v, home_zone_id: v.home_zone_id ? Number(v.home_zone_id) : undefined }) })),
      card(head('vehicle', 3), locked ? kv([['Vehicle', vehicle && vehicle.label], ['Registration', vehicle && vehicle.registration_no], ['Status', vehicle && statusBadge(vehicle.status)]]) : form([
        { name: 'type', label: 'Vehicle type', type: 'select', required: true, value: vehicle ? vehicle.type : '', options: [['', 'Choose a vehicle'], ...S.config.vehicles.map((v) => [v.key, `${v.label}${v.needs_licence ? ' — licence needed' : ''}`])] },
        { name: 'registration_no', label: 'Registration number', value: vehicle && vehicle.registration_no, hint: 'Needed for motor vehicles, for example DL3SAB1234.', max: 16 },
        { name: 'ownership', label: 'Vehicle ownership', type: 'select', value: vehicle ? vehicle.ownership : 'own', options: [['own', 'My own'], ['family', 'Family member'], ['rented', 'Rented'], ['fleet', 'Fleet vehicle']] },
      ], { submit: 'Save vehicle', onSubmit: save('/api/partners/vehicle', 'PUT') })),
      card(head('documents', 4), h('p', { class: 'small muted' }, 'Documents are stored privately and are visible only to verification staff. JPG, PNG or PDF, up to 5 MB.'),
        vehicle ? S.me.required_documents.map((k) => uploadRow(k, documents.find((d) => d.kind === k), draw)) : note('Save your vehicle first — the documents needed depend on it.', 'warn'),
        h('h3', null, 'Payout account'), p.payout ? h('div', { class: 'row between' }, h('span', null, `${p.payout.bank} · account ending ${p.payout.account_ending} · ${p.payout.ifsc}`), statusBadge(p.payout.status)) : null,
        form([{ name: 'holder', label: 'Account holder name', required: true, value: p.payout && p.payout.holder }, { name: 'bank', label: 'Bank name', required: true, value: p.payout && p.payout.bank },
          { name: 'account', label: p.payout ? 'New account number' : 'Account number', required: true, inputmode: 'numeric', hint: 'Stored encrypted. Only the last four digits are shown afterwards.' }, { name: 'ifsc', label: 'IFSC', required: true, value: p.payout && p.payout.ifsc, max: 11 }],
        { submit: p.payout ? 'Replace payout account' : 'Save payout account', onSubmit: save('/api/partners/payout', 'PUT') })),
      card(head('training', 5), S.config.training.map((m) => h('div', { class: 'card flat stack tight' }, h('div', { class: 'row between' }, h('strong', null, m.title), p.training[m.key] ? badge('Acknowledged', 'ok') : null), h('p', { class: 'small' }, m.text),
        p.training[m.key] ? null : btn('I have read and understood this', async (b) => { const r = await act(b, () => api('/api/partners/training', { method: 'POST', body: { module: m.key } })); if (r) reload(); }, 'sm primary')))),
      p.editable ? card('6. Submit for approval', h('p', { class: 'small muted' }, checklist.every((c) => c.done) ? 'Everything is complete. Submit your application for verification.' : `Still to do: ${checklist.filter((c) => !c.done).map((c) => c.label.toLowerCase()).join('; ')}.`),
        btn(p.status === 'draft' ? 'Submit application' : 'Submit again', async (b) => { const r = await act(b, () => api('/api/partners/applications/submit', { method: 'POST' }), 'Application submitted.'); if (r) reload(); }, 'primary big block')) : null,
      card('Application history', historyBox()));
  };
  draw();
}
function historyBox() {
  const box = h('div', null, spinner());
  api('/api/partners/verification-status').then((r) => mount(box, timeline(r.history.map((x) => ({ label: x.label, created_at: x.created_at, actor: x.actor, note: x.note }))))).catch((e) => mount(box, note(e.message, 'bad')));
  return box;
}

/* ---------- Home ---------- */
function offerCard(o, refresh) {
  const total = S.config.offer_seconds || 45;
  const bar = h('i', { style: `width:${Math.min(100, (o.seconds_left / total) * 100)}%` });
  const left = h('strong', null, `${o.seconds_left}s`);
  const tick = () => { const s = Math.max(0, Math.round((Date.parse(o.expires_at) - Date.now()) / 1000)); left.textContent = `${s}s`; bar.style.width = `${Math.min(100, (s / total) * 100)}%`; if (s <= 0) refresh(); };
  every(1000, tick);
  return h('section', { class: 'offer stack', 'aria-label': 'New delivery offer' },
    h('div', { class: 'row between' }, h('strong', null, 'New delivery offer'), h('span', { class: 'small' }, 'Expires in ', left)), h('div', { class: 'timer' }, bar),
    h('div', { class: 'row between' }, h('div', null, h('div', { class: 'earn' }, money(o.earning)), h('div', { class: 'small muted' }, 'Estimated earning')), h('div', { class: 'right' }, badge(o.category_label, 'info'), ' ', badge(o.payment_type === 'cod' ? `Collect ${money(o.cod_amount)}` : 'Prepaid', o.payment_type === 'cod' ? 'warn' : 'ok'))),
    h('div', { class: 'leg' }, h('span', { class: 'pin b' }), h('div', null, h('strong', null, o.pickup.name), h('div', { class: 'small muted' }, `${o.pickup.address} · ${o.pickup_distance_km} km from you, about ${o.pickup_eta_min} min`)),
      h('span', { class: 'pin' }), h('div', null, h('strong', null, `Drop area: ${o.drop_area}`), h('div', { class: 'small muted' }, `${o.trip_distance_km} km trip · full address shown after pickup`))),
    kv([['Estimated total time', `${o.total_minutes} min`], ['Package', `${o.package_count} × ${o.package_type}${o.weight_kg ? ` · ${o.weight_kg} kg` : ''}`], ['Order', o.ready ? 'Ready for pickup' : o.expected_ready_at ? `Ready about ${clock(o.expected_ready_at)}` : 'Being prepared'], o.method === 'scheduled' ? ['Scheduled for', dt(o.scheduled_for)] : null]),
    h('div', { class: 'grid g2' }, btn('Decline', () => formModal('Decline this offer', [{ name: 'reason', label: 'Reason', type: 'select', options: ['Too far', 'Vehicle not suitable', 'Taking a break', 'Other'] }],
      { submit: 'Decline offer', intro: 'Declining does not reduce your pay. The offer goes to the next partner.', onSubmit: async (v) => { await api(`/api/delivery/offers/${o.id}/decline`, { method: 'POST', body: v }); refresh(); } }), 'big'),
    btn('Accept', async (b) => { try { b.disabled = true; const r = await api(`/api/delivery/offers/${o.id}/accept`, { method: 'POST' }); toast('Delivery accepted.', 'ok'); go(`/task/${r.delivery.code}`); } catch (e) { toast(e.message, 'bad'); refresh(); } }, 'primary big')));
}
const taskSummary = (d) => h('a', { class: 'card accent stack tight', href: `#/task/${d.code}`, style: 'text-decoration:none;color:inherit' },
  h('div', { class: 'row between' }, h('strong', null, `Active delivery ${d.code}`), statusBadge(d.status, d.status_label)),
  h('div', { class: 'small' }, `${d.pickup.name} → ${d.drop.area}`), h('div', { class: 'row between small muted' }, `${d.category_label} · ${d.distance_km} km`, h('span', { class: 'strong', style: 'color:var(--brand-d)' }, 'Open task →')));
async function pageHome(silent) {
  if (!approved()) return pageApplication();
  if (!silent) loading('/', 'Home');
  S.refresh = pageHome;
  let d;
  try { d = await api('/api/partners/home'); } catch (e) { if (e.status === 401) return signOut(); return failed('/', 'Home', e, () => pageHome()); }
  if (currentRoute().path !== '/') return undefined;
  clearTimers();
  if (d.online || d.active) startLocation(); else stopLocation();
  every(15000, () => pageHome(true)); // a missed push is caught by this refresh
  const toggle = h('button', { class: 'toggle', role: 'switch', type: 'button', 'aria-checked': String(d.online), 'aria-label': 'Available for deliveries' });
  toggle.addEventListener('click', async () => {
    const r = await act(toggle, () => api('/api/partners/availability', { method: 'PATCH', body: { online: !d.online } }));
    if (r) { if (r.online) startLocation(); else stopLocation(); toast(r.online ? 'You are online. Offers will appear here.' : 'You are offline.', 'ok'); }
    pageHome(true);
  });
  const z = d.zone;
  shell('/', `Hello, ${S.me.user.name.split(' ')[0]}`,
    h('div', { class: `card ${d.online ? 'accent' : ''}` }, h('div', { class: 'switch' }, h('div', null, h('h2', null, d.online ? 'You are online' : 'You are offline'), h('div', { class: 'small muted' }, d.online ? 'Waiting for delivery offers in your zone.' : 'Go online to receive delivery offers.')), toggle),
      d.online_blockers.length && !d.online ? h('div', { class: 'note warn', style: 'margin-top:10px' }, d.online_blockers.join(' ')) : null),
    d.online ? geoNote() : null,
    d.offer ? offerCard(d.offer, () => pageHome(true)) : null,
    d.active ? taskSummary(d.active) : null,
    h('div', { class: 'grid g2' }, stat("Today's deliveries", d.today.completed), stat("Today's earnings", money(d.today.earnings))),
    d.cash_in_hand > 0 ? h('a', { class: 'card warn row between', href: '#/earnings', style: 'text-decoration:none;color:inherit' }, h('span', null, 'Cash to deposit'), h('strong', null, money(d.cash_in_hand))) : null,
    card('Your zone', z ? [h('div', { class: 'row between' }, h('strong', null, `${z.name}, ${z.city}`), statusBadge(z.status, z.status === 'active' ? 'Open' : 'Suspended')),
      plot([d.location && d.online ? { lat: d.location.lat, lng: d.location.lng, label: 'You', kind: 'partner' } : null], [{ lat: z.center_lat, lng: z.center_lng, km: z.radius_km, label: z.name }], { height: 240 }),
      h('div', { class: 'small muted' }, d.online ? (d.location ? `Your location was updated ${ago(d.location.at)}.` : 'Waiting for your first location update.') : 'Your location is not collected while you are offline.'),
      d.online ? testLocation([{ label: `${z.name} centre`, lat: z.center_lat, lng: z.center_lng }], () => pageHome(true)) : null] : empty('No operating zone chosen.')),
    d.notifications.length ? card('Latest alerts', h('ol', { class: 'tl' }, d.notifications.map((n) => h('li', null, h('div', { class: 't1' }, n.title), h('div', { class: 't2' }, [ago(n.created_at), n.body].filter(Boolean).join(' · '))))), h('a', { href: '#/notifications', class: 'small' }, 'All alerts')) : null);
  return undefined;
}

/* ---------- Active task ---------- */
async function pageTask(code, silent) {
  if (!approved()) return go('/');
  if (!silent) loading('/tasks', `Delivery ${code}`);
  S.refresh = () => pageTask(code, true);
  let d;
  try { d = (await api(`/api/deliveries/${code}`)).delivery; } catch (e) {
    if (e.status === 404) { shell('/tasks', `Delivery ${code}`, h('div', { class: 'card stack' }, h('p', null, 'This delivery is no longer assigned to you.'), h('a', { class: 'btn primary', href: '#/' }, 'Back to home'))); return undefined; }
    return failed('/tasks', `Delivery ${code}`, e, () => pageTask(code));
  }
  if (currentRoute().path !== `/task/${code}`) return undefined;
  clearTimers();
  const open = !['delivered', 'returned_to_seller', 'cancelled'].includes(d.status);
  if (open) { startLocation(); every(20000, () => pageTask(code, true)); }
  const refresh = () => pageTask(code, true);
  const post = (path, body, done) => async (b) => { const r = await act(b, () => api(`/api/deliveries/${code}/${path}`, { method: 'POST', body }), done); refresh(); return r; };
  const isReturn = d.kind === 'return';
  const backToSeller = d.kind === 'forward' && d.status === 'return_in_progress';
  const beforePickup = ['partner_assigned', 'en_route_to_pickup', 'arrived_at_pickup', 'pickup_verification_pending'].includes(d.status);
  const giver = isReturn ? 'customer' : 'seller';
  const pickupCard = card(isReturn ? 'Collect from customer' : backToSeller ? 'Return to seller' : 'Pickup', h('strong', null, d.pickup.name), h('div', null, d.pickup.address),
    d.pickup.instructions ? note(`Pickup instructions: ${d.pickup.instructions}`) : null,
    h('div', { class: 'row' }, mapsLink(d.pickup.lat, d.pickup.lng, 'Navigate to pickup'), d.pickup.contact ? h('a', { class: 'btn', href: `tel:${d.pickup.contact}` }, 'Call seller') : null),
    d.pickup.contact_masked ? h('div', { class: 'small muted' }, `Customer contact ${d.pickup.contact_masked} — ask support to connect you.`) : null);
  const dropCard = d.drop.approximate
    ? card(isReturn ? 'Deliver to seller' : 'Customer', h('div', null, `Drop area: `, h('strong', null, d.drop.area)), h('div', { class: 'small muted' }, 'The full address is shown after pickup is confirmed.'))
    : card(isReturn ? 'Deliver to seller' : 'Customer', h('strong', null, d.drop.name), h('div', null, d.drop.address), d.drop.instructions ? note(`Delivery instructions: ${d.drop.instructions}`) : null,
      d.contactless ? badge('Contactless delivery requested', 'info') : null,
      h('div', { class: 'row' }, mapsLink(d.drop.lat, d.drop.lng, 'Navigate to drop'), d.drop.contact ? h('a', { class: 'btn', href: `tel:${d.drop.contact}` }, 'Call seller') : null),
      d.drop.phone_masked ? h('div', { class: 'small muted' }, `Customer contact ${d.drop.phone_masked}. The number is masked — use Support to reach the customer.`) : null);
  const pts = [{ lat: d.pickup.lat, lng: d.pickup.lng, label: 'Pickup', kind: 'pickup' }, d.drop.lat ? { lat: d.drop.lat, lng: d.drop.lng, label: 'Drop', kind: 'drop' } : null];
  const testPts = [{ label: 'At pickup point', lat: d.pickup.lat, lng: d.pickup.lng }, d.drop.lat ? { label: 'At drop point', lat: d.drop.lat, lng: d.drop.lng } : null];
  const release = () => formModal('Hand back this task', [{ name: 'reason', label: 'Why can you not do this delivery?', type: 'textarea', required: true, max: 200 }],
    { submit: 'Hand back task', danger: true, intro: 'The delivery will be offered to another partner. You can hand a task back only before pickup.', onSubmit: async (v) => { await api(`/api/deliveries/${code}/release`, { method: 'POST', body: v }); toast('Task handed back.', 'ok'); go('/'); } });
  const failedAttempt = () => formModal('Report a failed delivery attempt', [{ name: 'reason', label: 'What happened?', type: 'select', required: true, options: ['Customer unavailable', 'Incorrect delivery address', 'Customer refused the order', 'Could not reach the address', 'Other'] }, { name: 'note', label: 'Details', type: 'textarea', max: 200 }],
    { submit: 'Report failed attempt', danger: true, intro: 'Keep the package safe. The operations team will tell you whether to try again or return it to the seller.', onSubmit: async (v) => { await api(`/api/deliveries/${code}/failed-attempt`, { method: 'POST', body: v }); refresh(); } });
  let action;
  if (d.status === 'partner_assigned') action = card('Next step', h('p', null, 'Head to the pickup point.'), btn('Start trip to pickup', post('start'), 'primary big block'), btn('I cannot do this delivery', release, 'danger block'));
  else if (d.status === 'en_route_to_pickup') action = card('Next step', h('p', null, `Confirm when you reach the pickup point. Arrival is checked by GPS (within ${S.config.geofence_m} m).`), btn('I have arrived at pickup', post('arrived-at-pickup', {}, 'Arrival confirmed.'), 'primary big block'), btn('I cannot do this delivery', release, 'danger block'));
  else if (d.status === 'arrived_at_pickup') action = card('Waiting for the seller', note(`The seller has not marked the order ready yet${d.expected_ready_at ? ` (expected about ${clock(d.expected_ready_at)})` : ''}. This screen updates when it is ready.`, 'warn'), h('a', { class: 'btn block', href: '#/support/new?category=seller_not_ready&delivery=' + code }, 'Report: seller not ready'));
  else if (d.status === 'pickup_verification_pending' && !d.pickup_verified) action = card('Verify the pickup', h('p', { class: 'small muted' }, `Ask the ${giver} for the 4-digit pickup PIN and count the packages. ${isReturn ? '' : 'The seller can also confirm the handover from their dashboard.'}`),
    h('div', { class: 'small' }, 'Items: ', d.items.length ? d.items.map((i) => `${i.qty} × ${i.title}`).join(', ') : `${d.package_count} package(s)`),
    form([{ name: 'code', label: 'Pickup PIN', required: true, code: true, max: 4, inputmode: 'numeric' }, { name: 'package_count', label: 'Number of packages received', type: 'number', required: true, min: 1 }],
      { submit: 'Verify pickup', onSubmit: async (v) => { await api(`/api/deliveries/${code}/verify-pickup`, { method: 'POST', body: { method: 'pin', ...v } }); toast('Pickup verified.', 'ok'); refresh(); } }));
  else if (d.status === 'pickup_verification_pending') action = card('Pickup verified', note('The handover is verified. Confirm that you have the package to see the delivery address.', 'ok'), btn('Confirm pickup and start delivery', post('picked-up'), 'primary big block'));
  else if (d.status === 'picked_up' || d.status === 'en_route_to_customer') action = card('Next step', h('p', null, `Ride to the ${isReturn ? 'seller' : 'customer'}. Arrival is checked by GPS.`), btn(`I have arrived at the ${isReturn ? 'seller' : 'customer'}`, post('arrived-at-destination', {}, 'Arrival confirmed.'), 'primary big block'), isReturn ? null : btn('Cannot deliver', failedAttempt, 'danger block'));
  else if (d.status === 'return_in_progress' && !d.arrived_at_destination) action = card('Return the package', h('p', null, 'Carry the package back to the pickup point. Arrival is checked by GPS.'), btn('I have arrived at the seller', post('arrived-at-destination', {}, 'Arrival confirmed.'), 'primary big block'));
  else if (['arrived_at_destination', 'delivery_verification_pending', 'return_in_progress'].includes(d.status)) {
    const toSeller = backToSeller || isReturn;
    if (!d.proof) {
      action = card(toSeller ? 'Verify the return handover' : 'Verify the delivery',
        form([{ name: 'code', label: toSeller ? 'Return code from the seller' : 'Delivery code from the customer', required: true, code: true, max: 4, inputmode: 'numeric', hint: toSeller ? 'The seller sees this code on their delivery screen.' : 'The customer sees this 4-digit code on their order tracking page.' }],
          { submit: 'Verify code', onSubmit: async (v) => { await api(`/api/deliveries/${code}/proof`, { method: 'POST', body: { method: 'otp', code: v.code } }); toast('Verified.', 'ok'); refresh(); } }),
        !toSeller && d.contactless ? (() => { const input = h('input', { type: 'file', class: 'input', accept: 'image/*', capture: 'environment', 'aria-label': 'Photo of delivered package' });
          return h('div', { class: 'stack tight' }, h('h3', null, 'Contactless: photo proof'), h('p', { class: 'small muted' }, 'The customer asked for contactless delivery and agreed to a photo of the package at the door.'), input,
            btn('Submit photo proof', async (b) => { const r = await act(b, async () => api(`/api/deliveries/${code}/proof-photo`, { method: 'POST', raw: await readFileInput(input) }), 'Photo saved.'); if (r) refresh(); })); })() : null,
        !toSeller && d.allow_alternative ? h('div', { class: 'stack tight' }, h('h3', null, 'Handed to someone else'), h('p', { class: 'small muted' }, 'The customer has authorised handing the order to another person at the address.'),
          form([{ name: 'recipient_name', label: 'Name of the person who received it', required: true }, { name: 'relation', label: 'Relation to the customer', required: true, placeholder: 'Family member, security guard…' }],
            { submit: 'Record recipient', onSubmit: async (v) => { await api(`/api/deliveries/${code}/proof`, { method: 'POST', body: { method: 'alternative', ...v } }); refresh(); } })) : null,
        !toSeller ? h('p', { class: 'small muted' }, 'The customer can also confirm receipt from their tracking page.') : null,
        !toSeller ? btn('Customer unavailable / cannot deliver', failedAttempt, 'danger block') : null);
    } else if (d.payment_type === 'cod' && !toSeller) {
      action = card('Collect payment and complete', note(`Collect ${money(d.cod_amount)} from the customer before you hand over the order.`, 'warn'),
        form([{ name: 'payment_method', label: 'How did the customer pay?', type: 'select', required: true, options: [['cash', 'Cash'], ['upi', 'UPI / digital payment at the door']] }, { name: 'amount', label: 'Amount collected (₹)', type: 'number', required: true, step: '0.01' }, { name: 'cod_collected', type: 'checkbox', label: `I have collected ${money(d.cod_amount)} from the customer.` }],
          { submit: 'Complete delivery', onSubmit: async (v) => { await api(`/api/deliveries/${code}/complete`, { method: 'POST', body: v }); toast('Delivery completed.', 'ok'); refresh(); } }));
    } else action = card('Complete', note('Handover verified.', 'ok'), btn(toSeller ? 'Complete return' : 'Complete delivery', post('complete', {}, 'Completed.'), 'primary big block'));
  } else if (d.status === 'delivery_attempt_failed') action = card('Waiting for instructions', note(`Reported: ${d.failure_reason}. Keep the package safe. The operations team will ask you to try again or to return it to the seller.`, 'warn'));
  else if (d.status === 'delivered' || d.status === 'returned_to_seller') action = h('div', { class: 'card accent stack center' }, h('h2', null, d.status === 'delivered' ? 'Delivery completed' : 'Return completed'), h('div', { class: 'offer', style: 'border:0;box-shadow:none;padding:0' }, h('div', { class: 'earn' }, money(d.earning)), h('div', { class: 'small muted' }, 'Earned for this delivery')),
    kv([['Delivery ID', d.code], ['Order ID', d.order_code], ['Distance', `${d.distance_km} km`], ['Completed', dt(d.completed_at)], ['Base', money(d.earning_breakdown.base)], ['Distance pay', money(d.earning_breakdown.distance)], d.earning_breakdown.incentive ? ['Incentive', money(d.earning_breakdown.incentive)] : null, ['Customer feedback', d.feedback === 'received' ? 'Received' : 'Not yet given']]),
    d.payment_type === 'cod' ? note('This was a cash order: the earning is released to your wallet when your cash deposit is confirmed.', 'warn') : null, h('a', { class: 'btn primary block', href: '#/' }, 'Back to home'));
  else action = card(null, note(`This delivery is ${d.status_label.toLowerCase()}.`));
  shell('/tasks', `Delivery ${d.code}`,
    h('div', { class: 'row between' }, h('span', { class: 'muted small' }, `Order ${d.order_code} · ${d.category_label}`), h('span', { class: 'row' }, demoTag(d.is_demo), statusBadge(d.status, d.status_label))),
    action, open ? geoNote() : null, open ? testLocation(testPts, refresh) : null,
    open ? (beforePickup || backToSeller ? [pickupCard, dropCard] : [dropCard, pickupCard]) : null,
    open ? card('Route', plot(pts.map((p, i) => (p && i === 0 && pts[1] ? { ...p, to: pts[1] } : p))), plotLegend(['pickup', 'drop'])) : null,
    open ? card('Task details', kv([['Package', `${d.package_count} × ${d.package_type}${d.weight_kg ? ` · ${d.weight_kg} kg` : ''}`], ['Payment', d.payment_type === 'cod' ? `Cash on delivery · collect ${money(d.cod_amount)}` : 'Prepaid — nothing to collect'], ['Trip distance', `${d.distance_km} km`], ['Your earning', money(d.earning)], d.special_handling ? ['Handling', 'Special handling requested'] : null]),
      h('a', { class: 'btn block', href: `#/support/new?delivery=${d.code}` }, 'Report a problem with this delivery')) : null,
    card('Timeline', timeline(d.timeline)));
  return undefined;
}

/* ---------- Tasks ---------- */
const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];
async function pageTasks() {
  if (!approved()) return go('/');
  const q = currentRoute().query; const range = q.range || '7d';
  loading('/tasks', 'Delivery tasks');
  S.refresh = null;
  try {
    const [d, o] = await Promise.all([api('/api/partners/tasks', { query: range === 'custom' && !(q.from && q.to) ? { range: '7d' } : { range, from: q.from, to: q.to } }), api('/api/delivery/offers')]);
    clearTimers();
    const custom = form([{ name: 'from', label: 'From', type: 'date', value: q.from, required: true }, { name: 'to', label: 'To', type: 'date', value: q.to, required: true }], { submit: 'Show', onSubmit: (v) => go(`/tasks?range=custom&from=${v.from}&to=${v.to}`) });
    shell('/tasks', 'Delivery tasks',
      o.offers[0] ? offerCard(o.offers[0], pageTasks) : null, d.active ? taskSummary(d.active) : note(o.online ? 'No active delivery. New offers appear on Home.' : 'You are offline. Go online from Home to receive offers.'),
      h('h2', null, 'History'), tabs([...RANGES, ['custom', 'Custom']], range, (k) => go(`/tasks?range=${k}`)), range === 'custom' ? h('div', { class: 'card' }, custom) : null,
      h('div', { class: 'small muted' }, d.range.label),
      d.history.length ? d.history.map((t) => h('a', { class: 'card stack tight', href: `#/task/${t.code}`, style: 'text-decoration:none;color:inherit' },
        h('div', { class: 'row between' }, h('strong', null, t.code), statusBadge(t.status, t.status_label)), h('div', { class: 'small muted' }, `Order ${t.order_code} · ${t.pickup_name} · ${t.category_label} · ${day(t.date)}`),
        h('div', { class: 'row between small' }, `${t.distance_km} km`, h('span', null, h('strong', null, money(t.earnings)), t.adjustment ? ` (${t.adjustment > 0 ? '+' : ''}${money(t.adjustment)} adjustment)` : '')))) : empty('No deliveries in this period.'));
  } catch (e) { failed('/tasks', 'Delivery tasks', e, pageTasks); }
  return undefined;
}

/* ---------- Earnings ---------- */
async function pageEarnings() {
  if (!approved()) return go('/');
  const tab = currentRoute().query.tab || 'summary';
  loading('/earnings', 'Earnings');
  S.refresh = null;
  const pick = tabs([['summary', 'Summary'], ['statement', 'Statement'], ['payouts', 'Payouts'], ['cash', 'Cash']], tab, (k) => go(`/earnings?tab=${k}`));
  try {
    let body;
    if (tab === 'summary') {
      const e = await api('/api/partners/earnings');
      const max = Math.max(1, ...e.daily.map((x) => x.total));
      const split = (x) => kv([['Base earnings', money(x.base)], ['Distance earnings', money(x.distance)], ['Incentives', money(x.incentive)], ['Tips', e.tips_supported ? money(x.tip) : 'Not offered yet'], ['Adjustments', money(x.adjustment)], ['Completed deliveries', x.completed]]);
      body = [h('div', { class: 'grid g2' }, stat('Today', money(e.today.total), `${e.today.completed} deliveries`), stat('Last 7 days', money(e.week.total), `${e.week.completed} deliveries`)),
        card('Last 7 days', h('div', { class: 'bars', role: 'img', 'aria-label': e.daily.map((x) => `${day(x.day)}: ${money(x.total)}`).join(', ') }, e.daily.map((x) => h('div', null, h('span', null, x.total ? money(x.total) : ''), h('i', { style: `height:${(x.total / max) * 78}%` }), h('span', null, new Date(`${x.day}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short' }))))), split(e.week)),
        card('Today', split(e.today)),
        card('Wallet', h('div', { class: 'grid g2' }, stat('Available balance', money(e.wallet.available), 'Ready for the next payout'), stat('Pending', money(e.wallet.pending), 'Held until cash is deposited'), stat('In payout', money(e.wallet.in_payout)), stat('Paid out', money(e.wallet.paid))),
          h('p', { class: 'small muted' }, e.payout_schedule), e.payout_account_status !== 'verified' ? note('Your payout account is not verified yet. Payouts start after verification.', 'warn') : null),
        e.adjustments.length ? card('Adjustments', table([{ label: 'Date', render: (a) => day(a.created_at) }, { label: 'Reason', render: (a) => `${a.reason}${a.delivery_code ? ` (${a.delivery_code})` : ''}` }, { label: 'Amount', right: true, render: (a) => money(a.amount) }], e.adjustments)) : null];
    } else if (tab === 'statement') {
      const range = currentRoute().query.range || '30d';
      const t = await api('/api/partners/transactions', { query: { range } });
      body = [tabs(RANGES, range, (k) => go(`/earnings?tab=statement&range=${k}`)), h('div', { class: 'row between' }, h('span', { class: 'small muted' }, t.range.label), h('a', { class: 'btn sm', href: `/api/partners/statement.csv?range=${range}`, download: '' }, 'Download CSV')),
        table([{ label: 'Transaction', render: (x) => h('div', null, h('div', { class: 'mono small' }, x.txn_code), h('div', { class: 'small muted' }, dt(x.created_at))) }, { label: 'For', render: (x) => h('div', null, x.delivery_code || '—', h('div', { class: 'small muted' }, `${x.type} · ${x.note || ''}`)) },
          { label: 'Amount', right: true, render: (x) => h('div', null, h('strong', null, money(x.amount)), h('div', null, statusBadge(x.status, x.status === 'in_payout' ? `In ${x.payout_code}` : null))) }], t.transactions, { emptyText: 'No transactions in this period.' })];
    } else if (tab === 'payouts') {
      const p = await api('/api/partners/payouts');
      body = [table([{ label: 'Payout', render: (x) => h('div', null, h('strong', null, x.code), h('div', { class: 'small muted' }, dt(x.created_at))) }, { label: 'Status', render: (x) => h('div', null, statusBadge(x.status), h('div', { class: 'small muted' }, x.status === 'paid' ? `Ref ${x.reference} · ${dt(x.settled_at)}` : x.failure_reason || '')) }, { label: 'Amount', right: true, render: (x) => money(x.amount) }], p.payouts, { emptyText: 'No payouts yet.' })];
    } else {
      const c = await api('/api/partners/cod');
      body = [h('div', { class: 'grid g2' }, stat('Cash you hold', money(c.cash_in_hand)), stat('Cash limit', money(c.limit), 'Cash orders pause above this')), note(c.instructions),
        c.cash_in_hand > 0 ? card('Record a deposit', form([{ name: 'amount', label: 'Amount deposited (₹)', type: 'number', required: true, value: c.cash_in_hand, step: '0.01' }, { name: 'method', label: 'How', type: 'select', required: true, options: [['hub_cash', 'Cash at zone hub'], ['bank_transfer', 'Bank transfer'], ['upi', 'UPI']] }, { name: 'reference', label: 'Receipt or transaction reference', required: true }],
          { submit: 'Record deposit', onSubmit: async (v) => { const r = await api('/api/partners/cod/deposits', { method: 'POST', body: v }); toast(`Deposit ${r.code} recorded. Awaiting confirmation.`, 'ok'); pageEarnings(); } })) : null,
        table([{ label: 'Record', render: (x) => h('div', null, h('strong', null, x.type === 'collection' ? 'Collected' : 'Deposit'), h('div', { class: 'small muted' }, `${x.code} · ${dt(x.created_at)}${x.delivery_code ? ` · ${x.delivery_code}` : ''}`)) }, { label: 'Status', render: (x) => statusBadge(x.status) }, { label: 'Amount', right: true, render: (x) => money(x.amount) }], c.transactions, { emptyText: 'No cash-on-delivery records.' })];
    }
    shell('/earnings', 'Earnings', pick, ...body);
  } catch (e) { failed('/earnings', 'Earnings', e, pageEarnings); }
  return undefined;
}

/* ---------- Performance ---------- */
async function pagePerformance() {
  if (!approved()) return go('/');
  loading('/performance', 'Performance');
  S.refresh = null;
  try {
    const p = await api('/api/partners/performance');
    shell('/performance', 'Performance', h('div', { class: 'small muted' }, p.period),
      h('div', { class: 'grid g2' }, stat('Completed deliveries', p.completed), stat('Customer rating', p.rating ? `${p.rating} ★` : '—', p.rating_count ? `${p.rating_count} ratings` : 'No ratings yet'), stat('Offer acceptance', pct(p.acceptance_rate), `${p.offers_accepted} of ${p.offers_received} offers`),
        stat('Average delivery time', val(p.average_minutes, ' min'), 'From assignment to delivery'), stat('Failed attempts', p.failed_attempts), stat('Online time', `${p.online_hours} h`)), note(p.note));
  } catch (e) { failed('/performance', 'Performance', e, pagePerformance); }
  return undefined;
}

/* ---------- Support ---------- */
async function pageSupport(parts, query) {
  S.refresh = null;
  const cats = S.config.ticket_categories;
  if (parts[1] === 'new') {
    return shell('/support', 'Report an issue', card(null, form([
      { name: 'category', label: 'What is the problem?', type: 'select', required: true, value: query.category || '', options: [['', 'Choose'], ...Object.entries(cats)] },
      { name: 'delivery_code', label: 'Delivery ID', value: query.delivery, hint: 'If this is about one delivery.' }, { name: 'description', label: 'Describe what happened', type: 'textarea', required: true, max: 1500 },
    ], { submit: 'Send to support', intro: 'For a safety incident choose "Safety incident" — it is marked urgent and shown to the operations team at once. In an emergency call 112 first.',
      onSubmit: async (v) => { const r = await api('/api/partners/tickets', { method: 'POST', body: v }); toast(`Ticket ${r.code} created.`, 'ok'); go(`/support/${r.code}`); } })), h('a', { href: '#/support' }, 'Back to my tickets'));
  }
  loading('/support', 'Support');
  try {
    if (parts[1]) {
      const { ticket: t } = await api(`/api/partners/tickets/${parts[1]}`);
      const input = h('input', { type: 'file', class: 'input', accept: 'image/*,application/pdf', 'aria-label': 'Evidence file' });
      return shell('/support', `Ticket ${t.code}`, h('div', { class: 'row between' }, badge(t.category_label, 'info'), statusBadge(t.status)), card(t.subject, h('p', null, t.description), h('div', { class: 'small muted' }, `${dt(t.created_at)}${t.delivery_code ? ` · ${t.delivery_code}` : ''}`)),
        card('Conversation', t.messages.length ? t.messages.map((m) => h('div', { class: `note ${m.author_type === 'support' ? 'ok' : ''}` }, h('strong', null, m.author_type === 'support' ? 'Support' : 'You'), ` · ${dt(m.created_at)}`, h('div', null, m.body))) : empty('No replies yet. Support will answer here.'),
          form([{ name: 'body', label: 'Add a message', type: 'textarea', required: true, max: 1500 }], { submit: 'Send', onSubmit: async (v) => { await api(`/api/partners/tickets/${t.code}/messages`, { method: 'POST', body: v }); pageSupport(parts, query); } })),
        card('Evidence', t.has_evidence ? note('A file is attached to this ticket.', 'ok') : h('p', { class: 'small muted' }, 'Attach a photo or PDF (up to 5 MB).'), h('div', { class: 'row' }, h('div', { class: 'grow' }, input),
          btn(t.has_evidence ? 'Replace' : 'Attach', async (b) => { const r = await act(b, async () => api(`/api/partners/tickets/${t.code}/evidence`, { method: 'POST', raw: await readFileInput(input) }), 'Evidence attached.'); if (r) pageSupport(parts, query); }))), h('a', { href: '#/support' }, 'Back to my tickets'));
    }
    const { tickets } = await api('/api/partners/tickets');
    return shell('/support', 'Support', h('a', { class: 'btn primary block', href: '#/support/new' }, 'Report an issue'), h('div', { class: 'grid g2' }, ['pickup_unreachable', 'seller_not_ready', 'customer_unavailable', 'package_damage', 'payment', 'safety'].filter((k) => cats[k]).map((k) => h('a', { class: 'btn', href: `#/support/new?category=${k}` }, cats[k]))),
      h('h2', null, 'My tickets'), tickets.length ? tickets.map((t) => h('a', { class: 'card stack tight', href: `#/support/${t.code}`, style: 'text-decoration:none;color:inherit' }, h('div', { class: 'row between' }, h('strong', null, t.subject), statusBadge(t.status)), h('div', { class: 'small muted' }, `${t.code} · updated ${ago(t.updated_at)}`))) : empty('You have not raised any tickets.'));
  } catch (e) { return failed('/support', 'Support', e, () => pageSupport(parts, query)); }
}

/* ---------- Profile and alerts ---------- */
async function pageProfile() {
  S.refresh = null;
  loading('/profile', 'Profile');
  try {
    await loadMe();
    const [{ sessions }, { zones }] = await Promise.all([api('/api/partners/sessions'), api('/api/partners/zones')]);
    const { partner: p, user: u, vehicle, documents } = S.me;
    shell('/profile', 'Profile',
      card(null, h('div', { class: 'row between' }, h('div', null, h('h2', null, u.name), h('div', { class: 'small muted' }, `Partner ID ${p.code}${p.fleet ? ` · ${p.fleet.name}` : ' · Individual partner'}`)), statusBadge(p.status, p.status_label)),
        kv([['Mobile', u.mobile], ['Email', u.email], ['City', p.city], ['Language', p.language], ['Emergency contact', p.emergency_name ? `${p.emergency_name} · ${p.emergency_phone}` : null], ['Rating', p.rating ? `${p.rating} ★ (${p.rating_count})` : 'No ratings yet'], ['Approved', p.approved_at ? day(p.approved_at) : null], ['Documents valid until', p.documents_valid_until ? day(p.documents_valid_until) : null]]),
        p.fleet_hold ? note('Your fleet manager has put your account on hold.', 'warn') : null),
      card('Vehicle', vehicle ? kv([['Type', vehicle.label], ['Registration', vehicle.registration_no], ['Verification', statusBadge(vehicle.status)]]) : empty('No vehicle added.'), approved() ? h('p', { class: 'small muted' }, 'To change your vehicle, raise a support ticket — a new vehicle needs verification.') : null),
      approved() ? card('Operating zones', h('p', { class: 'small muted' }, 'You receive offers from the zones you select.'), (() => {
        const boxes = zones.map((z) => [z, h('input', { type: 'checkbox', checked: z.selected, id: `z${z.id}` })]);
        return h('div', { class: 'stack tight' }, boxes.map(([z, box]) => h('label', { class: 'check', for: `z${z.id}` }, box, h('span', null, `${z.name}, ${z.city} `, z.open_now ? badge('Open now', 'ok') : badge(z.status === 'active' ? `Opens ${z.open_time}` : 'Suspended', 'warn')))),
          btn('Save zones', async (b) => { const ids = boxes.filter(([, box]) => box.checked).map(([z]) => z.id); const r = await act(b, () => api('/api/partners/profile', { method: 'PATCH', body: { zone_ids: ids, home_zone_id: ids.includes(p.home_zone_id) ? p.home_zone_id : ids[0] } }), 'Zones saved.'); if (r) pageProfile(); }, 'primary'));
      })()) : null,
      card('Documents', documents.length ? documents.map((d) => h('div', { class: 'row between' }, h('span', null, d.kind_label), statusBadge(d.status))) : empty('No documents uploaded.'), h('p', { class: 'small muted' }, 'Visible only to you and verification staff.')),
      card('Payout account', p.payout ? kv([['Account holder', p.payout.holder], ['Bank', p.payout.bank], ['Account', `•••• ${p.payout.account_ending}`], ['IFSC', p.payout.ifsc], ['Verification', statusBadge(p.payout.status)]]) : empty('No payout account.'),
        btn(p.payout ? 'Change payout account' : 'Add payout account', () => formModal('Payout account', [{ name: 'holder', label: 'Account holder name', required: true }, { name: 'bank', label: 'Bank name', required: true }, { name: 'account', label: 'Account number', required: true, inputmode: 'numeric' }, { name: 'ifsc', label: 'IFSC', required: true, max: 11 }],
          { submit: 'Save', intro: 'A changed account must be verified again before payouts resume.', onSubmit: async (v) => { await api('/api/partners/payout', { method: 'PUT', body: v }); toast('Payout account saved.', 'ok'); pageProfile(); } }))),
      card('Signed-in devices', sessions.map((s) => h('div', { class: 'row between' }, h('div', { class: 'grow' }, h('div', { class: 'small' }, (s.user_agent || 'Unknown device').slice(0, 60)), h('div', { class: 'tiny muted' }, `Last active ${ago(s.last_seen_at)}`)), s.current ? badge('This device', 'ok') : btn('Sign out', async (b) => { const r = await act(b, () => api(`/api/partners/sessions/${s.id}`, { method: 'DELETE' })); if (r) pageProfile(); }, 'sm')))),
      btn('Sign out', signOut, 'danger block'));
  } catch (e) { failed('/profile', 'Profile', e, pageProfile); }
}
async function pageNotifications() {
  S.refresh = null;
  loading('', 'Alerts');
  try {
    const { notifications } = await api('/api/partners/notifications');
    if (S.me.unread_notifications) { await api('/api/partners/notifications/read', { method: 'POST' }); S.me.unread_notifications = 0; }
    shell('', 'Alerts', notifications.length ? card(null, h('ol', { class: 'tl' }, notifications.map((n) => h('li', null, h('div', { class: 't1' }, n.title, n.read_at ? null : [' ', badge('New', 'info')]), h('div', { class: 't2' }, [dt(n.created_at), n.body].filter(Boolean).join(' · ')))))) : empty('No alerts yet.'));
  } catch (e) { failed('', 'Alerts', e, pageNotifications); }
}

function startLive() {
  if (!S.me || S.stopLive) return;
  S.stopLive = live({ portal: 'partner' }, async () => {
    if (!S.me) return undefined;
    const before = S.me.partner.status;
    await loadMe().catch(() => {});
    if (!S.me || S.me.partner.status !== before) return render();
    if (S.refresh) S.refresh(true);
    return undefined;
  });
}

/* ---------- Router ---------- */
async function render() {
  const r = currentRoute();
  clearTimers();
  const publicPages = { login: pageLogin, register: pageRegister, forgot: pageForgot };
  if (!S.me) { stopLocation(); return (publicPages[r.parts[0]] || pageLogin)(); }
  if (publicPages[r.parts[0]]) return go('/');
  window.scrollTo(0, 0);
  switch (r.parts[0]) {
    case undefined: return pageHome();
    case 'task': return pageTask(r.parts[1]);
    case 'tasks': return pageTasks();
    case 'earnings': return pageEarnings();
    case 'performance': return pagePerformance();
    case 'support': return pageSupport(r.parts, r.query);
    case 'profile': return pageProfile();
    case 'notifications': return pageNotifications();
    default: return go('/');
  }
}
(async () => {
  try { await loadMe(); } catch (e) { mount(root, h('div', { class: 'auth' }, h('div', { class: 'card panel stack' }, h('p', null, e.message), btn('Try again', () => location.reload(), 'primary')))); return; }
  startLive();
  onRoute(() => render().catch((e) => toast(e.message, 'bad')));
})();
