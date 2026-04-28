import { Message, Profile } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

interface MessageBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
}

export default function MessageBubble({ message, sender, isMine, showAvatar }: MessageBubbleProps) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="w-7 flex-shrink-0">
        {!isMine && showAvatar && sender && (
          <Avatar name={sender.name} size="sm" />
        )}
      </div>

      <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showAvatar && sender && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {sender.name}
          </span>
        )}
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
            isMine
              ? 'bg-emerald-500 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 mx-1">
          {formatDate(message.created_at)}
        </span>
      </div>
    </div>
  )
}
