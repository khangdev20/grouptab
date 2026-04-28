'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, BarChart3, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/groups', icon: MessageCircle, label: 'Chats' },
  { href: '/groups/new', icon: Users, label: 'New Group' },
  { href: '/balances', icon: BarChart3, label: 'Balances' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/groups/new' && pathname.startsWith(href) && href !== '/groups' ? true : pathname === href)
          const isGroupsActive = href === '/groups' && pathname.startsWith('/groups') && !pathname.startsWith('/groups/new')
          const active = href === '/groups' ? isGroupsActive : isActive

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors haptic',
                active
                  ? 'text-emerald-500'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
