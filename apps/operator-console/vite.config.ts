import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The product name lives only in brand.json at the repository root.
const brand = JSON.parse(readFileSync(new URL('../../brand.json', import.meta.url), 'utf8')) as { productName: string; companyName: string }

/** Lets index.html say %BRAND_PRODUCT_NAME% and %BRAND_COMPANY_NAME% instead of a hard-coded name. */
const brandInHtml = (): Plugin => ({
  name: 'brand-in-html',
  transformIndexHtml: (html) => html
    .replaceAll('%BRAND_PRODUCT_NAME%', brand.productName)
    .replaceAll('%BRAND_COMPANY_NAME%', brand.companyName),
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), brandInHtml()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@dnd-kit/') || id.includes('node_modules/hls.js/')) {
            return 'vendor-dashboard';
          }
          return undefined;
        },
      },
    },
  },
})
