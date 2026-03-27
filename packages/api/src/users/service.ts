import { db } from '../db/client.js';
import { geocodeAddress } from '../location/geocode.js';
import type { User } from '@shelfshare/shared';

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await db.query<User>(
    `SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl",
            bio, location_text AS "locationText", email_notif AS "emailNotif", created_at AS "createdAt"
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateUser(
  id: string,
  fields: {
    displayName?: string | undefined;
    bio?: string | undefined;
    locationText?: string | undefined;
    emailNotif?: boolean | undefined;
  },
): Promise<User> {
  let locationUpdate = '';
  const params: unknown[] = [id];

  if (fields.locationText !== undefined) {
    const coords = await geocodeAddress(fields.locationText);
    if (coords) {
      locationUpdate = `, location = ST_MakePoint($${params.length + 1}, $${params.length + 2})::geography`;
      params.push(coords.lng, coords.lat);
    }
  }

  const { rows } = await db.query<User>(
    `UPDATE users SET
       display_name  = COALESCE($2, display_name),
       bio           = COALESCE($3, bio),
       location_text = COALESCE($4, location_text),
       email_notif   = COALESCE($5, email_notif),
       updated_at    = NOW()
       ${locationUpdate}
     WHERE id = $1
     RETURNING id, email, display_name AS "displayName", avatar_url AS "avatarUrl",
               bio, location_text AS "locationText", email_notif AS "emailNotif", created_at AS "createdAt"`,
    [id, fields.displayName ?? null, fields.bio ?? null, fields.locationText ?? null, fields.emailNotif ?? null, ...params.slice(1)],
  );

  const user = rows[0];
  if (!user) throw new Error('User not found');
  return user;
}
