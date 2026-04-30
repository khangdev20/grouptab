'use client'

import { useState } from 'react'

export default function StatisticsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

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
            Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === 'month' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${period === 'year' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Year
          </button>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl mb-6 flex flex-col items-center justify-center min-h-[200px]">
          <p className="text-gray-500 dark:text-gray-400 font-medium text-center">Chart implementation coming soon</p>
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">By Category</h2>
        <div className="space-y-3">
           <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl">🍔</div>
               <span className="font-semibold text-gray-800 dark:text-gray-200">Food & Drink</span>
             </div>
             <span className="font-bold text-gray-900 dark:text-white">$0.00</span>
           </div>
           <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xl">🚕</div>
               <span className="font-semibold text-gray-800 dark:text-gray-200">Transport</span>
             </div>
             <span className="font-bold text-gray-900 dark:text-white">$0.00</span>
           </div>
           <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xl">🛒</div>
               <span className="font-semibold text-gray-800 dark:text-gray-200">Shopping</span>
             </div>
             <span className="font-bold text-gray-900 dark:text-white">$0.00</span>
           </div>
           <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">📦</div>
               <span className="font-semibold text-gray-800 dark:text-gray-200">Other</span>
             </div>
             <span className="font-bold text-gray-900 dark:text-white">$0.00</span>
           </div>
        </div>
      </div>
    </div>
  )
}
