import { Pool } from 'pg';
import type { ScheduledHandler } from 'aws-lambda';

const db = new Pool({ connectionString: process.env['DATABASE_URL'] });

export const handler: ScheduledHandler = async () => {
  const client = await db.connect();
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
