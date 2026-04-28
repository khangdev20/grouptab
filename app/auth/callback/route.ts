import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/groups'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Upsert profile for Google users (name comes from user_metadata)
      const name = data.user.user_metadata?.full_name
        ?? data.user.user_metadata?.name
        ?? data.user.email?.split('@')[0]
        ?? 'User'
      const email = data.user.email ?? ''

      await supabase.from('profiles').upsert(
        { id: data.user.id, name, email },
        { onConflict: 'id', ignoreDuplicates: false }
      )

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
