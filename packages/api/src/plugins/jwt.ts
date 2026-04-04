import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { getSecrets } from '../config/secrets.js';
import { getDb } from '../db/client.js';

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
  // Use getter/setter so Fastify allows per-request mutation of an object type
  app.decorateRequest('user', {
    getter(this: FastifyRequest) {
      return (this as unknown as Record<string, JwtPayload>)['_jwtUser'] ?? { sub: '', tv: 0 };
    },
    setter(this: FastifyRequest, val: JwtPayload) {
      (this as unknown as Record<string, JwtPayload>)['_jwtUser'] = val;
    },
  });

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
      const pool = await getDb();
      const { rows } = await pool.query<{ tokenVersion: number }>(
        `SELECT token_version AS "tokenVersion" FROM users WHERE id = $1`,
        [payload.sub],
      );
      if (!rows[0] || rows[0].tokenVersion !== payload.tv) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      req.user = payload;
    } catch (err) {
      req.log.warn({ err }, 'JWT verification failed');
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(jwtPlugin);
