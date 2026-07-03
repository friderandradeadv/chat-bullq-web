import { api } from '@/lib/api';

// Web Push no cliente: pede permissão, inscreve no pushManager e manda a
// inscrição pro backend. A chave pública VAPID vem do próprio backend.

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // ArrayBuffer explícito → tipo Uint8Array<ArrayBuffer>, aceito por BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // garante que o SW registrado pelo PwaRegister esteja pronto
  return navigator.serviceWorker.ready;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

/** Ativa o push neste dispositivo. Retorna o status resultante. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const { data } = await api.get<{ publicKey: string | null }>(
    '/notifications/push/public-key',
  );
  if (!data?.publicKey) throw new Error('Servidor sem chave VAPID configurada.');

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  // envia { endpoint, keys: { p256dh, auth } } — o toJSON() já entrega nesse formato.
  await api.post('/notifications/push/subscribe', sub.toJSON());
  return 'granted';
}

/** Desativa o push neste dispositivo (remove local + no servidor). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api
      .delete('/notifications/push/subscribe', { data: { endpoint: sub.endpoint } })
      .catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
}
