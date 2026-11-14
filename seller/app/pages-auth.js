// Sign-in, registration, password recovery, email verification, account status and the onboarding wizard.
import { h, icon, state, api, ApiError, navigate, reload, toast, field, onSubmit, refreshMe, banner, badge, statusBadge, pageHead, card, kv, fmtDateTime, currentQuery, pickFile, uploadFile, uploadUrl, busy, can, integrationNote, emptyState } from './core.js';
import { signOut } from './shell.js';

const safeNext = (next) => (next && next.startsWith('/seller/') ? next : null);
let lastVerification = null; // result of the most recent "send verification email" call, kept in memory only

function mailNotice(result, mail, purpose) {
  if (!result && !mail) return null;
  if (result && result.delivered) return banner('success', `We sent ${purpose} to your email address. The link expires soon, so use it promptly.`);
  const parts = [h('b', 'No email was sent. '), 'This server has no email (SMTP) service configured, so the message could not be delivered. Ask the site administrator to configure SMTP.'];
  const link = result && result.dev_link;
  return h('div.stack.sm', banner('warn', parts), link ? h('div.banner.demo', icon('info'), h('div.grow', h('b', 'Development preview. '), 'Because DEV_MAIL_PREVIEW is enabled on this server, the link that would have been emailed is shown here: ', h('a', { href: link.replace(/^https?:\/\/[^/]+/, ''), dataset: { devLink: '' } }, 'open the link'))) : null);
}

export async function login(ctx) {
  let config = { demo: null };
  try { config = await api('/public-config'); } catch { /* optional */ }
  const form = h('form.stack', h('div', { dataset: { formError: '' } }),
    field({ name: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'you@business.com', autocomplete: 'username' }),
    field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }),
    h('div.row.between', h('label.check', h('input', { type: 'checkbox', name: 'remember', checked: true }), h('span', 'Keep me signed in for 30 days')), h('a.small', { href: '/seller/forgot-password' }, 'Forgot password?')),
    h('button.btn.primary.lg.block', { type: 'submit' }, 'Sign in'));
  onSubmit(form, async (values) => {
    await api('/auth/login', { method: 'POST', body: values });
    await refreshMe();
    if (!state.me) {
      // The password was accepted but the browser did not keep the session cookie — typical when the page is shown inside
      // another site's frame with cookies blocked. Say so instead of silently returning to this form.
      const own = `${location.origin}/seller/login`;
      form.querySelector('[data-form-error]').replaceChildren(h('div.banner.error.form-error', { role: 'alert' }, icon('alert'), h('div', h('b', 'Your details are correct, but this browser did not keep the sign-in cookie. '),
        'That happens when the Seller Hub is shown inside another page and the browser blocks cookies there. ', h('a', { href: own, target: '_blank', rel: 'noopener' }, 'Open the Seller Hub in its own tab'), ' and sign in again.')));
      return;
    }
    state.shell = null;
    navigate(safeNext(ctx.query.next) || '/seller/dashboard', { replace: true });
  });
  const demo = config.demo ? h('div.banner.demo', { style: { marginTop: '16px' } }, icon('info'), h('div.grow', h('b', 'Demo store available. '), 'A sample seller account filled with DEMO DATA exists on this server. ',
    h('button.link-btn', { type: 'button', onClick: () => { form.elements.email.value = config.demo.email; form.elements.password.value = config.demo.password; form.elements.password.focus(); } }, 'Fill in the demo sign-in'),
    h('div.tiny', { style: { marginTop: '4px' } }, `${config.demo.email} · ${config.demo.password}`))) : null;
  return h('div', h('h1', 'Sign in to Seller Hub'), h('p.lead', 'Manage your NearBuy store, orders and payments.'), form, demo,
    h('p.auth-foot', 'New to NearBuy? ', h('a', { href: '/seller/register' }, 'Create a seller account')));
}

