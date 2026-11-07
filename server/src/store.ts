import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { ProductInput } from './validation.js';

export interface Generation extends ProductInput {
  id: string;
  createdAt: string;
  imageUrl: string;
}

export function openStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      product TEXT NOT NULL,
      description TEXT NOT NULL,
      priceCents INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      image BLOB NOT NULL
    );`);
  const columns = 'id, brand, product, description, priceCents, createdAt';
  const insert = db.prepare('INSERT INTO generations VALUES (?, ?, ?, ?, ?, ?, ?)');
  const list = db.prepare(`SELECT ${columns} FROM generations ORDER BY rowid DESC LIMIT ? OFFSET ?`);
  const findImage = db.prepare('SELECT image FROM generations WHERE id = ?');
  function withUrl(row: unknown): Generation {
    const value = row as Omit<Generation, 'imageUrl'>;
    return { ...value, imageUrl: `/api/generations/${value.id}/image` };
  }
  return {
    save(input: ProductInput, png: Buffer): Generation {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      insert.run(id, input.brand, input.product, input.description, input.priceCents, createdAt, png);
      return withUrl({ id, ...input, createdAt });
    },
    list(limit: number, offset: number) {
      const rows = list.all(limit + 1, offset);
      return { generations: rows.slice(0, limit).map(withUrl), hasMore: rows.length > limit };
    },
    image(id: string): Uint8Array | undefined {
      return (findImage.get(id) as { image: Uint8Array } | undefined)?.image;
    },
    close() { db.close(); },
  };
}
export type Store = ReturnType<typeof openStore>;
