'use client'

import { useState } from 'react'
import { CheckCircle2, Bell, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react'
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
  onRemind: (debt: Debt) => void
  remindState: { canRemind: boolean; remaining: number }
}

export default function DebtCard({
  debt, profiles, currentUserId,
  pendingAmount, remainingDebt,
  settling, rawShares,
  onMarkPaid, onConfirm, onRemind, remindState,
}: DebtCardProps) {
  const [expanded, setExpanded] = useState(false)

  const from = profiles[debt.from]
  const to = profiles[debt.to]
  const fromIsMe = debt.from === currentUserId
  const toIsMe = debt.to === currentUserId
  const key = `${debt.from}-${debt.to}`
  const { canRemind, remaining } = remindState

  // Compute breakdown from raw shares
  const breakdown: DebtBreakdownItem[] = getDebtBreakdown(debt.from, debt.to, rawShares)
  const owedItems = breakdown.filter(i => i.direction === 'owed')
  const offsetItems = breakdown.filter(i => i.direction === 'offset')

  const fromName = fromIsMe ? 'You' : from?.name?.split(' ')[0] ?? '?'
  const toName = toIsMe ? 'you' : to?.name?.split(' ')[0] ?? '?'

  return (
    <div className="flex flex-col glass-panel rounded-3xl overflow-hidden">
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={from?.name ?? '?'} imageUrl={from?.avatar_url} size="md" className="shadow-md flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] text-gray-900 dark:text-white">
              <span className="font-bold">{fromIsMe ? 'You' : from?.name}</span>
              {' '}<span className="text-gray-400 px-1">→</span>{' '}
              <span className="font-bold">{toIsMe ? 'you' : to?.name}</span>
            </p>
            <p className="text-sm font-black text-emerald-500 mt-0.5">{formatCurrency(remainingDebt)}</p>
            {pendingAmount > 0 && (
              <p className="text-[11px] font-semibold text-amber-500 mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {formatCurrency(pendingAmount)} pending confirmation
              </p>
            )}
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

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="flex gap-2 mt-3">
          {fromIsMe && (
            <button
              onClick={() => onMarkPaid(debt, remainingDebt)}
              disabled={settling === key}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              {settling === key ? '...' : 'Mark Paid'}
            </button>
          )}

          {toIsMe && (
            <>
              <button
                onClick={() => onRemind(debt)}
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
                onClick={() => onConfirm(debt, remainingDebt)}
                disabled={settling === key}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold haptic transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {settling === key ? '...' : 'Confirm Received'}
              </button>
            </>
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
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(remainingDebt)}</p>
          </div>

          {/* Simplification notice when there's triangular debt */}
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
