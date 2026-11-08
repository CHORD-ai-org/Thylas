import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiMiddleware } from './server/ai';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    /* Prefix '' so the middleware sees DEEPSEEK_* too; Vite still only exposes
       VITE_* to the browser, and the key is read by the server handler alone (D-006). */
    aiMiddleware(loadEnv(mode, '.', '')),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: false },
}));
