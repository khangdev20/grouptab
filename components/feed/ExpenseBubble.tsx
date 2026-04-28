import { Message } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Receipt } from 'lucide-react'

interface ExpenseBubbleProps {
  message: Message
  senderName: string
  isMine: boolean
}

export default function ExpenseBubble({ message, senderName, isMine }: ExpenseBubbleProps) {
  const meta = message.metadata as any
  const amount = meta?.amount ?? 0
  const description = meta?.description ?? 'Expense'
  const paidBy = meta?.paid_by_name ?? senderName

  return (
    <div className="flex justify-center my-2">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 max-w-[85%] w-full">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
            <Receipt size={14} className="text-green-600 dark:text-green-400" />
          </div>
          <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
            New Expense
          </span>
        </div>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">{description}</p>
        <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(amount)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Paid by {isMine ? 'you' : paidBy} · {formatDate(message.created_at)}
        </p>
      </div>
    </div>
  )
}
