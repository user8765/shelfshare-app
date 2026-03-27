import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createInvite, redeemInvite } from '../auth/invites.js';

const inviteRoutes: FastifyPluginAsync = async (app) => {
  // POST /invites — generate invite link
  app.post('/invites', async (req, reply) => {
    const body = z.object({ inviteeEmail: z.string().email().optional() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const invite = await createInvite(req.user.sub, body.data.inviteeEmail);
    return reply.status(201).send({ code: invite.code });
  });

  // POST /invites/redeem — redeem code (called after Google login for new users)
  app.post('/invites/redeem', async (req, reply) => {
    const body = z.object({ code: z.string() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'code required' });

    await redeemInvite(body.data.code, req.user.sub);
    return reply.status(204).send();
  });
};

export default inviteRoutes;
