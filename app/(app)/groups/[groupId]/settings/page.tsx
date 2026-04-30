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
      <div className="flex flex-col min-h-full bg-gray-50 dark:bg-neutral-950">
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
          <div className="flex items-center gap-3 py-4">
            <div className="w-9 h-9 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
            <div className="h-5 w-32 bg-gray-200/60 dark:bg-neutral-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 px-4 py-5 space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex flex-col items-center text-center animate-pulse">
            <div className="w-20 h-20 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 mb-3" />
            <div className="h-5 w-32 bg-gray-200/60 dark:bg-neutral-800/60 rounded" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl h-[72px] animate-pulse bg-gray-200/40 dark:bg-neutral-800/40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-neutral-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <Link href={`/groups/${groupId}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Group Settings</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        {group && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex flex-col items-center text-center relative">
            <div className="relative mb-4 group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
              <Avatar name={group.name} imageUrl={group.avatar_url} size="xl" className="transition-opacity group-hover:opacity-80 shadow-lg w-20 h-20 text-3xl" />
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
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-neutral-800">
                <Camera size={12} className="text-white" />
              </div>
            </div>

            {isEditing ? (
              <div className="w-full space-y-3 mt-2">
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Group Name"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-center text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                    autoFocus
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-center text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  />
                </div>
                <div className="flex gap-2 justify-center pt-1">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditName(group.name)
                      setEditDesc(group.description || '')
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 text-sm font-semibold haptic flex items-center gap-1.5"
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button
                    onClick={handleSaveDetails}
                    disabled={savingDetails || !editName.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold haptic disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                  >
                    <Check size={16} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{group.name}</h2>
                  <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-emerald-500 transition-colors haptic bg-gray-100 dark:bg-neutral-800 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                    <Edit2 size={12} />
                  </button>
                </div>
                {group.description && <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>}
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <button onClick={copyInviteLink} className="w-full flex items-center gap-3 px-4 py-4 haptic">
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <UserPlus size={16} className="text-emerald-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Invite members</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Code: {group?.invite_code}</p>
            </div>
            <Copy size={16} className="text-gray-400" />
          </button>
        </div>

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

        {/* Notifications toggle */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden">
          <button onClick={togglePush} disabled={pushLoading || permission === 'denied'} className="w-full flex items-center gap-3 px-4 py-4 haptic disabled:opacity-50">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${subscribed ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-100 dark:bg-neutral-800'}`}>
              {subscribed
                ? <Bell size={16} className="text-emerald-500" />
                : <BellOff size={16} className="text-gray-400" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {pushLoading ? 'Updating…' : subscribed ? 'Notifications on' : 'Notifications off'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {permission === 'denied'
                  ? 'Blocked in browser settings'
                  : 'Expenses, mentions & reminders'}
              </p>
            </div>
            {/* Toggle pill */}
            <div className={`w-11 h-6 rounded-full transition-colors ${subscribed ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-neutral-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${subscribed ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">Members ({members.length})</p>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
            {members.map(({ profile, role }) => (
              <div key={profile.id} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={profile.name} imageUrl={profile.avatar_url} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.id === currentUserId ? 'You' : profile.name}</p>
                </div>
                {role === 'admin' && <span className="text-xs text-emerald-500 font-semibold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Admin</span>}
              </div>
            ))}
          </div>
        </div>

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
