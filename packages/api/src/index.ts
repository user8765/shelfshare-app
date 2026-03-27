import Fastify from 'fastify';
import cors from '@fastify/cors';
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

async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: '*' });
  await app.register(jwtPlugin);

  await app.register(authRoutes);
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

// Lambda handler — proxy is initialised once and reused across warm invocations
const appPromise = buildApp().then((app) => awsLambdaFastify(app));

export const handler: LambdaHandler = async (event, context) => {
  const proxy = await appPromise;
  return proxy(event, context);
};

// Local dev server
if (process.env['NODE_ENV'] !== 'production') {
  void buildApp().then((app) => app.listen({ port: 3000, host: '0.0.0.0' }));
}
