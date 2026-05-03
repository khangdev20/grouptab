'use client'

import { useState } from 'react'
import {
  CheckCircle2, Bell, ChevronDown, TrendingUp, TrendingDown,
  Clock, CircleCheckBig, CircleDollarSign, X, RotateCcw,
} from 'lucide-react'
import { Debt, Profile } from '@/lib/types'
import { formatCurrency, formatDate, getDebtBreakdown, DebtBreakdownItem } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

const CATEGORY_EMOJI: Record<string, string> = {
  food_drink: '🍜',
  transport: '🚗',
  shopping: '🛍️',
  entertainment: '🎮',
  bills: '💡',
  other: '📎',
}

interface DebtCardProps {
  debt: Debt
  profiles: Record<string, Profile>
  currentUserId: string | null
  pendingAmount: number
  remainingDebt: number
  settling: string | null
  rawShares: any[]
  onMarkPaid: (debt: Debt, amount: number) => void
  onConfirm: (debt: Debt, amount: number) => void
  onReject: (debt: Debt) => void
  onCancel: (debt: Debt) => void
  onRemind: (debt: Debt) => void
  remindState: { canRemind: boolean; remaining: number }
}

export default function DebtCard({
  debt, profiles, currentUserId,
  pendingAmount, remainingDebt,
  settling, rawShares,
  onMarkPaid, onConfirm, onReject, onCancel, onRemind, remindState,
}: DebtCardProps) {
  const [expanded, setExpanded] = useState(false)

  const from = profiles[debt.from]
  const to = profiles[debt.to]
  const fromIsMe = debt.from === currentUserId
  const toIsMe = debt.to === currentUserId
  const key = `${debt.from}-${debt.to}`
  const { canRemind, remaining } = remindState
  const isSettling = settling === key

  const breakdown: DebtBreakdownItem[] = getDebtBreakdown(debt.from, debt.to, rawShares)
  const owedItems = breakdown.filter(i => i.direction === 'owed')
  const offsetItems = breakdown.filter(i => i.direction === 'offset')

  const fromName = fromIsMe ? 'You' : from?.name?.split(' ')[0] ?? '?'
  const toName = toIsMe ? 'you' : to?.name?.split(' ')[0] ?? '?'

  const hasPending = pendingAmount > 0
  const isFullyPending = remainingDebt <= 0 && hasPending
  // Progress: how much of the original debt is covered (pending + already-confirmed portion)
  const totalOriginal = debt.amount
  const progressPct = totalOriginal > 0
    ? Math.min(100, Math.round((pendingAmount / totalOriginal) * 100))
    : 0

  return (
    <div className="flex flex-col glass-panel rounded-3xl overflow-hidden">

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      {hasPending && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-800/40">
          <Clock size={13} className="text-amber-500 flex-shrink-0 animate-pulse" />
          <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 flex-1 min-w-0">
            {formatCurrency(pendingAmount)} pending confirmation
            {isFullyPending && ' · fully paid'}
          </p>
          {isFullyPending && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 flex-shrink-0">
              AWAITING
            </span>
          )}
        </div>
      )}

      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar name={from?.name ?? '?'} imageUrl={from?.avatar_url} size="md" className="shadow-md" />
            {fromIsMe && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
                <CircleDollarSign size={9} className="text-white" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] text-gray-900 dark:text-white">
              <span className="font-bold">{fromIsMe ? 'You' : from?.name}</span>
              {' '}<span className="text-gray-400 px-1">owes</span>{' '}
              <span className="font-bold">{toIsMe ? 'you' : to?.name}</span>
            </p>

            {/* Amount row */}
            <div className="flex items-baseline gap-2 mt-0.5">
              {remainingDebt > 0 ? (
                <>
                  <p className="text-sm font-black text-emerald-500">{formatCurrency(remainingDebt)}</p>
                  {hasPending && (
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                      of {formatCurrency(debt.amount)}
                    </p>
                  )}
                </>
              ) : isFullyPending ? (
                <p className="text-sm font-black text-amber-500">
                  {formatCurrency(pendingAmount)} <span className="font-normal text-amber-400 text-[11px]">awaiting</span>
                </p>
              ) : (
                <p className="text-sm font-black text-gray-400 dark:text-gray-500 line-through">{formatCurrency(debt.amount)}</p>
              )}
            </div>
          </div>

          {/* Breakdown toggle */}
          {breakdown.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors haptic flex-shrink-0"
              aria-label={expanded ? 'Hide breakdown' : 'Show breakdown'}
            >
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {breakdown.length} expense{breakdown.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {/* ── Progress bar (only when partial/full pending) ─────────────── */}
        {hasPending && totalOriginal > 0 && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-amber-400/70 dark:bg-amber-500/60 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                {formatCurrency(pendingAmount)} pending
              </p>
              {remainingDebt > 0 && (
                <p className="text-[10px] text-gray-400 font-semibold">
                  {formatCurrency(remainingDebt)} left
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="flex gap-2 mt-3">

          {/* DEBTOR: Mark Paid — only if still has remaining debt */}
          {fromIsMe && remainingDebt > 0 && (
            <button
              onClick={() => onMarkPaid(debt, remainingDebt)}
              disabled={isSettling}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              {isSettling ? 'Sending…' : 'Mark as Paid'}
            </button>
          )}

          {/* DEBTOR: Cancel pending — debtor cancels before creditor confirms */}
          {fromIsMe && hasPending && (
            <button
              onClick={() => onCancel(debt)}
              disabled={isSettling}
              title="Cancel your pending payment submission"
              className="py-2.5 px-3 rounded-xl text-sm font-semibold haptic transition-all flex items-center justify-center gap-1.5 flex-shrink-0 bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 border border-gray-200 dark:border-neutral-700 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              <span className="text-[12px]">Cancel</span>
            </button>
          )}

          {/* CREDITOR: Remind — only if there's remaining debt */}
          {toIsMe && remainingDebt > 0 && (
            <button
              onClick={() => onRemind(debt)}
              disabled={!canRemind}
              title={canRemind
                ? `Remind ${from?.name} (${remaining} left)`
                : 'Reminder limit reached for 48h'
              }
              className={`py-2.5 px-3.5 rounded-xl text-sm font-semibold haptic transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${
                canRemind
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Bell size={15} />
              <span>{remaining}/2</span>
            </button>
          )}

          {/* CREDITOR: Confirm payment */}
          {toIsMe && hasPending && (
            <button
              onClick={() => onConfirm(debt, pendingAmount)}
              disabled={isSettling}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CircleCheckBig size={16} />
              {isSettling ? 'Confirming…' : (isFullyPending ? 'Confirm Payment' : 'Confirm Partial')}
            </button>
          )}

          {/* CREDITOR: Reject payment — payment wasn't actually received */}
          {toIsMe && hasPending && (
            <button
              onClick={() => onReject(debt)}
              disabled={isSettling}
              title="Reject — payment not received"
              className="py-2.5 px-3 rounded-xl text-sm font-semibold haptic transition-all flex items-center justify-center gap-1.5 flex-shrink-0 bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 border border-gray-200 dark:border-neutral-700 disabled:opacity-50"
            >
              <X size={14} />
              <span className="text-[12px]">Reject</span>
            </button>
          )}

          {/* DEBTOR: Waiting state — paid all, waiting for creditor */}
          {fromIsMe && remainingDebt <= 0 && hasPending && (
            <div className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
              <Clock size={15} className="animate-pulse" />
              Waiting for {to?.name?.split(' ')[0] ?? 'creditor'}…
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable breakdown ───────────────────────────────────────────── */}
      {expanded && breakdown.length > 0 && (
        <div className="border-t border-gray-200/60 dark:border-neutral-700/60 px-4 pt-3 pb-4 bg-gray-50/60 dark:bg-neutral-800/30">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Expense breakdown
          </p>

          <div className="space-y-1.5">
            {/* Owed items — creditor paid */}
            {owedItems.map((item) => (
              <div key={item.expenseId} className="flex items-center gap-2.5 py-1.5">
                <span className="text-base flex-shrink-0 w-6 text-center">{CATEGORY_EMOJI[item.category] ?? '📎'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {formatDate(item.date)} · {formatCurrency(item.totalAmount)} total
                  </p>
                </div>
                <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
                  <TrendingDown size={12} />
                  <span className="text-[13px] font-bold">−{formatCurrency(item.shareAmount)}</span>
                </div>
              </div>
            ))}

            {/* Divider if both types exist */}
            {owedItems.length > 0 && offsetItems.length > 0 && (
              <div className="border-t border-dashed border-gray-200 dark:border-neutral-700 my-2" />
            )}

            {/* Offset items — debtor paid (reduces debt) */}
            {offsetItems.map((item) => (
              <div key={item.expenseId} className="flex items-center gap-2.5 py-1.5">
                <span className="text-base flex-shrink-0 w-6 text-center">{CATEGORY_EMOJI[item.category] ?? '📎'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {formatDate(item.date)} · {fromName} paid · {formatCurrency(item.totalAmount)} total
                  </p>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 flex-shrink-0">
                  <TrendingUp size={12} />
                  <span className="text-[13px] font-bold">+{formatCurrency(item.shareAmount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Net summary */}
          <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-neutral-700/60 flex items-center justify-between">
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Net owed</p>
            {isFullyPending ? (
              <p className="text-sm font-black text-amber-500">
                {formatCurrency(pendingAmount)} <span className="font-normal text-[11px] text-amber-400">pending</span>
              </p>
            ) : (
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(remainingDebt > 0 ? remainingDebt : debt.amount)}
              </p>
            )}
          </div>

          {breakdown.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
              Showing direct expenses between {fromName} and {toName}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
