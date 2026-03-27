import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendMessage, getThread, getConversations } from '../messaging/service.js';

const messageRoutes: FastifyPluginAsync = async (app) => {
  // GET /messages/conversations
  app.get('/messages/conversations', async (req) => {
    return getConversations(req.user.sub);
  });

  // GET /messages/:userId — fetch thread
  app.get('/messages/:userId', async (req) => {
    const { userId } = req.params as { userId: string };
    return getThread(req.user.sub, userId);
  });

  // POST /messages/:userId — send message
  app.post('/messages/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = z.object({ content: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const message = await sendMessage(req.user.sub, userId, body.data.content);
    return reply.status(201).send(message);
  });
};

export default messageRoutes;
