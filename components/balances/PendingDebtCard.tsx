import { CheckCircle2 } from 'lucide-react'
import { Debt, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

interface PendingDebtCardProps {
  debt: Debt
  profiles: Record<string, Profile>
  currentUserId: string | null
  pendingAmount: number
  settling: string | null
  onConfirm: (debt: Debt, amount: number) => void
}

export default function PendingDebtCard({
  debt, profiles, currentUserId, pendingAmount, settling, onConfirm,
}: PendingDebtCardProps) {
  const from = profiles[debt.from]
  const to = profiles[debt.to]
  const fromIsMe = debt.from === currentUserId
  const toIsMe = debt.to === currentUserId
  const key = `${debt.from}-${debt.to}`

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
          <p className="text-xs font-bold text-amber-500 mt-0.5">{formatCurrency(debt.amount)} · Pending confirmation</p>
        </div>
      </div>
      {toIsMe && (
        <button
          onClick={() => onConfirm(debt, pendingAmount)}
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
