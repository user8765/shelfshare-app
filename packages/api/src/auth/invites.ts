import { db } from '../db/client.js';
import type { PoolClient } from 'pg';
import { nanoid } from 'nanoid';

export async function createInvite(inviterId: string, inviteeEmail?: string) {
  const code = nanoid(10);
  const { rows } = await db.query<{ id: string; code: string }>(
    `INSERT INTO invites (code, inviter_id, invitee_email, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
     RETURNING id, code`,
    [code, inviterId, inviteeEmail ?? null],
  );
  const invite = rows[0];
  if (!invite) throw new Error('Failed to create invite');
  return invite;
}

// Accepts an optional client for transactional use
export async function redeemInvite(code: string, userId: string, client?: PoolClient) {
  const q = client ?? db;
  const { rows } = await (q as typeof db).query<{ id: string }>(
    `UPDATE invites
     SET used_by = $1
     WHERE code = $2
       AND used_by IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     RETURNING id`,
    [userId, code],
  );
  if (!rows[0]) throw new Error('Invalid or expired invite code');
}
