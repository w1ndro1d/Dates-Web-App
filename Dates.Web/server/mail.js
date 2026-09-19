import nodemailer from 'nodemailer';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function card(title, content) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#0d0c12;color:#f5ede3;font-family:Arial,sans-serif;padding:24px"><table role="presentation" style="max-width:560px;width:100%;margin:auto;background:#181419;border:1px solid #704827;border-radius:18px"><tr><td style="padding:30px"><p style="color:#ffd184;font-weight:bold">DATES</p><h1 style="color:#fff4df;font-size:26px">${escapeHtml(title)}</h1>${content}<p style="margin-top:28px;color:#b8ada4;font-size:12px">Dates · Your events, right on time.</p></td></tr></table></body></html>`;
}
export function verificationMail(email, value, origin) {
  // A fragment avoids putting the token in server access logs and referrer headers.
  // The landing page requires a button press, so link scanners cannot verify an account.
  const url = `${origin}/#verify-email=${value}`;
  return { to: email, subject: 'Verify your Dates email address',
    text: `Verify your email: ${url}\nThis link expires in 24 hours. If you did not register, ignore this message.`,
    html: card('Verify your email', `<p>Confirm your email address to finish creating your account.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#f5a13a;color:#24150c;text-decoration:none;font-weight:bold">Verify email address</a></p><p>This link expires in 24 hours. If you did not register, ignore this message.</p>`) };
}
export function reminderMail(event, occurrence, kind) {
  const timing = { month: 'in one month', week: 'in one week', day: 'tomorrow', today: 'today' }[kind];
  const formatted = new Date(`${occurrence}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return { to: event.email, subject: `Reminder: ${event.title} ${timing}`,
    text: `${event.title} is coming up ${timing}.\nDate: ${formatted}\nTimezone: ${event.time_zone}\nImportance: ${event.importance}/10\n${event.note}`,
    html: card(event.title, `<p>This event is coming up ${timing}.</p><p><strong>${escapeHtml(formatted)}</strong><br>${escapeHtml(event.time_zone)}</p><p>Importance: ${event.importance}/10</p>${event.note ? `<p>${escapeHtml(event.note).replace(/\r?\n/g, '<br>')}</p>` : ''}`) };
}
export function mailer(env = process.env) {
  let transport;
  return async message => {
    if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new Error('SMTP configuration is missing');
    transport ??= nodemailer.createTransport({ host: env.SMTP_HOST || 'smtp.gmail.com', port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_PORT === '465', requireTLS: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, disableFileAccess: true, disableUrlAccess: true });
    await transport.sendMail({ ...message, from: { name: env.SMTP_NAME || 'Dates Reminders', address: env.SMTP_FROM } });
  };
}
