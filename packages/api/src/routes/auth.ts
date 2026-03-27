import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyGoogleToken, upsertUser, signJwt, isFirstUser } from '../auth/service.js';
import { redeemInvite } from '../auth/invites.js';

const CallbackBody = z.object({
  idToken: z.string(),
  inviteCode: z.string().optional(),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/google/callback', async (req, reply) => {
    const body = CallbackBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'idToken required' });

    const profile = await verifyGoogleToken(body.data.idToken);

    // Invite gate — skip for very first user (bootstrapping)
    const firstUser = await isFirstUser();
    if (!firstUser) {
      if (!body.data.inviteCode) {
        return reply.status(403).send({ error: 'Invite code required' });
      }
    }

    const user = await upsertUser(profile);

    // Redeem invite after account created (no-op if first user)
    if (body.data.inviteCode) {
      try {
        await redeemInvite(body.data.inviteCode, user.id);
      } catch {
        // Invite invalid/expired — still allow login if account already existed
      }
    }

    const token = await signJwt({ sub: user.id, email: user.email });
    return reply.send({ token });
  });

  app.delete('/auth/session', async (_req, reply) => reply.status(204).send());
};

export default authRoutes;
