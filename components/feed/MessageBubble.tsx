import { Message, Profile } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Image from 'next/image'

interface MessageBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
}

function renderContent(content: string, isMine: boolean) {
  const parts = content.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={`font-semibold rounded px-0.5 ${isMine ? 'bg-white/25' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'}`}>
        {part}
      </span>
    ) : part
  )
}

export default function MessageBubble({ message, sender, isMine, showAvatar }: MessageBubbleProps) {
  const isImage = message.type === 'image'
  const imageUrl = isImage ? (message.metadata as any)?.url : null

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-7 flex-shrink-0">
        {!isMine && showAvatar && sender && <Avatar name={sender.name} size="sm" />}
      </div>

      <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showAvatar && sender && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-1">{sender.name}</span>
        )}

        {isImage && imageUrl ? (
          <div className={`rounded-2xl overflow-hidden ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
            <Image
              src={imageUrl}
              alt="image"
              width={220}
              height={220}
              className="object-cover max-w-[220px] max-h-[220px] w-auto h-auto"
              unoptimized
            />
          </div>
        ) : (
          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
            isMine
              ? 'bg-emerald-500 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-sm'
          }`}>
            {renderContent(message.content ?? '', isMine)}
          </div>
        )}

        <span className="text-[10px] text-gray-400 mt-1 mx-1">{formatDate(message.created_at)}</span>
      </div>
    </div>
  )
}
