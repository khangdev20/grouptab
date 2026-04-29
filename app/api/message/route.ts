import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/message — send a message and push-notify group members
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { groupId, type, content, metadata } = body

  // Insert message
  const { data: msg, error } = await admin.from('messages').insert({
    group_id: groupId,
    sender_id: user.id,
    type,
    content,
    metadata,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get sender name + group name
  const [{ data: profile }, { data: group }, { data: members }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', user.id).single(),
    admin.from('groups').select('name').eq('id', groupId).single(),
    admin.from('group_members').select('user_id').eq('group_id', groupId),
  ])

  const senderName = profile?.name || 'Someone'
  const groupName = group?.name || 'your group'
  const otherMembers = (members || []).map((m: any) => m.user_id).filter((id: string) => id !== user.id)

  const url = `/groups/${groupId}`

  // Determine notification based on type
  if (type === 'expense' && otherMembers.length) {
    const amount = metadata?.amount ? `$${Number(metadata.amount).toFixed(2)}` : ''
    await sendPush({
      userIds: otherMembers,
      title: `💸 New expense in ${groupName}`,
      body: `${senderName} added ${amount ? amount + ' — ' : ''}${metadata?.description || 'an expense'}`,
      url,
      tag: 'expense',
    })
  } else if (type === 'settlement' && otherMembers.length) {
    await sendPush({
      userIds: otherMembers,
      title: `✅ Settlement in ${groupName}`,
      body: `${senderName} marked a debt as settled`,
      url,
      tag: 'settlement',
    })
  } else if (type === 'text' && content) {
    // @mention detection
    const mentionedNames: string[] = (content.match(/@(\S+)/g) || []).map((m: string) => m.slice(1))
    if (mentionedNames.length) {
      // Get user IDs of mentioned members
      const { data: mentionedProfiles } = await admin
        .from('profiles')
        .select('id')
        .in('name', mentionedNames)
        .in('id', otherMembers)

      const mentionedIds = (mentionedProfiles || []).map((p: any) => p.id)
      if (mentionedIds.length) {
        await sendPush({
          userIds: mentionedIds,
          title: `🔔 ${senderName} mentioned you`,
          body: `In ${groupName}: ${content.slice(0, 80)}`,
          url,
          tag: 'mention',
        })
      }
    }
  }

  return NextResponse.json({ ok: true, message: msg })
}
