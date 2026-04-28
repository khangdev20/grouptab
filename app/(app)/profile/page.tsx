'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { LogOut, Moon, Sun, Bell } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) setProfile(data)
      setLoading(false)
    }
    init()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-4 py-6 space-y-5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        {/* Profile card */}
        {profile && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 flex flex-col items-center text-center">
            <Avatar name={profile.name} size="xl" className="mb-3" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{profile.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{profile.email}</p>
          </div>
        )}

        {/* App info */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <span className="text-base">💸</span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">GroupTab</span>
              </div>
              <span className="text-xs text-gray-400">v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-4 text-red-500 haptic"
          >
            <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <LogOut size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-semibold">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
