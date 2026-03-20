// NaRegua — Edge Function: lembrete 20min antes do agendamento
// Roda via Cron (Supabase Dashboard > Edge Functions > Schedules)
// A cada 5 minutos verifica agendamentos proximos e envia push pro dono/barbeiro

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC = 'BKz5o1wlqjsE7tCaZ-aW4bRGmrNy0Z7mnN1Ygbqut79dSL7eY39ypaj8r82lHfzGyUDfvIlFWunvsDe9i22WfuU'
const VAPID_PRIVATE = 'L9RA-SzmGo0oxY2Gn0w5Ad4s4M1kqEXuK8Amc9GolzA'
const VAPID_SUBJECT = 'mailto:duam-rt@hotmail.com'

async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const webPush = await import('https://esm.sh/web-push@3.6.7')
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  await webPush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth }
  }, payload)
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Janela: agendamentos entre 15 e 25 minutos a partir de agora
    // (roda a cada 5min, pega janela de 10min pra nao perder nenhum)
    const now = new Date()
    const from = new Date(now.getTime() + 15 * 60000)
    const to = new Date(now.getTime() + 25 * 60000)

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, client_name, scheduled_at, service_id, barber_id, barbershop_id')
      .in('status', ['confirmed', 'pending'])
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())

    if (!appts || appts.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'nenhum agendamento proximo', checked: now.toISOString() }), { status: 200 })
    }

    let sent = 0

    for (const appt of appts) {
      // Buscar nome do servico
      let serviceName = 'Servico'
      if (appt.service_id) {
        const { data: svc } = await supabase.from('services').select('name').eq('id', appt.service_id).single()
        if (svc) serviceName = svc.name
      }

      // Buscar nome do barbeiro
      let barberName = ''
      if (appt.barber_id) {
        const { data: barber } = await supabase.from('barbers').select('name').eq('id', appt.barber_id).single()
        if (barber) barberName = barber.name
      }

      const dt = new Date(appt.scheduled_at)
      const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' })

      // Push pro dono e barbeiros da barbearia
      const payload = JSON.stringify({
        title: 'Proximo cliente em 20min',
        body: `${appt.client_name} — ${serviceName} as ${hora}${barberName ? ' (com ' + barberName + ')' : ''}`,
        tag: 'reminder-' + appt.id,
        url: '/dashboard.html'
      })

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('barbershop_id', appt.barbershop_id)

      if (subs && subs.length > 0) {
        const results = await Promise.allSettled(
          subs.map(sub => sendPush(sub, payload))
        )

        // Limpar subscriptions invalidas
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'rejected') {
            const err = (results[i] as PromiseRejectedResult).reason
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', subs[i].id)
            }
          }
        }

        sent += results.filter(r => r.status === 'fulfilled').length
      }
    }

    return new Response(JSON.stringify({ ok: true, appts: appts.length, sent, checked: now.toISOString() }), { status: 200 })

  } catch (err) {
    console.error('Reminder error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
