'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import Logo from '@/components/ui/Logo'
import { formatDate } from '@/lib/utils'
import { Plus, Hash, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface GroupWithActivity extends Group {
  lastActivityAt: string
  lastMessagePreview: string | null
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupWithActivity[]>([])
  const [loading, setLoading] = useState(true)

  // Join Modal State
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoining(true)
    try {
      router.push(`/join/${code}`)
      setShowJoinModal(false)
      setJoinCode('')
    } catch {
      toast.error('Invalid invite code')
    }
    setJoining(false)
  }

  const handleCreate = async () => {
    if (!createName.trim()) return
    setCreating(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const groupId = crypto.randomUUID()
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      await supabase.from('profiles').upsert({ id: user.id, name: user.email?.split('@')[0] ?? 'User' }, { onConflict: 'id', ignoreDuplicates: true })

      const { error } = await supabase
        .from('groups')
        .insert({ id: groupId, name: createName.trim(), description: createDesc.trim() || null, created_by: user.id, invite_code: inviteCode })

      if (error) throw error

      await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: user.id, role: 'admin' })

      toast.success('Group created!')
      setShowCreateModal(false)
      setCreateName('')
      setCreateDesc('')
      router.push(`/groups/${groupId}`)
    } catch (error: any) {
      console.log('Create group error:', error)
      toast.error(error.message || error.code || 'Failed to create group')
      setCreating(false)
    }
  }

  useEffect(() => {
    const fetchGroups = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // ── Batch: memberships + most recent message per group ────────────────
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, joined_at, groups(*)')
        .eq('user_id', user.id)

      if (!memberships?.length) { setLoading(false); return }

      const groupIds = memberships.map((m: any) => m.group_id).filter(Boolean) as string[]

      // Fetch latest message per group in one query — ordered DESC, then group client-side
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('group_id, content, type, created_at')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(groupIds.length * 3) // rough cap; deduplicated below

      // Build lastMessage map — first occurrence per group_id wins (newest)
      const lastMsgMap = new Map<string, { preview: string; at: string }>()
      for (const msg of recentMessages ?? []) {
        if (lastMsgMap.has(msg.group_id)) continue
        let preview = ''
        if (msg.type === 'text') preview = msg.content ?? ''
        else if (msg.type === 'expense') preview = '💸 New expense'
        else if (msg.type === 'settlement') preview = '✅ Payment recorded'
        else if (msg.type === 'image') preview = '📷 Photo'
        else if (msg.type === 'receipt_pending') preview = '🧾 Receipt uploaded'
        lastMsgMap.set(msg.group_id, { preview, at: msg.created_at })
      }

      // Assemble enriched groups, sorted by most recent activity
      const enriched: GroupWithActivity[] = (memberships as any[])
        .map((m) => {
          if (!m.groups) return null
          const lastMsg = lastMsgMap.get(m.group_id)
          return {
            ...m.groups,
            lastActivityAt: lastMsg?.at ?? m.joined_at,
            lastMessagePreview: lastMsg?.preview ?? null,
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())

      setGroups(enriched as GroupWithActivity[])
      setLoading(false)

      // ── Realtime Subscription for Feed Activity ────────────────────────────
      const channel = supabase
        .channel('groups-feed-activity')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const msg = payload.new as any
            
            setGroups((prevGroups) => {
              const groupIndex = prevGroups.findIndex((g) => g.id === msg.group_id)
              // If we aren't tracking this group, ignore
              if (groupIndex === -1) return prevGroups

              let preview = ''
              if (msg.type === 'text') preview = msg.content ?? ''
              else if (msg.type === 'expense') preview = '💸 New expense'
              else if (msg.type === 'settlement') preview = '✅ Payment recorded'
              else if (msg.type === 'image') preview = '📷 Photo'
              else if (msg.type === 'receipt_pending') preview = '🧾 Receipt uploaded'

              const newGroups = [...prevGroups]
              newGroups[groupIndex] = {
                ...newGroups[groupIndex],
                lastActivityAt: msg.created_at,
                lastMessagePreview: preview,
              }

              // Re-sort by lastActivityAt DESC
              return newGroups.sort(
                (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
              )
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    
    let cleanup: (() => void) | undefined
    fetchGroups().then((cleanupFn) => {
      cleanup = cleanupFn
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden">
      <div className="absolute top-[-5%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3 anim-slide-left">
            <Logo size={36} />
            <span className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">GroupTab</span>
          </div>
          <div className="flex items-center gap-2 anim-scale-in">
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-10 h-10 bg-white/80 dark:bg-neutral-800/80 border border-gray-200/50 dark:border-neutral-700/50 rounded-full flex items-center justify-center haptic shadow-sm hover:bg-white dark:hover:bg-neutral-800 transition-all"
            >
              <Hash size={18} className="text-emerald-600 dark:text-emerald-400" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 rounded-full flex items-center justify-center haptic shadow-lg shadow-emerald-500/30 transition-all"
            >
              <Plus size={22} className="text-white drop-shadow-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto scroll-area pb-[calc(5rem+env(safe-area-inset-bottom,0px))] px-4 pt-5 z-10">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-panel p-4 rounded-3xl flex items-center gap-4">
                <div className="skeleton w-14 h-14 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="skeleton h-4 w-1/2 rounded-full" />
                  <div className="skeleton h-3 w-1/3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center anim-fade-up">
            <div className="anim-float w-24 h-24 rounded-3xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6 shadow-inner border border-emerald-200/50 dark:border-emerald-800/50">
              <Logo size={56} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No groups yet</h2>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-8 font-medium max-w-[260px] leading-relaxed">
              Create a group to start tracking shared expenses with friends.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl text-[15px] font-bold haptic shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {groups.map((group, idx) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="anim-fade-up block glass-panel p-4 rounded-3xl hover:bg-white/90 dark:hover:bg-neutral-800/90 active:scale-[0.98] transition-all duration-200 hover:shadow-lg"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="shadow-sm rounded-full bg-white dark:bg-neutral-800 p-0.5 flex-shrink-0">
                    <Avatar name={group.name} imageUrl={group.avatar_url} size="lg" />
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-gray-900 dark:text-white text-[16px] truncate tracking-tight">
                        {group.name}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400/80 dark:text-gray-500 ml-2 flex-shrink-0">
                        {formatDate(group.lastActivityAt)}
                      </span>
                    </div>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400 truncate font-medium">
                      {group.lastMessagePreview ?? group.description ?? <span className="italic">No messages yet</span>}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Join by Code Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-[calc(2rem+env(safe-area-inset-bottom,0px))] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJoinModal(false)} />
          <div className="relative w-full max-w-[420px] bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-neutral-800/50 p-6 space-y-4 anim-slide-up">
            <div className="absolute top-[-20%] left-[-5%] w-[140px] h-[140px] bg-emerald-400/15 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Hash size={20} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-[18px] font-black text-gray-900 dark:text-white">Join a group</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400">Enter the invite code shared by your friend</p>
              </div>
            </div>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. ABC123"
              maxLength={10}
              autoFocus
              className="w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-[20px] font-black tracking-[0.3em] text-center uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowJoinModal(false)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-[15px] font-bold text-gray-700 dark:text-gray-300 haptic">Cancel</button>
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold haptic shadow-sm shadow-emerald-500/20 disabled:opacity-50 transition-colors"
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-[calc(2rem+env(safe-area-inset-bottom,0px))] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-[420px] bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-neutral-800/50 p-6 space-y-4 anim-slide-up">
            <div className="absolute top-[-20%] left-[-5%] w-[140px] h-[140px] bg-teal-400/15 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                <Users size={20} className="text-teal-500" />
              </div>
              <div>
                <h3 className="text-[18px] font-black text-gray-900 dark:text-white">Create a group</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400">Start tracking shared expenses</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Group name (e.g. Weekend Trip)"
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <input
                type="text"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Description (optional)"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-[15px] font-bold text-gray-700 dark:text-gray-300 haptic">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white text-[15px] font-bold haptic shadow-sm shadow-teal-500/20 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
