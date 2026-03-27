import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyGoogleToken, upsertUser, signJwt, isFirstUser, isExistingUser } from '../auth/service.js';
import { redeemInvite } from '../auth/invites.js';
import { getDb } from '../db/client.js';

const CallbackBody = z.object({
  idToken: z.string(),
  inviteCode: z.string().optional(),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/google/callback', async (req, reply) => {
    const body = CallbackBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'idToken required' });

    const profile = await verifyGoogleToken(body.data.idToken);

    // Returning user — just issue a new token, no invite needed
    if (await isExistingUser(profile.googleId)) {
      const user = await upsertUser(profile); // updates display_name/avatar
      const token = await signJwt({ sub: user.id, tv: user.tokenVersion });
      return reply.send({ token });
    }

    // New user — invite required (except bootstrapping first user)
    const firstUser = await isFirstUser();
    if (!firstUser) {
      if (!body.data.inviteCode) {
        return reply.status(403).send({ error: 'Invite code required' });
      }

      // Atomically create account + redeem invite
      const pool = await getDb();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const user = await upsertUser(profile);
        await redeemInvite(body.data.inviteCode, user.id, client);
        await client.query('COMMIT');
        const token = await signJwt({ sub: user.id, tv: user.tokenVersion });
        return reply.send({ token });
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        const e = err as { message?: string };
        if (e.message?.includes('Invalid or expired')) {
          return reply.status(403).send({ error: 'Invalid or expired invite code' });
        }
        throw err;
      } finally {
        client.release();
      }
    }

    // First user — no invite needed
    const user = await upsertUser(profile);
    const token = await signJwt({ sub: user.id, tv: user.tokenVersion });
    return reply.send({ token });
  });

  app.delete('/auth/session', async (_req, reply) => reply.status(204).send());
};

export default authRoutes;
