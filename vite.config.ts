import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    port: 5273,
    proxy: {
      '/api': 'http://localhost:3100',
      '/mcp': 'http://localhost:3100',
    },
  },
});
