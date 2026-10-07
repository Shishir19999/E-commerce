import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Modes
//   (default)  full-stack build: talks to the Express API (VITE_API_URL), served from "/"
//   demo       browser-only demo backend (localStorage), served from "/"        -> npm run dev:demo
//   pages      browser-only demo backend, served from /E-commerce/ (GitHub Pages) -> npm run build:pages
const DEMO_MODES = ['demo', 'pages'];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/E-commerce/' : '/',
  define: DEMO_MODES.includes(mode) ? { 'import.meta.env.VITE_DEMO': JSON.stringify('true') } : {},
}));
