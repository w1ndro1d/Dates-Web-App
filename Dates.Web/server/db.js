import { neon } from '@neondatabase/serverless';

export function database(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  const sql = neon(url);
  return { query: async (text, parameters = []) => ({ rows: await sql.query(text, parameters) }) };
}
