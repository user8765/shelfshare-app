import Fastify from 'fastify';
import cors from '@fastify/cors';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', app: 'ShelfShare API' }));

  await app.listen({ port: 3000, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
