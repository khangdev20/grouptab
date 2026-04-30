'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group, Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, Copy, UserPlus, LogOut, RefreshCw, Bell, BellOff, Edit2, Camera, Check, X } from 'lucide-react'
import Link from 'next/link'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function GroupSettingsPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<{ profile: Profile; role: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { permission, subscribed, subscribe, unsubscribe } = usePushNotifications()
  const [pushLoading, setPushLoading] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      if (grp) {
        setGroup(grp)
        setEditName(grp.name)
        setEditDesc(grp.description || '')
      }
      if (mems) setMembers(mems.map((m: any) => ({ profile: m.profiles, role: m.role })).filter((m: any) => m.profile))
      setLoading(false)
    }
    init()
  }, [groupId])

  const copyInviteLink = () => {
    if (!group?.invite_code) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${group.invite_code}`).then(() => toast.success('Invite link copied!'))
  }

  const handleLeave = async () => {
    if (!currentUserId) return
    const supabase = createClient()
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUserId)
    toast.success('Left group')
    router.push('/groups')
  }

  const togglePush = async () => {
    setPushLoading(true)
    if (subscribed) {
      await unsubscribe()
      toast.success('Notifications disabled')
    } else {
      const ok = await subscribe()
      if (ok) toast.success('Notifications enabled!')
      else if (permission === 'denied') toast.error('Notifications blocked — enable in browser settings')
    }
    setPushLoading(false)
  }

  const handleSaveDetails = async () => {
    if (!group || !editName.trim()) return
    setSavingDetails(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('groups')
      .update({ name: editName.trim(), description: editDesc.trim() })
      .eq('id', group.id)

    if (error) {
      toast.error('Failed to update group details')
    } else {
      setGroup({ ...group, name: editName.trim(), description: editDesc.trim() })
      toast.success('Group updated')
      setIsEditing(false)
    }
    setSavingDetails(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !group) return

    setUploading(true)
    const toastId = toast.loading('Uploading avatar...')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `group_avatars/${group.id}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('groups')
        .update({ avatar_url: publicUrl })
        .eq('id', group.id)

      if (updateError) throw updateError

      setGroup({ ...group, avatar_url: publicUrl })
      toast.success('Avatar updated', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
        <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-4 pt-safe shadow-sm">
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-9 h-9 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
            <div className="h-6 w-40 bg-gray-200/60 dark:bg-neutral-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 z-10">
          <div className="glass-panel rounded-[28px] p-6 flex flex-col items-center text-center animate-pulse">
            <div className="w-24 h-24 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 mb-4" />
            <div className="h-6 w-40 bg-gray-200/60 dark:bg-neutral-800/60 rounded mb-2" />
            <div className="h-4 w-56 bg-gray-200/60 dark:bg-neutral-800/60 rounded" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel rounded-3xl h-[76px] animate-pulse bg-gray-200/40 dark:bg-neutral-800/40" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[60px] pointer-events-none z-0"></div>

      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-4 pt-safe shadow-sm">
        <div className="flex items-center gap-3 py-3.5">
          <Link href={`/groups/${groupId}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors haptic">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Group Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 z-10 scroll-area">
        {/* Profile Card */}
        {group && (
          <div className="glass-panel p-6 rounded-[28px] flex flex-col items-center text-center relative shadow-sm">
            <div className="relative mb-4 group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
              <Avatar name={group.name} imageUrl={group.avatar_url} size="xl" className="transition-opacity group-hover:opacity-80 shadow-lg w-24 h-24 text-4xl" />
              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={28} className="text-white drop-shadow-md" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md border-[3px] border-white dark:border-neutral-800">
                <Camera size={14} className="text-white" />
              </div>
            </div>

            {isEditing ? (
              <div className="w-full space-y-3 mt-2 max-w-[280px]">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Group Name"
                  className="w-full px-4 py-3 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-center text-[17px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  autoFocus
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-center text-[15px] font-medium outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                />
                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditName(group.name)
                      setEditDesc(group.description || '')
                    }}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 font-bold haptic transition-colors hover:bg-gray-200 dark:hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDetails}
                    disabled={savingDetails || !editName.trim()}
                    className="flex-1 py-3 rounded-2xl bg-emerald-500 text-white font-bold haptic disabled:opacity-50 shadow-sm shadow-emerald-500/20 transition-transform"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center gap-2">
                  <h2 className="text-[22px] font-black text-gray-900 dark:text-white tracking-tight">{group.name}</h2>
                  <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-emerald-500 transition-colors haptic bg-gray-100 dark:bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    <Edit2 size={14} />
                  </button>
                </div>
                {group.description && <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>}
              </div>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl overflow-hidden">
            <button onClick={copyInviteLink} className="w-full flex items-center gap-4 px-5 py-4 haptic hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                <UserPlus size={18} className="text-emerald-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white">Invite members</p>
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Code: <span className="font-mono text-emerald-600 dark:text-emerald-400">{group?.invite_code}</span></p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <Copy size={14} className="text-gray-500" />
              </div>
            </button>
          </div>

          <div className="glass-panel rounded-3xl overflow-hidden">
            <Link href={`/groups/${groupId}/recurring`} className="w-full flex items-center gap-4 px-5 py-4 haptic hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw size={18} className="text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white">Recurring payments</p>
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Set reminders for regular costs</p>
              </div>
            </Link>
          </div>

          <div className="glass-panel rounded-3xl overflow-hidden">
            <button onClick={togglePush} disabled={pushLoading || permission === 'denied'} className="w-full flex items-center gap-4 px-5 py-4 haptic disabled:opacity-50 hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${subscribed ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-100 dark:bg-neutral-800'}`}>
                {subscribed
                  ? <Bell size={18} className="text-amber-500" />
                  : <BellOff size={18} className="text-gray-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                  {pushLoading ? 'Updating…' : subscribed ? 'Notifications on' : 'Notifications off'}
                </p>
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  {permission === 'denied'
                    ? 'Blocked in browser settings'
                    : 'Expenses, mentions & reminders'}
                </p>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 flex-shrink-0 ${subscribed ? 'bg-amber-500' : 'bg-gray-200 dark:bg-neutral-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${subscribed ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Members */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">Members ({members.length})</h3>
          <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-gray-100/50 dark:divide-neutral-800/50">
            {members.map(({ profile, role }) => (
              <div key={profile.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar name={profile.name} imageUrl={profile.avatar_url} size="md" />
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">{profile.id === currentUserId ? 'You' : profile.name}</p>
                </div>
                {role === 'admin' && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">Admin</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Leave */}
        <div className="pt-2">
          <div className="glass-panel rounded-3xl overflow-hidden">
            <button onClick={handleLeave} className="w-full flex items-center gap-4 px-5 py-4 text-red-500 haptic hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <LogOut size={18} className="text-red-500" />
              </div>
              <span className="text-[15px] font-bold">Leave group</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
