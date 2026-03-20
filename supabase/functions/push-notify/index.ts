// NaRegua — Edge Function: envia Push Notification quando novo agendamento chega
// Deploy: supabase functions deploy push-notify
// Webhook: Supabase Dashboard > Database > Webhooks > appointments INSERT > POST esta function

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC = 'BKz5o1wlqjsE7tCaZ-aW4bRGmrNy0Z7mnN1Ygbqut79dSL7eY39ypaj8r82lHfzGyUDfvIlFWunvsDe9i22WfuU'
const VAPID_PRIVATE = 'L9RA-SzmGo0oxY2Gn0w5Ad4s4M1kqEXuK8Amc9GolzA'
const VAPID_SUBJECT = 'mailto:duam-rt@hotmail.com'

// Web Push com crypto nativo do Deno
async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  // Importar web-push compativel com Deno
  const webPush = await import('https://esm.sh/web-push@3.6.7')

  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  await webPush.sendNotification({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  }, payload)
}

serve(async (req) => {
  try {
    const body = await req.json()

    // Webhook envia: { type: 'INSERT', table: 'appointments', record: {...} }
    const record = body.record
    if (!record || !record.barbershop_id) {
      return new Response(JSON.stringify({ ok: true, msg: 'no record' }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar nome do servico
    let serviceName = 'Servico'
    if (record.service_id) {
      const { data: svc } = await supabase.from('services').select('name').eq('id', record.service_id).single()
      if (svc) serviceName = svc.name
    }

    // Montar horario
    const dt = new Date(record.scheduled_at)
    const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' })
    const dia = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Recife' })

    const payload = JSON.stringify({
      title: 'Novo agendamento!',
      body: `${record.client_name} — ${serviceName} as ${hora} (${dia})`,
      tag: 'appt-' + record.id,
      url: '/dashboard.html'
    })

    // Buscar todas as subscriptions desta barbearia
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('barbershop_id', record.barbershop_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'no subscriptions' }), { status: 200 })
    }

    // Enviar push pra cada inscrito
    const results = await Promise.allSettled(
      subs.map(sub => sendPush(sub, payload))
    )

    // Limpar subscriptions invalidas (410 Gone)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const err = (results[i] as PromiseRejectedResult).reason
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', subs[i].id)
        }
      }
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 })

  } catch (err) {
    console.error('Push error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
