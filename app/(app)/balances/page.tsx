'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import { ChevronRight, HandCoins, ArrowRightLeft, CheckCircle2 } from 'lucide-react'

interface GroupBalance {
  group: { id: string; name: string; avatar_url?: string | null }
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
        .select('group_id, groups(id, name, avatar_url)')
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
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Background glowing effects */}
      <div className="absolute top-[-5%] left-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[250px] h-[250px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="py-3.5">
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Balances</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 px-5 pt-5 space-y-6 z-10 w-full">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-[104px] glass-panel bg-gray-200/50 dark:bg-neutral-800/50 rounded-3xl animate-pulse" />
            <div className="h-[104px] glass-panel bg-gray-200/50 dark:bg-neutral-800/50 rounded-3xl animate-pulse" />
          </div>
          <div className="space-y-3 mt-8 pt-2">
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-neutral-800 rounded-md animate-pulse mb-4 ml-1" />
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[76px] glass-panel bg-gray-200/50 dark:bg-neutral-800/50 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-area z-10">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 px-5 pt-5">
            <div className="glass-panel p-5 rounded-3xl relative overflow-hidden">
              <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1.5 relative z-10">You're owed</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight relative z-10">{formatCurrency(totalOwed)}</p>
            </div>
            <div className="glass-panel p-5 rounded-3xl relative overflow-hidden">
              <p className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-widest mb-1.5 relative z-10">You owe</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight relative z-10">{formatCurrency(totalOwe)}</p>
            </div>
          </div>

          {/* Per-group */}
          {groupBalances.length > 0 ? (
            <div className="px-5 mt-6 mb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 ml-1">
                By Group
              </p>
              <div className="space-y-3">
                {groupBalances.map(({ group, netBalance }) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}/balances`}
                    className="flex items-center gap-4 glass-panel p-4 rounded-3xl haptic hover:scale-[0.98] transition-transform active:scale-95"
                  >
                    <Avatar name={group.name} imageUrl={group.avatar_url} size="md" className="shadow-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">{group.name}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${netBalance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netBalance > 0 ? `You are owed ${formatCurrency(netBalance)}` : `You owe ${formatCurrency(Math.abs(netBalance))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-black text-lg ${netBalance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netBalance > 0 ? '+' : '-'}{formatCurrency(Math.abs(netBalance))}
                      </span>
                      <ChevronRight size={18} className="text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 mt-4">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">All settled up!</h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 max-w-[250px]">
                You have no outstanding balances in any of your groups.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
