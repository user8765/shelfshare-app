import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getOwnerBooks, getBookById, createBook, updateBook, deleteBook } from '../books/service.js';
import { lookupIsbn } from '../books/googleBooks.js';

const VisibilityEnum = z.enum(['radius', 'community', 'both', 'private']);

const CreateBody = z.object({
  isbn: z.string().optional(),
  title: z.string().min(1).optional(),   // optional if isbn provided — we'll fill from API
  author: z.string().optional(),
  genre: z.string().optional(),
  coverUrl: z.string().url().optional(),
  description: z.string().optional(),
  isLendable: z.boolean().optional(),
  visibility: VisibilityEnum.optional(),
  communityIds: z.array(z.string().uuid()).optional(),
});

const UpdateBody = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  genre: z.string().optional(),
  coverUrl: z.string().url().optional(),
  description: z.string().optional(),
  isLendable: z.boolean().optional(),
  visibility: VisibilityEnum.optional(),
  communityIds: z.array(z.string().uuid()).optional(),
});

const bookRoutes: FastifyPluginAsync = async (app) => {
  // GET /books — own library
  app.get('/books', async (req) => {
    return getOwnerBooks(req.user.sub);
  });

  // GET /books/isbn/:isbn — lookup metadata before adding
  app.get('/books/isbn/:isbn', async (req, reply) => {
    const { isbn } = req.params as { isbn: string };
    const metadata = await lookupIsbn(isbn);
    if (!metadata) return reply.status(404).send({ error: 'Book not found' });
    return metadata;
  });

  // GET /books/:id
  app.get('/books/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const book = await getBookById(id);
    if (!book) return reply.status(404).send({ error: 'Not found' });
    return book;
  });

  // POST /books
  app.post('/books', async (req, reply) => {
    const body = CreateBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    let input = body.data;

    // Auto-fill from Google Books if ISBN provided and title missing
    if (input.isbn && !input.title) {
      const meta = await lookupIsbn(input.isbn);
      if (!meta?.title) return reply.status(400).send({ error: 'Could not find book for ISBN, provide title manually' });
      input = { ...input, ...meta };
    }

    if (!input.title) return reply.status(400).send({ error: 'title is required' });

    const book = await createBook(req.user.sub, { ...input, title: input.title });
    return reply.status(201).send(book);
  });

  // PATCH /books/:id
  app.patch('/books/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const book = await updateBook(id, req.user.sub, body.data);
      return book;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // DELETE /books/:id
  app.delete('/books/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await deleteBook(id, req.user.sub);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message });
    }
  });
};

export default bookRoutes;
