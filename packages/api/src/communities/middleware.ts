import type { FastifyRequest, FastifyReply } from 'fastify';
import { getMemberRole } from '../communities/service.js';

export async function requireCommunityAdmin(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const role = await getMemberRole(req.params.id, req.user.sub);
  if (role !== 'admin') {
    await reply.status(403).send({ error: 'Admin access required' });
  }
}
