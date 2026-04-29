export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@grouptab.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  userIds: string[]        // who to notify
  title: string
  body: string
  url?: string
  tag?: string             // expense | mention | settlement | reminder
}

export async function POST(req: NextRequest) {
  // Internal calls only — verify secret header
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.PUSH_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload: PushPayload = await req.json()
  const { userIds, title, body, url, tag } = payload

  if (!userIds?.length) return NextResponse.json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription, user_id')
    .in('user_id', userIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const notification = JSON.stringify({ title, body, url: url || '/groups', tag: tag || 'grouptab' })

  const results = await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription, notification).catch(async (err) => {
        // Subscription expired — remove it
        if (err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
        throw err
      })
    )
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ sent, total: subs.length })
}
