// Notificaciones push (Web Push estándar del navegador, sin servicios de
// terceros). El usuario activa/desactiva desde Ajustes; el envío real lo
// hace la Edge Function push-notify por cron, nunca desde aquí.
import { VAPID_PUBLIC_KEY } from './config.js';
import { savePushSubscription, deletePushSubscription } from './supabase-client.js';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Requiere gesto del usuario (botón): el navegador bloquea el permiso si no.
export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador no soporta notificaciones.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permiso de notificaciones no concedido.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  await savePushSubscription(sub);
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await deletePushSubscription(endpoint);
}
