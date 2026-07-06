import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@react-google-maps/api', 'framer-motion'],
  },
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'google-maps': ['@react-google-maps/api'],
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
});
