// hooks/useGroupBalances.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  const [allSettlements, setAllSettlements] = useState<any[]>([])
  const [rawShares, setRawShares] = useState<any[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])

  const sharesRef = useRef<any[]>([])
  const settlementsRef = useRef<any[]>([])
  const memberIdsRef = useRef<string[]>([])

  // Stable — only uses setter fns (which never change) and imported pure fns
  const recalcFromData = useCallback((
    shares: any[],
    allSettlements: any[],
    ids: string[],
  ) => {
    const completed = allSettlements.filter((s: any) => s.status === 'completed')
    setPendingSettlements(allSettlements.filter((s: any) => s.status === 'pending'))
    setAllSettlements(allSettlements)
    const bal = calculateBalances(shares, completed, ids)
    setBalances(bal)
    setDebts(simplifyDebts(bal))
  }, [])

  // Exposed so callers can force-sync after mutations (Supabase doesn't echo
  // postgres_changes events back to the client that triggered the write).
  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [{ data: settlements }, { data: shares }] = await Promise.all([
      fetchSettlements(supabase, groupId),
      fetchExpenseShares(supabase, groupId),
    ])
    if (settlements) settlementsRef.current = settlements
    if (shares) {
      sharesRef.current = shares
      setRawShares(shares)
    }
    recalcFromData(sharesRef.current, settlementsRef.current, memberIdsRef.current)
  }, [groupId, recalcFromData])

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: members }, { data: shares }, { data: settlements }] =
        await Promise.all([
          fetchGroupMembers(supabase, groupId),
          fetchExpenseShares(supabase, groupId),
          fetchSettlements(supabase, groupId),
        ])

      const profileMap: Record<string, Profile> = {}
      const ids: string[] = []
      if (members) {
        members.forEach((m: any) => {
          if (m.profiles) {
            profileMap[m.user_id] = m.profiles
            ids.push(m.user_id)
          }
        })
      }
      setProfiles(profileMap)
      setMemberIds(ids)

      sharesRef.current = shares ?? []
      settlementsRef.current = settlements ?? []
      memberIdsRef.current = ids

      setRawShares(sharesRef.current)
      recalcFromData(sharesRef.current, settlementsRef.current, ids)
      setLoading(false)
    }

    init()

    const channel = supabase
      .channel(`balances-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements' },
        async () => {
          const { data } = await fetchSettlements(supabase, groupId)
          if (data) {
            settlementsRef.current = data
            recalcFromData(sharesRef.current, data, memberIdsRef.current)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_shares' },
        async () => {
          const { data } = await fetchExpenseShares(supabase, groupId)
          if (data) {
            sharesRef.current = data
            setRawShares(data)
            recalcFromData(data, settlementsRef.current, memberIdsRef.current)
          }
        },
      )
      .subscribe()

    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const [{ data: settlements }, { data: shares }] = await Promise.all([
        fetchSettlements(supabase, groupId),
        fetchExpenseShares(supabase, groupId),
      ])
      if (settlements) settlementsRef.current = settlements
      if (shares) {
        sharesRef.current = shares
        setRawShares(shares)
      }
      recalcFromData(sharesRef.current, settlementsRef.current, memberIdsRef.current)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [groupId, recalcFromData])

  return {
    balances, debts, profiles, currentUserId, loading,
    pendingSettlements, allSettlements, rawShares, memberIds,
    refetch,
  }
}
