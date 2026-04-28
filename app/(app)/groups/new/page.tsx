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
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <Link href="/groups" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">New Group</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-4 py-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Group name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="Weekend trip, Roommates..."
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="What's this group for?"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors haptic"
          >
            {loading ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}
