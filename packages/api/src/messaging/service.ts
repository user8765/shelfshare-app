import { db } from '../db/client.js';
import { enqueueNotification } from '../notifications/publisher.js';
import type { Message } from '@shelfshare/shared';

const MSG_SELECT = `
  id, sender_id AS "senderId", recipient_id AS "recipientId",
  content, read_at AS "readAt", created_at AS "createdAt"
`;

export async function sendMessage(senderId: string, recipientId: string, content: string): Promise<Message> {
  const { rows } = await db.query<Message>(
    `INSERT INTO messages (sender_id, recipient_id, content)
     VALUES ($1, $2, $3)
     RETURNING ${MSG_SELECT}`,
    [senderId, recipientId, content],
  );
  const message = rows[0];
  if (!message) throw new Error('Failed to send message');

  // Email fallback — only if recipient has email_notif enabled
  const { rows: recipientRows } = await db.query<{ email: string; displayName: string; emailNotif: boolean }>(
    `SELECT email, display_name AS "displayName", email_notif AS "emailNotif" FROM users WHERE id = $1`,
    [recipientId],
  );
  const recipient = recipientRows[0];
  if (recipient?.emailNotif) {
    const { rows: senderRows } = await db.query<{ displayName: string }>(
      `SELECT display_name AS "displayName" FROM users WHERE id = $1`,
      [senderId],
    );
    await enqueueNotification({
      type: 'new_message',
      borrowerName: senderRows[0]?.displayName ?? 'Someone',
      messagePreview: content.slice(0, 100),
      recipientEmail: recipient.email,
      recipientName: recipient.displayName,
    });
  }

  return message;
}

export async function getThread(userId: string, otherUserId: string, limit = 50): Promise<Message[]> {
  const { rows } = await db.query<Message>(
    `SELECT ${MSG_SELECT} FROM messages
     WHERE (sender_id = $1 AND recipient_id = $2)
        OR (sender_id = $2 AND recipient_id = $1)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, otherUserId, limit],
  );

  // Mark received messages as read
  await db.query(
    `UPDATE messages SET read_at = NOW()
     WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
    [userId, otherUserId],
  );

  return rows.reverse();
}

export async function getConversations(userId: string): Promise<Array<{ userId: string; displayName: string; avatarUrl: string | null; lastMessage: string; lastAt: string; unread: number }>> {
  const { rows } = await db.query(
    `SELECT
       other_user.id AS "userId",
       other_user.display_name AS "displayName",
       other_user.avatar_url AS "avatarUrl",
       last_msg.content AS "lastMessage",
       last_msg.created_at AS "lastAt",
       COUNT(unread.id)::int AS "unread"
     FROM (
       SELECT DISTINCT
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id
       FROM messages
       WHERE sender_id = $1 OR recipient_id = $1
     ) threads
     JOIN users other_user ON other_user.id = threads.other_id
     JOIN LATERAL (
       SELECT content, created_at FROM messages
       WHERE (sender_id = $1 AND recipient_id = threads.other_id)
          OR (sender_id = threads.other_id AND recipient_id = $1)
       ORDER BY created_at DESC LIMIT 1
     ) last_msg ON true
     LEFT JOIN messages unread
       ON unread.recipient_id = $1 AND unread.sender_id = threads.other_id AND unread.read_at IS NULL
     GROUP BY other_user.id, other_user.display_name, other_user.avatar_url, last_msg.content, last_msg.created_at
     ORDER BY last_msg.created_at DESC`,
    [userId],
  );
  return rows;
}
