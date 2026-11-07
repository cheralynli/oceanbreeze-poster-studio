import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import type { ProductInput } from './validation.js';

for (const weight of ['Regular', 'Bold']) {
  const font = fileURLToPath(new URL(`../assets/fonts/LiberationSans-${weight}.ttf`, import.meta.url));
  if (!GlobalFonts.registerFromPath(font, 'Poster Sans')) throw new Error(`Cannot load poster font: ${weight}`);
}
const backgroundPath = fileURLToPath(new URL('../../client/public/assets/backgroundtemplate.png', import.meta.url));

export function wrapText(ctx: SKRSContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    // Long unbroken names/words must fit too; never silently truncate input.
    for (const char of word) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPoster(input: ProductInput): Promise<Buffer> {
  const background = await loadImage(backgroundPath);
  const canvas = createCanvas(1587, 1587);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(background, 0, 0, 1587, 1587);
  ctx.fillStyle = '#184A70';
  ctx.textBaseline = 'top';
  // Safe area excludes the fish on the left and coral below the text panel.
  const area = { x: 355, y: 700, width: 1000, height: 470 };
  const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(input.priceCents / 100);
  const blocks = [
    { text: input.brand, size: 56, weight: 'bold' },
    { text: input.product, size: 82, weight: 'bold' },
    { text: input.description, size: 46, weight: 'normal' },
    { text: price, size: 74, weight: 'bold' },
  ];
  for (let percent = 100; percent >= 32; percent -= 2) {
    const scale = percent / 100;
    const gap = 20 * scale;
    const layout = blocks.map((block) => {
      const size = Math.floor(block.size * scale);
      const font = `${block.weight} ${size}px "Poster Sans"`;
      ctx.font = font;
      const lines = wrapText(ctx, block.text, area.width);
      return { font, lines, lineHeight: size * 1.25 };
    });
    const height = layout.reduce((sum, block) => sum + block.lines.length * block.lineHeight, gap * 3);
    if (height > area.height) continue;
    let y = area.y;
    for (const block of layout) {
      ctx.font = block.font;
      for (const line of block.lines) { ctx.fillText(line, area.x, y); y += block.lineHeight; }
      y += gap;
    }
    return canvas.encode('png');
  }
  throw new Error('Text could not fit the poster. Please shorten the product details.');
}
