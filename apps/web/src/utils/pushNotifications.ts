import { api } from '../services/http/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

async function sendToServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await api.post('/push/subscribe', {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  });
}

/** Compares a PushSubscription's applicationServerKey with a base64url VAPID key. */
function keyMatchesVapid(sub: PushSubscription, vapidBase64Url: string): boolean {
  try {
    const subKey = sub.options?.applicationServerKey;
    if (!subKey) return false;
    const subBytes = new Uint8Array(subKey as ArrayBuffer);
    const newBytes = urlBase64ToUint8Array(vapidBase64Url);
    if (subBytes.length !== newBytes.length) return false;
    return subBytes.every((b, i) => b === newBytes[i]);
  } catch {
    return false;
  }
}

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[push] permission not granted:', permission);
      return false;
    }

    const keyRes = await api.get<{ publicKey: string | null }>('/push/vapid-key');
    const vapidKey = keyRes.data.publicKey;
    if (!vapidKey) {
      console.warn('[push] server returned no VAPID public key');
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      // If the server's VAPID key changed, unsubscribe so we resubscribe with the new key
      if (!keyMatchesVapid(existing, vapidKey)) {
        console.warn('[push] VAPID key mismatch — resubscribing');
        await existing.unsubscribe();
      } else {
        // Key matches — just ensure server has it
        await sendToServer(existing).catch((e) => console.warn('[push] re-save failed:', e));
        return true;
      }
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await sendToServer(sub);
    console.info('[push] subscribed OK');
    return true;
  } catch (e) {
    console.warn('[push] subscribe error:', e);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn('[push] unsubscribe:', e);
  }
}
