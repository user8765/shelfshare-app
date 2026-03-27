#!/usr/bin/env node
// Migration runner — applies all pending SQL migrations in order
// Usage: DATABASE_URL=... node scripts/migrate.js
//        or: DB_SECRET_ARN=... node scripts/migrate.js  (AWS)

const { readdir, readFile } = require('fs/promises');
const { join } = require('path');
const { Pool } = require('pg');

async function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (process.env.DB_SECRET_ARN) {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({});
    const res = await client.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
    if (!res.SecretString) throw new Error('DB secret is empty');
    return res.SecretString;
  }

  throw new Error('Set DATABASE_URL or DB_SECRET_ARN');
}

async function run() {
  const connectionString = await getConnectionString();
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, '../packages/api/migrations');
    const files = (await readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        `SELECT name FROM _migrations WHERE name = $1`, [file]
      );
      if (rows.length > 0) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.log(`  apply ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
