import nodemailer from 'nodemailer';
import { lookup } from 'node:dns/promises';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function card(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 16px;background:#0d0c12;color:#eee8e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#181419;border:1px solid #704827;border-radius:18px"><tr><td style="padding:40px"><p style="margin:0 0 24px;color:#ffd184;font-size:13px;font-weight:700;letter-spacing:2px">DATES</p><h1 style="margin:0 0 24px;color:#fff4df;font-size:28px;line-height:1.25;font-weight:700;letter-spacing:-0.4px">${escapeHtml(title)}</h1>${content}</td></tr></table></body></html>`;
}
export function verificationMail(email, value, origin) {
  // A fragment avoids putting the token in server access logs and referrer headers.
  // The browser exchanges the fragment for verification after the app loads.
  const url = `${origin}/#verify-email=${value}`;
  return { to: email, subject: 'Verify your Dates email address',
    text: `Verify your email: ${url}\nThis link expires in 24 hours. If you did not register, ignore this message.`,
    html: card('Verify your email', `<p>Confirm your email address to finish creating your account.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#f5a13a;color:#24150c;text-decoration:none;font-weight:bold">Verify email address</a></p><p>This link expires in 24 hours. If you did not register, ignore this message.</p>`) };
}
export function reminderMail(event, occurrence, kind) {
  const timing = { month: 'in one month', week: 'in one week', day: 'tomorrow', today: 'today' }[kind];
  const importance = event.importance <= 3 ? 'Low' : event.importance <= 6 ? 'Medium' : 'High';
  const importanceColor = importance === 'High' ? '#ffad86' : importance === 'Medium' ? '#ffd184' : '#c7d4c4';
  const formatted = new Date(`${occurrence}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return { to: event.email, subject: `Reminder: ${event.title} ${timing}`,
    text: `${event.title} is coming up ${timing}.\nDate: ${formatted}\nTimezone: ${event.time_zone}\nImportance: ${importance}\n${event.note}`,
    html: card(event.title, `<p style="margin:0 0 22px;color:#ddd5cd;font-size:16px">This event is coming up ${timing}.</p><p style="margin:0 0 22px;color:#c8bfb7;font-size:15px"><strong style="color:#fff4df;font-weight:600">${escapeHtml(formatted)}</strong><br><span style="color:#a9a0a0">${escapeHtml(event.time_zone)}</span></p><p style="margin:0 0 22px;color:#c8bfb7;font-size:15px">Importance: <strong style="color:${importanceColor};font-weight:700">${importance}</strong></p>${event.note ? `<div style="margin-top:26px;padding:18px 20px;background:#100e12;border-left:3px solid #8f592c;border-radius:8px;color:#d8d0c8;font-size:15px">${escapeHtml(event.note).replace(/\r?\n/g, '<br>')}</div>` : ''}`) };
}
export function mailer(env = process.env) {
  let transport;
  return async message => {
    if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new Error('SMTP configuration is missing');
    const hostname = env.SMTP_HOST || 'smtp.gmail.com';
    // Nodemailer's c-ares resolver can stall on some Windows configurations.
    // Resolve through the OS first and retain the hostname for TLS validation.
    const { address } = await lookup(hostname, { family: 4 });
    const password = hostname === 'smtp.gmail.com' ? env.SMTP_PASSWORD.replace(/\s/g, '') : env.SMTP_PASSWORD;
    transport ??= nodemailer.createTransport({ host: address, port: Number(env.SMTP_PORT || 587),
      family: 4, secure: env.SMTP_PORT === '465', requireTLS: true, tls: { servername: hostname },
      auth: { user: env.SMTP_USER, pass: password },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, disableFileAccess: true, disableUrlAccess: true });
    let timeout;
    try {
      await Promise.race([
        transport.sendMail({ ...message, from: { name: env.SMTP_NAME || 'Dates Reminders', address: env.SMTP_FROM } }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('SMTP delivery timed out')), 15000); })
      ]);
    } catch (error) {
      transport.close();
      transport = undefined;
      throw error;
    } finally { clearTimeout(timeout); }
  };
}
