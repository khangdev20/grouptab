import { Receipt, ChevronRight } from 'lucide-react'
import { Message, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'

interface ReceiptBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
  groupId: string
}

export default function ReceiptBubble({ message, sender, isMine, showAvatar, showName, groupId }: ReceiptBubbleProps) {
  const meta = message.metadata as any
  const receiptAmount = meta?.amount ?? 0
  const merchant = meta?.merchant_name ?? 'Receipt'
  const itemsCount = meta?.items_count ?? 0
  const membersCount = meta?.members_count ?? 0

  const BadgeRow = () => (
    <div className="flex items-center gap-2 mt-3">
      {itemsCount > 0 && (
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
          {itemsCount} item{itemsCount !== 1 ? 's' : ''}
        </span>
      )}
      {membersCount > 0 && (
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
          {membersCount} ppl
        </span>
      )}
    </div>
  )

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
            <Link href={`/groups/${groupId}/receipt/${meta?.receipt_id}`} className="block w-full haptic">
              <div className="glass-panel p-4 rounded-3xl w-[250px] relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none">
                  <Receipt size={100} />
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/20 rounded-lg w-fit mb-3">
                  <Receipt size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Receipt</span>
                </div>
                <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2">{merchant}</p>
                <p className="text-[26px] font-black text-emerald-500 tracking-tight mt-0.5">
                  ${receiptAmount ? Number(receiptAmount).toFixed(2) : '—'}
                </p>
                <BadgeRow />
                <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-neutral-700/50 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">Tap to split</span>
                  <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center">
                    <ChevronRight size={14} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="glass-panel p-4 rounded-3xl w-[250px] relative overflow-hidden opacity-90">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none grayscale">
                <Receipt size={100} />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-neutral-800 rounded-lg w-fit mb-3">
                <Receipt size={12} className="text-gray-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Receipt</span>
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2">{merchant}</p>
              <p className="text-[26px] font-black text-gray-800 dark:text-gray-200 tracking-tight mt-0.5">
                ${receiptAmount ? Number(receiptAmount).toFixed(2) : '—'}
              </p>
              <BadgeRow />
              <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-neutral-700/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  Waiting for {sender?.name?.split(' ')[0] ?? 'them'}...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
