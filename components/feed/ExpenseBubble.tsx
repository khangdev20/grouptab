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
    <div className={`flex my-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`rounded-2xl overflow-hidden max-w-[82%] shadow-sm border ${
        isMine
          ? 'bg-emerald-500 border-emerald-400'
          : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
      }`}>
        {/* Header bar */}
        <div className={`px-3.5 py-2 flex items-center gap-2 ${
          isMine ? 'bg-emerald-600/30' : 'bg-emerald-50 dark:bg-emerald-900/20'
        }`}>
          <Receipt size={13} className={isMine ? 'text-white/80' : 'text-emerald-500'} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${
            isMine ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400'
          }`}>Expense</span>
        </div>

        {/* Body */}
        <div className="px-3.5 py-2.5">
          <p className={`font-semibold text-sm ${isMine ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            {description}
          </p>
          <p className={`text-lg font-bold mt-0.5 ${isMine ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatCurrency(amount)}
          </p>
          <p className={`text-[11px] mt-1 ${isMine ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
            Paid by {isMine ? 'you' : paidBy} · {formatDate(message.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}
