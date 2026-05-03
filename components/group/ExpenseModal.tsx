import { X, Clock } from 'lucide-react'
import { Profile } from '@/lib/types'
import { ExpenseMeta } from '@/components/feed/ExpenseBubble'

interface ExpenseModalProps {
  open: boolean
  onClose: () => void
  isEditing: boolean
  // form fields
  desc: string; setDesc: (v: string) => void
  category: string; setCategory: (v: string) => void
  amount: string; setAmount: (v: string) => void
  paidBy: string; setPaidBy: (v: string) => void
  involvedMembers: string[]; setInvolvedMembers: React.Dispatch<React.SetStateAction<string[]>>
  profiles: Record<string, Profile>
  currentUserId: string | null
  saving: boolean
  onSubmit: () => void
  pendingCount?: number
}

const CATEGORIES = [
  { value: 'food_drink', label: 'Food & Drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'bills', label: 'Bills' },
  { value: 'other', label: 'Other' },
]

export default function ExpenseModal({
  open, onClose, isEditing,
  desc, setDesc, category, setCategory, amount, setAmount,
  paidBy, setPaidBy, involvedMembers, setInvolvedMembers,
  profiles, currentUserId, saving, onSubmit, pendingCount = 0,
}: ExpenseModalProps) {
  if (!open) return null

  const sortedEntries = Object.entries(profiles).sort(([a], [b]) =>
    a === currentUserId ? -1 : b === currentUserId ? 1 : 0
  )

  const splitPerPerson = involvedMembers.length > 0 && amount && !isNaN(parseFloat(amount))
    ? parseFloat(amount) / involvedMembers.length
    : null

  return (
    <div
      className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl anim-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center haptic hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Pending settlement warning */}
          {!isEditing && pendingCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40">
              <Clock size={13} className="text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                <span className="font-bold">{pendingCount} payment{pendingCount !== 1 ? 's' : ''} awaiting confirmation.</span>
                {' '}Adding this expense will change pending debt amounts.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Description</label>
            <input
              type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Dinner, groceries, etc."
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Category</label>
            <select
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Paid by */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Paid by</label>
            <div className="flex gap-2 flex-wrap">
              {sortedEntries.map(([uid, profile]) => (
                <button key={uid} onClick={() => setPaidBy(uid)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors haptic ${paidBy === uid ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                >
                  {uid === currentUserId ? 'You' : profile.name}
                </button>
              ))}
            </div>
          </div>

          {/* Split between */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Split between</label>
            <div className="flex gap-2 flex-wrap">
              {sortedEntries.map(([uid, profile]) => {
                const isSelected = involvedMembers.includes(uid)
                return (
                  <button key={`split-${uid}`}
                    onClick={() => {
                      if (isSelected) {
                        if (involvedMembers.length > 1) setInvolvedMembers(prev => prev.filter(id => id !== uid))
                      } else {
                        setInvolvedMembers(prev => [...prev, uid])
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors haptic flex items-center gap-1.5 border border-transparent ${isSelected ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' : 'bg-gray-50 dark:bg-neutral-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    {uid === currentUserId ? 'You' : profile.name}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium text-center bg-gray-50 dark:bg-neutral-800/50 rounded-lg py-2">
            Split equally among <span className="font-bold text-gray-600 dark:text-gray-300">{involvedMembers.length} member{involvedMembers.length !== 1 ? 's' : ''}</span>
            {splitPerPerson != null && ` ($${splitPerPerson.toFixed(2)} / each)`}
          </p>

          <button
            onClick={onSubmit}
            disabled={saving || !desc.trim() || !amount || !paidBy}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic mt-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : isEditing ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
