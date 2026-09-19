import { createApp } from './app.js';
import { database } from './db.js';
import { mailer } from './mail.js';

createApp({ db: database(), send: mailer() }).listen(3001, '127.0.0.1', () => console.log('Dates API: http://127.0.0.1:3001'));
