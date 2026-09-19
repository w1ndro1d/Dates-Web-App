import { createApp } from '../server/app.js';
import { database } from '../server/db.js';
import { mailer } from '../server/mail.js';

let handler;
export default function api(req, res) {
  try {
    handler ??= createApp({ db: database(), send: mailer() });
    return handler(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'The service is not configured yet.' }));
  }
}
