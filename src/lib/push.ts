import { getStoredToken } from './api';

// Subscribes this browser to Web Push so notifications reach the device even
// when the app isn't open. Needs a production build (the service worker is
// disabled in dev) and, on iOS, the app installed to the home screen.
export async function enablePush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const { key } = await fetch('/api/push/public-key').then(r => r.json());
    if (!key) return;
    const sub = await reg.pushManager.getSubscription()
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await authedPost('/api/push/subscribe', sub.toJSON());
  } catch (err) {
    console.error('Web push subscription failed:', err);
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await authedPost('/api/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (err) {
    console.error('Web push unsubscribe failed:', err);
  }
}

function authedPost(url: string, body: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: JSON.stringify(body),
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
