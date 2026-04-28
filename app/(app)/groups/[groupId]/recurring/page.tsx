'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RecurringPayment, RecurringFrequency, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Bell, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function frequencyLabel(r: RecurringPayment): string {
  const cfg = r.frequency_config
  switch (r.frequency) {
    case 'daily': return 'Every day'
    case 'weekly': {
      const days = (cfg.days_of_week ?? []).map((d) => DAYS_OF_WEEK[d]).join(', ')
      return days ? `Weekly on ${days}` : 'Weekly'
    }
    case 'fortnightly': {
      const days = (cfg.days_of_week ?? []).map((d) => DAYS_OF_WEEK[d]).join(', ')
      return days ? `Fortnightly on ${days}` : 'Fortnightly'
    }
    case 'monthly':
      return cfg.day_of_month ? `Monthly on the ${cfg.day_of_month}${ordinal(cfg.day_of_month)}` : 'Monthly'
    case 'quarterly':
      return cfg.day_of_month ? `Quarterly on the ${cfg.day_of_month}${ordinal(cfg.day_of_month)}` : 'Quarterly'
    case 'yearly':
      return 'Yearly'
    default:
      return r.frequency
  }
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function nextDueLabel(dateStr: string | null): string {
  if (!dateStr) return ''
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  return `Due in ${diff}d`
}

export default function RecurringPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [payments, setPayments] = useState<RecurringPayment[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [nextDue, setNextDue] = useState('')
  const [payerId, setPayerId] = useState('')
  const [involvedIds, setInvolvedIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      setPayerId(user.id)

      const [{ data: recs }, { data: mems }] = await Promise.all([
        supabase.from('recurring_payments').select('*').eq('group_id', groupId).eq('active', true).order('next_due_date', { ascending: true }),
        supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId),
      ])

      if (recs) setPayments(recs)
      if (mems) {
        const profiles = mems.map((m: any) => m.profiles).filter(Boolean)
        setMembers(profiles)
        setInvolvedIds(profiles.map((p: Profile) => p.id))
      }
      setLoading(false)
    }
    init()
  }, [groupId])

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const toggleInvolved = (id: string) => {
    setInvolvedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!title.trim() || !amount || !currentUserId) return
    setSaving(true)
    const supabase = createClient()

    const cfg: RecurringPayment['frequency_config'] = {}
    if (frequency === 'weekly' || frequency === 'fortnightly') cfg.days_of_week = selectedDays
    if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') cfg.day_of_month = dayOfMonth

    const { error } = await supabase.from('recurring_payments').insert({
      group_id: groupId,
      created_by: currentUserId,
      title: title.trim(),
      amount: parseFloat(amount),
      frequency,
      frequency_config: cfg,
      next_due_date: nextDue || null,
      payer_id: payerId || null,
      involved_members: involvedIds,
      notes: notes.trim() || null,
      active: true,
    })

    if (error) {
      toast.error('Failed to save')
      setSaving(false)
      return
    }

    toast.success('Recurring payment added!')
    setTitle(''); setAmount(''); setNotes(''); setShowForm(false)
    // Reload
    const { data: recs } = await supabase.from('recurring_payments').select('*').eq('group_id', groupId).eq('active', true).order('next_due_date', { ascending: true })
    if (recs) setPayments(recs)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('recurring_payments').update({ active: false }).eq('id', id)
    setPayments((prev) => prev.filter((p) => p.id !== id))
    toast.success('Removed')
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link href={`/groups/${groupId}`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Recurring</h1>
          </div>
          <button onClick={() => setShowForm(true)} className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center haptic">
            <Plus size={18} className="text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-4 py-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCw size={28} className="text-emerald-500" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">No recurring payments</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Set up reminders for regular shared costs like rent, subscriptions, or bills.</p>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-emerald-500 text-white rounded-full text-sm font-semibold haptic">
              Add first reminder
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((r) => {
              const payer = members.find((m) => m.id === r.payer_id)
              const dueLabel = nextDueLabel(r.next_due_date)
              const isOverdue = r.next_due_date && new Date(r.next_due_date) < new Date()
              return (
                <div key={r.id} className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                    <Bell size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{r.title}</p>
                      <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 haptic flex-shrink-0 mt-0.5">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(r.amount)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{frequencyLabel(r)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {dueLabel && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {dueLabel}
                        </span>
                      )}
                      {payer && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Paid by {payer.id === currentUserId ? 'you' : payer.name}
                        </span>
                      )}
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mt-4 bg-white dark:bg-neutral-900 rounded-2xl p-4 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white">New Recurring Payment</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Netflix, Rent, Electricity..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Amount (AUD)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Frequency</label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button key={f.value} onClick={() => setFrequency(f.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border haptic transition-colors ${frequency === f.value ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {(frequency === 'weekly' || frequency === 'fortnightly') && (
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Day(s) of week</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)} className={`w-10 h-10 rounded-full text-xs font-semibold haptic transition-colors ${selectedDays.includes(i) ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') && (
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Day of month</label>
                <input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)} min="1" max="31" className="w-24 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Next due date</label>
              <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Paid by</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} onClick={() => setPayerId(m.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium haptic ${payerId === m.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400'}`}>
                    {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Split between</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} onClick={() => toggleInvolved(m.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium haptic ${involvedIds.includes(m.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400'}`}>
                    {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Notes (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-white" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-600 dark:text-gray-400 haptic">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !title.trim() || !amount} className="flex-1 py-2.5 rounded-xl bg-emerald-500 disabled:bg-emerald-300 text-white text-sm font-semibold haptic">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
