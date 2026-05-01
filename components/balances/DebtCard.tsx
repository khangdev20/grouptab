import { CheckCircle2, Bell } from 'lucide-react'
import { Debt, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

interface DebtCardProps {
  debt: Debt
  profiles: Record<string, Profile>
  currentUserId: string | null
  pendingAmount: number
  remainingDebt: number
  settling: string | null
  onMarkPaid: (debt: Debt, amount: number) => void
  onConfirm: (debt: Debt, amount: number) => void
  onRemind: (debt: Debt) => void
  remindState: { canRemind: boolean; remaining: number }
}

export default function DebtCard({
  debt, profiles, currentUserId,
  pendingAmount, remainingDebt,
  settling, onMarkPaid, onConfirm, onRemind, remindState,
}: DebtCardProps) {
  const from = profiles[debt.from]
  const to = profiles[debt.to]
  const fromIsMe = debt.from === currentUserId
  const toIsMe = debt.to === currentUserId
  const key = `${debt.from}-${debt.to}`
  const { canRemind, remaining } = remindState

  return (
    <div className="flex flex-col gap-3 glass-panel p-4 rounded-3xl">
      <div className="flex items-center gap-3">
        <Avatar name={from?.name ?? '?'} imageUrl={from?.avatar_url} size="md" className="shadow-md" />
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
      </div>

      <div className="flex gap-2">
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
              className={`py-2.5 px-3.5 rounded-xl text-sm font-semibold haptic transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${canRemind ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
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
  )
}
