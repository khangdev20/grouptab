'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OCRItem, Profile } from '@/lib/types'
import ItemCard from '@/components/receipt/ItemCard'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import Link from 'next/link'

interface ItemState extends OCRItem {
  excluded: boolean
  assignedTo: string[]
}

export default function ReceiptReviewPage() {
  const { groupId, receiptId } = useParams() as { groupId: string; receiptId: string }
  const router = useRouter()
  const [receipt, setReceipt] = useState<any>(null)
  const [items, setItems] = useState<ItemState[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [paidBy, setPaidBy] = useState<string>('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showImage, setShowImage] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      setPaidBy(user.id)

      const [{ data: rec }, { data: mems }] = await Promise.all([
        supabase.from('receipts').select('*').eq('id', receiptId).single(),
        supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId),
      ])

      if (rec) {
        setReceipt(rec)
        setDescription(rec.merchant_name || 'Receipt expense')
        const ocrItems: OCRItem[] = rec.ocr_data?.items ?? []
        const allMemberIds = (mems ?? []).map((m: any) => m.user_id)
        setItems(
          ocrItems.map((item) => ({
            ...item,
            excluded: false,
            assignedTo: allMemberIds,
          }))
        )
      }

      if (mems) {
        const profiles = mems.map((m: any) => m.profiles).filter(Boolean) as Profile[]
        setMembers(profiles)
      }

      setLoading(false)
    }
    init()
  }, [groupId, receiptId])

  const toggleExclude = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, excluded: !item.excluded } : item
      )
    )
  }

  const updateAssignment = (idx: number, ids: string[]) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, assignedTo: ids } : item))
    )
  }

  const includedItems = items.filter((i) => !i.excluded)
  const totalAmount = includedItems.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0)

  const handleConfirm = async () => {
    if (!currentUserId || !paidBy) return
    if (includedItems.length === 0) {
      toast.error('No items included')
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    try {
      // Create expense
      const { data: expense, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: paidBy,
          description,
          total_amount: totalAmount,
          receipt_id: receiptId,
          split_type: 'custom',
          category,
        })
        .select()
        .single()

      if (expErr) throw expErr

      // Create receipt items + assignments
      for (const item of includedItems) {
        const { data: ri } = await supabase
          .from('receipt_items')
          .insert({
            receipt_id: receiptId,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            total_price: item.price * (item.quantity || 1),
          })
          .select()
          .single()

        if (ri && item.assignedTo.length > 0) {
          const sharePerPerson = (item.price * (item.quantity || 1)) / item.assignedTo.length
          await supabase.from('receipt_item_assignments').insert(
            item.assignedTo.map((uid) => ({
              receipt_item_id: ri.id,
              user_id: uid,
              amount: sharePerPerson,
            }))
          )
        }
      }

      // Create expense shares per person
      const shareMap: Record<string, number> = {}
      for (const item of includedItems) {
        const perPerson = (item.price * (item.quantity || 1)) / (item.assignedTo.length || 1)
        for (const uid of item.assignedTo) {
          shareMap[uid] = (shareMap[uid] || 0) + perPerson
        }
      }

      await supabase.from('expense_shares').insert(
        Object.entries(shareMap).map(([uid, amount]) => ({
          expense_id: expense.id,
          user_id: uid,
          amount,
        }))
      )

      // Update receipt status
      await supabase.from('receipts').update({ status: 'confirmed' }).eq('id', receiptId)

      // Get paid by name
      const paidByProfile = members.find((m) => m.id === paidBy)
      const paidByName = paidByProfile?.name ?? 'Unknown'

      // Post expense message
      await supabase.from('messages').insert({
        group_id: groupId,
        sender_id: currentUserId,
        type: 'expense',
        content: `${description} — ${formatCurrency(totalAmount)}`,
        metadata: {
          expense_id: expense.id,
          amount: totalAmount,
          description,
          paid_by: paidBy,
          paid_by_name: paidByName,
        },
      })

      toast.success('Expense added!')
      router.push(`/groups/${groupId}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
        <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>

        <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
          <div className="flex items-center gap-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse" />
            <div>
              <div className="h-5 w-32 bg-gray-200/60 dark:bg-neutral-800/60 rounded animate-pulse mb-1.5" />
              <div className="h-3 w-20 bg-gray-200/60 dark:bg-neutral-800/60 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex-1 px-5 pt-5 space-y-6 z-10 w-full">
          <div className="glass-panel rounded-3xl p-5 space-y-5 animate-pulse">
            <div className="h-10 w-full bg-gray-200/50 dark:bg-neutral-800/50 rounded-2xl" />
            <div className="h-10 w-full bg-gray-200/50 dark:bg-neutral-800/50 rounded-2xl" />
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-gray-200/50 dark:bg-neutral-800/50 rounded-xl" />
              <div className="h-8 w-20 bg-gray-200/50 dark:bg-neutral-800/50 rounded-xl" />
            </div>
          </div>
          <div>
            <div className="h-3.5 w-16 bg-gray-200/60 dark:bg-neutral-800/60 rounded mb-3 animate-pulse ml-1" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-panel rounded-3xl h-[84px] bg-gray-200/50 dark:bg-neutral-800/50 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-neutral-950 relative overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-20%] w-[400px] h-[400px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[300px] h-[300px] bg-teal-400/10 dark:bg-teal-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-neutral-800/50 px-5 pt-safe shadow-sm">
        <div className="flex items-center gap-4 py-3.5">
          <Link
            href={`/groups/${groupId}`}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic transition-colors"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">Review Receipt</h1>
            <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">
              {receipt?.merchant_name ?? 'Receipt'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area pb-[calc(7rem+env(safe-area-inset-bottom,0px))] z-10 px-5 pt-5 space-y-6">

        {/* Receipt image toggle */}
        {receipt?.image_url && (
          <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowImage(!showImage)}
              className="w-full flex items-center justify-between px-5 py-4 text-[15px] font-bold text-gray-700 dark:text-gray-300 haptic hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Receipt size={16} className="text-emerald-500" />
                </div>
                <span>View scanned image</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                {showImage ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {showImage && (
              <div className="p-4 pt-0 border-t border-gray-100/50 dark:border-neutral-800/50 mt-2">
                <img
                  src={receipt.image_url}
                  alt="Receipt"
                  className="w-full max-h-72 object-cover rounded-2xl shadow-inner bg-gray-100 dark:bg-neutral-900"
                />
              </div>
            )}
          </div>
        )}

        {/* Details Group */}
        <div className="glass-panel rounded-3xl p-5 space-y-5 shadow-sm">
          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ml-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-[15px] font-medium focus:ring-2 focus:ring-emerald-500 shadow-inner outline-none transition-all"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ml-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white text-[15px] font-medium focus:ring-2 focus:ring-emerald-500 shadow-inner outline-none transition-all appearance-none"
            >
              <option value="food_drink">Food & Drink</option>
              <option value="transport">Transport</option>
              <option value="shopping">Shopping</option>
              <option value="entertainment">Entertainment</option>
              <option value="bills">Bills</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Paid by */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block ml-1">
              Paid by
            </label>
            <div className="flex flex-wrap gap-2">
              {[...members].sort((mA, mB) => (mA.id === currentUserId ? -1 : mB.id === currentUserId ? 1 : 0)).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaidBy(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold haptic transition-all shadow-sm ${paidBy === m.id
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-[1.02]'
                    : 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700/50'
                    }`}
                >
                  <Avatar name={m.name} size="sm" className="!w-5 !h-5 !text-[10px] shadow-sm" />
                  {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3 ml-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Items
            </label>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">
              {includedItems.length} of {items.length} included
            </span>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <ItemCard
                key={idx}
                item={item}
                members={members}
                currentUserId={currentUserId ?? ''}
                onToggleExclude={() => toggleExclude(idx)}
                onAssignChange={(ids) => updateAssignment(idx, ids)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom confirm bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl border-t border-gray-200/50 dark:border-neutral-800/50 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Amount</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{formatCurrency(totalAmount)}</span>
        </div>
        <button
          onClick={handleConfirm}
          disabled={submitting || includedItems.length === 0}
          className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:dark:bg-emerald-900/50 disabled:text-white/50 text-white font-bold rounded-2xl transition-all haptic flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] text-[15px]"
        >
          {submitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Saving Expense...</span>
            </div>
          ) : (
            <>
              <Check size={20} />
              <span>Confirm & Split Expense</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
