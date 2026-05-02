// app/(app)/groups/[groupId]/balances/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useGroupBalances } from '@/hooks/useGroupBalances'
import { useSettlement } from '@/hooks/useSettlement'
import { useRemindDebtor } from '@/hooks/useRemindDebtor'
import DebtCard from '@/components/balances/DebtCard'
import Avatar from '@/components/ui/Avatar'
import {
  ArrowLeft, PartyPopper, TrendingUp, TrendingDown,
  Minus, Clock, Users,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export default function GroupBalancesPage() {
  const { groupId } = useParams() as { groupId: string }

  const {
    balances, debts, profiles, currentUserId, loading,
    pendingSettlements, rawShares,
  } = useGroupBalances(groupId)

  const { settling, handleSettle } = useSettlement({
    groupId, profiles, pendingSettlements, currentUserId,
  })

  const { getRemindState, handleRemind } = useRemindDebtor(groupId, profiles)

  if (loading) {
    return (
      <div className="flex flex-col h-full px-4 pt-[calc(1rem+env(safe-area-inset-top))] gap-4">
        <div className="h-8 w-24 rounded-xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
        <div className="h-32 w-full rounded-3xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 w-full rounded-3xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
        ))}
      </div>
    )
  }

  const myBalance = balances.find(b => b.userId === currentUserId)

  const debtCards = debts.map(debt => {
    const pendingAmount = pendingSettlements
      .filter(s => s.from_user === debt.from && s.to_user === debt.to)
      .reduce((sum, s) => sum + s.amount, 0)
    const remainingDebt = Math.max(0, Math.round((debt.amount - pendingAmount) * 100) / 100)
    return { debt, pendingAmount, remainingDebt }
  })

  const debtKeys = new Set(debts.map(d => `${d.from}-${d.to}`))
  const orphanPending = pendingSettlements.filter(
    s => !debtKeys.has(`${s.from_user}-${s.to_user}`)
  )

  const isSettledUp = debtCards.every(c => c.remainingDebt === 0) && orphanPending.length === 0

  // Compute summary stats
  const totalOwedToMe = debts
    .filter(d => d.to === currentUserId)
    .reduce((s, d) => s + d.amount, 0)
  const totalIOwe = debts
    .filter(d => d.from === currentUserId)
    .reduce((s, d) => s + d.amount, 0)
  const totalPending = pendingSettlements.reduce((s, p) => s + p.amount, 0)

  // Sorted member balances for the bar chart
  const memberBalances = balances
    .filter(b => Math.abs(b.amount) >= 0.01)
    .sort((a, b) => b.amount - a.amount)
  const maxAbs = Math.max(...memberBalances.map(b => Math.abs(b.amount)), 0.01)

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-blue-400/8 dark:bg-blue-600/8 rounded-full blur-[80px] pointer-events-none" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 border-b border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl flex-shrink-0 z-10">
        <Link
          href={`/groups/${groupId}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 haptic transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 dark:text-white text-[17px]">Balances</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Users size={11} />
            {Object.keys(profiles).length} members
          </p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-800/40">
            <Clock size={11} className="text-amber-500 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalPending)} pending
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 z-10 space-y-5 scroll-area">

        {/* ── My balance hero card ─────────────────────────────────────── */}
        {myBalance && (
          <div className="glass-panel rounded-3xl p-4 anim-fade-up">
            <div className="flex items-center gap-3 mb-3">
              <Avatar
                name={profiles[currentUserId!]?.name ?? '?'}
                imageUrl={profiles[currentUserId!]?.avatar_url}
                size="md"
                className="shadow-md"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Your balance</p>
                <p className={`text-xl font-black ${
                  myBalance.amount > 0.01 ? 'text-emerald-500'
                  : myBalance.amount < -0.01 ? 'text-red-500'
                  : 'text-gray-400'
                }`}>
                  {myBalance.amount > 0.01
                    ? `+${formatCurrency(myBalance.amount)}`
                    : formatCurrency(myBalance.amount)}
                </p>
              </div>
            </div>

            {/* Owed to me / I owe summary row */}
            {(totalOwedToMe > 0 || totalIOwe > 0) && (
              <div className="flex gap-2 mt-1">
                {totalOwedToMe > 0 && (
                  <div className="flex-1 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingUp size={11} className="text-emerald-500" />
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Owed to you</p>
                    </div>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalOwedToMe)}</p>
                  </div>
                )}
                {totalIOwe > 0 && (
                  <div className="flex-1 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 px-3 py-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingDown size={11} className="text-red-500" />
                      <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">You owe</p>
                    </div>
                    <p className="text-sm font-black text-red-600 dark:text-red-400">{formatCurrency(totalIOwe)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pending notice on my balance */}
            {totalPending > 0 && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/50 dark:border-amber-800/30">
                <Clock size={12} className="text-amber-500 animate-pulse flex-shrink-0" />
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {formatCurrency(totalPending)} in payments awaiting confirmation
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Member balance bar chart ─────────────────────────────────── */}
        {memberBalances.length > 0 && (
          <div className="anim-fade-up delay-50">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">
              Members
            </h2>
            <div className="glass-panel rounded-3xl px-4 py-3 space-y-3">
              {memberBalances.map((b, idx) => {
                const profile = profiles[b.userId]
                if (!profile) return null
                const isMe = b.userId === currentUserId
                const barPct = Math.round((Math.abs(b.amount) / maxAbs) * 100)
                const isPositive = b.amount > 0

                return (
                  <div key={b.userId} className="flex items-center gap-3">
                    <Avatar name={profile.name} imageUrl={profile.avatar_url} size="sm" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                          {isMe ? 'You' : profile.name.split(' ')[0]}
                        </p>
                        <p className={`text-[13px] font-bold flex-shrink-0 ml-2 ${
                          isPositive ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {isPositive ? '+' : ''}{formatCurrency(b.amount)}
                        </p>
                      </div>
                      {/* Bar */}
                      <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPositive ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Zero balance members note */}
              {balances.filter(b => Math.abs(b.amount) < 0.01).length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-1.5">
                  <Minus size={11} className="text-gray-400" />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {balances.filter(b => Math.abs(b.amount) < 0.01).length} member
                    {balances.filter(b => Math.abs(b.amount) < 0.01).length !== 1 ? 's' : ''} settled
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Settle Up ────────────────────────────────────────────────── */}
        {isSettledUp ? (
          <div className="flex flex-col items-center justify-center py-10 text-center anim-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <PartyPopper size={32} className="text-emerald-500" />
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-white">All settled up!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No outstanding debts in this group.</p>
          </div>
        ) : (
          <div className="anim-fade-up delay-100">
            <div className="flex items-center justify-between mb-3 ml-1">
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Settle Up
              </h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {debtCards.filter(c => c.remainingDebt > 0 || c.pendingAmount > 0).length} payment
                {debtCards.filter(c => c.remainingDebt > 0 || c.pendingAmount > 0).length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-3">
              {debtCards.map(({ debt, pendingAmount, remainingDebt }) => {
                const key = `${debt.from}-${debt.to}`
                if (remainingDebt <= 0 && pendingAmount <= 0) return null
                return (
                  <DebtCard
                    key={key}
                    debt={debt}
                    profiles={profiles}
                    currentUserId={currentUserId}
                    pendingAmount={pendingAmount}
                    remainingDebt={remainingDebt}
                    settling={settling}
                    rawShares={rawShares}
                    onMarkPaid={(d, amt) => handleSettle(d, amt)}
                    onConfirm={(d, amt) => handleSettle(d, amt)}
                    onRemind={handleRemind}
                    remindState={getRemindState(debt)}
                  />
                )
              })}

              {/* Orphan pending (simplified away debt but pending still exists) */}
              {orphanPending.map(s => {
                const fromProfile = profiles[s.from_user]
                const toProfile = profiles[s.to_user]
                const isMeDebtor = s.from_user === currentUserId
                const isMeCreditor = s.to_user === currentUserId

                if (!isMeDebtor && !isMeCreditor) return null

                return (
                  <div key={s.id} className="glass-panel rounded-3xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-800/40">
                      <Clock size={13} className="text-amber-500 flex-shrink-0 animate-pulse" />
                      <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 flex-1">
                        {formatCurrency(s.amount)} pending confirmation
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300">
                        AWAITING
                      </span>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <Avatar name={fromProfile?.name ?? '?'} imageUrl={fromProfile?.avatar_url} size="md" className="shadow-md flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-gray-900 dark:text-white">
                          <span className="font-bold">{isMeDebtor ? 'You' : fromProfile?.name}</span>
                          {' '}<span className="text-gray-400 px-1">paid</span>{' '}
                          <span className="font-bold">{isMeCreditor ? 'you' : toProfile?.name}</span>
                        </p>
                        <p className="text-sm font-black text-amber-500 mt-0.5">{formatCurrency(s.amount)}</p>
                      </div>
                      {isMeCreditor && (
                        <button
                          onClick={() => handleSettle({ from: s.from_user, to: s.to_user, amount: s.amount }, s.amount)}
                          disabled={settling === `${s.from_user}-${s.to_user}`}
                          className="py-2 px-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      )}
                      {isMeDebtor && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40">
                          <Clock size={13} className="text-amber-500 animate-pulse" />
                          <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">Waiting…</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}