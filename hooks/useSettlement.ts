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
  setPendingSettlements: React.Dispatch<React.SetStateAction<any[]>>
  onDone?: () => void
}

export function useSettlement({
  groupId, profiles, pendingSettlements, currentUserId, setPendingSettlements, onDone,
}: UseSettlementOptions) {
  const [settling, setSettling] = useState<string | null>(null)

  const handleSettle = useCallback(async (debt: Debt, amount: number) => {
    if (!currentUserId) return
    const key = `${debt.from}-${debt.to}`
    setSettling(key)
    const supabase = createClient()

    const fromProfile = profiles[debt.from]
    const toProfile = profiles[debt.to]
    const isDebtor = currentUserId === debt.from

    if (isDebtor) {
      // Mark Paid → create new PENDING settlement
      const { data: settlement, error } = await supabase
        .from('settlements')
        .insert({ group_id: groupId, from_user: debt.from, to_user: debt.to, amount, status: 'pending' })
        .select().single()

      if (error || !settlement) { toast.error('Failed to record settlement'); setSettling(null); return }

      // Optimistically add to pending settlements to instantly hide the Mark Paid button
      setPendingSettlements(prev => [...prev, settlement])

      await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'settlement',
        content: `${fromProfile?.name ?? 'Someone'} marked ${formatCurrency(amount)} as paid. Waiting for confirmation.`,
        metadata: { settlement_id: settlement.id, amount, from_user: debt.from, from_name: fromProfile?.name ?? '', to_user: debt.to, to_name: toProfile?.name ?? '', status: 'pending' },
      })

      toast.success('Settlement submitted for confirmation!')
      pushGroupNotify(groupId,
        `${fromProfile?.name?.split(' ')[0]} paid you`,
        `${fromProfile?.name?.split(' ')[0]} marked ${formatCurrency(amount)} as paid. Tap to confirm.`,
        'settlement'
      )
    } else {
      // Confirm Received → UPDATE existing pending settlements
      const existingPending = pendingSettlements.filter(s => s.from_user === debt.from && s.to_user === debt.to)

      if (existingPending.length > 0) {
        for (const s of existingPending) {
          const { error } = await supabase.from('settlements').update({ status: 'completed' }).eq('id', s.id)
          if (error) { toast.error('Failed to confirm: ' + error.message); setSettling(null); return }
          await supabase.from('messages')
            .update({
              metadata: { settlement_id: s.id, amount: s.amount, from_user: s.from_user, from_name: fromProfile?.name ?? '', to_user: s.to_user, to_name: toProfile?.name ?? '', status: 'completed' },
              content: `${fromProfile?.name ?? 'Someone'} paid ${toProfile?.name ?? 'Someone'} ${formatCurrency(s.amount)}`,
            })
            .eq('type', 'settlement')
            .contains('metadata', { settlement_id: s.id })
        }
        toast.success('Payment confirmed!')
      } else {
        const { data: settlement, error } = await supabase
          .from('settlements')
          .insert({ group_id: groupId, from_user: debt.from, to_user: debt.to, amount, status: 'completed' })
          .select().single()
        if (error || !settlement) { toast.error('Failed to confirm'); setSettling(null); return }
        await supabase.from('messages').insert({
          group_id: groupId, sender_id: currentUserId, type: 'settlement',
          content: `${fromProfile?.name ?? 'Someone'} paid ${toProfile?.name ?? 'Someone'} ${formatCurrency(amount)}`,
          metadata: { settlement_id: settlement.id, amount, from_user: debt.from, from_name: fromProfile?.name ?? '', to_user: debt.to, to_name: toProfile?.name ?? '', status: 'completed' },
        })
        toast.success('Payment confirmed!')
      }

      pushGroupNotify(groupId, 'Payment Confirmed', `Your payment of ${formatCurrency(amount)} was confirmed.`, 'settlement')
    }

    // Wait slightly for Supabase realtime to update balances/debts before unlocking button
    await new Promise(r => setTimeout(r, 800))
    setSettling(null)
    onDone?.()
  }, [currentUserId, groupId, profiles, pendingSettlements, setPendingSettlements, onDone])

  return { settling, handleSettle }
}
