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
      // Upsert profile for OAuth users
      const name = data.user.user_metadata?.full_name
        ?? data.user.user_metadata?.name
        ?? data.user.email?.split('@')[0]
        ?? 'User'
      const email = data.user.email ?? ''

      await supabase.from('profiles').upsert(
        { id: data.user.id, name, email },
        { onConflict: 'id', ignoreDuplicates: false }
      )

      // Decode the next URL (it may be URL-encoded from the login redirect)
      const destination = decodeURIComponent(next)
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
