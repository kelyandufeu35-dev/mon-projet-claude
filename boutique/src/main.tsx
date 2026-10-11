import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/figtree';
import './styles.css';
import App from './App';
import { config } from './config';
import { toCents } from './lib/pricing';

// Structured data so search engines show the price. No rating is declared
// until real reviews exist.
const ld = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: config.product.name,
  description: config.product.subtitle,
  brand: { '@type': 'Brand', name: config.brand.name },
  ...(config.product.images.length ? { image: config.product.images.map((i) => config.brand.url + i) } : {}),
  offers: {
    '@type': 'Offer',
    priceCurrency: 'EUR',
    price: (toCents(config.product.price) / 100).toFixed(2),
    availability: 'https://schema.org/InStock',
    url: config.brand.url,
  },
};
const script = document.createElement('script');
script.type = 'application/ld+json';
script.textContent = JSON.stringify(ld);
document.head.appendChild(script);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
