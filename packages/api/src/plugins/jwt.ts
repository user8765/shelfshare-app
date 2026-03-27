import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { getSecrets } from '../config/secrets.js';
import { db } from '../db/client.js';

export interface JwtPayload {
  sub: string; // user id
  tv: number;  // token_version — increment to invalidate all tokens for a user
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const jwtPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('user', { getter: () => ({ sub: '', tv: 0 }) });

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (req.routeOptions.url?.startsWith('/auth')) return;
    if (req.routeOptions.url === '/health') return;

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = header.slice(7);
    try {
      const { jwtSecret } = await getSecrets();
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

      // Verify token version matches DB — allows server-side revocation
      const { rows } = await db.query<{ tokenVersion: number }>(
        `SELECT token_version AS "tokenVersion" FROM users WHERE id = $1`,
        [payload.sub],
      );
      if (!rows[0] || rows[0].tokenVersion !== payload.tv) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      req.user = payload;
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(jwtPlugin);
