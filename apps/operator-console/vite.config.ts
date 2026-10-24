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
        // Each heavy dependency gets its own chunk. Sharing one meant the JSX runtime landed beside
        // hls.js, and because the entry needs the runtime the whole chunk became eager: ~340 kB of video
        // player downloaded on first paint, including on the login screen where no video exists, despite
        // useHlsPlayback importing it dynamically on purpose. The regex also tolerates the backslashes
        // Rollup emits on Windows, which the previous `includes('node_modules/react/')` did not.
        manualChunks(id) {
          if (/node_modules[\\/]hls\.js[\\/]/.test(id)) return 'vendor-hls';
          if (/node_modules[\\/]@dnd-kit[\\/]/.test(id)) return 'vendor-dnd';
          if (/node_modules[\\/]react(-dom|-router-dom)?[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
})
