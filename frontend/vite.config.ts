import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    build: { emptyOutDir: false },
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
server: {
        port: 3010,
        allowedHosts: true,
        proxy: {
          '/api': {
            target: 'http://localhost:8010',
            changeOrigin: true,
          },
        },
      },
  };
});