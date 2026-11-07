import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Generation {
  id: string;
  brand: string;
  product: string;
  description: string;
  priceCents: number;
  createdAt: string;
  imageUrl: string;
}
type Fields = 'brand' | 'product' | 'description' | 'price';
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function App() {
  const [values, setValues] = useState({ brand: '', product: '', description: '', price: '' });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [historyBusy, setHistoryBusy] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [imageError, setImageError] = useState(false);
  const historyController = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function loadHistory(offset = 0) {
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 10000);
    setHistoryBusy(true);
    setHistoryError('');
    try {
      const response = await fetch(`/api/generations?offset=${offset}`, { signal: controller.signal });
      if (!response.ok) throw new Error('History unavailable');
      const data = await response.json() as { generations: Generation[]; hasMore: boolean };
      if (historyController.current !== controller) return;
      setHistory((previous) => offset === 0 ? data.generations : [
        ...previous, ...data.generations.filter((item) => !previous.some((old) => old.id === item.id)),
      ]);
      setHasMore(data.hasMore);
    } catch {
      if (historyController.current === controller) setHistoryError('Could not load saved posters. Please try again.');
    } finally {
      window.clearTimeout(timer);
      if (historyController.current === controller) setHistoryBusy(false);
    }
  }

  useEffect(() => {
    void loadHistory();
    return () => { historyController.current?.abort(); historyController.current = null; };
  }, []);

  function selectPoster(item: Generation) {
    setSelected(item);
    setImageError(false);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const response = await fetch('/api/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.fields ?? {});
        setError(data.error ?? 'Could not generate the poster. Please try again.');
        const firstField = Object.keys(data.fields ?? {})[0];
        if (firstField) window.setTimeout(() => {
          (formRef.current?.elements.namedItem(firstField) as HTMLElement | null)?.focus();
        }, 0);
        return;
      }
      selectPoster(data as Generation);
      // Refresh from storage so new records and pagination stay in sync.
      await loadHistory();
    } catch {
      setError('Could not confirm generation. Check your connection and refresh history before trying again.');
    } finally { setBusy(false); }
  }

  function fieldProps(field: Fields) {
    return {
      value: values[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((previous) => ({ ...previous, [field]: event.target.value }));
        setErrors((previous) => ({ ...previous, [field]: undefined }));
      },
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': [field !== 'price' ? `${field}-count` : '', errors[field] ? `${field}-error` : ''].filter(Boolean).join(' ') || undefined,
    };
  }

  return (
    <>
      <div className="doodle-sea" aria-hidden="true">
        {['a', 'b', 'c', 'd'].map((variant) => (
          <div key={`fish-${variant}`} className={`fish fish-${variant}`}>
            <span className="eye" /><span className="mouth" />
          </div>
        ))}
        {['a', 'b', 'c', 'd'].map((variant) => <div key={variant} className={`weed weed-${variant}`} />)}
      </div>
      <main>
        <header><h1>Poster studio</h1></header>
        <div className="workspace">
          <section className="card" aria-labelledby="details-heading">
            <h2 id="details-heading">Product details</h2>
            <p className="muted">Start with the essentials.</p>
            <form ref={formRef} onSubmit={generate} noValidate aria-busy={busy}>
              <fieldset disabled={busy}>
                <div className="field-heading"><label htmlFor="brand">Brand name</label><span id="brand-count" className="character-count">{values.brand.length}/80 characters</span></div>
                <input id="brand" name="brand" placeholder="e.g. Sunshield" maxLength={80} required {...fieldProps('brand')} />
                {errors.brand && <p className="field-error" id="brand-error">{errors.brand}</p>}
                <div className="field-heading"><label htmlFor="product">Product name</label><span id="product-count" className="character-count">{values.product.length}/120 characters</span></div>
                <input id="product" name="product" placeholder="e.g. Tropical Glow" maxLength={120} required {...fieldProps('product')} />
                {errors.product && <p className="field-error" id="product-error">{errors.product}</p>}
                <div className="field-heading"><label htmlFor="description">Product description</label><span id="description-count" className="character-count">{values.description.length}/500 characters</span></div>
                <textarea id="description" name="description" rows={4} placeholder="What makes this product special?" maxLength={500} required {...fieldProps('description')} />
                {errors.description && <p className="field-error" id="description-error">{errors.description}</p>}
                <label htmlFor="price">Price (USD)</label>
                <input id="price" name="price" type="text" inputMode="decimal" placeholder="14.99" maxLength={9} required {...fieldProps('price')} />
                {errors.price && <p className="field-error" id="price-error">{errors.price}</p>}
                <button disabled={busy} type="submit">{busy ? 'Generating…' : 'Generate poster'}</button>
              </fieldset>
              {error && <p className="error-message" role="alert">{error}</p>}
              <p className="generation-status" role="status">{busy ? 'Creating and saving your poster…' : selected && !error ? 'Your poster is ready.' : ''}</p>
            </form>
          </section>
          <section className="card" aria-labelledby="template-heading">
            <h2 id="template-heading">{selected ? 'Your poster' : 'Your template'}</h2>
            <p className="muted">{selected ? `${selected.brand} · ${selected.product}` : 'Ocean-inspired artwork, ready for your product.'}</p>
            <img className="template" src={selected?.imageUrl ?? '/assets/backgroundtemplate.png'}
              onError={() => setImageError(true)} onLoad={() => setImageError(false)}
              alt={selected ? `${selected.brand}: ${selected.product}. ${selected.description} ${money(selected.priceCents)}` : 'Oceanbreeze Supplies poster template with a pale panel for product details.'} />
            {imageError && <p role="alert" className="error-message">The image could not load. Try refreshing the page.</p>}
            {selected && <a className="download-button" href={`${selected.imageUrl}?download=1`} download>Download PNG</a>}
          </section>
        </div>
        <section className="card history" aria-labelledby="history-heading" aria-busy={historyBusy}>
          <div className="history-header">
            <h2 id="history-heading">Previous generations</h2>
            <button type="button" className="secondary-button" disabled={historyBusy || busy} onClick={() => void loadHistory()}>Refresh history</button>
          </div>
          {historyError && <p className="error-message" role="alert">{historyError}</p>}
          {historyBusy && <p role="status" className="muted">Loading saved posters…</p>}
          {!historyBusy && !historyError && history.length === 0 && <p className="muted">No posters yet. Your first creation will appear here.</p>}
          <div className="history-grid">
            {history.map((item) => (
              <button key={item.id} type="button" className="history-item" aria-pressed={selected?.id === item.id}
                onClick={() => { selectPoster(item); document.getElementById('template-heading')?.scrollIntoView({ block: 'start' }); }}>
                <img src={item.imageUrl} alt="" loading="lazy" />
                <strong>{item.product}</strong>
                <span>{item.brand} · {money(item.priceCents)}</span>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </button>
            ))}
          </div>
          {hasMore && <button className="secondary-button load-more" type="button" disabled={historyBusy || busy} onClick={() => void loadHistory(history.length)}>Load more</button>}
        </section>
      </main>
    </>
  );
}
