import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserById, updateUser } from '../users/service.js';

const PatchBody = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  locationText: z.string().max(200).optional(),
  emailNotif: z.boolean().optional(),
});

const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users/me', async (req, reply) => {
    const user = await getUserById(req.user.sub);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  app.patch('/users/me', async (req, reply) => {
    const body = PatchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const user = await updateUser(req.user.sub, {
      displayName: body.data.displayName,
      bio: body.data.bio,
      locationText: body.data.locationText,
      emailNotif: body.data.emailNotif,
    });
    return user;
  });

  app.get('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await getUserById(id);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    // Strip sensitive fields from public profile
    const { emailNotif: _e, ...publicProfile } = user;
    return publicProfile;
  });
};

export default userRoutes;
