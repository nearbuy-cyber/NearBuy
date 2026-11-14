'use strict';
// Transactional email. Real delivery needs SMTP settings; without them nothing is sent and callers are told so.
const { insert } = require('./db');
const { nowIso } = require('./lib');

const smtpConfigured = () => Boolean(process.env.SMTP_HOST);
const isProduction = () => process.env.NODE_ENV === 'production';
/** Development-only preview of links that would have been emailed. Never active in production or with SMTP configured. */
const devPreviewEnabled = () => !smtpConfigured() && !isProduction() && process.env.DEV_MAIL_PREVIEW === '1';

let transport = null;
function getTransport() {
  if (transport) return transport;
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch {
    throw new Error('SMTP_HOST is set but the "nodemailer" package is not installed. Run: npm install nodemailer');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
  });
  return transport;
}

/**
 * Send an email. Returns { delivered, status } — `delivered` is true only when the SMTP server accepted the message.
 */
async function sendMail({ to, purpose, subject, text, link }) {
  const record = { to_email: to, purpose, subject, body: text, link: link || null, created_at: nowIso() };
  if (!smtpConfigured()) {
    // Outside production the unsent message (including its link) is kept so a developer can read it; in production it is not.
    insert('email_outbox', isProduction() ? { ...record, body: '(not sent)', link: null, status: 'not_sent_no_provider' } : { ...record, status: 'not_sent_no_provider' });
    if (!isProduction()) console.log(`[nearbuy:mail] No SMTP provider configured — NOT sent. To: ${to} · ${subject}${link ? ` · ${link}` : ''}`);
    return { delivered: false, status: 'not_sent_no_provider' };
  }
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM || 'NearBuy Seller Hub <no-reply@localhost>', to, subject, text });
    insert('email_outbox', { ...record, link: null, body: '(delivered via SMTP)', status: 'sent' });
    return { delivered: true, status: 'sent' };
  } catch (err) {
    insert('email_outbox', { ...record, link: null, status: 'failed', error: String(err.message || err).slice(0, 300) });
    console.error(`[nearbuy:mail] Delivery to ${to} failed: ${err.message}`);
    return { delivered: false, status: 'failed' };
  }
}

module.exports = { sendMail, smtpConfigured, devPreviewEnabled, isProduction };
