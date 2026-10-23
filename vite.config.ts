import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['axetask.png', 'axetask-mark.png', 'favicon.png', 'apple-touch-icon.png'],
        workbox: {
          // Adds the Web Push handlers to the generated service worker.
          importScripts: ['push-sw.js'],
        },
        manifest: {
          name: 'AxeTask Enterprise',
          short_name: 'AxeTask',
          description: 'Gestion de tâches et productivité multi-ventures',
          theme_color: '#090D16',
          background_color: '#090D16',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ]
        },
        devOptions: {
          // Was `true` — a dev-mode service worker was silently caching the
          // app shell in the browser, so code changes (even after a hard
          // refresh) never showed up until it was manually unregistered.
          // PWA behavior in production (the actual point of this plugin) is
          // unaffected by this flag.
          enabled: false,
          type: 'module',
          navigateFallback: 'index.html'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow external tunnels (ngrok, etc.)
      allowedHosts: [
        '127.0.0.1:3000',
        'localhost:3000',
        'unanimatedly-canorous-arya.ngrok-free.dev',
      ],
    },
  };
});
