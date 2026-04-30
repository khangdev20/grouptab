import { Message, Profile } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Receipt } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

interface ExpenseBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
}

export default function ExpenseBubble({ message, sender, isMine, showAvatar, showName }: ExpenseBubbleProps) {
  const meta = message.metadata as any
  const amount = meta?.amount ?? 0
  const description = meta?.description ?? 'Expense'
  const paidBy = meta?.paid_by_name ?? sender?.name ?? 'Someone'

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} my-2`}>
      <div className={`flex items-end gap-[10px] w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMine && (
          <div className="w-7 flex-shrink-0">
            {showAvatar && sender && <Avatar name={sender.name} size="sm" />}
          </div>
        )}

        <div className={`flex flex-col max-w-[82%] sm:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && showName && sender && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-3.5">{sender.name}</span>
          )}

          <div className={`rounded-2xl overflow-hidden shadow-sm border w-full ${
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
      </div>
    </div>
  )
}
