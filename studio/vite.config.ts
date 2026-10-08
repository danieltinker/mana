import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { PRODUCT } from './src/product.ts';

export default defineConfig({
  base: './',                                   // served under any path prefix (GitHub Pages, halom.io/mana/studio/)
  plugins: [
    preact(),
    { name: 'product-name', transformIndexHtml: (html) => html.replaceAll('__PRODUCT_MARK__', PRODUCT.mark) },
  ],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 700 },
});
