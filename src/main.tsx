import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dev mode used to register a PWA service worker (see vite.config.ts —
// devOptions.enabled is now false), which left stale service workers stuck
// in developers' browsers serving a frozen snapshot of the app that no
// amount of reloading could bust. Self-heal any leftover one on every dev
// load so this never needs a manual DevTools unregister again. Skipped in
// production builds, where the PWA service worker is the intended behavior.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
