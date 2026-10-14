import { defineConfig } from 'vite';

export default defineConfig({
  // Silnik leży w ../engine i jest importowany wprost ze źródeł.
  server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
  worker: { format: 'es' },
  preview: { port: 4173, strictPort: true },
  // Fonty zawsze jako osobne pliki: wbudowane w CSS (base64) byłyby pobierane wszystkie, bez względu na unicode-range.
  build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
});
