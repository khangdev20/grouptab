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
        .insert({ id: data.user.id, name })
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

  return (
    <div className="flex flex-col min-h-dvh bg-white dark:bg-neutral-900">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="anim-logo mb-5">
          <Logo size={72} />
        </div>
        <h1 className="anim-fade-up delay-150 text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-1">Create account</h1>
        <p className="anim-fade-up delay-200 text-gray-400 dark:text-gray-500 mb-10 text-sm">Join GroupTab for free</p>

        <form onSubmit={handleRegister} className="anim-fade-up delay-300 w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="Min. 6 characters"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors haptic"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account...
              </span>
            ) : 'Create account'}
          </button>
        </form>

        <p className="anim-fade-up delay-400 mt-7 text-sm text-gray-400 dark:text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-500 font-semibold hover:text-indigo-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
