import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, groupId } = await request.json()
  if (!email || !groupId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify caller is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is a member of the group
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Not a group member' }, { status: 403 })

  // Use admin client to find user by email
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // List users and find by email
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const targetUser = usersData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!targetUser) {
    return NextResponse.json({ error: 'No account found with that email' }, { status: 404 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', targetUser.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })
  }

  // Get or create profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', targetUser.id)
    .single()

  // Add to group
  const { error: insertError } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: targetUser.id, role: 'member' })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  const name = profile?.name
    ?? targetUser.user_metadata?.full_name
    ?? email.split('@')[0]

  return NextResponse.json({ success: true, name })
}
