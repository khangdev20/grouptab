'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, BarChart3, User, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/groups', icon: MessageCircle, label: 'Chats' },
  { href: '/statistics', icon: PieChart, label: 'Statistics' },
  { href: '/balances', icon: BarChart3, label: 'Balances' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 pointer-events-none"
         style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-4 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-neutral-800/50 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] pointer-events-auto">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href) && href !== '/groups' ? true : pathname === href)
            const isGroupsActive = href === '/groups' && pathname.startsWith('/groups')
            const active = href === '/groups' ? isGroupsActive : isActive

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all haptic',
                  active
                    ? 'text-emerald-500'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                )}
              >
                <div className={cn('relative flex items-center justify-center w-10 h-8 rounded-xl transition-colors', active && 'bg-emerald-50 dark:bg-emerald-500/10')}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} className={active ? 'drop-shadow-sm' : ''} />
                </div>
                <span className="text-[10px] font-bold tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
