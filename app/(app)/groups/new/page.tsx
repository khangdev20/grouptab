'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const groupId = crypto.randomUUID()
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    await supabase.from('profiles').upsert({ id: user.id, name: user.email?.split('@')[0] ?? 'User' }, { onConflict: 'id', ignoreDuplicates: true })

    const { error } = await supabase
      .from('groups')
      .insert({ id: groupId, name: name.trim(), description: description.trim() || null, created_by: user.id, invite_code: inviteCode })

    if (error) {
      console.log('Create group error:', JSON.stringify(error))
      toast.error(error.message || error.code || 'Failed to create group', { duration: 6000 })
      setLoading(false)
      return
    }

    await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: user.id, role: 'admin' })

    toast.success('Group created!')
    router.push(`/groups/${groupId}`)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[60px] pointer-events-none z-0"></div>

      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-4 pt-safe shadow-sm">
        <div className="flex items-center gap-3 py-3.5">
          <Link href="/groups" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-neutral-800/50 haptic transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">New Group</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-4 py-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] z-10">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <div>
              <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ml-1">
                Group name <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                placeholder="Weekend trip, Roommates..."
                required
              />
            </div>

            <div>
              <label className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ml-1">
                Description <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                placeholder="What's this group for?"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 dark:disabled:bg-emerald-800/50 disabled:text-white/50 text-white font-bold text-[15px] rounded-2xl transition-colors haptic shadow-sm shadow-emerald-500/20"
          >
            {loading ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}
