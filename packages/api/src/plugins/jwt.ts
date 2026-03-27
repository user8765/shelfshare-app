import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { getSecrets } from '../config/secrets.js';

export interface JwtPayload {
  sub: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const jwtPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('user', { getter: () => ({ sub: '', email: '' }) });

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (req.routeOptions.url?.startsWith('/auth')) return;

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = header.slice(7);
    try {
      const { jwtSecret } = await getSecrets();
      // Fix #15 — pin algorithm to prevent alg:none attacks
      req.user = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(jwtPlugin);
