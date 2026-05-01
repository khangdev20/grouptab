'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Balance, Debt, Profile } from '@/lib/types'
import { calculateBalances, simplifyDebts } from '@/lib/utils'
import {
  fetchGroupMembers,
  fetchExpenseShares,
  fetchSettlements,
} from '@/lib/supabase/queries'

export function useGroupBalances(groupId: string) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([])
  const [rawShares, setRawShares] = useState<any[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])

  // ── Helper: recalculate from raw data ────────────────────────────────────
  const recalcFromData = (shares: any[], allSettlements: any[], ids: string[]) => {
    const completed = allSettlements.filter((s: any) => s.status === 'completed')
    setPendingSettlements(allSettlements.filter((s: any) => s.status === 'pending'))
    const bal = calculateBalances(shares, completed, ids)
    setBalances(bal)
    setDebts(simplifyDebts(bal))
  }

  useEffect(() => {
    const supabase = createClient()
    let allShares: any[] = []
    let allSettlements: any[] = []
    let ids: string[] = []

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: members }, { data: shares }, { data: settlements }] = await Promise.all([
        fetchGroupMembers(supabase, groupId),
        fetchExpenseShares(supabase, groupId),
        fetchSettlements(supabase, groupId),
      ])

      const profileMap: Record<string, Profile> = {}
      ids = []
      if (members) {
        members.forEach((m: any) => {
          if (m.profiles) { profileMap[m.user_id] = m.profiles; ids.push(m.user_id) }
        })
      }
      setProfiles(profileMap)
      setMemberIds(ids)

      allShares = shares ?? []
      allSettlements = settlements ?? []
      setRawShares(allShares)
      recalcFromData(allShares, allSettlements, ids)
      setLoading(false)
    }

    init()

    // ── Realtime subscriptions ───────────────────────────────────────────
    const channel = supabase
      .channel(`balances-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, async () => {
        const { data } = await fetchSettlements(supabase, groupId)
        if (data) {
          allSettlements = data
          recalcFromData(allShares, data, ids)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_shares' }, async () => {
        const { data } = await fetchExpenseShares(supabase, groupId)
        if (data) {
          allShares = data
          setRawShares(data)
          recalcFromData(data, allSettlements, ids)
        }
      })
      .subscribe()

    // Refetch when tab becomes visible again
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await fetchSettlements(supabase, groupId)
      if (data) {
        allSettlements = data
        recalcFromData(allShares, data, ids)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [groupId])

  return { balances, debts, profiles, currentUserId, loading, pendingSettlements, rawShares, memberIds, setPendingSettlements }
}
