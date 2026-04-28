'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'

export default function JoinGroupPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/login?redirect=/join/${inviteCode}`)
        return
      }

      const { data: grp } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (!grp) {
        toast.error('Invalid invite link')
        router.push('/groups')
        return
      }

      setGroup(grp)

      // Check if already member
      const { data: mem } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', grp.id)
        .eq('user_id', user.id)
        .single()

      if (mem) {
        setAlreadyMember(true)
        setTimeout(() => router.push(`/groups/${grp.id}`), 1500)
      }

      setLoading(false)
    }
    init()
  }, [inviteCode, router])

  const handleJoin = async () => {
    if (!group) return
    setJoining(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'member' })

    if (error) {
      toast.error('Failed to join group')
      setJoining(false)
      return
    }

    toast.success(`Joined ${group.name}!`)
    router.push(`/groups/${group.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-white dark:bg-neutral-900">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-white dark:bg-neutral-900 items-center justify-center px-6">
      {group && (
        <div className="w-full max-w-sm text-center">
          <Avatar name={group.name} size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Join {group.name}
          </h1>
          {group.description && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">{group.description}</p>
          )}

          {alreadyMember ? (
            <p className="text-emerald-500 font-medium">You're already in this group. Redirecting...</p>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic"
            >
              {joining ? 'Joining...' : `Join ${group.name}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
