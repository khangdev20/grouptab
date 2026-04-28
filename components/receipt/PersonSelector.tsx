'use client'

import { Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface PersonSelectorProps {
  members: Profile[]
  selected: string[]
  onChange: (ids: string[]) => void
  currentUserId: string
}

export default function PersonSelector({ members, selected, onChange, currentUserId }: PersonSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => {
        const isSelected = selected.includes(member.id)
        const isMe = member.id === currentUserId
        return (
          <button
            key={member.id}
            onClick={() => toggle(member.id)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors haptic',
              isSelected
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300'
            )}
          >
            <Avatar name={member.name} size="sm" className="!w-5 !h-5 !text-[10px]" />
            {isMe ? 'You' : member.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}
