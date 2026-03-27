import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createBorrowRequest, getBorrowRequests, getBorrowRequestById,
  acceptRequest, declineRequest, markReturned,
  proposeExtension, confirmExtension,
} from '../borrow/service.js';

const ActionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal('decline') }),
  z.object({ action: z.literal('return') }),
  z.object({ action: z.literal('propose-extension'), proposedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal('confirm-extension') }),
]);

const borrowRoutes: FastifyPluginAsync = async (app) => {
  // POST /borrow-requests
  app.post('/borrow-requests', async (req, reply) => {
    const body = z.object({ bookId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const request = await createBorrowRequest(body.data.bookId, req.user.sub);
      return reply.status(201).send(request);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // GET /borrow-requests?role=owner|borrower
  app.get('/borrow-requests', async (req, reply) => {
    const query = z.object({ role: z.enum(['owner', 'borrower']) }).safeParse(req.query);
    if (!query.success) return reply.status(400).send({ error: 'role must be owner or borrower' });
    return getBorrowRequests(req.user.sub, query.data.role);
  });

  // GET /borrow-requests/:id
  app.get('/borrow-requests/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const request = await getBorrowRequestById(id);
    if (!request) return reply.status(404).send({ error: 'Not found' });
    return request;
  });

  // PATCH /borrow-requests/:id
  app.patch('/borrow-requests/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ActionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      switch (body.data.action) {
        case 'accept':
          return await acceptRequest(id, req.user.sub, body.data.dueDate);
        case 'decline':
          return await declineRequest(id, req.user.sub);
        case 'return':
          return await markReturned(id, req.user.sub);
        case 'propose-extension':
          return await proposeExtension(id, req.user.sub, body.data.proposedDueDate);
        case 'confirm-extension':
          return await confirmExtension(id, req.user.sub);
      }
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
};

export default borrowRoutes;
