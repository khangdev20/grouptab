import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Message, Profile } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  sender: Profile | null
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
  showTime?: boolean
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

export default function MessageBubble({ message, sender, isMine, showAvatar, showName = showAvatar, showTime = true }: MessageBubbleProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isImage = message.type === 'image'
  const imageUrl = isImage ? (message.metadata as any)?.url : null

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-end gap-[10px] w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMine && (
          <div className="w-7 flex-shrink-0">
            {showAvatar && sender && <Avatar name={sender.name} size="sm" />}
          </div>
        )}

        <div className={`flex flex-col max-w-[75vw] sm:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && showName && sender && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-3.5">{sender.name}</span>
          )}

          {isImage && imageUrl ? (
            <>
              <div
                onClick={() => setShowPreview(true)}
                className={`rounded-2xl overflow-hidden cursor-pointer shadow-sm relative group ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
              >
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10" />
                <Image
                  src={imageUrl}
                  alt="image"
                  width={220}
                  height={220}
                  className="object-cover max-w-[220px] max-h-[220px] w-auto h-auto transition-transform duration-300 group-hover:scale-105 active:scale-95"
                  unoptimized
                />
              </div>

              {mounted && createPortal(
                <AnimatePresence>
                  {showPreview && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                      onClick={() => setShowPreview(false)}
                    >
                      <button
                        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors haptic"
                        onClick={(e) => { e.stopPropagation(); setShowPreview(false) }}
                      >
                        <X size={20} />
                      </button>
                      <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Image
                          src={imageUrl}
                          alt="image preview full"
                          width={1200}
                          height={1200}
                          className="object-contain max-w-full max-h-[85vh] rounded-xl"
                          unoptimized
                        />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}
            </>
          ) : (
            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${isMine
              ? 'bg-emerald-500 text-white rounded-br-sm'
              : 'glass-panel text-gray-900 dark:text-white rounded-bl-sm'
              }`}>
              {renderContent(message.content ?? '', isMine)}
            </div>
          )}
        </div>
      </div>

      {showTime && (
        <span className={`text-[9px] text-gray-400 font-medium mt-0.5 tracking-wide ${isMine ? 'mr-1' : 'ml-[39px]'}`}>
          {formatDate(message.created_at)}
        </span>
      )}
    </div>
  )
}
