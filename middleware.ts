import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — IMPORTANT: do not add logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated users trying to access protected routes → redirect to login
  const isProtectedRoute = pathname.startsWith('/groups') || pathname.startsWith('/profile')
  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users trying to access auth pages → redirect to app
  const isAuthRoute = pathname === '/login' || pathname === '/register'
  if (user && isAuthRoute) {
    const groupsUrl = request.nextUrl.clone()
    groupsUrl.pathname = '/groups'
    return NextResponse.redirect(groupsUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all routes except static files, api routes, and auth callback
    '/((?!_next/static|_next/image|favicon|icons|api|auth/callback|sw\\.js|manifest\\.json).*)',
  ],
}
