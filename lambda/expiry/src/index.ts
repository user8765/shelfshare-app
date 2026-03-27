import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { ScheduledHandler } from 'aws-lambda';

const smClient = new SecretsManagerClient({});
let db: Pool | null = null;

async function getDb(): Promise<Pool> {
  if (db) return db;
  const arn = process.env['DB_SECRET_ARN'];
  if (!arn) throw new Error('DB_SECRET_ARN not set');
  const res = await smClient.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) throw new Error('DB secret is empty');
  db = new Pool({ connectionString: res.SecretString });
  return db;
}

export const handler: ScheduledHandler = async () => {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ id: string; bookId: string; requesterId: string }>(
      `UPDATE borrow_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending' AND request_expires_at < NOW()
       RETURNING id, book_id AS "bookId", requester_id AS "requesterId"`,
    );

    if (rows.length) {
      await client.query(
        `UPDATE books SET status = 'available', updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [rows.map((r) => r.bookId)],
      );
      console.log(`Expired ${rows.length} borrow request(s):`, rows.map((r) => r.id));
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
