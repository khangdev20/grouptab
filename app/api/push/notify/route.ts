export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import webpush from 'web-push'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:admin@grouptab.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  // Auth check — any logged-in user can trigger notifications for their groups
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupId, title, body, url, tag } = await req.json()
  if (!groupId || !title) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // Verify sender is a member of this group
  const { data: membership } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  // Get all OTHER members
  const { data: members } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', user.id)

  const userIds = (members || []).map((m: any) => m.user_id)
  if (!userIds.length) return NextResponse.json({ sent: 0 })

  // Get their push subscriptions
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription, user_id')
    .in('user_id', userIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const notification = JSON.stringify({
    title,
    body,
    url: url || `/groups/${groupId}`,
    tag: tag || 'message',
  })

  const results = await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription, notification).catch(async (err: any) => {
        if (err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
        throw err
      })
    )
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
