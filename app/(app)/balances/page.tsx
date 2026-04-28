'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface GroupBalance {
  group: { id: string; name: string }
  netBalance: number
}

export default function BalancesPage() {
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [totalOwed, setTotalOwed] = useState(0)
  const [totalOwe, setTotalOwe] = useState(0)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all groups user is in
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user.id)

      if (!memberships) return

      const results: GroupBalance[] = []

      for (const mem of memberships as any[]) {
        const group = mem.groups
        if (!group) continue

        // Get expense shares and settlements for this group
        const [{ data: shares }, { data: settlements }] = await Promise.all([
          supabase
            .from('expense_shares')
            .select('*, expenses!inner(group_id, paid_by, total_amount)')
            .eq('expenses.group_id', group.id),
          supabase
            .from('settlements')
            .select('*')
            .eq('group_id', group.id)
            .eq('status', 'completed'),
        ])

        // Simple net calc: what I paid - what I owe
        let net = 0
        for (const share of shares ?? []) {
          const exp = (share as any).expenses
          if (!exp) continue
          if (exp.paid_by === user.id) {
            // I paid: others owe me their share
            net += share.amount
          }
          if (share.user_id === user.id) {
            // My share
            net -= share.amount
          }
        }
        for (const s of settlements ?? []) {
          if (s.from_user === user.id) net += s.amount
          if (s.to_user === user.id) net -= s.amount
        }

        if (Math.abs(net) > 0.01) {
          results.push({ group, netBalance: net })
        }
      }

      setGroupBalances(results)
      setTotalOwed(results.filter((r) => r.netBalance > 0).reduce((s, r) => s + r.netBalance, 0))
      setTotalOwe(results.filter((r) => r.netBalance < 0).reduce((s, r) => s + Math.abs(r.netBalance), 0))
      setLoading(false)
    }
    init()
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Balances</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 px-4 pt-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4">
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">You're owed</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalOwed)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
              <p className="text-xs text-red-500 font-semibold mb-1">You owe</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(totalOwe)}</p>
            </div>
          </div>

          {/* Per-group */}
          {groupBalances.length > 0 ? (
            <div className="px-4 mt-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                By group
              </p>
              <div className="space-y-2">
                {groupBalances.map(({ group, netBalance }) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}/balances`}
                    className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800 rounded-2xl px-4 py-3.5 haptic"
                  >
                    <Avatar name={group.name} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{group.name}</p>
                      <p className={`text-xs font-medium mt-0.5 ${netBalance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netBalance > 0 ? `Owed ${formatCurrency(netBalance)}` : `Owes ${formatCurrency(Math.abs(netBalance))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`font-bold text-base ${netBalance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netBalance > 0 ? '+' : '-'}{formatCurrency(Math.abs(netBalance))}
                      </span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <span className="text-4xl mb-3">✅</span>
              <p className="font-semibold text-gray-900 dark:text-white">All settled!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                No outstanding balances across any groups.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
