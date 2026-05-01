'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'
import toast from 'react-hot-toast'

function RegisterInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/groups'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Trigger handle_new_user may have already created the profile.
      // Use upsert to set the name the user provided.
      await supabase
        .from('profiles')
        .upsert({ id: data.user.id, name }, { onConflict: 'id' })

      toast.success('Account created!')
      router.push(redirectTo)
      router.refresh()
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full gradient-bg relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[80px] pointer-events-none anim-float"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-[300px] h-[300px] bg-teal-400/20 dark:bg-teal-600/20 rounded-full blur-[80px] pointer-events-none anim-float" style={{ animationDelay: '2s' }}></div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">

        <div className="anim-logo mb-6 drop-shadow-xl">
          <Logo size={64} />
        </div>
        <h1 className="anim-fade-up delay-150 text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">Create account</h1>
        <p className="anim-fade-up delay-200 text-gray-500 dark:text-gray-400 mb-8 text-[15px] font-medium">Join GroupTab for free</p>

        <div className="w-full max-w-sm glass-panel p-6 sm:p-8 rounded-3xl shadow-xl anim-fade-up delay-250 flex flex-col items-center">
          {/* Google Sign Up */}
          <div className="w-full mb-5">
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/80 dark:bg-neutral-800/80 border border-gray-200/50 dark:border-neutral-700/50 rounded-2xl font-bold text-gray-700 dark:text-gray-200 text-[15px] hover:bg-white dark:hover:bg-neutral-800 transition-all haptic shadow-sm"
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="w-full flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-neutral-700/50" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-neutral-700/50" />
          </div>

          <form onSubmit={handleRegister} className="w-full space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5 block uppercase tracking-wider">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-white/60 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-black/40 text-[15px] transition-all shadow-inner font-medium placeholder:font-normal placeholder:text-gray-400"
                placeholder="Khang"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5 block uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-white/60 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-black/40 text-[15px] transition-all shadow-inner font-medium placeholder:font-normal placeholder:text-gray-400"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5 block uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-white/60 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-black/40 text-[15px] transition-all shadow-inner font-medium placeholder:font-normal placeholder:text-gray-400"
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold rounded-2xl transition-all haptic shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] text-[15px]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        <p className="anim-fade-up delay-300 mt-8 text-[15px] font-medium text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:text-emerald-500 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  )
}
