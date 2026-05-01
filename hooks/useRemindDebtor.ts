'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Debt, Profile } from '@/lib/types'
import { formatCurrency, pushGroupNotify } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useEffect } from 'react'
import { getRateLimitState, incrementRateLimit, RemindMap } from '@/lib/utils'

const REMIND_LIMIT = 2
const WINDOW_MS = 48 * 60 * 60 * 1000

export function useRemindDebtor(groupId: string, profiles: Record<string, Profile>) {
  const [remindMap, setRemindMap] = useState<RemindMap>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`remind-${groupId}`)
      if (raw) setRemindMap(JSON.parse(raw))
    } catch {}
  }, [groupId])

  const getRemindState = useCallback((debt: Debt) => {
    const key = `${debt.from}-${debt.to}`
    return getRateLimitState(remindMap, key, REMIND_LIMIT, WINDOW_MS)
  }, [remindMap])

  const handleRemind = useCallback(async (debt: Debt) => {
    const key = `${debt.from}-${debt.to}`
    const { canRemind } = getRateLimitState(remindMap, key, REMIND_LIMIT, WINDOW_MS)
    if (!canRemind) { toast.error('Reminder limit reached (2 per 48h)'); return }

    const creditorProfile = profiles[debt.to]
    const debtorName = profiles[debt.from]?.name?.split(' ')[0] ?? 'them'

    try {
      await fetch('/api/push/remind-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId, debtorId: debt.from,
          title: 'Friendly reminder 👋',
          body: `${creditorProfile?.name?.split(' ')[0] ?? 'Someone'} is reminding you about ${formatCurrency(debt.amount)} owed.`,
          url: `/groups/${groupId}/balances`,
        }),
      })
    } catch { /* best-effort */ }

    const newMap = incrementRateLimit(remindMap, key, WINDOW_MS)
    setRemindMap(newMap)
    try { localStorage.setItem(`remind-${groupId}`, JSON.stringify(newMap)) } catch {}
    toast.success(`Reminder sent to ${debtorName}!`)
  }, [remindMap, profiles, groupId])

  return { getRemindState, handleRemind }
}
