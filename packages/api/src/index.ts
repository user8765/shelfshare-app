import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import awsLambdaFastify from '@fastify/aws-lambda';
import type { Handler as LambdaHandler } from 'aws-lambda';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import inviteRoutes from './routes/invites.js';
import userRoutes from './routes/users.js';
import bookRoutes from './routes/books.js';
import communityRoutes from './routes/communities.js';
import discoverRoutes from './routes/discover.js';
import borrowRoutes from './routes/borrow.js';
import messageRoutes from './routes/messages.js';
import { getSecrets } from './config/secrets.js';

async function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'];

  await app.register(helmet);
  await app.register(cors, { origin: allowedOrigins });

  // Global rate limit
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  await app.register(jwtPlugin);

  // Stricter rate limit on auth endpoints
  await app.register(authRoutes, { prefix: '' });
  app.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.startsWith('/auth')) {
      routeOptions.config = { ...routeOptions.config, rateLimit: { max: 10, timeWindow: '1 minute' } };
    }
  });
  await app.register(inviteRoutes);
  await app.register(userRoutes);
  await app.register(bookRoutes);
  await app.register(communityRoutes);
  await app.register(discoverRoutes);
  await app.register(borrowRoutes);
  await app.register(messageRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}

// Lambda handler — secrets validated at cold start
const appPromise = getSecrets()  // fail fast if secrets missing
  .then(() => buildApp())
  .then((app) => awsLambdaFastify(app));

export const handler: LambdaHandler = async (event, context) => {
  const proxy = await appPromise;
  return proxy(event, context);
};

// Local dev server
if (process.env['NODE_ENV'] !== 'production') {
  void buildApp().then((app) => app.listen({ port: 3000, host: '0.0.0.0' }));
}
