import { localDate, occurrenceDate, dueDate } from '../shared/calendar.js';
import { reminderMail } from './mail.js';

export async function processReminders(db, send, now = new Date()) {
  // A bounded function invocation; durable deliveries prevent routine duplicate runs.
  const started = Date.now();
  let processed = 0;
  let failed = 0;
  let cursor = 0;
  while (processed < 50 && Date.now() - started < 35000) {
    const { rows } = await db.query(`SELECT e.*, e.event_date::text AS event_date, u.email FROM events e
      JOIN users u ON u.id = e.user_id AND u.verified = true
      WHERE e.id > $1 AND (e.remind_month OR e.remind_week OR e.remind_day OR e.remind_today)
      AND (e.recurring OR e.event_date >= ($2::timestamptz - interval '1 day')::date)
      ORDER BY e.id LIMIT 100`, [cursor, now.toISOString()]);
    if (!rows.length) break;
    for (const event of rows) {
      cursor = event.id;
      const today = localDate(now, event.time_zone);
      const occurrence = occurrenceDate(event.event_date, event.recurring, today);
      for (const kind of ['month', 'week', 'day', 'today']) {
        if (!event[`remind_${kind}`] || dueDate(occurrence, kind) !== today) continue;
        if (processed >= 50 || Date.now() - started >= 35000) return { processed, failed, more: true };
        const { rows: claimed } = await db.query(`INSERT INTO deliveries(event_id, occurrence, kind, state, lease_until)
          VALUES($1,$2,$3,'sending',now() + interval '5 minutes')
          ON CONFLICT(event_id, occurrence, kind) DO UPDATE SET state='sending', lease_until=now()+interval '5 minutes', attempts=deliveries.attempts+1
          WHERE deliveries.state <> 'sent' AND deliveries.lease_until < now() AND deliveries.attempts < 5
          RETURNING event_id`, [event.id, occurrence, kind]);
        if (!claimed.length) continue;
        processed++;
        try {
          await send(reminderMail(event, occurrence, kind));
          await db.query(`UPDATE deliveries SET state='sent', sent_at=now() WHERE event_id=$1 AND occurrence=$2 AND kind=$3`, [event.id, occurrence, kind]);
        } catch {
          failed++;
          await db.query(`UPDATE deliveries SET state='failed', lease_until=now()+interval '15 minutes' WHERE event_id=$1 AND occurrence=$2 AND kind=$3`, [event.id, occurrence, kind]);
        }
      }
    }
  }
  return { processed, failed, more: processed >= 50 || Date.now() - started >= 35000 };
}
