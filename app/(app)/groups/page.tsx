'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Group } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'
import { Plus } from 'lucide-react'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGroups = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('group_members')
        .select('grp:groups(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })

      if (data) {
        setGroups(data.map((d: any) => d.grp).filter(Boolean))
      }
      setLoading(false)
    }
    fetchGroups()
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-neutral-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">GroupTab</h1>
          <Link
            href="/groups/new"
            className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center haptic"
          >
            <Plus size={18} className="text-white" />
          </Link>
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
              <span className="text-4xl">💸</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No groups yet</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Create a group to start tracking shared expenses with friends.
            </p>
            <Link
              href="/groups/new"
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-semibold haptic"
            >
              Create your first group
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-neutral-800">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors haptic"
              >
                <Avatar name={group.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">
                      {group.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatDate(group.created_at)}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {group.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
