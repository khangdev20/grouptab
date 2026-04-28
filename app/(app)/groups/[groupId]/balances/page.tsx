'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Balance, Debt, Profile } from '@/lib/types'
import { calculateBalances, simplifyDebts, formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function GroupBalancesPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [balances, setBalances] = useState<Balance[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: members }, { data: shares }, { data: settlements }] = await Promise.all([
        supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId),
        supabase.from('expense_shares').select('*, expenses!inner(group_id, paid_by)').eq('expenses.group_id', groupId),
        supabase.from('settlements').select('*').eq('group_id', groupId).eq('status', 'completed'),
      ])

      const profileMap: Record<string, Profile> = {}
      const memberIds: string[] = []
      if (members) {
        members.forEach((m: any) => {
          if (m.profiles) {
            profileMap[m.user_id] = m.profiles
            memberIds.push(m.user_id)
          }
        })
      }
      setProfiles(profileMap)

      const bal = calculateBalances(shares ?? [], settlements ?? [], memberIds)
      setBalances(bal)
      setDebts(simplifyDebts(bal))
      setLoading(false)
    }
    init()
  }, [groupId])

  const handleSettle = async (debt: Debt) => {
    if (!currentUserId) return
    setSettling(`${debt.from}-${debt.to}`)
    const supabase = createClient()

    const fromProfile = profiles[debt.from]
    const toProfile = profiles[debt.to]

    const { data: settlement, error } = await supabase
      .from('settlements')
      .insert({
        group_id: groupId,
        from_user: debt.from,
        to_user: debt.to,
        amount: debt.amount,
        status: 'completed',
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to record settlement')
      setSettling(null)
      return
    }

    await supabase.from('messages').insert({
      group_id: groupId,
      sender_id: currentUserId,
      type: 'settlement',
      content: `${fromProfile?.name ?? 'Someone'} paid ${toProfile?.name ?? 'Someone'} ${formatCurrency(debt.amount)}`,
      metadata: {
        settlement_id: settlement.id,
        amount: debt.amount,
        from_user: debt.from,
        from_name: fromProfile?.name ?? '',
        to_user: debt.to,
        to_name: toProfile?.name ?? '',
      },
    })

    toast.success('Settlement recorded!')
    setSettling(null)
    router.push(`/groups/${groupId}`)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <Link
            href={`/groups/${groupId}`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Balances</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-area px-4 py-4 space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {/* Net balances */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Net Balances
            </h2>
            <div className="space-y-2">
              {balances.map((b) => {
                const profile = profiles[b.userId]
                const isMe = b.userId === currentUserId
                const isPositive = b.amount > 0
                return (
                  <div
                    key={b.userId}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800 rounded-2xl px-4 py-3"
                  >
                    <Avatar name={profile?.name ?? '?'} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {isMe ? 'You' : profile?.name ?? 'Unknown'}
                      </p>
                      <p className={`text-xs font-semibold ${isPositive ? 'text-green-500' : b.amount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {isPositive ? `owed ${formatCurrency(b.amount)}` : b.amount < 0 ? `owes ${formatCurrency(Math.abs(b.amount))}` : 'settled'}
                      </p>
                    </div>
                    <span className={`text-base font-bold ${isPositive ? 'text-green-500' : b.amount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(b.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Suggested settlements */}
          {debts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Settle Up
              </h2>
              <div className="space-y-2">
                {debts.map((debt) => {
                  const from = profiles[debt.from]
                  const to = profiles[debt.to]
                  const fromIsMe = debt.from === currentUserId
                  const toIsMe = debt.to === currentUserId
                  const isMyDebt = fromIsMe || toIsMe
                  const key = `${debt.from}-${debt.to}`

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800 rounded-2xl px-4 py-3"
                    >
                      <Avatar name={from?.name ?? '?'} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">
                          <span className="font-semibold">{fromIsMe ? 'You' : from?.name}</span>
                          {' '}
                          <span className="text-gray-500">→</span>
                          {' '}
                          <span className="font-semibold">{toIsMe ? 'you' : to?.name}</span>
                        </p>
                        <p className="text-sm font-bold text-indigo-500 mt-0.5">{formatCurrency(debt.amount)}</p>
                      </div>
                      {isMyDebt && (
                        <button
                          onClick={() => handleSettle(debt)}
                          disabled={settling === key}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 text-white rounded-full text-xs font-semibold haptic disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} />
                          {settling === key ? '...' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {debts.length === 0 && balances.every((b) => Math.abs(b.amount) < 0.01) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">🎉</span>
              <p className="font-semibold text-gray-900 dark:text-white">All settled up!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No outstanding balances.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
