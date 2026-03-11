import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env['VITE_BASE_PATH'] ?? '/',
  server: {
    open: true,
    proxy: {
      '/lobby': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
