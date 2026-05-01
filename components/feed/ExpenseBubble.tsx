'use client'

import { useState, useRef } from 'react'
import { Message, Profile } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Receipt, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

interface ExpenseBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
  onEdit?: (meta: ExpenseMeta) => void
  onDelete?: (messageId: string, expenseId: string) => void
}

export interface ExpenseMeta {
  messageId: string
  expenseId: string
  description: string
  amount: number
  paidBy: string
  category?: string
}

export default function ExpenseBubble({
  message, sender, isMine, showAvatar, showName,
  onEdit, onDelete
}: ExpenseBubbleProps) {
  const meta = message.metadata as any
  const amount = meta?.amount ?? 0
  const description = meta?.description ?? 'Expense'
  const paidBy = meta?.paid_by_name ?? sender?.name ?? 'Someone'
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const expenseMeta: ExpenseMeta = {
    messageId: message.id,
    expenseId: meta?.expense_id ?? '',
    description: meta?.description ?? '',
    amount: meta?.amount ?? 0,
    paidBy: meta?.paid_by ?? '',
    category: meta?.category ?? 'other',
  }

  const BubbleContent = ({ mine }: { mine: boolean }) => (
    <div className={`glass-panel p-4 rounded-3xl ${mine ? 'rounded-br-sm' : 'rounded-bl-sm'} w-[250px] relative overflow-hidden shadow-sm ${
      mine
        ? 'bg-gradient-to-br from-emerald-500/10 to-transparent dark:from-emerald-500/5 border-emerald-200/30 dark:border-emerald-500/10'
        : 'opacity-95'
    }`}>
      <div className={`absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none ${mine ? 'text-emerald-600' : 'grayscale'}`}>
        <Receipt size={100} />
      </div>

      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${mine ? 'bg-emerald-50 dark:bg-emerald-500/20' : 'bg-gray-100 dark:bg-neutral-800'}`}>
          <Receipt size={12} className={mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>Expense</span>
        </div>

        {/* 3-dot menu — only for sender */}
        {isMine && (onEdit || onDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v) }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors haptic"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <>
                {/* backdrop */}
                <div className="fixed inset-0 z-[90]" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-[100] w-36 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-700 overflow-hidden anim-scale-in">
                  <button
                    onClick={() => { setShowMenu(false); onEdit?.(expenseMeta) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <Pencil size={14} className="text-emerald-500" />
                    Edit
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-neutral-700" />
                  <button
                    onClick={() => { setShowMenu(false); onDelete?.(message.id, meta?.expense_id ?? '') }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2 relative z-10">{description}</p>
      <p className={`text-[26px] font-black tracking-tight mt-0.5 relative z-10 ${mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-200'}`}>
        {formatCurrency(amount)}
      </p>

      <div className={`mt-4 pt-3 border-t relative z-10 ${mine ? 'border-emerald-100 dark:border-emerald-900/30' : 'border-gray-200/50 dark:border-neutral-700/50'}`}>
        <p className={`text-[11px] font-medium ${mine ? 'text-emerald-800/60 dark:text-emerald-200/50' : 'text-gray-500 dark:text-gray-400'}`}>
          Paid by <span className={`font-bold ${mine ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}>{mine ? 'you' : paidBy}</span>
        </p>
        <p className={`text-[10px] mt-0.5 ${mine ? 'text-emerald-800/40 dark:text-emerald-200/30' : 'text-gray-400 dark:text-gray-500'}`}>{formatDate(message.created_at)}</p>
      </div>
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
          <BubbleContent mine={isMine} />
        </div>
      </div>
    </div>
  )
}
