import { db } from '../db/client.js';
import { DEFAULT_RADIUS_METERS } from '@shelfshare/shared';
import type { Book } from '@shelfshare/shared';

const BOOK_SELECT = `
  b.id, b.owner_id AS "ownerId", b.isbn, b.title, b.author, b.genre,
  b.cover_url AS "coverUrl", b.description, b.status,
  b.is_lendable AS "isLendable", b.visibility,
  b.created_at AS "createdAt", b.updated_at AS "updatedAt"
`;

const BASE_WHERE = `
  b.status = 'available'
  AND b.is_lendable = true
  AND b.owner_id != $1
`;

export interface DiscoverParams {
  currentUserId: string;
  q?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  radiusMeters?: number | undefined;
  communityId?: string | undefined;
}

export async function discoverBooks(params: DiscoverParams): Promise<Book[]> {
  const { currentUserId, q, lat, lng, communityId } = params;
  const radiusMeters = params.radiusMeters ?? DEFAULT_RADIUS_METERS;

  const conditions: string[] = [BASE_WHERE];
  const values: unknown[] = [currentUserId];

  // Full-text search
  if (q) {
    values.push(q);
    conditions.push(`b.search_vector @@ plainto_tsquery('english', $${values.length})`);
  }

  // Visibility filter
  if (communityId && lat !== undefined && lng !== undefined) {
    // both: radius OR community
    values.push(communityId);
    const cidIdx = values.length;
    values.push(lng, lat, radiusMeters);
    const lngIdx = cidIdx + 1, latIdx = cidIdx + 2, rIdx = cidIdx + 3;
    conditions.push(`(
      (b.visibility IN ('community','both') AND EXISTS (
        SELECT 1 FROM book_communities bc WHERE bc.book_id = b.id AND bc.community_id = $${cidIdx}
      ))
      OR
      (b.visibility IN ('radius','both') AND ST_DWithin(
        u.location, ST_MakePoint($${lngIdx}, $${latIdx})::geography, $${rIdx}
      ))
    )`);
  } else if (communityId) {
    values.push(communityId);
    conditions.push(`b.visibility IN ('community','both') AND EXISTS (
      SELECT 1 FROM book_communities bc WHERE bc.book_id = b.id AND bc.community_id = $${values.length}
    )`);
  } else if (lat !== undefined && lng !== undefined) {
    values.push(lng, lat, radiusMeters);
    const lngIdx = values.length - 2, latIdx = values.length - 1, rIdx = values.length;
    conditions.push(`b.visibility IN ('radius','both') AND ST_DWithin(
      u.location, ST_MakePoint($${lngIdx}, $${latIdx})::geography, $${rIdx}
    )`);
  } else {
    // No location or community filter — return nothing (privacy: don't expose all books)
    return [];
  }

  const where = conditions.join(' AND ');
  const { rows } = await db.query<Book>(
    `SELECT ${BOOK_SELECT}
     FROM books b
     JOIN users u ON u.id = b.owner_id
     WHERE ${where}
     ORDER BY b.created_at DESC
     LIMIT 50`,
    values,
  );
  return rows;
}
