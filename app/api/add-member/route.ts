import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, groupId } = await request.json()
  if (!email || !groupId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify caller is authenticated and in the group
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Not a group member' }, { status: 403 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Server config error' }, { status: 500 })

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // Step 1: try profiles table (fastest — covers all users who signed up via app)
  const normalizedEmail = email.trim().toLowerCase()
  const { data: profileByEmail } = await admin
    .from('profiles')
    .select('id, name')
    .eq('email', normalizedEmail)
    .maybeSingle()

  let targetId: string | null = profileByEmail?.id ?? null
  let targetName: string | null = profileByEmail?.name ?? null

  // Step 2: fall back to scanning auth users (covers users without email in profiles yet)
  if (!targetId) {
    let page = 1
    let found = false
    while (!found) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      const match = data.users.find(u => u.email?.toLowerCase() === normalizedEmail)
      if (match) {
        targetId = match.id
        targetName = match.user_metadata?.full_name ?? match.user_metadata?.name ?? normalizedEmail.split('@')[0]
        // Upsert their profile so future lookups hit Step 1
        await admin.from('profiles').upsert(
          { id: match.id, name: targetName, email: normalizedEmail },
          { onConflict: 'id', ignoreDuplicates: false }
        )
        found = true
      }
      if (!data.nextPage) break
      page++
    }
  }

  if (!targetId) return NextResponse.json({ error: 'No account found with that email' }, { status: 404 })

  // Check already a member
  const { data: existing } = await supabase
    .from('group_members').select('user_id')
    .eq('group_id', groupId).eq('user_id', targetId).single()
  if (existing) return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })

  // Add to group — use admin client to bypass RLS (we're inserting for another user)
  const { error: insertError } = await admin
    .from('group_members').insert({ group_id: groupId, user_id: targetId, role: 'member' })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true, name: targetName ?? normalizedEmail.split('@')[0] })
}
