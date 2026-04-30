'use client'

import { OCRItem, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import PersonSelector from './PersonSelector'
import { cn } from '@/lib/utils'

interface ItemCardProps {
  item: OCRItem & { excluded: boolean; assignedTo: string[] }
  members: Profile[]
  currentUserId: string
  onToggleExclude: () => void
  onAssignChange: (ids: string[]) => void
}

export default function ItemCard({
  item,
  members,
  currentUserId,
  onToggleExclude,
  onAssignChange,
}: ItemCardProps) {
  return (
    <div className={cn(
      'rounded-3xl p-4 transition-all duration-300 relative overflow-hidden',
      item.excluded
        ? 'bg-gray-100/50 dark:bg-neutral-900/50 opacity-60 border border-transparent'
        : 'glass-panel shadow-sm hover:shadow-md'
    )}>
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={cn(
            'text-[15px] font-bold tracking-tight',
            item.excluded
              ? 'line-through text-gray-400'
              : 'text-gray-900 dark:text-white'
          )}>
            {item.name}
          </p>
          {item.quantity && item.quantity > 1 && (
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 bg-gray-100 dark:bg-neutral-800 w-fit px-2 py-0.5 rounded-md">Qty: {item.quantity}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={cn(
            'font-black text-lg tracking-tight',
            item.excluded ? 'text-gray-400' : 'text-emerald-600 dark:text-emerald-400'
          )}>
            {formatCurrency(item.price)}
          </span>
          <button
            onClick={onToggleExclude}
            className={cn(
              'text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg font-bold haptic transition-all',
              item.excluded
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
            )}
          >
            {item.excluded ? 'Include' : 'Exclude'}
          </button>
        </div>
      </div>

      {!item.excluded && (
        <div className="mt-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Split between:</p>
          <PersonSelector
            members={members}
            selected={item.assignedTo}
            onChange={onAssignChange}
            currentUserId={currentUserId}
          />
        </div>
      )}
    </div>
  )
}
