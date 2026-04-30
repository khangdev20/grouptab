'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { LogOut, Moon, Sun, Bell, Edit2, Camera, Check, ChevronRight, Wallet, Coffee, Copy } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSupportModal, setShowSupportModal] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setEditName(data.name)
      }
      setLoading(false)
    }
    init()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleNameSave = async () => {
    if (!profile || !editName.trim() || editName.trim() === profile.name) {
      setIsEditing(false)
      return
    }
    setSavingName(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ name: editName.trim() })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to update name')
    } else {
      setProfile({ ...profile, name: editName.trim() })
      toast.success('Name updated')
      setIsEditing(false)
    }
    setSavingName(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)
    const toastId = toast.loading('Uploading avatar...')
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `avatars/${profile.id}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: publicUrl })
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
        <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>

        <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
          <div className="py-3.5">
            <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Profile</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 z-10">
          {/* Profile card skeleton */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col items-center text-center shadow-md animate-pulse">
            <div className="w-20 h-20 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 mb-4" />
            <div className="h-6 w-32 bg-gray-200/60 dark:bg-neutral-800/60 rounded mb-2" />
            <div className="h-4 w-48 bg-gray-200/60 dark:bg-neutral-800/60 rounded" />
          </div>

          <div className="space-y-3">
            <div className="h-3 w-16 bg-gray-200 dark:bg-neutral-800 rounded ml-1 animate-pulse" />
            <div className="glass-panel rounded-3xl h-[76px] animate-pulse bg-gray-200/50 dark:bg-neutral-800/50" />
          </div>
          
          <div className="glass-panel rounded-3xl h-[76px] animate-pulse bg-gray-200/50 dark:bg-neutral-800/50" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="py-3.5">
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-5 py-6 flex flex-col gap-6 z-10">
        {/* Profile card */}
        {profile && (
          <div className="glass-panel rounded-3xl p-6 flex flex-col items-center text-center relative shadow-md">
            <div className="relative mb-4 group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
              <Avatar name={profile.name} imageUrl={profile.avatar_url} size="xl" className="transition-opacity group-hover:opacity-80 shadow-lg w-20 h-20 text-3xl" />
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
              <div className="flex items-center gap-2 mt-2 w-full max-w-[280px]">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-center text-[17px] font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                />
                <button
                  onClick={handleNameSave}
                  disabled={savingName || !editName.trim()}
                  className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0 haptic shadow-sm shadow-emerald-500/20"
                >
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{profile.name}</h2>
                <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-emerald-500 transition-colors haptic bg-gray-100 dark:bg-neutral-800 w-8 h-8 rounded-full flex items-center justify-center">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 mt-1.5">{profile.email}</p>
          </div>
        )}

        {/* App info */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">App Info</h3>
          <div className="glass-panel rounded-3xl overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <Wallet size={20} className="text-emerald-500" />
                  </div>
                  <span className="text-[15px] font-bold text-gray-900 dark:text-white">GroupTab</span>
                </div>
                <span className="text-sm font-semibold text-gray-400 bg-gray-100 dark:bg-neutral-800 px-3 py-1 rounded-full">v2.0.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div>
          <div className="glass-panel rounded-3xl overflow-hidden">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-4 px-5 py-4 text-red-500 haptic hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shadow-sm">
                <LogOut size={18} className="text-red-500" />
              </div>
              <span className="text-[15px] font-bold">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="mt-auto pt-4">
          <div className="glass-panel rounded-3xl overflow-hidden">
            <button
              onClick={() => setShowSupportModal(true)}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 text-amber-600 dark:text-amber-500 haptic hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors group"
            >
              <Coffee size={20} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-[15px] font-bold">Buy me a coffee</span>
            </button>
          </div>
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div 
          className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-5 backdrop-blur-sm anim-fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowSupportModal(false)}
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl anim-scale-in">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                <Coffee size={28} className="text-amber-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 text-center tracking-tight">Support GroupTab</h3>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 text-center leading-relaxed">
              If you find this app helpful, consider buying me a coffee to support the development!
            </p>
            
            <div className="space-y-3">
              {/* PayPal */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">PayPal</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">lenhutkhangvo@gmail.com</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('lenhutkhangvo@gmail.com')
                      toast.success('PayPal email copied!')
                    }}
                    className="p-2.5 bg-white dark:bg-neutral-700 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-600 shadow-sm transition-all haptic flex-shrink-0"
                  >
                    <Copy size={16} className="text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* PayID */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">PayID</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">0490407665</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('0490407665')
                      toast.success('PayID copied!')
                    }}
                    className="p-2.5 bg-white dark:bg-neutral-700 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-600 shadow-sm transition-all haptic flex-shrink-0"
                  >
                    <Copy size={16} className="text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSupportModal(false)}
              className="w-full mt-6 py-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors haptic"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
