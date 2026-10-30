// Imported into the Workbox-generated service worker (see vite.config.ts).
// Shows server-sent Web Push notifications even when no AxeTask tab is open.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data?.text() }; }
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    // An AxeTask tab is open: it plays the sound the user picked in
    // "Sons & Alertes", so the system notification stays silent.
    clients.forEach(c => c.postMessage({ type: 'axetask-play-sound', id: data.id }));
    return self.registration.showNotification(data.title || 'AxeTask', {
      body: data.body || undefined,
      icon: '/icon-192.png',
      badge: '/badge.png',
      // renotify: a replaced notification (same tag) still rings/vibrates.
      tag: data.id || 'axetask',
      renotify: true,
      silent: clients.length > 0,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
    });
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const open = clients.find(c => c.url.startsWith(self.location.origin));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