export async function register() {
  const types = ['Sole proprietorship', 'Partnership', 'Limited liability partnership', 'Private limited company', 'Public limited company', 'One person company', 'Hindu undivided family'];
  let businessTypes = types;
  try { businessTypes = (await api('/public-config')).business_types || types; } catch { /* use defaults */ }
  const form = h('form.stack', h('div', { dataset: { formError: '' } }),
    h('div.form-grid',
      field({ name: 'name', label: 'Full name', required: true, autocomplete: 'name' }),
      field({ name: 'mobile', label: 'Mobile number', required: true, prefix: '+91', inputmode: 'numeric', maxlength: 10, placeholder: '10-digit number', autocomplete: 'tel-national' }),
      field({ name: 'email', label: 'Business email', type: 'email', required: true, full: true, autocomplete: 'email', hint: 'We send a verification link to this address.' }),
      field({ name: 'business_name', label: 'Business name', required: true, autocomplete: 'organization' }),
      field({ name: 'business_type', label: 'Business type', type: 'select', options: businessTypes, required: true }),
      field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', hint: '8+ characters with an uppercase letter, a lowercase letter and a number.' }),
      field({ name: 'confirm_password', label: 'Confirm password', type: 'password', required: true, autocomplete: 'new-password' }),
      field({ name: 'accept_terms', type: 'checkbox', full: true, label: 'I accept the NearBuy seller terms and conditions and confirm that the business details I provide are accurate.' })),
    h('button.btn.primary.lg.block', { type: 'submit' }, 'Create account'));
  onSubmit(form, async (values) => {
    const result = await api('/auth/register', { method: 'POST', body: values });
    lastVerification = { result: result.verification, mail: result.mail };
    await refreshMe();
    state.shell = null;
    navigate('/seller/verify-email', { replace: true });
  });
  return h('div', h('h1', 'Create your seller account'), h('p.lead', 'Step 1 of 2 — create your sign-in. Next you will verify your email and complete onboarding.'), form,
    h('p.auth-foot', 'Already selling on NearBuy? ', h('a', { href: '/seller/login' }, 'Sign in')));
}

export async function forgotPassword() {
  const out = h('div');
  const form = h('form.stack', h('div', { dataset: { formError: '' } }), field({ name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'username' }), h('button.btn.primary.lg.block', { type: 'submit' }, 'Send reset link'));
  onSubmit(form, async (values) => {
    const result = await api('/auth/forgot-password', { method: 'POST', body: values });
    const sent = result.mail && result.mail.configured;
    out.replaceChildren(sent ? banner('success', 'If an account exists for that address, a password reset link has been emailed. It is valid for 60 minutes.')
      : mailNotice({ delivered: false, dev_link: result.dev_link }, result.mail) || banner('warn', 'No email was sent.'));
    if (!sent && !result.dev_link) out.append(h('p.small.muted', { style: { marginTop: '8px' } }, 'If that address has an account, a reset link was generated but could not be emailed.'));
  });
  return h('div', h('h1', 'Forgot your password?'), h('p.lead', 'Enter your account email and we will send a link to choose a new password.'), form, h('div', { style: { marginTop: '16px' } }, out), h('p.auth-foot', h('a', { href: '/seller/login' }, 'Back to sign in')));
}

