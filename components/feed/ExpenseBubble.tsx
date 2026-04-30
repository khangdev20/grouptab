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
            {showAvatar && sender && <Avatar name={sender.name} imageUrl={sender.avatar_url} size="sm" />}
          </div>
        )}

        <div className={`flex flex-col max-w-[82%] sm:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && showName && sender && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-3.5">{sender.name}</span>
          )}

          {isMine ? (
            <div className="glass-panel p-4 rounded-3xl rounded-br-sm w-[250px] relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent dark:from-emerald-500/5 border-emerald-200/30 dark:border-emerald-500/10 shadow-sm">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none text-emerald-600">
                <Receipt size={100} />
              </div>
              
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/20 rounded-lg">
                  <Receipt size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Expense</span>
                </div>
              </div>
              
              <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2 relative z-10">{description}</p>
              <p className="text-[26px] font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5 relative z-10">
                {formatCurrency(amount)}
              </p>
              
              <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 relative z-10">
                <p className="text-[11px] font-medium text-emerald-800/60 dark:text-emerald-200/50">
                  Paid by <span className="font-bold text-emerald-700 dark:text-emerald-300">you</span>
                </p>
                <p className="text-[10px] text-emerald-800/40 dark:text-emerald-200/30 mt-0.5">{formatDate(message.created_at)}</p>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-4 rounded-3xl rounded-bl-sm w-[250px] relative overflow-hidden opacity-95 shadow-sm">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none grayscale">
                <Receipt size={100} />
              </div>
              
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                  <Receipt size={12} className="text-gray-500" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Expense</span>
                </div>
              </div>
              
              <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2 relative z-10">{description}</p>
              <p className="text-[26px] font-black text-gray-800 dark:text-gray-200 tracking-tight mt-0.5 relative z-10">
                {formatCurrency(amount)}
              </p>
              
              <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-neutral-700/50 relative z-10">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  Paid by <span className="font-bold text-gray-700 dark:text-gray-300">{paidBy}</span>
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(message.created_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
