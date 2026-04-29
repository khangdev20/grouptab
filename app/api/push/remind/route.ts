import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Called by Vercel Cron (or external cron) daily
// vercel.json: { "crons": [{ "path": "/api/push/remind", "schedule": "0 9 * * *" }] }
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.PUSH_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Find recurring payments due today or overdue
  const { data: recurring } = await admin
    .from('recurring_payments')
    .select('*, groups(name)')
    .lte('next_due_date', today)

  if (!recurring?.length) return NextResponse.json({ reminders: 0 })

  let sent = 0
  for (const payment of recurring) {
    const { data: members } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', payment.group_id)

    const memberIds = (members || []).map((m: any) => m.user_id)
    if (!memberIds.length) continue

    await sendPush({
      userIds: memberIds,
      title: `🔁 Payment reminder`,
      body: `${payment.title} ($${Number(payment.amount).toFixed(2)}) is due in ${(payment.groups as any)?.name}`,
      url: `/groups/${payment.group_id}/recurring`,
      tag: 'reminder',
    })
    sent++
  }

  return NextResponse.json({ reminders: sent })
}
