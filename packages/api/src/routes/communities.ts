import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createCommunity, getCommunityById, updateCommunity,
  joinCommunity, getMembers, updateMember, removeMember,
} from '../communities/service.js';
import { requireCommunityAdmin } from '../communities/middleware.js';

const communityRoutes: FastifyPluginAsync = async (app) => {
  // POST /communities
  app.post('/communities', async (req, reply) => {
    const body = z.object({ name: z.string().min(1), description: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const community = await createCommunity(req.user.sub, body.data);
    return reply.status(201).send(community);
  });

  // GET /communities/:id
  app.get('/communities/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const community = await getCommunityById(id);
    if (!community) return reply.status(404).send({ error: 'Not found' });
    return community;
  });

  // PATCH /communities/:id — admin only
  app.patch<{ Params: { id: string } }>(
    '/communities/:id',
    { preHandler: requireCommunityAdmin },
    async (req, reply) => {
      const body = z.object({ name: z.string().min(1).optional(), description: z.string().optional() }).safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      try {
        return await updateCommunity(req.params.id, body.data);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  // POST /communities/:id/join
  app.post('/communities/:id/join', async (req, reply) => {
    const body = z.object({ inviteCode: z.string() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'inviteCode required' });
    try {
      const community = await joinCommunity(body.data.inviteCode, req.user.sub);
      return community;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /communities/:id/members
  app.get('/communities/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    return getMembers(id);
  });

  // PATCH /communities/:id/members/:userId — admin only (change role or remove)
  app.patch<{ Params: { id: string; userId: string } }>(
    '/communities/:id/members/:userId',
    { preHandler: requireCommunityAdmin },
    async (req, reply) => {
      const body = z.object({
        role: z.enum(['admin', 'member']).optional(),
        remove: z.boolean().optional(),
      }).safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

      try {
        if (body.data.remove) {
          await removeMember(req.params.id, req.params.userId);
          return reply.status(204).send();
        }
        if (body.data.role) {
          await updateMember(req.params.id, req.params.userId, body.data.role);
          return reply.status(204).send();
        }
        return reply.status(400).send({ error: 'Provide role or remove:true' });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return reply.status(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );
};

export default communityRoutes;
