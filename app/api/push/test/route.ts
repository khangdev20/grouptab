export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import webpush from 'web-push'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  // Check env vars
  const envCheck = {
    vapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  // Check subscriptions for this user
  const { data: subs, error: subError } = await admin
    .from('push_subscriptions')
    .select('endpoint, updated_at')
    .eq('user_id', user.id)

  if (!envCheck.vapidPublic || !envCheck.vapidPrivate) {
    return NextResponse.json({ ok: false, envCheck, subs, error: 'VAPID keys missing on server' })
  }

  webpush.setVapidDetails(
    'mailto:admin@grouptab.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  if (!subs?.length) {
    return NextResponse.json({ ok: false, envCheck, subs: [], error: 'No subscription found for this user — click Enable in Settings first' })
  }

  // Send a test push
  const results = await Promise.allSettled(
    subs.map(({ endpoint, ...rest }: any) => {
      const sub = admin.from('push_subscriptions').select('subscription').eq('endpoint', endpoint).eq('user_id', user.id)
      return sub
    })
  )

  const { data: fullSubs } = await admin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', user.id)

  const pushResults = await Promise.allSettled(
    (fullSubs || []).map(({ subscription }: any) =>
      webpush.sendNotification(subscription, JSON.stringify({
        title: '🔔 Test notification',
        body: 'GroupTab push notifications are working!',
        url: '/groups',
        tag: 'test',
      }))
    )
  )

  const sent = pushResults.filter(r => r.status === 'fulfilled').length
  const errors = pushResults
    .filter(r => r.status === 'rejected')
    .map(r => (r as any).reason?.message || String((r as any).reason))

  return NextResponse.json({ ok: sent > 0, envCheck, subscriptions: subs?.length, sent, errors })
}
