import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    /* root-relative alias: no node types needed in the config */
    alias: { '@': '/src' },
  },
  server: { port: 5173, strictPort: false },
});
