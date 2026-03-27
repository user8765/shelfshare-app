import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import inviteRoutes from './routes/invites.js';
import userRoutes from './routes/users.js';
import bookRoutes from './routes/books.js';
import communityRoutes from './routes/communities.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: '*' });
  await app.register(jwtPlugin);

  await app.register(authRoutes);
  await app.register(inviteRoutes);
  await app.register(userRoutes);
  await app.register(bookRoutes);
  await app.register(communityRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: 3000, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
