import { createApp } from './app.js';
import { database } from './db.js';
import { mailer } from './mail.js';
import { processReminders } from './reminders.js';
import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
// Reuse the ignored .NET local settings so developers maintain one private
// SMTP configuration. Production never reads this file.
try {
  const local = JSON.parse(await readFile(new URL('../../Dates.API/DatesAPI/appsettings.Local.json', import.meta.url), 'utf8'));
  const smtp = local.Email?.Smtp || {};
  env.SMTP_HOST ||= smtp.Host;
  env.SMTP_PORT ||= String(smtp.Port || '');
  env.SMTP_USER ||= smtp.Username;
  env.SMTP_PASSWORD ||= smtp.Password;
  env.SMTP_FROM ||= smtp.From;
  env.SMTP_NAME ||= smtp.DisplayName;
} catch { /* .env.local can provide SMTP settings instead. */ }

env.APP_ORIGIN ||= 'http://localhost:5173';
env.RATE_LIMIT_SECRET ||= 'dates-local-rate-limit-secret-do-not-use-in-production';
env.CRON_SECRET ||= 'dates-local-cron-secret-do-not-use-in-production';
env.REMINDERS_ENABLED ||= 'false';

let db;
if (env.DATABASE_URL) {
  db = database(env.DATABASE_URL);
} else {
  const dataDirectory = fileURLToPath(new URL('../.local', import.meta.url));
  await mkdir(dataDirectory, { recursive: true });
  db = new PGlite(fileURLToPath(new URL('../.local/dates', import.meta.url)));
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
}

const send = mailer(env);
createApp({ db, send, env }).listen(3001, '127.0.0.1', () => {
  console.log(`Dates API: http://127.0.0.1:3001 (${env.DATABASE_URL ? 'configured Postgres' : 'private local database'})`);
});

let checkingReminders = false;
async function checkLocalReminders() {
  if (checkingReminders) return;
  checkingReminders = true;
  try {
    const result = await processReminders(db, send);
    if (result.processed || result.failed) console.log(`Reminder check: ${result.processed - result.failed} sent, ${result.failed} failed`);
  } catch (error) {
    console.error('Local reminder check failed', { category: error.code || error.name });
  } finally { checkingReminders = false; }
}
setTimeout(checkLocalReminders, 1000);
setInterval(checkLocalReminders, 60000).unref();
