'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushPrompt() {
  const { permission, subscribed, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true) // start hidden
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Show after 3s if not yet granted/denied
    if (permission === 'default' && !subscribed) {
      const t = setTimeout(() => setDismissed(false), 3000)
      return () => clearTimeout(t)
    }
  }, [permission, subscribed])

  if (dismissed || permission === 'denied' || subscribed) return null

  const handleEnable = async () => {
    setLoading(true)
    await subscribe()
    setLoading(false)
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[80] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-700 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <Bell size={16} className="text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Enable notifications</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Get notified for expenses, mentions & reminders</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 bg-emerald-500 text-white text-xs font-semibold py-2 rounded-xl haptic disabled:opacity-60"
            >
              {loading ? 'Enabling…' : 'Enable'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 haptic"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-gray-400 haptic">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
