import { Pool } from 'pg';
import { getSecrets } from '../config/secrets.js';

let _db: Pool | null = null;

export async function getDb(): Promise<Pool> {
  if (_db) return _db;
  const { databaseUrl } = await getSecrets();
  _db = new Pool({
    connectionString: databaseUrl,
    ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: true } : false,
  });
  return _db;
}

// Convenience proxy — lazily initialised, awaited on first use
export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return async (...args: unknown[]) => {
      const pool = await getDb();
      return (pool as unknown as Record<string, (...a: unknown[]) => unknown>)[prop as string]?.(...args);
    };
  },
});
