import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import inviteRoutes from './routes/invites.js';
import userRoutes from './routes/users.js';
import bookRoutes from './routes/books.js';
import communityRoutes from './routes/communities.js';
import discoverRoutes from './routes/discover.js';
import borrowRoutes from './routes/borrow.js';
import messageRoutes from './routes/messages.js';
import { initWsRelay } from './messaging/wsRelay.js';

async function main() {
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

  // Start Redis → WebSocket relay if WS endpoint configured
  const wsEndpoint = process.env['WS_MANAGEMENT_ENDPOINT'];
  if (wsEndpoint) initWsRelay(wsEndpoint);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: 3000, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
