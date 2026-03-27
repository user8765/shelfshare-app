import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;   // user id
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
    // Skip auth routes
    if (req.routeOptions.url?.startsWith('/auth')) return;

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing token' });
    }

    const token = header.slice(7);
    try {
      const secret = process.env['JWT_SECRET'];
      if (!secret) throw new Error('JWT_SECRET not set');
      req.user = jwt.verify(token, secret) as JwtPayload;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
};

export default fp(jwtPlugin);
