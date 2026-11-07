import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT ?? 3001);
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});

// The compiled server also serves the built React app for npm start.
const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
app.use(express.static(clientDist));
app.get('/{*path}', (_request, response, next) => {
  response.sendFile(path.join(clientDist, 'index.html'), (error) => {
    if (error) next(error);
  });
});

const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
};
app.use(handleError);

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Oceanbreeze API listening on http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
