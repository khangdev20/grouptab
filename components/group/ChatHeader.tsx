import { ArrowLeft, Scale, RefreshCw, Settings } from 'lucide-react'
import { Group, Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'

interface ChatHeaderProps {
  group: Group | null
  profiles: Record<string, Profile>
  groupId: string
}

export default function ChatHeader({ group, profiles, groupId }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 border-b border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl flex-shrink-0 z-20">
      <Link href="/groups" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-neutral-800/50 haptic transition-colors">
        <ArrowLeft size={20} />
      </Link>
      {group && <Avatar name={group.name} imageUrl={group.avatar_url} size="md" />}
      <div className="flex-1 min-w-0">
        <h1 className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">{group?.name ?? '...'}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">{Object.keys(profiles).length} members</p>
      </div>
      <div className="flex items-center gap-1">
        <Link href={`/groups/${groupId}/balances`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
          <Scale size={18} />
        </Link>
        <Link href={`/groups/${groupId}/recurring`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
          <RefreshCw size={18} />
        </Link>
        <Link href={`/groups/${groupId}/settings`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
          <Settings size={18} />
        </Link>
      </div>
    </div>
  )
}
