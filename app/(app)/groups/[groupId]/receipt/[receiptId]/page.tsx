'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OCRItem, Profile } from '@/lib/types'
import ItemCard from '@/components/receipt/ItemCard'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, Check, ChevronDown, ChevronUp } from 'lucide-react'
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
      <div className="flex items-center justify-center h-dvh">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <Link
            href={`/groups/${groupId}`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Review Receipt</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {receipt?.merchant_name ?? 'Receipt'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        {/* Receipt image toggle */}
        {receipt?.image_url && (
          <div className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800">
            <button
              onClick={() => setShowImage(!showImage)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-400 haptic"
            >
              <span>View receipt image</span>
              {showImage ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showImage && (
              <img
                src={receipt.image_url}
                alt="Receipt"
                className="w-full max-h-64 object-contain bg-gray-100 dark:bg-neutral-800"
              />
            )}
          </div>
        )}

        {/* Description */}
        <div className="mx-4 mt-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Paid by */}
        <div className="mx-4 mt-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
            Paid by
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setPaidBy(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium haptic transition-colors ${
                  paidBy === m.id
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Avatar name={m.name} size="sm" className="!w-5 !h-5 !text-[10px]" />
                {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mx-4 mt-4">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
            Items ({includedItems.length} of {items.length} included)
          </label>
          <div className="space-y-2">
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
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 px-4 py-3 pb-safe">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</span>
        </div>
        <button
          onClick={handleConfirm}
          disabled={submitting || includedItems.length === 0}
          className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic flex items-center justify-center gap-2"
        >
          <Check size={18} />
          {submitting ? 'Adding expense...' : 'Confirm & Add Expense'}
        </button>
      </div>
    </div>
  )
}
