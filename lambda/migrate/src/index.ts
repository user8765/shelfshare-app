import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const sm = new SecretsManagerClient({});

export const handler = async () => {
  const arn = process.env['DB_SECRET_ARN'];
  if (!arn) throw new Error('DB_SECRET_ARN not set');

  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!SecretString) throw new Error('DB secret empty');

  const pool = new Pool({ connectionString: SecretString });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const dir = join(__dirname, 'migrations');
    const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
    const applied: string[] = [];

    for (const file of files) {
      const { rows } = await client.query(`SELECT name FROM _migrations WHERE name = $1`, [file]);
      if (rows.length) continue;

      const sql = await readFile(join(dir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      applied.push(file);
    }

    return { applied, message: applied.length ? `Applied ${applied.length} migration(s)` : 'No new migrations' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};
