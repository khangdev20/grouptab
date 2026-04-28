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

  // Use admin client with service role key to look up user by email
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  // Direct lookup by email — much faster than listUsers
  const { data: { user: targetUser }, error: lookupError } = await admin.auth.admin.getUserByEmail(
    email.toLowerCase()
  )

  if (lookupError || !targetUser) {
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

  // Add to group
  const { error: insertError } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: targetUser.id, role: 'member' })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  // Get display name from profile or fallback to metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', targetUser.id)
    .single()

  const name = profile?.name
    ?? targetUser.user_metadata?.full_name
    ?? targetUser.user_metadata?.name
    ?? email.split('@')[0]

  // Upsert their profile with email so future lookups work
  await admin.from('profiles').upsert(
    { id: targetUser.id, name, email: targetUser.email ?? email },
    { onConflict: 'id', ignoreDuplicates: false }
  )

  return NextResponse.json({ success: true, name })
}