export async function resetPassword(ctx) {
  const token = ctx.query.token;
  let info;
  try { if (!token) throw new ApiError(400, { error: 'This link is missing its token.' }); info = await api('/auth/token-info', { query: { token } }); } catch (err) {
    return h('div', h('h1', 'This link cannot be used'), h('p.lead', err.message), h('a.btn.primary.block', { href: '/seller/forgot-password' }, 'Request a new link'), h('p.auth-foot', h('a', { href: '/seller/login' }, 'Back to sign in')));
  }
  const invite = info.purpose === 'team_invite';
  const form = h('form.stack', h('div', { dataset: { formError: '' } }),
    field({ name: 'password', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', hint: '8+ characters with an uppercase letter, a lowercase letter and a number.' }),
    field({ name: 'confirm_password', label: 'Confirm new password', type: 'password', required: true, autocomplete: 'new-password' }),
    h('button.btn.primary.lg.block', { type: 'submit' }, invite ? 'Accept invitation' : 'Save new password'));
  onSubmit(form, async (values) => {
    await api('/auth/reset-password', { method: 'POST', body: { ...values, token } });
    await refreshMe();
    toast(invite ? 'Invitation accepted. Sign in with your new password.' : 'Password changed. Sign in with your new password.', 'success');
    navigate('/seller/login', { replace: true });
  });
  return h('div', h('h1', invite ? `Welcome, ${info.name}` : 'Choose a new password'), h('p.lead', invite ? `Set a password for ${info.email} to join your team's seller workspace.` : `For the account ${info.email}. You will be signed out on all devices.`), form);
}

export async function verifyEmail(ctx) {
  const token = ctx.query.token;
  if (token) {
    try {
      await api('/auth/verify-email', { method: 'POST', body: { token } });
      await refreshMe();
      state.shell = null;
      return h('div', h('div.status-hero', { style: { padding: '0 0 14px' } }, h('span.ico', { style: { background: 'var(--green-soft)', color: 'var(--green)' } }, icon('check', 'lg')), h('div', h('h1', 'Email verified'), h('p.muted', 'Your business email is confirmed.'))),
        h('a.btn.primary.lg.block', { href: state.me ? '/seller/onboarding' : '/seller/login' }, state.me ? 'Continue to onboarding' : 'Sign in to continue'));
    } catch (err) {
      return h('div', h('h1', 'Verification failed'), h('p.lead', err.message), state.me ? h('a.btn.primary.block', { href: '/seller/verify-email' }, 'Send a new link') : h('a.btn.primary.block', { href: '/seller/login' }, 'Sign in to request a new link'));
    }
  }
  const me = state.me;
  if (!me) { navigate('/seller/login?next=/seller/verify-email', { replace: true }); return null; }
  if (me.user.email_verified) { navigate(me.seller && me.seller.status === 'approved' ? '/seller/dashboard' : '/seller/onboarding', { replace: true }); return null; }
  const notice = h('div');
  const draw = () => notice.replaceChildren(lastVerification ? mailNotice(lastVerification.result, lastVerification.mail, 'a verification link') : banner('', 'Use the button below to send a verification link to your email address.'));
  draw();
  const resend = h('button.btn.primary.lg.block', { type: 'button', onClick: () => busy(resend, async () => {
    const r = await api('/auth/resend-verification', { method: 'POST', body: {} });
    if (r.already_verified) { await refreshMe(); navigate('/seller/onboarding', { replace: true }); return; }
    lastVerification = { result: r.verification, mail: r.mail };
    draw();
    if (r.verification.delivered) toast('Verification email sent.', 'success');
  }) }, icon('mail', 'sm'), lastVerification ? 'Send the link again' : 'Send verification link');
  return h('div', h('h1', 'Verify your email'), h('p.lead', 'We need to confirm ', h('b', me.user.email), ' before you can use the Seller Hub. Your account stays locked until the link in the email is opened.'),
    h('div.stack', notice, resend, h('button.btn.block', { type: 'button', onClick: async () => { await refreshMe(); if (state.me && state.me.user.email_verified) navigate('/seller/onboarding', { replace: true }); else toast('Not verified yet. Open the link in the email first.', 'info'); } }, 'I have verified — continue'),
      h('p.auth-foot', 'Wrong account? ', h('button.link-btn', { type: 'button', onClick: signOut }, 'Sign out'))));
}

const STATUS_ICON = { approved: ['check', 'green'], rejected: ['x', 'red'], action_required: ['alert', 'red'], under_review: ['clock', 'amber'], pending_verification: ['clock', 'amber'], not_started: ['info', 'blue'] };
function statusHero(o) {
  const [ico, t] = STATUS_ICON[o.status] || ['info', 'blue'];
  return h('div.status-hero', h('span.ico', { style: { background: `var(--${t}-soft)`, color: `var(--${t})` } }, icon(ico, 'lg')),
    h('div.grow', h('div.row.wrap', h('h2', { style: { fontSize: '19px' } }, o.status_label), statusBadge(o.status, 'Seller account')), h('p.muted', { style: { marginTop: '4px' } }, o.status_note || STATUS_TEXT[o.status])));
}
const STATUS_TEXT = {
  not_started: 'You have not started onboarding yet.', pending_verification: 'Complete every onboarding step, then submit your details for review.', under_review: 'Your details are with the marketplace team. You will be notified when the review is complete.',
  approved: 'Your seller account is approved. You can list products and receive orders.', rejected: 'Your application was not approved. Correct the details and submit again.', action_required: 'Something needs to be corrected before your account can be approved.',
};

export async function accountStatus() {
  const me = state.me;
  if (!me.user.email_verified) {
    return h('div', h('h1', 'Account status'), h('p.lead', 'Your seller account is waiting for email verification.'),
      kv([['Email', me.user.email], ['Email verification', badge('Pending verification', 'amber')], ['Seller account', badge('Not started', '')]]),
      h('a.btn.primary.block', { href: '/seller/verify-email', style: { marginTop: '18px' } }, 'Verify email'));
  }
  const o = await api('/onboarding');
  const bankState = o.bank ? (o.bank.verification_status === 'verified' ? badge('Verified', 'green') : badge('Not verified', 'amber')) : badge('Not added', '');
  return h('div.stack.lg',
    pageHead({ title: 'Account status', subtitle: 'Where your seller account stands and what is still needed.', trail: ['Account status'], actions: [o.status !== 'approved' && o.status !== 'under_review' ? h('a.btn.primary', { href: '/seller/onboarding' }, 'Continue onboarding') : null] }),
    h('div.card', statusHero(o)),
    h('div.grid.c2',
      card({ title: 'Verification checks', flush: true, body: h('div.list',
        h('div', icon('mail'), h('div.grow', h('b.strong', 'Business email'), h('div.small.muted', me.user.email)), badge('Verified', 'green')),
        h('div', icon('file'), h('div.grow', h('b.strong', 'GSTIN and PAN'), h('div.small.muted', o.business && o.business.gstin ? `${o.business.gstin} · PAN ${o.business.pan_masked || 'not added'}` : 'Not provided yet')), o.business && o.business.gstin ? badge('Format checked', 'blue') : badge('Not added', '')),
        h('div', icon('bank'), h('div.grow', h('b.strong', 'Bank account'), h('div.small.muted', o.bank ? `${o.bank.bank_name} ${o.bank.account_masked}` : 'Not provided yet')), bankState),
        h('div', icon('shield'), h('div.grow', h('b.strong', 'Marketplace review'), h('div.small.muted', o.submitted_at ? `Submitted ${fmtDateTime(o.submitted_at)}` : 'Not submitted yet')), statusBadge(o.status, o.status_label))) }),
      card({ title: `Onboarding checklist · ${o.completed} of ${o.total} complete`, flush: true, body: h('div.list', o.steps.map((step) => h('a.list-row', { href: `/seller/onboarding?step=${step.key}` }, h(`span.step-dot${step.done ? '.done' : ''}`, step.done ? '✓' : ''), h('div.grow', h('b.strong', step.title), h('div.small.muted', step.hint)), step.done ? badge('Done', 'green') : badge('To do', 'amber')))) })),
    integrationNote('GSTIN and PAN are checked for format and consistency only, and the bank account is not verified with a test transfer. Real KYC needs a government GST/PAN verification API and a bank penny-drop service.'),
    o.auto_review ? banner('', [h('b', 'Demo review mode is on. '), 'Onboarding submissions are approved automatically by this server instead of being reviewed by marketplace staff. Set DEMO_AUTO_REVIEW=0 to require a manual review through the operations API.']) : null);
}

/* ---------- Onboarding wizard ---------- */
const STEP_ORDER = ['business', 'pickup', 'bank', 'store', 'product', 'review'];
export async function onboarding(ctx) {
  const o = await api('/onboarding');
  const firstOpen = o.steps.find((st) => !st.done);
  const step = STEP_ORDER.includes(ctx.query.step) ? ctx.query.step : firstOpen ? firstOpen.key : 'review';
  const index = STEP_ORDER.indexOf(step);
  const go = (key) => navigate(`/seller/onboarding?step=${key}`);
  const next = () => go(STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]);
  const readOnly = !o.can_manage;
  const locked = o.status === 'under_review';

  const stepNav = h('div.card', h('nav.wizard-steps', { 'aria-label': 'Onboarding steps' }, o.steps.map((st, i) => h(`a${st.key === step ? '.active' : ''}`, { href: `/seller/onboarding?step=${st.key}`, 'aria-current': st.key === step ? 'step' : null }, h(`span.step-dot${st.done ? '.done' : ''}`, st.done ? '✓' : i + 1), h('div', h('b.strong', st.title), h('small', st.done ? 'Completed' : st.key === 'review' ? 'Final step' : 'Not completed'))))));
  const back = index > 0 ? h('button.btn', { type: 'button', onClick: () => go(STEP_ORDER[index - 1]) }, icon('left', 'sm'), 'Back') : null;
  const actions = (label = 'Save and continue') => h('div.form-actions', back, readOnly ? null : h('button.btn.primary', { type: 'submit' }, label));
  const wrap = (title, text, body) => card({ title, subtitle: text, body });
  let panel;

  if (step === 'business') {
    const b = o.business || {};
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
      field({ name: 'legal_name', label: 'Business legal name', required: true, value: b.legal_name, hint: 'Exactly as it appears on your GST certificate.' }),
      field({ name: 'business_type', label: 'Business type', type: 'select', options: o.business_types, required: true, value: b.business_type }),
      field({ name: 'gstin', label: 'GSTIN', required: true, value: b.gstin, placeholder: '07AAKFG4521M1Z6', maxlength: 15, hint: '15 characters. Stored in upper case.' }),
      field({ name: 'pan', label: 'PAN', required: !b.has_pan, placeholder: b.has_pan ? `Saved: ${b.pan_masked}` : 'AAKFG4521M', maxlength: 10, hint: b.has_pan ? 'Leave blank to keep the saved PAN. It is stored encrypted and shown masked.' : 'Must match characters 3–12 of the GSTIN. Stored encrypted.' }),
      field({ name: 'address', label: 'Registered business address', type: 'textarea', rows: 2, required: true, value: b.address, full: true }),
      field({ name: 'city', label: 'City', required: true, value: b.city }),
      field({ name: 'state', label: 'State / union territory', type: 'select', options: o.states, required: true, value: b.state }),
      field({ name: 'pincode', label: 'PIN code', required: true, value: b.pincode, inputmode: 'numeric', maxlength: 6 })), actions());
    onSubmit(form, async (v) => { if (!v.pan) delete v.pan; const r = await api('/settings/business', { method: 'PUT', body: v }); toast(r.message, 'success'); next(); });
    panel = wrap('Business information', 'Legal identity used on tax invoices.', form);
  } else if (step === 'pickup') {
    const p = o.pickup_locations.find((l) => l.is_default) || o.pickup_locations[0] || {};
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
      field({ name: 'name', label: 'Pickup location name', required: true, value: p.name, placeholder: 'Main warehouse' }),
      field({ name: 'contact_person', label: 'Contact person', required: true, value: p.contact_person }),
      field({ name: 'mobile', label: 'Mobile number', required: true, value: p.mobile, prefix: '+91', inputmode: 'numeric', maxlength: 10 }),
      field({ name: 'pincode', label: 'PIN code', required: true, value: p.pincode, inputmode: 'numeric', maxlength: 6 }),
      field({ name: 'address', label: 'Address', type: 'textarea', rows: 2, required: true, value: p.address, full: true }),
      field({ name: 'city', label: 'City', required: true, value: p.city }),
      field({ name: 'state', label: 'State / union territory', type: 'select', options: o.states, required: true, value: p.state })), actions());
    onSubmit(form, async (v) => { const r = await api(p.id ? `/settings/pickup-locations/${p.id}` : '/settings/pickup-locations', { method: p.id ? 'PUT' : 'POST', body: { ...v, is_default: true } }); toast(r.message || 'Pickup location saved.', 'success'); next(); });
    panel = wrap('Pickup location', 'Where orders are packed and handed over. You can add more locations later under Shipping.', form);
  } else if (step === 'bank') {
    const b = o.bank;
    const form = h('form.stack', h('div', { dataset: { formError: '' } }),
      b ? banner('success', [h('b', 'Bank account saved: '), `${b.bank_name} ${b.account_masked} · IFSC ${b.ifsc}. Fill in the form only if you want to replace it.`]) : null,
      h('div.form-grid',
        field({ name: 'holder_name', label: 'Account holder name', required: true, value: b ? b.holder_name : '' }),
        field({ name: 'bank_name', label: 'Bank name', required: true, value: b ? b.bank_name : '' }),
        field({ name: 'account_number', label: 'Account number', type: 'password', required: true, inputmode: 'numeric', autocomplete: 'off', hint: '9–18 digits. Sent over the secure connection and stored encrypted on the server.' }),
        field({ name: 'confirm_account_number', label: 'Confirm account number', required: true, inputmode: 'numeric' }),
        field({ name: 'ifsc', label: 'IFSC code', required: true, value: b ? b.ifsc : '', placeholder: 'HDFC0001234', maxlength: 11 }),
        b ? field({ name: 'current_password', label: 'Your password', type: 'password', required: true, hint: 'Required to replace saved bank details.' }) : null),
      h('p.small.muted', icon('lock', 'sm'), ' Bank details are never kept in your browser. After saving, only the last four digits are shown.'),
      h('div.form-actions', back, b ? h('button.btn', { type: 'button', onClick: next }, 'Keep saved account') : null, readOnly ? null : h('button.btn.primary', { type: 'submit' }, b ? 'Replace and continue' : 'Save and continue')));
    onSubmit(form, async (v) => { const r = await api('/settings/bank', { method: 'PUT', body: v }); toast(r.message || 'Bank details saved.', 'success'); next(); });
    panel = wrap('Bank details', 'The account your settlements are paid into.', form);
  } else if (step === 'store') {
    const st = o.store || {};
    let logoId = st.logo_upload_id || null;
    const preview = h('span.thumb.lg');
    const drawLogo = () => preview.replaceChildren(logoId ? h('img', { src: uploadUrl(logoId), alt: 'Store logo' }) : icon('store'));
    drawLogo();
    const pick = h('button.btn.sm', { type: 'button', onClick: async () => { const file = await pickFile('image/png,image/jpeg,image/webp'); if (!file) return; await busy(pick, async () => { const up = await uploadFile(file, 'logo'); logoId = up.id; drawLogo(); toast('Logo uploaded. Save to apply it.', 'success'); }); } }, icon('upload', 'sm'), 'Upload logo');
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
      field({ name: 'store_name', label: 'Store display name', required: true, value: st.store_name, hint: 'Shown to customers on your listings.' }),
      h('div.field', { dataset: { field: 'logo_upload_id' } }, h('span.label', 'Store logo'), h('div.row', preview, pick, logoId ? h('button.btn.sm.ghost', { type: 'button', onClick: () => { logoId = null; drawLogo(); } }, 'Remove') : null), h('div.hint', 'PNG, JPG or WebP up to 1 MB. Optional.'), h('div.error', { hidden: true })),
      field({ name: 'store_description', label: 'Store description', type: 'textarea', rows: 3, required: true, value: st.store_description, full: true, hint: 'At least 20 characters.' }),
      field({ name: 'contact_email', label: 'Contact email', type: 'email', required: true, value: st.contact_email }),
      field({ name: 'contact_phone', label: 'Contact phone', required: true, value: st.contact_phone, prefix: '+91', inputmode: 'numeric', maxlength: 10 })), actions());
    onSubmit(form, async (v) => { const r = await api('/settings/store', { method: 'PUT', body: { ...v, logo_upload_id: logoId } }); await refreshMe(); state.shell = null; toast(r.message, 'success'); next(); });
    panel = wrap('Store information', 'How your store appears to customers.', form);
  } else if (step === 'product') {
    const p = o.first_product;
    panel = wrap('First product', 'Add at least one product so that your catalogue is ready when the account is approved.', h('div.stack',
      p ? h('div.banner.success', icon('check'), h('div.grow', h('b', `${o.product_count} product${o.product_count === 1 ? '' : 's'} added. `), 'First listing: ', h('a', { href: `/seller/products/${p.code}` }, p.title), ' ', statusBadge(p.status)))
        : emptyState({ ico: 'box', title: 'No products yet', text: 'Create your first listing. You can save it as a draft and finish it later.' }),
      h('div.form-actions', back, can('products.write') ? h('a.btn', { href: '/seller/products/new?from=onboarding' }, icon('plus', 'sm'), p ? 'Add another product' : 'Add your first product') : null, p ? h('button.btn.primary', { type: 'button', onClick: next }, 'Continue to review') : null)));
  } else {
    const remaining = o.steps.filter((st) => !st.done && st.key !== 'review');
    const b = o.business || {}; const pk = o.pickup_locations[0]; const st = o.store || {};
    const confirm = field({ name: 'confirm', type: 'checkbox', label: 'I confirm that the information above is accurate and that I am authorised to register this business.' });
    const form = h('form.stack', h('div', { dataset: { formError: '' } }),
      remaining.length ? banner('warn', [h('b', 'Not ready to submit. '), `Complete ${remaining.map((r) => r.title.toLowerCase()).join(', ')} first.`]) : null,
      h('div.grid.c2',
        h('div.stack.sm', h('h3', 'Business'), kv([['Legal name', b.legal_name], ['Type', b.business_type], ['GSTIN', b.gstin], ['PAN', b.pan_masked], ['Address', b.address ? `${b.address}, ${b.city}, ${b.state} ${b.pincode}` : null]])),
        h('div.stack.sm', h('h3', 'Pickup location'), kv([['Name', pk && pk.name], ['Contact', pk && `${pk.contact_person} · ${pk.mobile}`], ['Address', pk && `${pk.address}, ${pk.city}, ${pk.state} ${pk.pincode}`]])),
        h('div.stack.sm', h('h3', 'Bank account'), kv([['Account holder', o.bank && o.bank.holder_name], ['Bank', o.bank && o.bank.bank_name], ['Account', o.bank && o.bank.account_masked], ['IFSC', o.bank && o.bank.ifsc]])),
        h('div.stack.sm', h('h3', 'Store'), kv([['Display name', st.store_name], ['Contact', st.contact_email ? `${st.contact_email} · ${st.contact_phone}` : null], ['Products', o.product_count ? `${o.product_count} added` : null]]))),
      o.status === 'approved' ? banner('success', 'Your seller account is already approved. Changes to these details can be made in Settings.') : locked ? banner('', 'Your details have been submitted and are under review.') : confirm,
      o.auto_review && o.status !== 'approved' && !locked ? h('p.small.muted', 'Demo review mode: this server approves submissions automatically — no human review or KYC takes place.') : null,
      h('div.form-actions', back, o.status === 'approved' ? h('a.btn.primary', { href: '/seller/dashboard' }, 'Go to dashboard') : locked ? h('a.btn.primary', { href: '/seller/account-status' }, 'View account status') : readOnly ? null : h('button.btn.primary', { type: 'submit', disabled: remaining.length > 0 }, 'Submit for review')));
    onSubmit(form, async (v) => { const r = await api('/onboarding/submit', { method: 'POST', body: { confirm: Boolean(v.confirm) } }); await refreshMe(); state.shell = null; toast(r.status === 'approved' ? 'Seller account approved (demo review mode — no human review took place).' : 'Onboarding submitted for review.', 'success'); navigate('/seller/account-status'); });
    panel = wrap('Final review', 'Check everything before you submit.', form);
  }
  return h('div.stack.lg',
    pageHead({ title: 'Seller onboarding', subtitle: `Step ${index + 1} of 6 · ${o.completed} of ${o.total} completed`, trail: ['Onboarding'], tag: statusBadge(o.status, o.status_label), actions: [h('a.btn', { href: '/seller/account-status' }, 'Account status')] }),
    readOnly ? banner('warn', 'Only the store owner can change onboarding details. You can view them here.') : null,
    h('div.wizard', stepNav, panel));
}
