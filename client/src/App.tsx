export default function App() {
  return (
    <>
      <div className="doodle-sea" aria-hidden="true">
        {['a', 'b', 'c', 'd'].map((variant) => (
          <div key={`fish-${variant}`} className={`fish fish-${variant}`}>
            <span className="eye" /><span className="mouth" />
          </div>
        ))}
        {['a', 'b', 'c', 'd'].map((variant) => (
          <div key={`weed-${variant}`} className={`weed weed-${variant}`} />
        ))}
      </div>
    <main>
      <header>
        <h1>Poster studio</h1>
      </header>
      <div className="workspace">
        <section className="card" aria-labelledby="details-heading">
          <h2 id="details-heading">Product details</h2>
          <p className="muted">Start with the essentials.</p>
          <form onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="brand">Brand name</label>
            <input id="brand" name="brand" placeholder="e.g. Sunshield" maxLength={80} required />
            <label htmlFor="product">Product name</label>
            <input id="product" name="product" placeholder="e.g. Tropical Glow" maxLength={120} required />
            <label htmlFor="description">Product description</label>
            <textarea id="description" name="description" rows={4} placeholder="What makes this product special?" maxLength={500} required />
            <label htmlFor="price">Price (USD)</label>
            <input id="price" name="price" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="14.99" required />
            <button disabled type="submit">Generate poster</button>
          </form>
        </section>
        <section className="card" aria-labelledby="template-heading">
          <h2 id="template-heading">Your template</h2>
          <p className="muted">Ocean-inspired artwork, ready for your product.</p>
          <img className="template" src="/assets/backgroundtemplate.png" alt="Oceanbreeze Supplies poster background with a pale panel for product details, fish, an octopus and coral." />
        </section>
      </div>
      <section className="card history" aria-labelledby="history-heading">
        <h2 id="history-heading">Previous generations</h2>
        <p className="muted">Saved posters will appear here once generation and storage are connected.</p>
      </section>
    </main>
    </>
  );
}
