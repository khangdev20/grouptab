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

  // Sort members so "You" is always first
  const sortedMembers = [...members].sort((mA, mB) => (mA.id === currentUserId ? -1 : mB.id === currentUserId ? 1 : 0))

  return (
    <div className="flex flex-wrap gap-2">
      {sortedMembers.map((member) => {
        const isSelected = selected.includes(member.id)
        const isMe = member.id === currentUserId
        return (
          <button
            key={member.id}
            onClick={() => toggle(member.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all haptic shadow-sm',
              isSelected
                ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-[1.02]'
                : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700/50'
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', isSelected ? 'bg-white' : 'bg-gray-300 dark:bg-gray-600')} />
            {isMe ? 'You' : member.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}
