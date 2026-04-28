'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
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
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, name, email })
      if (profileError) {
        toast.error('Failed to create profile')
        setLoading(false)
        return
      }
      toast.success('Account created!')
      router.push('/groups')
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
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="anim-logo mb-5">
          <Logo size={72} />
        </div>
        <h1 className="anim-fade-up delay-150 text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-1">Create account</h1>
        <p className="anim-fade-up delay-200 text-gray-400 dark:text-gray-500 mb-8 text-sm">Join GroupTab for free</p>

        {/* Google Sign Up */}
        <div className="anim-fade-up delay-250 w-full max-w-sm mb-4">
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl font-semibold text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-50 dark:hover:bg-neutral-750 transition-colors haptic shadow-sm"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <div className="anim-fade-up delay-300 w-full max-w-sm flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-700" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-700" />
        </div>

        <form onSubmit={handleRegister} className="anim-fade-up delay-350 w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              placeholder="Khang"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              placeholder="Min. 6 characters"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account…
              </span>
            ) : 'Create account'}
          </button>
        </form>

        <p className="anim-fade-up delay-400 mt-7 text-sm text-gray-400 dark:text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-500 font-semibold hover:text-emerald-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
