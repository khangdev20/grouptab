import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/push/remind-debt
// Body: { debtorId, creditorName, amount, groupId, groupName }
export async function POST(req: NextRequest) {
  try {
    const { debtorId, creditorName, amount, groupId, groupName } = await req.json()

    if (!debtorId || !creditorName || !amount || !groupId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    await sendPush({
      userIds: [debtorId],
      title: 'Payment reminder',
      body: `${creditorName} is reminding you to pay ${amount} in ${groupName}.`,
      url: `/groups/${groupId}/balances`,
      tag: 'reminder',
    })

    return NextResponse.json({ sent: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
