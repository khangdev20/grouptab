'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      // User must be a member to see any page under this group
      const { data } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        router.replace('/')
        return
      }

      setReady(true)
    }

    check()
  }, [groupId, router])

  if (!ready) return null

  return <>{children}</>
}
