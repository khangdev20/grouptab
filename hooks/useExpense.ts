'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Group, Profile } from '@/lib/types'
import { ExpenseMeta } from '@/components/feed/ExpenseBubble'
import { pushGroupNotify } from '@/lib/utils'
import toast from 'react-hot-toast'

interface UseExpenseOptions {
  groupId: string
  profiles: Record<string, Profile>
  group: Group | null
  currentUserId: string | null
  onMessageDeleted?: (msgId: string) => void
  onMessageUpdated?: (msgId: string, metadata: any) => void
}

export function useExpense({
  groupId, profiles, group, currentUserId,
  onMessageDeleted, onMessageUpdated,
}: UseExpenseOptions) {
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseMeta | null>(null)
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('other')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [involvedMembers, setInvolvedMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const openCreate = useCallback(() => {
    setEditingExpense(null)
    setDesc('')
    setCategory('other')
    setAmount('')
    setPaidBy(currentUserId ?? '')
    setInvolvedMembers(Object.keys(profiles))
    setShowModal(true)
  }, [currentUserId, profiles])

  const openEdit = useCallback((meta: ExpenseMeta) => {
    setEditingExpense(meta)
    setDesc(meta.description)
    setAmount(String(meta.amount))
    setPaidBy(meta.paidBy)
    setCategory(meta.category ?? 'other')
    setInvolvedMembers(meta.involvedMembers ?? Object.keys(profiles))
    setShowModal(true)
  }, [profiles])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingExpense(null)
    setDesc('')
    setAmount('')
    setPaidBy('')
    setCategory('other')
    setInvolvedMembers([])
  }, [])

  const handleSubmit = useCallback(async () => {
    const parsedAmount = parseFloat(amount)
    if (!desc.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !paidBy || !currentUserId || involvedMembers.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const splitAmount = parsedAmount / involvedMembers.length
    const paidByName = profiles[paidBy]?.name ?? 'Someone'

    if (editingExpense) {
      // UPDATE
      await supabase.from('expenses').update({
        description: desc.trim(), total_amount: parsedAmount,
        paid_by: paidBy, category,
      }).eq('id', editingExpense.expenseId)

      await supabase.from('expense_shares').delete().eq('expense_id', editingExpense.expenseId)
      await supabase.from('expense_shares').insert(
        involvedMembers.map((uid) => ({ expense_id: editingExpense.expenseId, user_id: uid, amount: splitAmount }))
      )

      const newMeta = {
        expense_id: editingExpense.expenseId, amount: parsedAmount,
        description: desc.trim(), paid_by: paidBy, paid_by_name: paidByName,
      }
      await supabase.from('messages').update({ metadata: newMeta }).eq('id', editingExpense.messageId)
      onMessageUpdated?.(editingExpense.messageId, newMeta)
      toast.success('Expense updated!')
    } else {
      // CREATE
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({ group_id: groupId, paid_by: paidBy, description: desc.trim(), total_amount: parsedAmount, category })
        .select().single()

      if (error || !expense) { toast.error('Failed to save expense'); setSaving(false); return }

      await supabase.from('expense_shares').insert(
        involvedMembers.map((uid) => ({ expense_id: expense.id, user_id: uid, amount: splitAmount }))
      )
      await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'expense',
        content: `${desc.trim()} — $${parsedAmount.toFixed(2)}`,
        metadata: { expense_id: expense.id, amount: parsedAmount, description: desc.trim(), paid_by: paidBy, paid_by_name: paidByName },
      })

      toast.success('Expense added!')
      pushGroupNotify(groupId, `New expense in ${group?.name || 'your group'}`, `${paidByName} added ${desc.trim()} — $${parsedAmount.toFixed(2)}`, 'expense')
    }

    setSaving(false)
    closeModal()
  }, [amount, desc, paidBy, currentUserId, involvedMembers, category, editingExpense, profiles, group, groupId, onMessageUpdated, closeModal])

  const handleDelete = useCallback(async (messageId: string, expenseId: string) => {
    if (!currentUserId) return
    const supabase = createClient()
    await supabase.from('expense_shares').delete().eq('expense_id', expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) { toast.error('Failed to delete expense'); return }
    onMessageDeleted?.(messageId)
    toast.success('Expense deleted')
  }, [currentUserId, onMessageDeleted])

  return {
    showModal, editingExpense,
    desc, setDesc,
    category, setCategory,
    amount, setAmount,
    paidBy, setPaidBy,
    involvedMembers, setInvolvedMembers,
    saving,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  }
}
