import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations.');
const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
await sql.transaction(schema.split(';').filter(part => part.trim()).map(part => sql.query(part)));
console.log('Postgres schema is ready. Existing rows were preserved.');
