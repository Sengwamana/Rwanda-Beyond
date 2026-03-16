import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('/react-router-dom/')
            || id.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('/@tanstack/react-query/')) {
            return 'vendor-tanstack';
          }

          if (id.includes('/recharts/')) {
            return 'vendor-charts';
          }

          if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) {
            return 'vendor-maps';
          }

          if (id.includes('/@google/genai/')) {
            return 'vendor-ai';
          }

          if (id.includes('/lucide-react/')) {
            return 'vendor-icons';
          }

          if (id.includes('/axios/') || id.includes('/zustand/') || id.includes('/date-fns/')) {
            return 'vendor-utils';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
