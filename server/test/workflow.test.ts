import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { validateProduct, ValidationError } from '../src/validation.js';
import { openStore } from '../src/store.js';
import { renderPoster, wrapText } from '../src/poster.js';
import { createApp } from '../src/app.js';

const sample = { brand: 'Sunshield', product: 'Tropical Glow', description: 'SPF 50+ Broad Spectrum, Water Resistant (80 Min), Lightweight, Non-Greasy Formula, Perfect for beach days!', price: '14.99' };

test('validation rejects missing fields, excess lengths and invalid money without rounding', () => {
  assert.equal(validateProduct({ ...sample, price: '0.29' }).priceCents, 29);
  assert.equal(validateProduct({ ...sample, brand: '  Sunshield  ' }).brand, 'Sunshield');
  for (const price of ['', '-1', '0', '1.234', '1e3', 'Infinity', '1000000', 14.99]) {
    assert.throws(() => validateProduct({ ...sample, price }), ValidationError);
  }
  for (const invalid of [null, [], {}, { ...sample, brand: ' ' }, { ...sample, product: 'x'.repeat(121) }, { ...sample, description: 'x'.repeat(501) }]) {
    assert.throws(() => validateProduct(invalid), ValidationError);
  }
});

test('renderer creates PNGs and wraps even unbroken strings within the panel width', async () => {
  const ctx = createCanvas(1587, 1587).getContext('2d');
  ctx.font = 'bold 68px "Poster Sans"';
  const text = 'W'.repeat(120);
  const lines = wrapText(ctx, text, 1000);
  assert.equal(lines.join(''), text);
  assert.ok(lines.every((line) => ctx.measureText(line).width <= 1000));
  for (const input of [validateProduct(sample), validateProduct({ ...sample, brand: 'W'.repeat(80), product: text, description: 'W'.repeat(500), price: '999999.99' })]) {
    const png = await renderPoster(input);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const image = await loadImage(png);
    assert.equal(image.width, 1587);
    assert.equal(image.height, 1587);
  }
});

test('generation API validates, saves, downloads and paginates; SQLite survives reopening', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oceanbreeze-test-'));
  const filename = path.join(directory, 'posters.sqlite');
  let store = openStore(filename);
  const app = createApp(store, renderPoster);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const invalid = await fetch(`${base}/api/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).fields.brand);
    const badJson = await fetch(`${base}/api/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(badJson.status, 400);
    const created = await fetch(`${base}/api/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample) });
    assert.equal(created.status, 201);
    const item = await created.json();
    const downloaded = await fetch(`${base}${item.imageUrl}?download=1`);
    assert.equal(downloaded.headers.get('content-type'), 'image/png');
    assert.match(downloaded.headers.get('content-disposition')!, /attachment/);
    const png = Buffer.from(await downloaded.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    for (let index = 0; index < 12; index++) store.save({ ...validateProduct(sample), product: `Poster ${index}` }, png);
    const page1 = await (await fetch(`${base}/api/generations`)).json();
    assert.equal(page1.generations.length, 12);
    assert.equal(page1.hasMore, true);
    const page2 = await (await fetch(`${base}/api/generations?offset=12`)).json();
    assert.equal(page2.generations[0].id, item.id);
    assert.equal(page2.hasMore, false);
    assert.equal((await fetch(`${base}/api/generations?offset=-1`)).status, 400);
    assert.equal((await fetch(`${base}/api/generations/missing/image`)).status, 404);
    store.close();
    store = openStore(filename);
    assert.equal(store.list(20, 0).generations.length, 13);
    assert.deepEqual(Buffer.from(store.image(item.id)!), png);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true });
  }
});

test('render failure returns a useful error and does not create history', async () => {
  const store = openStore(':memory:');
  const server = createApp(store, async () => { throw new Error('Simulated rendering failure'); }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample),
    });
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Please try again/);
    assert.equal(store.list(12, 0).generations.length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});
