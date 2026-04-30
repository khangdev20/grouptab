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
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[400px] z-[80] anim-fade-up">
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-200/50 dark:border-neutral-800/50 p-5 flex items-start gap-4 relative overflow-hidden">
        {/* Glowing orb effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[150px] h-[150px] bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none z-0"></div>

        <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-500/20 flex items-center justify-center flex-shrink-0 relative z-10">
          <Bell size={22} className="text-white drop-shadow-sm" />
        </div>
        
        <div className="flex-1 min-w-0 relative z-10 pr-6">
          <p className="text-[16px] font-black text-gray-900 dark:text-white tracking-tight">Stay updated</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">Get instant alerts for new expenses, settlements, and @mentions.</p>
          
          <div className="flex gap-2.5 mt-4">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 dark:disabled:bg-emerald-800/50 disabled:text-white/50 text-white text-[13px] font-bold py-3 rounded-2xl transition-colors haptic shadow-sm shadow-emerald-500/20"
            >
              {loading ? 'Enabling…' : 'Turn on'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 bg-gray-100/80 dark:bg-neutral-800/80 text-gray-600 dark:text-gray-300 text-[13px] font-bold py-3 rounded-2xl transition-colors haptic"
            >
              Maybe later
            </button>
          </div>
        </div>

        <button onClick={() => setDismissed(true)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 haptic z-10 p-1.5 bg-gray-50 dark:bg-neutral-800 rounded-full transition-colors">
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
