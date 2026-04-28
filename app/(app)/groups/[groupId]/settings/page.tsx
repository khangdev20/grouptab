'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group, Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, Copy, UserPlus, LogOut, RefreshCw, Mail } from 'lucide-react'
import Link from 'next/link'

export default function GroupSettingsPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<{ profile: Profile; role: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: grp }, { data: mems }] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('group_members').select('user_id, role, profiles(*)').eq('group_id', groupId),
      ])

      if (grp) setGroup(grp)
      if (mems) setMembers(mems.map((m: any) => ({ profile: m.profiles, role: m.role })).filter((m: any) => m.profile))
      setLoading(false)
    }
    init()
  }, [groupId])

  const copyInviteLink = () => {
    if (!group?.invite_code) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${group.invite_code}`).then(() => toast.success('Invite link copied!'))
  }

  const handleAddByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)

    try {
      const res = await fetch('/api/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, groupId }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add member')
        setInviting(false)
        return
      }

      toast.success(`${data.name} added to group!`)
      setInviteEmail('')

      // Refresh members list
      const supabase = createClient()
      const { data: mems } = await supabase
        .from('group_members')
        .select('user_id, role, profiles(*)')
        .eq('group_id', groupId)
      if (mems) setMembers(mems.map((m: any) => ({ profile: m.profiles, role: m.role })).filter((m: any) => m.profile))
    } catch {
      toast.error('Network error, please try again')
    }

    setInviting(false)
  }

  const handleLeave = async () => {
    if (!currentUserId) return
    const supabase = createClient()
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUserId)
    toast.success('Left group')
    router.push('/groups')
  }

  if (loading) return <div className="flex items-center justify-center h-dvh"><div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <Link href={`/groups/${groupId}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Group Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-4 py-5 space-y-5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        {group && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex flex-col items-center text-center">
            <Avatar name={group.name} size="xl" className="mb-3" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{group.name}</h2>
            {group.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>}
          </div>
        )}

        {/* Invite via link */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <button onClick={copyInviteLink} className="w-full flex items-center gap-3 px-4 py-4 haptic">
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <UserPlus size={16} className="text-emerald-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Invite via link</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Code: {group?.invite_code}</p>
            </div>
            <Copy size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Add by email */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Add by email</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add someone directly using their email</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddByEmail()}
              placeholder="friend@example.com"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={handleAddByEmail}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-xl transition-colors haptic flex items-center gap-1.5"
            >
              {inviting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Add'}
            </button>
          </div>
        </div>

        {/* Recurring payments */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <Link href={`/groups/${groupId}/recurring`} className="w-full flex items-center gap-3 px-4 py-4 haptic">
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <RefreshCw size={16} className="text-emerald-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurring payments</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Set reminders for regular costs</p>
            </div>
          </Link>
        </div>

        {/* Members list */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">Members ({members.length})</p>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
            {members.map(({ profile, role }) => (
              <div key={profile.id} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={profile.name} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.id === currentUserId ? 'You' : profile.name}</p>
                </div>
                {role === 'admin' && <span className="text-xs text-emerald-500 font-semibold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Admin</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Leave group */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <button onClick={handleLeave} className="w-full flex items-center gap-3 px-4 py-4 text-red-500 haptic">
            <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <LogOut size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-semibold">Leave group</span>
          </button>
        </div>
      </div>
    </div>
  )
}
