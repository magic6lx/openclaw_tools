import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['@ant-design/icons', 'async-validator']
  }
});
