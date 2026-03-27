import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { db } from '../db/client.js';
import { getSecrets } from '../config/secrets.js';
import type { JwtPayload } from '../plugins/jwt.js';

const googleClient = new OAuth2Client(process.env['GOOGLE_CLIENT_ID']);

export async function verifyGoogleToken(idToken: string) {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Invalid Google token');
  return {
    googleId: payload.sub,
    email: payload.email,
    displayName: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  };
}

export async function isFirstUser(): Promise<boolean> {
  const { rows } = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
  return parseInt(rows[0]?.count ?? '0', 10) === 0;
}

export async function upsertUser(googleProfile: Awaited<ReturnType<typeof verifyGoogleToken>>) {
  const { rows } = await db.query<{ id: string; email: string }>(
    `INSERT INTO users (google_id, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           avatar_url   = EXCLUDED.avatar_url,
           updated_at   = NOW()
     RETURNING id, email`,
    [googleProfile.googleId, googleProfile.email, googleProfile.displayName, googleProfile.avatarUrl],
  );
  const user = rows[0];
  if (!user) throw new Error('Failed to upsert user');
  return user;
}

export function signJwt(payload: JwtPayload): Promise<string>;
export async function signJwt(payload: JwtPayload): Promise<string> {
  const { jwtSecret } = await getSecrets();
  return jwt.sign(payload, jwtSecret, { expiresIn: '7d', algorithm: 'HS256' });
}
