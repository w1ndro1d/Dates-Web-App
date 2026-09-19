import express from 'express';
import { createHmac } from 'node:crypto';
import { hash, token, equalSecret, hashPassword, verifyPassword, validateEmail, validatePassword, HttpError } from './security.js';
import { calendarDate } from '../shared/calendar.js';
import { verificationMail } from './mail.js';
import { processReminders } from './reminders.js';

const genericVerification = 'If this address can receive a verification link, an email is on its way. Check your inbox, or sign in if already verified.';
export function createApp({ db, send, env = process.env }) {
  const app = express();
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:5173').origin;
  const secure = origin.startsWith('https:');
  if (env.VERCEL && (!secure || !env.APP_ORIGIN)) throw new Error('APP_ORIGIN must be the HTTPS production or preview origin.');
  if ((env.RATE_LIMIT_SECRET || '').length < 32) throw new Error('RATE_LIMIT_SECRET must contain at least 32 random characters.');
  const cookieName = secure ? '__Host-dates-session' : 'dates-session';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 86400000 };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin) {
      return res.status(403).json({ message: 'This request origin is not allowed.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  const query = async (text, params) => (await db.query(text, params)).rows;
  function sessionValue(req) {
    return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
  }
  async function rateLimit(req, scope, limit, seconds, identity) {
    // Vercel overwrites x-real-ip. Locally, never trust caller-supplied forwarding headers.
    const ip = env.VERCEL ? req.headers['x-real-ip'] || 'unknown' : req.socket.remoteAddress;
    const key = createHmac('sha256', env.RATE_LIMIT_SECRET).update(`${scope}:${identity || ip}`).digest('hex');
    const rows = await query(`INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,now()+$2 * interval '1 second')
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.hits+1 END,
      expires_at=CASE WHEN rate_limits.expires_at <= now() THEN now()+$2 * interval '1 second' ELSE rate_limits.expires_at END
      RETURNING hits`, [key, seconds]);
    if (rows[0].hits > limit) throw new HttpError(429, 'Too many attempts. Please try again later.');
  }
  async function authenticate(req, res, next) {
    const value = sessionValue(req);
    if (!/^[\w-]{43}$/.test(value)) throw new HttpError(401, 'Please sign in again.');
    const rows = await query(`SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at > now() AND u.verified=true`, [hash(value)]);
    if (!rows.length) throw new HttpError(401, 'Your session expired. Please sign in again.');
    req.user = rows[0];
    await rateLimit(req, 'account', 120, 60, String(req.user.id));
    next();
  }
  async function sendVerification(user) {
    const value = token();
    const rows = await query(`UPDATE users SET verification_hash=$2,verification_expires=now()+interval '24 hours',verification_sent_at=now()
      WHERE id=$1 AND verified=false AND (verification_sent_at IS NULL OR verification_sent_at <= now()-interval '1 minute') RETURNING id`, [user.id, hash(value)]);
    if (!rows.length) return;
    try { await send(verificationMail(user.email, value, origin)); }
    catch (error) {
      // Do not disclose SMTP details or leave the account locked without a resend path.
      await query(`UPDATE users SET verification_sent_at=NULL WHERE id=$1 AND verification_hash=$2`, [user.id, hash(value)]);
      throw new HttpError(503, 'Email delivery is temporarily unavailable. Use Resend verification to try again.');
    }
  }
  async function sendNewlyDueReminders() {
    if (env.REMINDERS_ENABLED !== 'true') return null;
    try {
      return await processReminders(db, send);
    } catch (error) {
      // The event has already been saved. Let the scheduled retry handle a
      // temporary database or SMTP failure rather than making the user retry
      // and accidentally create a duplicate event.
      console.error('Immediate reminder check failed', { category: error.code || error.name });
      return null;
    }
  }
  app.get('/api/health', async (req, res) => { await query('SELECT 1'); res.json({ status: 'ok' }); });
  app.post('/api/Authentication/register', async (req, res) => {
    await rateLimit(req, 'register', 5, 3600);
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password, true);
    const passwordHash = await hashPassword(password);
    const rows = await query(`INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id,email`, [email, passwordHash]);
    if (rows.length) await sendVerification(rows[0]);
    res.status(202).json({ message: genericVerification });
  });
  app.post('/api/Authentication/login', async (req, res) => {
    await rateLimit(req, 'login-ip', 30, 900);
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    await rateLimit(req, 'login-account', 10, 900, email);
    const [user] = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (!(await verifyPassword(password, user?.password_hash)) || !user) throw new HttpError(401, 'Email or password is incorrect.');
    if (!user.verified) throw new HttpError(403, 'Verify your email address before signing in.', 'email_not_verified');
    const value = token();
    await query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')`, [hash(value), user.id]);
    res.cookie(cookieName, value, cookieOptions).json({ email: user.email });
  });
  app.get('/api/Authentication/me', authenticate, (req, res) => res.json({ email: req.user.email }));
  app.post('/api/Authentication/logout', async (req, res) => {
    await query('DELETE FROM sessions WHERE token_hash=$1', [hash(sessionValue(req))]);
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).sendStatus(204);
  });
  app.post('/api/Authentication/verify-email', async (req, res) => {
    await rateLimit(req, 'verify', 20, 900);
    const value = req.body?.token;
    if (typeof value !== 'string' || !/^[\w-]{43}$/.test(value)) throw new HttpError(400, 'This link is invalid or expired. Request a new verification email.');
    const rows = await query(`UPDATE users SET verified=true,verification_hash=NULL,verification_expires=NULL
      WHERE verification_hash=$1 AND verification_expires>now() AND verified=false RETURNING id`, [hash(value)]);
    if (!rows.length) throw new HttpError(400, 'This link is invalid, expired, or already used. Try signing in or request a new link.');
    res.json({ message: 'Your email is verified. You can now sign in.' });
  });
  app.post('/api/Authentication/resend-verification', async (req, res) => {
    await rateLimit(req, 'resend-ip', 5, 3600);
    const email = validateEmail(req.body?.email);
    await rateLimit(req, 'resend-email', 3, 3600, email);
    const [user] = await query('SELECT id,email FROM users WHERE email=$1 AND verified=false', [email]);
    if (user) await sendVerification(user);
    res.status(202).json({ message: genericVerification });
  });
  app.get('/api/DateDetails', authenticate, async (req, res) => {
    const rows = await query('SELECT *,event_date::text AS event_date FROM events WHERE user_id=$1 ORDER BY events.event_date,id', [req.user.id]);
    res.json(rows.map(eventDto));
  });
  app.post('/api/DateDetails', authenticate, async (req, res) => {
    await rateLimit(req, 'create-event', 20, 3600, String(req.user.id));
    const values = eventValues(req.body);
    const rows = await query(`INSERT INTO events(user_id,title,event_date,time_zone,recurring,importance,note,remind_month,remind_week,remind_day,remind_today)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *,event_date::text AS event_date`, [req.user.id, ...values]);
    await sendNewlyDueReminders();
    res.status(201).json(eventDto(rows[0]));
  });
  app.put('/api/DateDetails/:id', authenticate, async (req, res) => {
    const values = eventValues(req.body);
    const rows = await query(`UPDATE events SET title=$3,event_date=$4,time_zone=$5,recurring=$6,importance=$7,note=$8,
      remind_month=$9,remind_week=$10,remind_day=$11,remind_today=$12 WHERE id=$1 AND user_id=$2 RETURNING *,event_date::text AS event_date`, [eventId(req), req.user.id, ...values]);
    if (!rows.length) throw new HttpError(404, 'Event not found.');
    // Delivery records are independent of edits, so cosmetic edits never resend mail.
    await sendNewlyDueReminders();
    res.json(eventDto(rows[0]));
  });
  app.delete('/api/DateDetails/:id', authenticate, async (req, res) => {
    const rows = await query('DELETE FROM events WHERE id=$1 AND user_id=$2 RETURNING id', [eventId(req), req.user.id]);
    if (!rows.length) throw new HttpError(404, 'Event not found.');
    res.sendStatus(204);
  });
  app.get('/api/cron/reminders', async (req, res) => {
    if ((env.CRON_SECRET || '').length < 32 || !equalSecret(req.headers.authorization, `Bearer ${env.CRON_SECRET}`)) throw new HttpError(401, 'Unauthorized.');
    if (env.REMINDERS_ENABLED !== 'true' || (env.VERCEL_ENV && env.VERCEL_ENV !== 'production')) return res.json({ disabled: true });
    const result = await processReminders(db, send, new Date(), { targetLocalHour: 6 });
    await query('DELETE FROM sessions WHERE expires_at < now()');
    await query('DELETE FROM rate_limits WHERE expires_at < now()');
    res.status(result.failed ? 503 : 200).json(result);
  });
  app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof HttpError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 429) res.set('Retry-After', '900');
    // Log a category only: errors from DB/SMTP may include user data or credentials.
    if (status === 500) console.error('API request failed', { path: req.path, category: error.code || error.name });
    res.status(status).json({ message: error instanceof HttpError ? error.message : status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid JSON request.' : 'Something went wrong. Please try again.', ...(error.code && error instanceof HttpError ? { code: error.code } : {}) });
  });
  return app;
}
function eventId(req) {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) throw new HttpError(400, 'Invalid event ID.');
  return Number(req.params.id);
}
export function eventValues(body = {}) {
  const { event, eventDate, timeZoneId, importance, eventNote = '' } = body;
  if (typeof event !== 'string' || !event.trim() || event.length > 200 || /[\r\n\x00]/.test(event)) throw new HttpError(400, 'Enter an event name of up to 200 characters.');
  if (!calendarDate(eventDate)) throw new HttpError(400, 'Choose a valid calendar date.');
  if (typeof timeZoneId !== 'string' || timeZoneId.length > 100) throw new HttpError(400, 'Choose a valid timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: timeZoneId }); } catch { throw new HttpError(400, 'Choose a valid timezone.'); }
  if (!Number.isInteger(importance) || importance < 1 || importance > 10) throw new HttpError(400, 'Importance must be from 1 to 10.');
  if (typeof eventNote !== 'string' || eventNote.length > 200) throw new HttpError(400, 'Keep the description under 201 characters.');
  const flags = ['isRecurring', 'reminderOneMonth', 'reminderOneWeek', 'reminderOneDay', 'reminderSameDay'].map(key => {
    if (typeof body[key] !== 'boolean') throw new HttpError(400, 'Invalid event options.');
    return body[key];
  });
  return [event.trim(), eventDate, timeZoneId, flags[0], importance, eventNote.trim(), ...flags.slice(1)];
}
function eventDto(row) {
  return { dateId: row.id, event: row.title, eventDate: row.event_date, timeZoneId: row.time_zone,
    isRecurring: row.recurring, importance: row.importance, eventNote: row.note,
    reminderOneMonth: row.remind_month, reminderOneWeek: row.remind_week, reminderOneDay: row.remind_day,
    reminderSameDay: row.remind_today, initialLoggedDate: row.created_at };
}
