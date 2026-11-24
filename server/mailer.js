import { q } from './db.js';

// Sends email through Resend (https://resend.com) when RESEND_API_KEY is configured.
// Without a provider (classroom demo), the message is stored in the "outbox" table,
// which only Admins can read from the Admin panel. The API never reveals it to the requester.
export async function sendMail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Chronicle Atlas <onboarding@resend.dev>', to: [to], subject, text }),
    });
    if (res.ok) return { delivered: true };
    console.error('[mail] Resend error', res.status, await res.text().catch(() => ''));
  }
  await q('INSERT INTO outbox (to_email, subject, body) VALUES ($1, $2, $3)', [to, subject, text]);
  return { delivered: false, stored: true };
}
