import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyGoogleToken, upsertUser, signJwt } from '../auth/service.js';

const CallbackBody = z.object({ idToken: z.string() });

const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/google/callback — exchange Google ID token for app JWT
  app.post('/auth/google/callback', async (req, reply) => {
    const body = CallbackBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'idToken required' });

    const profile = await verifyGoogleToken(body.data.idToken);
    const user = await upsertUser(profile);
    const token = signJwt({ sub: user.id, email: user.email });

    return reply.send({ token });
  });

  // DELETE /auth/session — client-side logout (stateless, just a signal)
  app.delete('/auth/session', async (_req, reply) => reply.status(204).send());
};

export default authRoutes;
