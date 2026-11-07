import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProduct, ValidationError, type ProductInput } from './validation.js';
import type { Store } from './store.js';

export function createApp(store: Store, render: (input: ProductInput) => Promise<Buffer>) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/api/generations', (req, res) => {
    const rawOffset = req.query.offset ?? '0';
    if (typeof rawOffset !== 'string' || !/^\d{1,8}$/.test(rawOffset)) {
      res.status(400).json({ error: 'Invalid history offset.' }); return;
    }
    res.set('Cache-Control', 'no-store').json(store.list(12, Number(rawOffset)));
  });
  let activeRenders = 0;
  app.post('/api/generations', async (req, res) => {
    const input = validateProduct(req.body);
    if (activeRenders >= 4) {
      res.status(503).json({ error: 'The studio is busy. Please try again shortly.' }); return;
    }
    activeRenders++;
    try {
      const image = await render(input);
      const generation = store.save(input, image);
      res.status(201).json(generation);
    } finally { activeRenders--; }
  });
  app.get('/api/generations/:id/image', (req, res) => {
    const image = store.image(req.params.id);
    if (!image) { res.status(404).json({ error: 'Poster not found.' }); return; }
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="poster-${req.params.id}.png"` });
    res.send(Buffer.from(image));
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API endpoint not found.' }); });
  const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (error) => { if (error) next(error); });
  });
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ValidationError) { res.status(400).json({ error: error.message, fields: error.fields }); return; }
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Request must contain valid JSON.' }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: 'The submitted details are too large.' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  };
  app.use(handleError);
  return app;
}
