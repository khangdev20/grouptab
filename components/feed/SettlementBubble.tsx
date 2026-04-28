import { Message } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'

interface SettlementBubbleProps {
  message: Message
  isMine: boolean
}

export default function SettlementBubble({ message, isMine }: SettlementBubbleProps) {
  const meta = message.metadata as any
  const amount = meta?.amount ?? 0
  const fromName = meta?.from_name ?? 'Someone'
  const toName = meta?.to_name ?? 'Someone'

  return (
    <div className="flex justify-center my-2">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3 max-w-[85%] w-full">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
            Settled Up
          </span>
        </div>
        <p className="text-sm text-gray-900 dark:text-white">
          <span className="font-semibold">{isMine ? 'You' : fromName}</span>
          {' paid '}
          <span className="font-semibold">{toName}</span>
        </p>
        <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(amount)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(message.created_at)}</p>
      </div>
    </div>
  )
}
