import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.js';
import { hash, token } from '../server/security.js';
import { processReminders } from '../server/reminders.js';
import { localDate, localHour, occurrenceDate, dueDate, daysBetween } from '../shared/calendar.js';

const db = new PGlite();
const mail = [];
const env = { APP_ORIGIN: 'https://dates.example', RATE_LIMIT_SECRET: 'test-rate-secret-'.repeat(3), CRON_SECRET: 'test-cron-secret-'.repeat(3), REMINDERS_ENABLED: 'true' };
const send = async message => { mail.push(message); };
let server, base, cookie;
const event = { event: 'Birthday', eventDate: '2026-09-20', timeZoneId: 'Asia/Kathmandu', importance: 5, eventNote: '<script>bad()</script>', isRecurring: false, reminderOneMonth: false, reminderOneWeek: false, reminderOneDay: false, reminderSameDay: true };
async function request(path, method = 'GET', body, session = cookie, origin = env.APP_ORIGIN) {
  const response = await fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
}
before(async () => {
  await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  server = createApp({ db, send, env }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });

test('registration validates email/password and verification is required and single-use', async () => {
  assert.equal((await request('/api/Authentication/register', 'POST', { email: 'invalid', password: 'abcdefgh' })).status, 400);
  assert.equal((await request('/api/Authentication/register', 'POST', { email: 'one@example.com', password: 'short' })).status, 400);
  const credentials = { email: 'One@Example.com', password: ' password with spaces ' };
  const first = await request('/api/Authentication/register', 'POST', credentials);
  assert.equal(first.status, 202);
  const user = (await db.query('SELECT * FROM users')).rows[0];
  assert.equal(user.email, 'one@example.com');
  assert.notEqual(user.password_hash, credentials.password);
  const value = mail[0].text.match(/#verify-email=([\w-]+)/)[1];
  assert.equal(user.verification_hash, hash(value));
  assert.equal((await request('/api/Authentication/login', 'POST', credentials)).status, 403);
  const duplicate = await request('/api/Authentication/register', 'POST', credentials);
  assert.deepEqual(duplicate.body, first.body);
  assert.equal(mail.length, 1);
  const results = await Promise.all([request('/api/Authentication/verify-email', 'POST', { token: value }), request('/api/Authentication/verify-email', 'POST', { token: value })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  const login = await request('/api/Authentication/login', 'POST', credentials);
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  for (const part of ['__Host-dates-session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(header.includes(part));
  cookie = header.split(';')[0];
  assert.equal((await request('/api/Authentication/me')).body.email, user.email);
  assert.equal((await request('/api/Authentication/login', 'POST', { ...credentials, password: credentials.password.trim() })).status, 401);
});

test('event ownership, validation and CSRF origin checks', async () => {
  assert.equal((await request('/api/DateDetails', 'POST', event, cookie, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/DateDetails', 'POST', { ...event, eventDate: '2026-02-30' })).status, 400);
  assert.equal((await request('/api/DateDetails', 'POST', { ...event, timeZoneId: 'Unknown/Place' })).status, 400);
  const created = await request('/api/DateDetails', 'POST', event);
  assert.equal(created.status, 201);
  assert.equal(created.body.eventDate, event.eventDate);
  const id = created.body.dateId;
  const user = (await db.query(`INSERT INTO users(email,password_hash,verified) VALUES('two@example.com','unused',true) RETURNING id`)).rows[0];
  const otherToken = token();
  await db.query(`INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')`, [hash(otherToken), user.id]);
  const otherCookie = `__Host-dates-session=${otherToken}`;
  assert.deepEqual((await request('/api/DateDetails', 'GET', undefined, otherCookie)).body, []);
  assert.equal((await request(`/api/DateDetails/${id}`, 'PUT', event, otherCookie)).status, 404);
  assert.equal((await request(`/api/DateDetails/${id}`, 'DELETE', undefined, otherCookie)).status, 404);
  assert.equal((await request('/api/DateDetails', 'GET', undefined, '')).status, 401);
});

test('reminders use local calendar date, escape content, persist across runs and edits', async () => {
  const initialMail = mail.length;
  const beforeMidnight = new Date('2026-09-19T18:14:59Z');
  assert.equal(localDate(beforeMidnight, 'Asia/Kathmandu'), '2026-09-19');
  assert.equal((await processReminders(db, send, beforeMidnight)).processed, 0);
  const midnight = new Date('2026-09-19T18:15:00Z');
  const results = await Promise.all([processReminders(db, send, midnight), processReminders(db, send, midnight)]);
  assert.equal(results.reduce((sum, r) => sum + r.processed, 0), 1);
  assert.equal(mail.length, initialMail + 1);
  assert.ok(mail.at(-1).html.includes('&lt;script&gt;'));
  assert.ok(mail.at(-1).html.includes('Medium</strong>'));
  assert.ok(!mail.at(-1).html.includes('/10'));
  assert.ok(!mail.at(-1).html.includes('Your events, right on time'));
  assert.equal((await db.query('SELECT state FROM deliveries')).rows[0].state, 'sent');
  const id = (await request('/api/DateDetails')).body[0].dateId;
  assert.equal((await request(`/api/DateDetails/${id}`, 'PUT', { ...event, event: 'Renamed' })).status, 200);
  assert.equal((await processReminders(db, send, midnight)).processed, 0);
});

test('failed reminder delivery is retryable and is not marked sent', async () => {
  const id = (await request('/api/DateDetails', 'POST', { ...event, event: 'Retry' })).body.dateId;
  const now = new Date('2026-09-19T18:15:00Z');
  const result = await processReminders(db, async () => { throw new Error('SMTP unavailable'); }, now);
  assert.equal(result.failed, 1);
  assert.equal((await db.query('SELECT state FROM deliveries WHERE event_id=$1', [id])).rows[0].state, 'failed');
  assert.equal((await processReminders(db, send, now)).processed, 0);
  await db.query(`UPDATE deliveries SET lease_until=now()-interval '1 minute' WHERE event_id=$1`, [id]);
  assert.equal((await processReminders(db, send, now)).processed, 1);
});

test('calendar arithmetic handles leap years, month ends, DST and international date boundaries', () => {
  assert.equal(occurrenceDate('2024-02-29', true, '2027-03-01'), '2028-02-29');
  assert.equal(occurrenceDate('2024-02-29', true, '2027-02-28'), '2027-02-28');
  assert.equal(dueDate('2026-03-31', 'month'), '2026-02-28');
  assert.equal(dueDate('2028-03-31', 'month'), '2028-02-29');
  assert.equal(dueDate('2027-01-01', 'week'), '2026-12-25');
  assert.equal(daysBetween('2026-03-08', '2026-03-09'), 1);
  assert.equal(localDate(new Date('2026-09-19T12:00:00Z'), 'Pacific/Kiritimati'), '2026-09-20');
  assert.equal(localDate(new Date('2026-09-19T00:00:00Z'), 'America/Los_Angeles'), '2026-09-18');
  assert.equal(localHour(new Date('2026-09-19T00:15:00Z'), 'Asia/Kathmandu'), 6);
});

test('scheduled checks only send during the event timezone morning hour', async () => {
  const user = (await db.query(`SELECT id FROM users WHERE email='one@example.com'`)).rows[0];
  const event = (await db.query(`INSERT INTO events(user_id,title,event_date,time_zone,importance,remind_today)
    VALUES($1,'Morning event','2026-09-19','Asia/Kathmandu',5,true) RETURNING id`, [user.id])).rows[0];
  const before = mail.length;
  assert.equal((await processReminders(db, send, new Date('2026-09-18T23:59:00Z'), { targetLocalHour: 6 })).processed, 0);
  assert.equal((await processReminders(db, send, new Date('2026-09-19T00:15:00Z'), { targetLocalHour: 6 })).processed, 1);
  assert.equal(mail.length, before + 1);
  await db.query('DELETE FROM events WHERE id=$1', [event.id]);
});

test('expired verification links fail, resend stays generic, rate limits and logout persist', async () => {
  const value = token();
  await db.query(`UPDATE users SET verified=false,verification_hash=$1,verification_expires=now()-interval '1 minute' WHERE email='two@example.com'`, [hash(value)]);
  assert.equal((await request('/api/Authentication/verify-email', 'POST', { token: value })).status, 400);
  const unknown = await request('/api/Authentication/resend-verification', 'POST', { email: 'unknown@example.com' });
  const known = await request('/api/Authentication/resend-verification', 'POST', { email: 'two@example.com' });
  assert.deepEqual(unknown.body, known.body);
  for (let i = 0; i < 3; i++) await request('/api/Authentication/resend-verification', 'POST', { email: 'unknown@example.com' });
  assert.equal((await request('/api/Authentication/resend-verification', 'POST', { email: 'unknown@example.com' })).status, 429);
  assert.equal((await request('/api/cron/reminders')).status, 401);
  assert.equal((await request('/api/Authentication/logout', 'POST')).status, 204);
  assert.equal((await request('/api/Authentication/me')).status, 401);
});
