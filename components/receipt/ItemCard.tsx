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
      'rounded-2xl border p-3.5 transition-all',
      item.excluded
        ? 'border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 opacity-60'
        : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium',
            item.excluded
              ? 'line-through text-gray-400'
              : 'text-gray-900 dark:text-white'
          )}>
            {item.name}
          </p>
          {item.quantity && item.quantity > 1 && (
            <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn(
            'font-semibold text-sm',
            item.excluded ? 'text-gray-400' : 'text-gray-900 dark:text-white'
          )}>
            {formatCurrency(item.price)}
          </span>
          <button
            onClick={onToggleExclude}
            className={cn(
              'text-xs px-2 py-1 rounded-full border font-medium haptic transition-colors',
              item.excluded
                ? 'border-emerald-300 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-gray-400'
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
