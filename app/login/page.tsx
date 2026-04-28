'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/groups')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-dvh bg-white dark:bg-neutral-900">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo */}
        <div className="anim-logo mb-5">
          <Logo size={72} />
        </div>

        {/* Wordmark */}
        <div className="anim-fade-up delay-150 flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">GroupTab</span>
        </div>
        <p className="anim-fade-up delay-200 text-gray-400 dark:text-gray-500 mb-10 text-sm">
          Split expenses, stay friends
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="anim-fade-up delay-300 w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-shadow"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-shadow"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-all haptic"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span