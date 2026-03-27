const fastify = require('fastify')({ logger: true });

// Allow your mobile app to talk to the backend
fastify.register(require('@fastify/cors'), { origin: '*' });

fastify.get('/hello', async () => {
  return { 
    message: 'Welcome to ShelfShare!',
    status: 'Ready to lend some books 📚',
    location: 'Gurgaon Node'
  };
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) throw err;
  console.log('Backend live at http://localhost:3000');
});
