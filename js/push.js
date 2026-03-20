// NaLinha — Push Notifications
const VAPID_PUBLIC = 'BKz5o1wlqjsE7tCaZ-aW4bRGmrNy0Z7mnN1Ygbqut79dSL7eY39ypaj8r82lHfzGyUDfvIlFWunvsDe9i22WfuU';

async function initPush(shopId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Verificar se ja ta inscrito
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Pedir permissao e inscrever
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
    }

    // Salvar subscription no Supabase
    const keys = sub.toJSON().keys;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Upsert: se endpoint ja existe, atualiza
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);

    await sb.from('push_subscriptions').insert({
      user_id: session.user.id,
      barbershop_id: shopId,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    });

    console.log('Push subscription ativa');
  } catch (err) {
    console.error('Push init error:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
