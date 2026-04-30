'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Balance, Debt, Profile } from '@/lib/types'
import { calculateBalances, simplifyDebts, formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper, Bell } from 'lucide-react'
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
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([])
  // remindMap: key = `${debtorId}-${creditorId}`, value = { count, windowStart }
  const [remindMap, setRemindMap] = useState<Record<string, { count: number; windowStart: number }>>({}

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: members }, { data: shares }, { data: settlements }] = await Promise.all([
        supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId),
        supabase.from('expense_shares').select('*, expenses!inner(group_id, paid_by, total_amount)').eq('expenses.group_id', groupId),
        supabase.from('settlements').select('*').eq('group_id', groupId),
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

      const completedSettlements = (settlements ?? []).filter((s: any) => s.status === 'completed')
      setPendingSettlements((settlements ?? []).filter((s: any) => s.status === 'pending'))
      const bal = calculateBalances(shares ?? [], completedSettlements, memberIds)
      setBalances(bal)
      setDebts(simplifyDebts(bal))
      setLoading(false)
    }
    init()
  }, [groupId])

  // Load remind state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`remind-${groupId}`)
      if (raw) setRemindMap(JSON.parse(raw))
    } catch {}
  }, [groupId])

  // Max 2 reminds per 48h per debtor-creditor pair
  const REMIND_LIMIT = 2
  const WINDOW_MS = 48 * 60 * 60 * 1000

  const getRemindState = (debt: Debt) => {
    const key = `${debt.from}-${debt.to}`
    const entry = remindMap[key]
    if (!entry) return { count: 0, canRemind: true, remaining: REMIND_LIMIT }
    const elapsed = Date.now() - entry.windowStart
    if (elapsed >= WINDOW_MS) return { count: 0, canRemind: true, remaining: REMIND_LIMIT }
    return { count: entry.count, canRemind: entry.count < REMIND_LIMIT, remaining: REMIND_LIMIT - entry.count }
  }

  const handleRemind = async (debt: Debt) => {
    if (!currentUserId) return
    const key = `${debt.from}-${debt.to}`
    const { canRemind } = getRemindState(debt)
    if (!canRemind) {
      toast.error('You can only send 2 reminders per 48 hours')
      return
    }

    const debtorProfile = profiles[debt.from]
    const creditorProfile = profiles[currentUserId]

    try {
      await fetch('/api/push/remind-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorId: debt.from,
          creditorName: creditorProfile?.name?.split(' ')[0] ?? 'Someone',
          amount: formatCurrency(debt.amount),
          groupId,
          groupName: 'the group',
        }),
      })
    } catch {}

    // Update rate limit state
    const now = Date.now()
    const existing = remindMap[key]
    const inWindow = existing && (now - existing.windowStart) < WINDOW_MS
    const newEntry = {
      count: inWindow ? existing.count + 1 : 1,
      windowStart: inWindow ? existing.windowStart : now,
    }
    const updated = { ...remindMap, [key]: newEntry }
    setRemindMap(updated)
    try { localStorage.setItem(`remind-${groupId}`, JSON.stringify(updated)) } catch {}

    toast.success(`Reminder sent to ${debtorProfile?.name?.split(' ')[0] ?? 'them'}!`)
  }

  const handleSettle = async (debt: Debt) => {
    if (!currentUserId) return
    setSettling(`${debt.from}-${debt.to}`)
    const supabase = createClient()

    const fromProfile = profiles[debt.from]
    const toProfile = profiles[debt.to]

    const isDebtor = currentUserId === debt.from
    const status = isDebtor ? 'pending' : 'completed'

    const { data: settlement, error } = await supabase
      .from('settlements')
      .insert({
        group_id: groupId,
        from_user_id: debt.from,
        to_user_id: debt.to,
        amount: debt.amount,
        status: status,
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
      content: isDebtor 
        ? `${fromProfile?.name ?? 'Someone'} marked ${formatCurrency(debt.amount)} as paid. Waiting for confirmation.`
        : `${fromProfile?.name ?? 'Someone'} paid ${toProfile?.name ?? 'Someone'} ${formatCurrency(debt.amount)}`,
      metadata: {
        settlement_id: settlement.id,
        amount: debt.amount,
        from_user: debt.from,
        from_name: fromProfile?.name ?? '',
        to_user: debt.to,
        to_name: toProfile?.name ?? '',
        status: status,
      },
    })

    toast.success(isDebtor ? 'Settlement submitted for confirmation!' : 'Settlement recorded!')
    setSettling(null)

    try {
      const paidName = isDebtor ? profiles[currentUserId]?.name?.split(' ')[0] : fromProfile?.name?.split(' ')[0]
      const title = isDebtor ? `${paidName} paid you` : `Payment recorded`
      const body = isDebtor ? `${paidName} marked ${formatCurrency(debt.amount)} as paid. Tap to confirm.` : `A payment of ${formatCurrency(debt.amount)} was recorded.`
      
      await fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          title,
          body,
          url: `/groups/${groupId}`,
          tag: 'settlement'
        }),
      })
    } catch { /* best-effort */ }

    router.push(`/groups/${groupId}`)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="flex items-center gap-3 py-3.5">
          <Link
            href={`/groups/${groupId}`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Balances</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 px-5 pt-5 space-y-6 z-10 w-full">
          <div>
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-neutral-800 rounded-md animate-pulse mb-4 ml-1" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[76px] glass-panel bg-gray-200/50 dark:bg-neutral-800/50 rounded-3xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-area px-5 py-5 space-y-6 z-10">
          {/* Net balances */}
          <div>
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">
              Net Balances
            </h2>
            <div className="space-y-3">
              {balances.map((b) => {
                const profile = profiles[b.userId]
                const isMe = b.userId === currentUserId
                const isPositive = b.amount > 0
                return (
                  <div
                    key={b.userId}
                    className="flex items-center gap-4 glass-panel p-4 rounded-3xl"
                  >
                    <Avatar name={profile?.name ?? '?'} imageUrl={profile?.avatar_url} size="md" className="shadow-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">
                        {isMe ? 'You' : profile?.name ?? 'Unknown'}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-green-500' : b.amount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {isPositive ? `owed ${formatCurrency(b.amount)}` : b.amount < 0 ? `owes ${formatCurrency(Math.abs(b.amount))}` : 'settled'}
                      </p>
                    </div>
                    <span className={`text-lg font-black ${isPositive ? 'text-green-500' : b.amount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
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
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1 mt-8">
                Settle Up
              </h2>
              <div className="space-y-3">
                {debts.map((debt) => {
                  const from = profiles[debt.from]
                  const to = profiles[debt.to]
                  const fromIsMe = debt.from === currentUserId
                  const toIsMe = debt.to === currentUserId
                  const key = `${debt.from}-${debt.to}`
                  const pendingAmount = pendingSettlements
                    .filter((s) => s.from_user_id === debt.from && s.to_user_id === debt.to)
                    .reduce((sum, s) => sum + s.amount, 0)
                  const remainingDebt = debt.amount - pendingAmount

                  if (remainingDebt <= 0 && pendingAmount > 0) {
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-3 glass-panel p-4 rounded-3xl"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={from?.name ?? '?'} imageUrl={from?.avatar_url} size="md" className="shadow-md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] text-gray-900 dark:text-white">
                              <span className="font-bold">{fromIsMe ? 'You' : from?.name}</span>
                              {' '}
                              <span className="text-gray-400 px-1">→</span>
                              {' '}
                              <span className="font-bold">{toIsMe ? 'you' : to?.name}</span>
                            </p>
                            <p className="text-xs font-bold text-amber-500 mt-0.5">{formatCurrency(debt.amount)} · Pending confirmation</p>
                          </div>
                        </div>
                        {toIsMe && (
                          <button
                            onClick={() => handleSettle({ ...debt, amount: pendingAmount })}
                            disabled={settling === key}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} />
                            {settling === key ? '...' : 'Confirm Payment'}
                          </button>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-3 glass-panel p-4 rounded-3xl"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={from?.name ?? '?'} imageUrl={from?.avatar_url} size="md" className="shadow-md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-gray-900 dark:text-white">
                            <span className="font-bold">{fromIsMe ? 'You' : from?.name}</span>
                            {' '}
                            <span className="text-gray-400 px-1">→</span>
                            {' '}
                            <span className="font-bold">{toIsMe ? 'you' : to?.name}</span>
                          </p>
                          <p className="text-sm font-black text-emerald-500 mt-0.5">{formatCurrency(remainingDebt)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {fromIsMe && (
                          <button
                            onClick={() => handleSettle({ ...debt, amount: remainingDebt })}
                            disabled={settling === key}
                            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} />
                            {settling === key ? '...' : 'Mark Paid'}
                          </button>
                        )}
                        {toIsMe && (() => {
                          const { canRemind, remaining } = getRemindState(debt)
                          return (
                            <>
                              <button
                                onClick={() => handleRemind(debt)}
                                disabled={!canRemind}
                                title={canRemind ? `Remind ${from?.name} (${remaining} left)` : 'Reminder limit reached for 48h'}
                                className={`py-2.5 px-3.5 rounded-xl text-sm font-semibold haptic transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${
                                  canRemind
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <Bell size={15} />
                                <span>{remaining}/2</span>
                              </button>
                              <button
                                onClick={() => handleSettle({ ...debt, amount: remainingDebt })}
                                disabled={settling === key}
                                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 size={16} />
                                {settling === key ? '...' : 'Confirm Received'}
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {debts.length === 0 && balances.every((b) => Math.abs(b.amount) < 0.01) && (
            <div className="flex flex-col items-center justify-center py-16 text-center mt-4">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-5">
                <PartyPopper size={36} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">All settled up!</h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 max-w-[220px]">
                No outstanding balances between group members.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
