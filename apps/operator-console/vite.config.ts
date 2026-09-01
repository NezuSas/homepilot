import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Local keeps the root path; Cloud builds use a relative asset base so the
  // identical console bundle can be served below /homes/:homeId/.
  base: process.env.VITE_PUBLIC_BASE?.trim() || '/',
  plugins: [react()],
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
