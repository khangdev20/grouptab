'use client'

import { useState } from 'react'
import {
  CheckCircle2, Bell, ChevronDown, TrendingUp, TrendingDown,
  Clock, CircleCheckBig, CircleDollarSign, X, RotateCcw,
  CheckCheck, XCircle, Ban,
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

const STATUS_CONFIG = {
  completed: {
    icon: CheckCheck,
    label: 'Confirmed',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  pending: {
    icon: Clock,
    label: 'Awaiting',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200/60 dark:border-red-800/40',
    text: 'text-red-500 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  },
  cancelled: {
    icon: Ban,
    label: 'Cancelled',
    bg: 'bg-gray-50 dark:bg-neutral-800/40',
    border: 'border-gray-200/60 dark:border-neutral-700/40',
    text: 'text-gray-400 dark:text-gray-500',
    badge: 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400',
  },
} as const

interface DebtCardProps {
  debt: Debt
  profiles: Record<string, Profile>
  currentUserId: string | null
  pendingAmount: number
  remainingDebt: number
  excessPending: number
  settling: string | null
  rawShares: any[]
  pairSettlements: any[]
  onMarkPaid: (debt: Debt, amount: number) => void
  onConfirm: (debt: Debt, amount: number) => void
  onReject: (debt: Debt) => void
  onCancel: (debt: Debt) => void
  onRemind: (debt: Debt) => void
  remindState: { canRemind: boolean; remaining: number }
}

export default function DebtCard({
  debt, profiles, currentUserId,
  pendingAmount, remainingDebt, excessPending,
  settling, rawShares, pairSettlements,
  onMarkPaid, onConfirm, onReject, onCancel, onRemind, remindState,
}: DebtCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const from = profiles[debt.from]
  const to = profiles[debt.to]
  const fromIsMe = debt.from === currentUserId
  const toIsMe = debt.to === currentUserId
  const key = `${debt.from}-${debt.to}`
  const { canRemind, remaining } = remindState
  const isSettling = settling === key

  // Find last completed settlement timestamp to filter breakdown
  const lastCompletedAt = pairSettlements
    .filter(s => s.status === 'completed')
    .map(s => new Date(s.created_at).getTime())
    .sort((a, b) => b - a)[0] ?? null

  const allBreakdown: DebtBreakdownItem[] = getDebtBreakdown(debt.from, debt.to, rawShares)

  // Only show expenses that occurred after the last completed settlement
  const breakdown = lastCompletedAt
    ? allBreakdown.filter(item => new Date(item.date).getTime() > lastCompletedAt)
    : allBreakdown

  const owedItems = breakdown.filter(i => i.direction === 'owed')
  const offsetItems = breakdown.filter(i => i.direction === 'offset')

  const sortedHistory = [...pairSettlements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const fromName = fromIsMe ? 'You' : from?.name?.split(' ')[0] ?? '?'
  const toName = toIsMe ? 'you' : to?.name?.split(' ')[0] ?? '?'

  const hasPending = pendingAmount > 0
  const isFullyPending = remainingDebt <= 0 && hasPending
  const totalOriginal = debt.amount
  const progressPct = totalOriginal > 0
    ? Math.min(100, Math.round((pendingAmount / totalOriginal) * 100))
    : 0

  return (
    <div className="flex flex-col glass-panel rounded-3xl overflow-hidden">

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      {hasPending && (
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${
          excessPending > 0
            ? 'bg-orange-50/80 dark:bg-orange-900/20 border-orange-200/60 dark:border-orange-800/40'
            : 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/40'
        }`}>
          <Clock size={13} className={`flex-shrink-0 animate-pulse ${excessPending > 0 ? 'text-orange-500' : 'text-amber-500'}`} />
          <p className={`text-[12px] font-semibold flex-1 min-w-0 ${excessPending > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {excessPending > 0
              ? `${formatCurrency(pendingAmount)} pending · ${formatCurrency(excessPending)} over current debt`
              : `${formatCurrency(pendingAmount)} pending confirmation${isFullyPending ? ' · fully paid' : ''}`
            }
          </p>
          {excessPending > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200/60 dark:bg-orange-800/40 text-orange-700 dark:text-orange-300 flex-shrink-0">
              OVERPAID
            </span>
          ) : isFullyPending && (
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

          {/* Breakdown + history toggles */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {breakdown.length > 0 && (
              <button
                onClick={() => { setExpanded(v => !v); setShowHistory(false) }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors haptic"
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
            {sortedHistory.length > 0 && (
              <button
                onClick={() => { setShowHistory(v => !v); setExpanded(false) }}
                className={`px-2.5 py-1.5 rounded-xl transition-colors haptic flex items-center gap-1 ${
                  showHistory
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }`}
                title="Payment history"
              >
                <span className="text-[11px] font-bold">{sortedHistory.length}</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
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

          {toIsMe && remainingDebt > 0 && (
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
          )}

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

          {fromIsMe && remainingDebt <= 0 && hasPending && (
            <div className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
              <Clock size={15} className="animate-pulse" />
              Waiting for {to?.name?.split(' ')[0] ?? 'creditor'}…
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable expense breakdown ──────────────────────────────────── */}
      {expanded && breakdown.length > 0 && (
        <div className="border-t border-gray-200/60 dark:border-neutral-700/60 px-4 pt-3 pb-4 bg-gray-50/60 dark:bg-neutral-800/30">
          {lastCompletedAt && (
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
              <CheckCheck size={11} className="text-emerald-500 flex-shrink-0" />
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Showing expenses since last confirmed payment · {formatDate(new Date(lastCompletedAt).toISOString())}
              </p>
            </div>
          )}

          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Expense breakdown
          </p>

          <div className="space-y-1.5">
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

            {owedItems.length > 0 && offsetItems.length > 0 && (
              <div className="border-t border-dashed border-gray-200 dark:border-neutral-700 my-2" />
            )}

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

          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            Showing direct expenses between {fromName} and {toName}
          </p>
        </div>
      )}

      {/* ── Payment history ────────────────────────────────────────────────── */}
      {showHistory && sortedHistory.length > 0 && (
        <div className="border-t border-gray-200/60 dark:border-neutral-700/60 px-4 pt-3 pb-4 bg-gray-50/60 dark:bg-neutral-800/30">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Payment history
          </p>

          <div className="space-y-2">
            {sortedHistory.map((s) => {
              const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.cancelled
              const StatusIcon = cfg.icon
              const isSentByMe = s.from_user === currentUserId
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border ${cfg.bg} ${cfg.border}`}
                >
                  <StatusIcon size={14} className={`flex-shrink-0 ${cfg.text} ${s.status === 'pending' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                      {isSentByMe ? 'You' : fromName} paid {isSentByMe ? toName : 'you'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(s.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className={`text-[13px] font-black ${cfg.text}`}>{formatCurrency(s.amount)}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label.toUpperCase()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
