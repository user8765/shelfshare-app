import { db } from '../db/client.js';
import type { PoolClient } from 'pg';
import type { Book, BookVisibility } from '@shelfshare/shared';

interface CreateBookInput {
  isbn?: string | undefined;
  title: string;
  author?: string | undefined;
  genre?: string | undefined;
  coverUrl?: string | undefined;
  description?: string | undefined;
  isLendable?: boolean | undefined;
  visibility?: BookVisibility | undefined;
  communityIds?: string[] | undefined;
}

interface UpdateBookInput {
  title?: string | undefined;
  author?: string | undefined;
  genre?: string | undefined;
  coverUrl?: string | undefined;
  description?: string | undefined;
  isLendable?: boolean | undefined;
  visibility?: BookVisibility | undefined;
  communityIds?: string[] | undefined;
}

const BOOK_SELECT = `
  id, owner_id AS "ownerId", isbn, title, author, genre,
  cover_url AS "coverUrl", description,
  status, is_lendable AS "isLendable", visibility,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function getOwnerBooks(ownerId: string): Promise<Book[]> {
  const { rows } = await db.query<Book>(
    `SELECT ${BOOK_SELECT} FROM books WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  return rows;
}

export async function getBookById(id: string): Promise<Book | null> {
  const { rows } = await db.query<Book>(
    `SELECT ${BOOK_SELECT} FROM books WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createBook(ownerId: string, input: CreateBookInput): Promise<Book> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<Book>(
      `INSERT INTO books (owner_id, isbn, title, author, genre, cover_url, description, is_lendable, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${BOOK_SELECT}`,
      [ownerId, input.isbn ?? null, input.title, input.author ?? null,
       input.genre ?? null, input.coverUrl ?? null, input.description ?? null,
       input.isLendable ?? true, input.visibility ?? 'radius'],
    );
    const book = rows[0];
    if (!book) throw new Error('Failed to create book');

    if (input.communityIds?.length) {
      await setCommunities(client, book.id, input.communityIds);
    }

    await client.query('COMMIT');
    return book;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateBook(id: string, ownerId: string, input: UpdateBookInput): Promise<Book> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock check — cannot edit lent_out books
    const { rows: lockCheck } = await client.query<{ status: string }>(
      `SELECT status FROM books WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    const book = lockCheck[0];
    if (!book) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    if (book.status === 'lent_out') throw Object.assign(new Error('Book is currently lent out'), { statusCode: 409 });

    const { rows } = await client.query<Book>(
      `UPDATE books SET
         title       = COALESCE($3, title),
         author      = COALESCE($4, author),
         genre       = COALESCE($5, genre),
         cover_url   = COALESCE($6, cover_url),
         description = COALESCE($7, description),
         is_lendable = COALESCE($8, is_lendable),
         visibility  = COALESCE($9, visibility),
         updated_at  = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING ${BOOK_SELECT}`,
      [id, ownerId, input.title ?? null, input.author ?? null, input.genre ?? null,
       input.coverUrl ?? null, input.description ?? null, input.isLendable ?? null,
       input.visibility ?? null],
    );
    const updated = rows[0];
    if (!updated) throw Object.assign(new Error('Not found'), { statusCode: 404 });

    if (input.communityIds !== undefined) {
      await setCommunities(client, id, input.communityIds);
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteBook(id: string, ownerId: string): Promise<void> {
  const { rows } = await db.query<{ status: string }>(
    `SELECT status FROM books WHERE id = $1 AND owner_id = $2`,
    [id, ownerId],
  );
  const book = rows[0];
  if (!book) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  if (book.status === 'lent_out') throw Object.assign(new Error('Book is currently lent out'), { statusCode: 409 });

  await db.query(`DELETE FROM books WHERE id = $1`, [id]);
}

// Replace all community associations for a book
async function setCommunities(
  client: PoolClient,
  bookId: string,
  communityIds: string[],
): Promise<void> {
  await client.query(`DELETE FROM book_communities WHERE book_id = $1`, [bookId]);
  if (!communityIds.length) return;
  const values = communityIds.map((cid, i) => `($1, $${i + 2})`).join(',');
  await client.query(
    `INSERT INTO book_communities (book_id, community_id) VALUES ${values}`,
    [bookId, ...communityIds],
  );
}
