import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-tanstack': ['@tanstack/react-query'],
          'vendor-utils': ['axios', 'zustand', 'date-fns']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600
  }
});
