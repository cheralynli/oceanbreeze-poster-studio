import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './app.js';
import { openStore } from './store.js';
import { renderPoster } from './poster.js';

const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url));
mkdirSync(dataDir, { recursive: true });
const store = openStore(path.join(dataDir, 'posters.sqlite'));
const app = createApp(store, renderPoster);
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Oceanbreeze API listening on http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
