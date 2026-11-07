export interface ProductInput {
  brand: string;
  product: string;
  description: string;
  priceCents: number;
}

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Please check the highlighted fields.');
  }
}

export function validateProduct(body: unknown): ProductInput {
  const input = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};
  for (const [key, label, max] of [
    ['brand', 'Brand name', 80], ['product', 'Product name', 120],
    ['description', 'Description', 500],
  ] as const) {
    const value = typeof input[key] === 'string' ? input[key].trim().replace(/\s+/gu, ' ') : '';
    values[key] = value;
    if (!value) errors[key] = `${label} is required.`;
    else if (value.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
    else if (/[\p{Cc}\p{Cf}]/u.test(value)) errors[key] = `${label} contains unsupported control characters.`;
  }
  // Parse decimal currency without storing floating-point dollar values.
  const price = typeof input.price === 'string' ? input.price.trim() : '';
  const validPrice = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(price);
  const [whole, fraction = ''] = price.split('.');
  const priceCents = validPrice ? Number(whole) * 100 + Number(fraction.padEnd(2, '0')) : 0;
  if (!validPrice || priceCents < 1) {
    errors.price = 'Enter a price from $0.01 to $999,999.99 with up to 2 decimal places.';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { brand: values.brand, product: values.product, description: values.description, priceCents };
}
