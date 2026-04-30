'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

type ExpenseData = {
  amount: number
  expenses: {
    category: string
    created_at: string
  }
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [data, setData] = useState<ExpenseData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all expense shares for the current user for the current year
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()

      const { data: shares, error } = await supabase
        .from('expense_shares')
        .select('amount, expenses!inner(category, created_at)')
        .eq('user_id', user.id)
        .gte('expenses.created_at', startOfYear)

      if (!error && shares) {
        setData(shares as unknown as ExpenseData[])
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  const filteredData = useMemo(() => {
    const now = new Date()
    let startDate = new Date()

    if (period === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      startDate = new Date(now.setDate(diff))
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    return data.filter(item => new Date(item.expenses.created_at) >= startDate)
  }, [data, period])

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      food_drink: 0,
      transport: 0,
      shopping: 0,
      entertainment: 0,
      bills: 0,
      other: 0
    }

    filteredData.forEach(item => {
      const cat = item.expenses.category || 'other'
      if (totals[cat] !== undefined) {
        totals[cat] += item.amount
      } else {
        totals['other'] += item.amount
      }
    })

    return totals
  }, [filteredData])

  const categories = [
    { id: 'food_drink', label: 'Food & Drink', icon: '🍔', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
    { id: 'transport', label: 'Transport', icon: '🚕', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
    { id: 'shopping', label: 'Shopping', icon: '🛒', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎟️', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' },
    { id: 'bills', label: 'Bills', icon: '💡', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' },
    { id: 'other', label: 'Other', icon: '📦', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600' }
  ]

  const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="absolute top-[-5%] left-[-10%] w-[350px] h-[350px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="flex items-center justify-between py-3.5">
          <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Statistics</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 z-10">
        <div className="flex bg-gray-200/50 dark:bg-neutral-800/50 p-1 rounded-xl mb-6">
          <button
            onClick={() => setPeriod('week')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === 'week' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === 'month' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === 'year' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            This Year
          </button>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl mb-6 flex flex-col items-center justify-center min-h-[160px]">
          {loading ? (
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Total Spent</p>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{formatCurrency(totalSpent)}</h2>
            </>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">By Category</h2>
        <div className="space-y-3">
          {categories.map(cat => {
            const amount = categoryTotals[cat.id] || 0
            const percentage = totalSpent > 0 ? (amount / totalSpent) * 100 : 0
            
            return (
              <div key={cat.id} className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${cat.color}`}>
                      {cat.icon}
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{cat.label}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(amount)}</span>
                    <span className="text-xs font-medium text-gray-400">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

