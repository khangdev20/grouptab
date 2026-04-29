'use client'

import { useState } from 'react'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export default function PushDebugPage() {
  const [log, setLog] = useState<{ ok: boolean; msg: string }[]>([])
  const [running, setRunning] = useState(false)

  const append = (ok: boolean, msg: string) =>
    setLog((prev) => [...prev, { ok, msg }])

  const runDiag = async () => {
    setLog([])
    setRunning(true)

    // 1. VAPID key
    if (VAPID_KEY) {
      append(true, `VAPID public key present (${VAPID_KEY.slice(0, 20)}…)`)
    } else {
      append(false, 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is EMPTY — env var not set at build time')
    }

    // 2. Service worker support
    if ('serviceWorker' in navigator) {
      append(true, 'serviceWorker supported')
    } else {
      append(false, 'serviceWorker NOT supported on this browser/device')
      setRunning(false)
      return
    }

    // 3. PushManager support
    if ('PushManager' in window) {
      append(true, 'PushManager supported')
    } else {
      append(false, 'PushManager NOT supported — on iOS you must Add to Home Screen first')
      setRunning(false)
      return
    }

    // 4. Register SW
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      append(true, `Service worker registered (scope: ${reg.scope})`)
    } catch (e: any) {
      append(false, `Service worker registration failed: ${e.message}`)
      setRunning(false)
      return
    }

    // 5. Notification permission
    append(true, `Notification permission: ${Notification.permission}`)
    if (Notification.permission === 'denied') {
      append(false, 'Permission DENIED — go to browser settings to reset')
      setRunning(false)
      return
    }

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      append(perm === 'granted', `Permission request result: ${perm}`)
      if (perm !== 'granted') { setRunning(false); return }
    }

    // 6. Push subscribe
    let sub: PushSubscription
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) throw new Error('SW registration not found')

      // First unsubscribe any stale sub
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      const padding = '='.repeat((4 - (VAPID_KEY.length % 4)) % 4)
      const base64 = (VAPID_KEY + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = atob(base64)
      const key = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))

      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      append(true, `Push subscription created (endpoint: …${sub.endpoint.slice(-30)})`)
    } catch (e: any) {
      append(false, `Push subscribe failed: ${e.message}`)
      setRunning(false)
      return
    }

    // 7. Save to server
    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      const data = await res.json()
      if (res.ok) {
        append(true, 'Subscription saved to database ✓')
      } else {
        append(false, `Server returned ${res.status}: ${JSON.stringify(data)}`)
      }
    } catch (e: any) {
      append(false, `Failed to call /api/push/subscribe: ${e.message}`)
    }

    // 8. Test push
    try {
      const res = await fetch('/api/push/test')
      const data = await res.json()
      if (data.ok) {
        append(true, `Test push sent! Check your notification tray.`)
      } else {
        append(false, `Test push failed: ${JSON.stringify(data)}`)
      }
    } catch (e: any) {
      append(false, `Test push call failed: ${e.message}`)
    }

    setRunning(false)
  }

  return (
    <div className="p-5 space-y-4 min-h-full bg-gray-50 dark:bg-neutral-950">
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">Push Debug</h1>
      <button
        onClick={runDiag}
        disabled={running}
        className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run diagnostics'}
      </button>

      <div className="space-y-2">
        {log.map((entry, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 p-3 rounded-xl text-sm font-mono ${
              entry.ok
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            <span className="flex-shrink-0">{entry.ok ? '✓' : '✗'}</span>
            <span className="break-all">{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
