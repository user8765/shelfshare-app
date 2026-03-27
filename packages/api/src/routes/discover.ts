import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { discoverBooks } from '../discovery/service.js';

const QuerySchema = z.object({
  q: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().optional(),
  communityId: z.string().uuid().optional(),
});

const discoverRoutes: FastifyPluginAsync = async (app) => {
  app.get('/discover', async (req, reply) => {
    const query = QuerySchema.safeParse(req.query);
    if (!query.success) return reply.status(400).send({ error: query.error.flatten() });

    const books = await discoverBooks({
      currentUserId: req.user.sub,
      q: query.data.q,
      lat: query.data.lat,
      lng: query.data.lng,
      radiusMeters: query.data.radius,
      communityId: query.data.communityId,
    });
    return books;
  });
};

export default discoverRoutes;
