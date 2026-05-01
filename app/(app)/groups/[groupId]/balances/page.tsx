'use client'

import { useParams } from 'next/navigation'
import { useGroupBalances } from '@/hooks/useGroupBalances'
import { useSettlement } from '@/hooks/useSettlement'
import { useRemindDebtor } from '@/hooks/useRemindDebtor'
import DebtCard from '@/components/balances/DebtCard'
import Avatar from '@/components/ui/Avatar'
import { ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export default function GroupBalancesPage() {
  const { groupId } = useParams() as { groupId: string }

  const {
    balances, debts, profiles, currentUserId, loading,
    pendingSettlements, setPendingSettlements, rawShares,
  } = useGroupBalances(groupId)

  const { settling, handleSettle } = useSettlement({
    groupId, profiles, pendingSettlements, currentUserId,
    setPendingSettlements,
    // Stay on balances page after settling — no redirect
  })

  const { getRemindState, handleRemind } = useRemindDebtor(groupId, profiles)

  if (loading) {
    return (
      <div className="flex flex-col h-full px-4 pt-[calc(1rem+env(safe-area-inset-top))] gap-4">
        <div className="h-8 w-24 rounded-xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-28 w-full rounded-3xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />)}
      </div>
    )
  }

  const myBalance = balances.find(b => b.userId === currentUserId)
  const isSettledUp = debts.length === 0 && pendingSettlements.length === 0

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 border-b border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl flex-shrink-0 z-10">
        <Link href={`/groups/${groupId}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 haptic transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 dark:text-white text-[17px]">Balances</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{Object.keys(profiles).length} members</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 z-10 space-y-6">
        {/* My balance chip */}
        {myBalance && (
          <div className="glass-panel rounded-3xl p-4 flex items-center gap-3">
            <Avatar name={profiles[currentUserId!]?.name ?? '?'} imageUrl={profiles[currentUserId!]?.avatar_url} size="md" className="shadow-md" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Your balance</p>
              <p className={`text-lg font-black ${myBalance.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {myBalance.amount >= 0 ? `+${formatCurrency(myBalance.amount)}` : formatCurrency(myBalance.amount)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {myBalance.amount > 0.01 ? 'You are owed money' : myBalance.amount < -0.01 ? 'You owe money' : 'All settled up!'}
              </p>
            </div>
          </div>
        )}

        {/* All member balances */}
        <div>
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">Members</h2>
          <div className="space-y-2">
            {balances.map(b => {
              const profile = profiles[b.userId]
              if (!profile) return null
              return (
                <div key={b.userId} className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Avatar name={profile.name} imageUrl={profile.avatar_url} size="sm" />
                  <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {b.userId === currentUserId ? 'You' : profile.name}
                  </span>
                  <div className={`flex items-center gap-1 ${b.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {b.amount >= 0 ? <ArrowRight size={14} /> : <ArrowRight size={14} className="rotate-180" />}
                    <span className="text-sm font-bold">{formatCurrency(Math.abs(b.amount))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Settle Up */}
        {isSettledUp ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PartyPopper size={40} className="text-emerald-500 mb-3 opacity-70" />
            <p className="text-base font-bold text-gray-900 dark:text-white">All settled up!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No outstanding debts in this group.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1 mt-2">Settle Up</h2>
            <div className="space-y-3">
              {debts.map((debt) => {
                const key = `${debt.from}-${debt.to}`
                const pendingAmount = pendingSettlements
                  .filter(s => s.from_user === debt.from && s.to_user === debt.to)
                  .reduce((sum, s) => sum + s.amount, 0)
                const remainingDebt = debt.amount - pendingAmount
                return (
                  <DebtCard
                    key={key} debt={debt} profiles={profiles}
                    currentUserId={currentUserId}
                    pendingAmount={pendingAmount} remainingDebt={remainingDebt}
                    settling={settling}
                    rawShares={rawShares}
                    onMarkPaid={(d, amt) => handleSettle(d, amt)}
                    onConfirm={(d, amt) => handleSettle(d, amt)}
                    onRemind={handleRemind}
                    remindState={getRemindState(debt)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
