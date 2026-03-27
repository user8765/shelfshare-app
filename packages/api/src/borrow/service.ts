import { db } from '../db/client.js';
import type { BorrowRequest, BorrowRequestStatus } from '@shelfshare/shared';

const BR_SELECT = `
  id, book_id AS "bookId", requester_id AS "requesterId", status,
  due_date AS "dueDate", proposed_due_date AS "proposedDueDate",
  extension_proposed_by AS "extensionProposedBy",
  request_expires_at AS "requestExpiresAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function getExpiryHours(): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `SELECT value FROM system_config WHERE key = 'borrow_request_expiry_hours'`,
  );
  return parseInt(rows[0]?.value ?? '48', 10);
}

export async function createBorrowRequest(bookId: string, requesterId: string): Promise<BorrowRequest> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // FCFS atomic lock — only succeeds if book is available
    const { rowCount } = await client.query(
      `UPDATE books SET status = 'pending', updated_at = NOW()
       WHERE id = $1 AND status = 'available'`,
      [bookId],
    );
    if (!rowCount) throw Object.assign(new Error('Book is not available'), { statusCode: 409 });

    const expiryHours = await getExpiryHours();
    const { rows } = await client.query<BorrowRequest>(
      `INSERT INTO borrow_requests (book_id, requester_id, request_expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)
       RETURNING ${BR_SELECT}`,
      [bookId, requesterId, expiryHours],
    );
    const request = rows[0];
    if (!request) throw new Error('Failed to create borrow request');

    await client.query('COMMIT');
    return request;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBorrowRequests(
  userId: string,
  role: 'owner' | 'borrower',
): Promise<BorrowRequest[]> {
  const query =
    role === 'owner'
      ? `SELECT br.${BR_SELECT.replace(/\n/g, '')}
         FROM borrow_requests br
         JOIN books b ON b.id = br.book_id
         WHERE b.owner_id = $1
         ORDER BY br.created_at DESC`
      : `SELECT ${BR_SELECT}
         FROM borrow_requests
         WHERE requester_id = $1
         ORDER BY created_at DESC`;

  const { rows } = await db.query<BorrowRequest>(
    role === 'owner'
      ? `SELECT br.id, br.book_id AS "bookId", br.requester_id AS "requesterId", br.status,
                br.due_date AS "dueDate", br.proposed_due_date AS "proposedDueDate",
                br.extension_proposed_by AS "extensionProposedBy",
                br.request_expires_at AS "requestExpiresAt",
                br.created_at AS "createdAt", br.updated_at AS "updatedAt"
         FROM borrow_requests br
         JOIN books b ON b.id = br.book_id
         WHERE b.owner_id = $1
         ORDER BY br.created_at DESC`
      : `SELECT ${BR_SELECT} FROM borrow_requests WHERE requester_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  // suppress unused variable warning
  void query;
  return rows;
}

export async function getBorrowRequestById(id: string): Promise<BorrowRequest | null> {
  const { rows } = await db.query<BorrowRequest>(
    `SELECT ${BR_SELECT} FROM borrow_requests WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function acceptRequest(id: string, ownerId: string, dueDate: string): Promise<BorrowRequest> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership and pending status
    const { rows: check } = await client.query<{ bookId: string }>(
      `SELECT br.book_id AS "bookId"
       FROM borrow_requests br
       JOIN books b ON b.id = br.book_id
       WHERE br.id = $1 AND b.owner_id = $2 AND br.status = 'pending'`,
      [id, ownerId],
    );
    if (!check[0]) throw Object.assign(new Error('Request not found or not actionable'), { statusCode: 404 });

    const { rows } = await client.query<BorrowRequest>(
      `UPDATE borrow_requests SET status = 'accepted', due_date = $2, updated_at = NOW()
       WHERE id = $1 RETURNING ${BR_SELECT}`,
      [id, dueDate],
    );

    await client.query(
      `UPDATE books SET status = 'lent_out', updated_at = NOW() WHERE id = $1`,
      [check[0].bookId],
    );

    await client.query('COMMIT');
    return rows[0]!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function declineRequest(id: string, ownerId: string): Promise<BorrowRequest> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: check } = await client.query<{ bookId: string }>(
      `SELECT br.book_id AS "bookId"
       FROM borrow_requests br
       JOIN books b ON b.id = br.book_id
       WHERE br.id = $1 AND b.owner_id = $2 AND br.status = 'pending'`,
      [id, ownerId],
    );
    if (!check[0]) throw Object.assign(new Error('Request not found or not actionable'), { statusCode: 404 });

    const { rows } = await client.query<BorrowRequest>(
      `UPDATE borrow_requests SET status = 'declined', updated_at = NOW()
       WHERE id = $1 RETURNING ${BR_SELECT}`,
      [id],
    );

    await client.query(
      `UPDATE books SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [check[0].bookId],
    );

    await client.query('COMMIT');
    return rows[0]!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function markReturned(id: string, userId: string): Promise<BorrowRequest> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Either owner or borrower can mark returned
    const { rows: check } = await client.query<{ bookId: string }>(
      `SELECT br.book_id AS "bookId"
       FROM borrow_requests br
       JOIN books b ON b.id = br.book_id
       WHERE br.id = $1
         AND br.status = 'accepted'
         AND (br.requester_id = $2 OR b.owner_id = $2)`,
      [id, userId],
    );
    if (!check[0]) throw Object.assign(new Error('Request not found or not actionable'), { statusCode: 404 });

    const { rows } = await client.query<BorrowRequest>(
      `UPDATE borrow_requests SET status = 'returned', updated_at = NOW()
       WHERE id = $1 RETURNING ${BR_SELECT}`,
      [id],
    );

    await client.query(
      `UPDATE books SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [check[0].bookId],
    );

    await client.query('COMMIT');
    return rows[0]!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function proposeExtension(id: string, userId: string, proposedDueDate: string): Promise<BorrowRequest> {
  const { rows } = await db.query<BorrowRequest>(
    `UPDATE borrow_requests
     SET proposed_due_date = $2, extension_proposed_by = $3, updated_at = NOW()
     WHERE id = $1
       AND status = 'accepted'
       AND (requester_id = $3 OR book_id IN (SELECT id FROM books WHERE owner_id = $3))
     RETURNING ${BR_SELECT}`,
    [id, proposedDueDate, userId],
  );
  if (!rows[0]) throw Object.assign(new Error('Request not found or not actionable'), { statusCode: 404 });
  return rows[0];
}

export async function confirmExtension(id: string, userId: string): Promise<BorrowRequest> {
  // The confirmer must be the OTHER party (not the proposer)
  const { rows } = await db.query<BorrowRequest>(
    `UPDATE borrow_requests
     SET due_date = proposed_due_date,
         proposed_due_date = NULL,
         extension_proposed_by = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'accepted'
       AND proposed_due_date IS NOT NULL
       AND extension_proposed_by != $2
       AND (requester_id = $2 OR book_id IN (SELECT id FROM books WHERE owner_id = $2))
     RETURNING ${BR_SELECT}`,
    [id, userId],
  );
  if (!rows[0]) throw Object.assign(new Error('Request not found or not actionable'), { statusCode: 404 });
  return rows[0];
}

// Called by expiry Lambda — returns expired book IDs for notification
export async function expirePendingRequests(): Promise<Array<{ id: string; bookId: string; requesterId: string }>> {
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
    }

    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type { BorrowRequestStatus };
