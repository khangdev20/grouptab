import { useState } from 'react'
import { Message, Profile } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'

interface SettlementBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
  currentUserId?: string | null
}

export default function SettlementBubble({ message, sender, isMine, showAvatar, showName, currentUserId }: SettlementBubbleProps) {
  const meta = message.metadata as any
  const amount = meta?.amount ?? 0
  const fromName = meta?.from_name ?? 'Someone'
  const toName = meta?.to_name ?? 'Someone'
  const status = meta?.status ?? 'completed'
  const toUser = meta?.to_user
  const settlementId = meta?.settlement_id

  const [confirming, setConfirming] = useState(false)
  const isPending = status === 'pending'
  const canConfirm = isPending && currentUserId === toUser

  const handleConfirm = async () => {
    if (!settlementId) return
    setConfirming(true)
    const supabase = createClient()

    const { error: settlementError } = await supabase
      .from('settlements')
      .update({ status: 'completed' })
      .eq('id', settlementId)

    if (settlementError) {
      toast.error('Failed to confirm settlement')
      setConfirming(false)
      return
    }

    const { error: messageError } = await supabase
      .from('messages')
      .update({
        metadata: { ...meta, status: 'completed' },
        content: `${fromName} paid ${toName} ${formatCurrency(amount)}`
      })
      .eq('id', message.id)

    if (messageError) {
      toast.error('Failed to update message')
    } else {
      toast.success('Payment confirmed!')
      try {
        await fetch('/api/push/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: message.group_id,
            title: `Payment Confirmed`,
            body: `Your payment of ${formatCurrency(amount)} was confirmed by ${toName.split(' ')[0]}.`,
            url: `/groups/${message.group_id}`,
            tag: 'settlement'
          }),
        })
      } catch { /* best-effort */ }
    }
    setConfirming(false)
  }

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} my-2`}>
      <div className={`flex items-end gap-[10px] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar slot — only for others so sender bubble sits flush right */}
        {!isMine && (
          <div className="w-7 flex-shrink-0">
            {showAvatar && sender && <Avatar name={sender.name} imageUrl={sender.avatar_url} size="sm" />}
          </div>
        )}

        <div className={`flex flex-col max-w-[82%] min-w-[215px] ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && showName && sender && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-3.5">{sender.name}</span>
          )}

          <div className={`border rounded-2xl px-4 py-3 ${
            isPending
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          } ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isPending ? 'bg-amber-100 dark:bg-amber-800' : 'bg-blue-100 dark:bg-blue-800'
              }`}>
                {isPending ? (
                  <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 size={13} className="text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                isPending ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
              }`}>
                {isPending ? 'Payment Pending' : 'Settled Up'}
              </span>
            </div>

            <p className="text-sm text-gray-900 dark:text-white mt-1.5">
              {isPending ? (
                <>
                  <span className="font-semibold">{isMine ? 'You' : fromName}</span>
                  {' marked '}
                  <span className="font-semibold">{formatCurrency(amount)}</span>
                  {' as paid to '}
                  <span className="font-semibold">{currentUserId === toUser ? 'you' : toName}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{isMine ? 'You' : fromName}</span>
                  {' paid '}
                  <span className="font-semibold">{currentUserId === toUser ? 'you' : toName}</span>
                </>
              )}
            </p>

            {!isPending && (
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(amount)}</p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(message.created_at)}</p>

            {canConfirm && (
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/50">
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm transition-colors haptic disabled:opacity-50"
                >
                  {confirming ? 'Confirming...' : 'Confirm Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

