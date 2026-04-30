import { getInitials, generateAvatarColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, imageUrl, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name)
  const color = generateAvatarColor(name)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          'rounded-full object-cover flex-shrink-0 border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-800',
          sizeMap[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0',
        sizeMap[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}
