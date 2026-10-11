/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { config } from './src/config';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Fills index.html (title, description, social previews) from src/config.ts. */
function htmlFromConfig(): Plugin {
  return {
    name: 'html-from-config',
    transformIndexHtml(html) {
      const values: Record<string, string> = {
        TITLE: config.page.seoTitle,
        DESCRIPTION: config.page.seoDescription,
        OG_TITLE: config.product.name,
        OG_DESCRIPTION: config.product.subtitle,
        OG_IMAGE: config.product.images[0] ? config.brand.url + config.product.images[0] : config.brand.url + '/og.jpg',
        URL: config.brand.url,
      };
      return html.replace(/%(\w+)%/g, (m, key: string) => (key in values ? escape(values[key]) : m));
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlFromConfig()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
  },
});
