import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../frontend',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'home-assets/[name]-[hash].js',
        chunkFileNames: 'home-assets/[name]-[hash].js',
        assetFileNames: 'home-assets/[name]-[hash][extname]',
      },
    },
  },
});
