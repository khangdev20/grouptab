// hooks/useSettlement.ts
'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Debt, Profile } from '@/lib/types'
import { formatCurrency, pushGroupNotify } from '@/lib/utils'
import toast from 'react-hot-toast'

interface UseSettlementOptions {
  groupId: string
  profiles: Record<string, Profile>
  pendingSettlements: any[]
  currentUserId: string | null
  onDone?: () => void
}

export function useSettlement({
  groupId, profiles, pendingSettlements, currentUserId, onDone,
}: UseSettlementOptions) {
  const [settling, setSettling] = useState<string | null>(null)

  const handleSettle = useCallback(async (debt: Debt, amount: number) => {
    if (!currentUserId || amount <= 0) return
    const key = `${debt.from}-${debt.to}`
    setSettling(key)
    const supabase = createClient()

    const fromProfile = profiles[debt.from]
    const toProfile = profiles[debt.to]
    const isDebtor = currentUserId === debt.from

    try {
      if (isDebtor) {
        // Mark Paid → tạo PENDING settlement
        const { data: settlement, error } = await supabase
          .from('settlements')
          .insert({
            group_id: groupId,
            from_user: debt.from,
            to_user: debt.to,
            amount,
            status: 'pending',
          })
          .select()
          .single()

        if (error || !settlement) throw new Error(error?.message ?? 'Failed to create settlement')

        await supabase.from('messages').insert({
          group_id: groupId,
          sender_id: currentUserId,
          type: 'settlement',
          content: `${fromProfile?.name ?? 'Someone'} marked ${formatCurrency(amount)} as paid. Waiting for confirmation.`,
          metadata: {
            settlement_id: settlement.id,
            amount,
            from_user: debt.from,
            from_name: fromProfile?.name ?? '',
            to_user: debt.to,
            to_name: toProfile?.name ?? '',
            status: 'pending',
          },
        })

        toast.success('Submitted! Waiting for confirmation.')
        pushGroupNotify(
          groupId,
          `${fromProfile?.name?.split(' ')[0]} paid you`,
          `${fromProfile?.name?.split(' ')[0]} marked ${formatCurrency(amount)} as paid. Tap to confirm.`,
          'settlement',
        )
      } else {
        // Creditor confirm → UPDATE existing pending → completed
        const existingPending = pendingSettlements.filter(
          s => s.from_user === debt.from && s.to_user === debt.to,
        )

        // FIX Bug #3: block ghost confirm — creditor cannot confirm without a debtor-initiated pending
        if (existingPending.length === 0) {
          toast.error(`No pending payment from ${fromProfile?.name ?? 'the debtor'} yet. Ask them to mark as paid first.`)
          return
        }

        for (const s of existingPending) {
          const { error } = await supabase
            .from('settlements')
            .update({ status: 'completed' })
            .eq('id', s.id)

          if (error) throw new Error(error.message)

          // Update the corresponding settlement message
          await supabase
            .from('messages')
            .update({
              content: `${fromProfile?.name ?? 'Someone'} paid ${toProfile?.name ?? 'Someone'} ${formatCurrency(s.amount)}`,
              metadata: {
                settlement_id: s.id,
                // FIX Bug #2: always use s.amount from the DB record, not the UI-passed amount
                amount: s.amount,
                from_user: s.from_user,
                from_name: fromProfile?.name ?? '',
                to_user: s.to_user,
                to_name: toProfile?.name ?? '',
                status: 'completed',
              },
            })
            .eq('type', 'settlement')
            .filter('metadata->>settlement_id', 'eq', s.id)
        }

        const confirmedTotal = existingPending.reduce((sum, s) => sum + s.amount, 0)
        toast.success(`Confirmed ${formatCurrency(confirmedTotal)} payment!`)
        pushGroupNotify(
          groupId,
          'Payment confirmed',
          `Your payment of ${formatCurrency(confirmedTotal)} has been confirmed by ${toProfile?.name?.split(' ')[0] ?? 'the creditor'}.`,
          'settlement',
        )
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Something went wrong')
    } finally {
      // Realtime sẽ cập nhật UI — không cần delay giả
      setSettling(null)
      onDone?.()
    }
  }, [currentUserId, groupId, profiles, pendingSettlements, onDone])

  return { settling, handleSettle }
}