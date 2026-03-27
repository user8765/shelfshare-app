import { db } from '../db/client.js';
import { nanoid } from 'nanoid';
import type { Community, CommunityRole } from '@shelfshare/shared';

interface CommunityMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: CommunityRole;
  joinedAt: string;
}

export async function createCommunity(
  creatorId: string,
  input: { name: string; description?: string | undefined },
): Promise<Community> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const inviteCode = nanoid(10);
    const { rows } = await client.query<Community>(
      `INSERT INTO communities (name, description, invite_code, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, invite_code AS "inviteCode", created_by AS "createdBy", created_at AS "createdAt"`,
      [input.name, input.description ?? null, inviteCode, creatorId],
    );
    const community = rows[0];
    if (!community) throw new Error('Failed to create community');

    // Creator becomes admin automatically
    await client.query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [community.id, creatorId],
    );

    await client.query('COMMIT');
    return community;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCommunityById(id: string): Promise<Community | null> {
  const { rows } = await db.query<Community>(
    `SELECT id, name, description, invite_code AS "inviteCode", created_by AS "createdBy", created_at AS "createdAt"
     FROM communities WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateCommunity(
  id: string,
  input: { name?: string | undefined; description?: string | undefined },
): Promise<Community> {
  const { rows } = await db.query<Community>(
    `UPDATE communities SET
       name        = COALESCE($2, name),
       description = COALESCE($3, description)
     WHERE id = $1
     RETURNING id, name, description, invite_code AS "inviteCode", created_by AS "createdBy", created_at AS "createdAt"`,
    [id, input.name ?? null, input.description ?? null],
  );
  const community = rows[0];
  if (!community) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  return community;
}

export async function joinCommunity(inviteCode: string, userId: string): Promise<Community> {
  const { rows } = await db.query<Community>(
    `SELECT id, name, description, invite_code AS "inviteCode", created_by AS "createdBy", created_at AS "createdAt"
     FROM communities WHERE invite_code = $1`,
    [inviteCode],
  );
  const community = rows[0];
  if (!community) throw Object.assign(new Error('Invalid invite code'), { statusCode: 404 });

  await db.query(
    `INSERT INTO community_members (community_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (community_id, user_id) DO NOTHING`,
    [community.id, userId],
  );
  return community;
}

export async function getMembers(communityId: string): Promise<CommunityMember[]> {
  const { rows } = await db.query<CommunityMember>(
    `SELECT cm.user_id AS "userId", u.display_name AS "displayName",
            u.avatar_url AS "avatarUrl", cm.role, cm.joined_at AS "joinedAt"
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1
     ORDER BY cm.joined_at`,
    [communityId],
  );
  return rows;
}

export async function updateMember(
  communityId: string,
  userId: string,
  role: CommunityRole,
): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE community_members SET role = $3
     WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId, role],
  );
  if (!rowCount) throw Object.assign(new Error('Member not found'), { statusCode: 404 });
}

export async function removeMember(communityId: string, userId: string): Promise<void> {
  await db.query(
    `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId],
  );
}

export async function getMemberRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const { rows } = await db.query<{ role: CommunityRole }>(
    `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId],
  );
  return rows[0]?.role ?? null;
}
