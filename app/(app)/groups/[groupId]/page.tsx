'use client'

import { useEffect, useRef, useState, useCallback, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group, Message, Profile } from '@/lib/types'
import MessageBubble from '@/components/feed/MessageBubble'
import ExpenseBubble from '@/components/feed/ExpenseBubble'
import SettlementBubble from '@/components/feed/SettlementBubble'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, Settings, Camera, Send, Receipt, Scale, RefreshCw, Plus, X, AtSign, ImageIcon } from 'lucide-react'
import Link from 'next/link'

export default function GroupFeedPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [sendingImage, setSendingImage] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [, startTransition] = useTransition()

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    const fetchMessages = async () => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (msgs) {
        setMessages(msgs)
        setTimeout(() => scrollToBottom(false), 50)
      }
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: grp }, { data: members }] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId),
      ])

      if (grp) setGroup(grp)
      if (members) {
        const profileMap: Record<string, Profile> = {}
        members.forEach((m: any) => { if (m.profiles) profileMap[m.user_id] = m.profiles })
        setProfiles(profileMap)
      }

      await fetchMessages()
      setLoading(false)

      // Realtime subscription
      channel = supabase
        .channel(`group-${groupId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        }, (payload) => {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === (payload.new as Message).id)) return prev
            return [...prev, payload.new as Message]
          })
          setTimeout(() => scrollToBottom(true), 50)
        })
        .subscribe()
    }

    init()

    // Refetch when tab regains focus (user switches back from another app)
    const onFocus = () => fetchMessages()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchMessages()
    })

    return () => {
      if (channel) supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [groupId, scrollToBottom])

  const sendMessage = async () => {
    if (!text.trim() || sending || !currentUserId) return
    setSending(true)
    const supabase = createClient()
    const trimmed = text.trim()
    const { error } = await supabase.from('messages').insert({ group_id: groupId, sender_id: currentUserId, type: 'text', content: trimmed })
    if (error) toast.error('Failed to send')
    else {
      const senderName = profiles[currentUserId]?.name || 'Someone'
      const groupName = group?.name || 'your group'
      // @mention → targeted notify; otherwise broadcast new message
      const mentioned = trimmed.match(/@(\S+)/g)
      if (!mentioned) {
        pushNotify(`💬 ${senderName} in ${groupName}`, trimmed.slice(0, 100), 'message')
      } else {
        pushNotify(`🔔 ${senderName} mentioned you`, `In ${groupName}: ${trimmed.slice(0, 80)}`, 'mention')
      }
    }
    setText('')
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseAmount)
    if (!expenseDesc.trim() || isNaN(amount) || amount <= 0 || !expensePaidBy || !currentUserId) return
    setSavingExpense(true)
    const supabase = createClient()

    // Get all member IDs for equal split
    const memberIds = Object.keys(profiles)
    const splitAmount = amount / memberIds.length

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({ group_id: groupId, paid_by: expensePaidBy, description: expenseDesc.trim(), total_amount: amount })
      .select()
      .single()

    if (expenseError || !expense) {
      toast.error('Failed to save expense')
      setSavingExpense(false)
      return
    }

    await supabase.from('expense_shares').insert(
      memberIds.map((uid) => ({ expense_id: expense.id, user_id: uid, amount: splitAmount }))
    )

    const paidByName = profiles[expensePaidBy]?.name ?? 'Someone'
    await supabase.from('messages').insert({
      group_id: groupId,
      sender_id: currentUserId,
      type: 'expense',
      content: `${expenseDesc.trim()} — $${amount.toFixed(2)}`,
      metadata: { expense_id: expense.id, amount, description: expenseDesc.trim(), paid_by: expensePaidBy, paid_by_name: paidByName },
    })

    toast.success('Expense added!')
    const paidName = profiles[expensePaidBy]?.name || 'Someone'
    pushNotify(`💸 New expense in ${group?.name || 'your group'}`, `${paidName} added ${expenseDesc.trim()} — $${parseFloat(expenseAmount).toFixed(2)}`, 'expense')
    setExpenseDesc('')
    setExpenseAmount('')
    setExpensePaidBy('')
    setShowExpenseModal(false)
    setSavingExpense(false)
  }

  const sendImage = async (file: File) => {
    if (!currentUserId) return
    setSendingImage(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${groupId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
      await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'image',
        content: null, metadata: { url: publicUrl },
      })
      const senderName = profiles[currentUserId]?.name || 'Someone'
      pushNotify(`📷 ${senderName}`, `Sent an image in ${group?.name || 'your group'}`, 'message')
    } catch {
      toast.error('Failed to send image')
    }
    setSendingImage(false)
  }

  // ─── Push notify other group members ────────────────────────────────────
  const pushNotify = async (title: string, body: string, tag?: string) => {
    try {
      await fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, title, body, url: `/groups/${groupId}`, tag }),
      })
    } catch { /* best-effort */ }
  }

  const insertMention = (name: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const after = text.slice(cursor)
    const atIndex = before.lastIndexOf('@')
    const newText = before.slice(0, atIndex) + '@' + name + ' ' + after
    setText(newText)
    setShowMentions(false)
    startTransition(() => { textarea.focus() })
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) await sendImage(file)
    }
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await sendImage(file)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    const toastId = toast.loading('Scanning receipt...')
    try {
      const supabase = createClient()
      const path = `${groupId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)

      const formData = new FormData()
      formData.append('file', file)
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData })
      const ocrData = await ocrRes.json()
      if (!ocrData.success) throw new Error(ocrData.error)

      // Validate OCR result — reject if we couldn't read anything useful
      const result = ocrData.result
      if (!result || (!result.merchant_name && !result.total)) {
        throw new Error('Invalid receipt, please try again')
      }

      const { data: receipt, error: receiptError } = await supabase.from('receipts').insert({
        group_id: groupId, uploaded_by: currentUserId, image_url: publicUrl,
        merchant_name: result.merchant_name, receipt_date: result.date,
        total_amount: result.total, ocr_data: result, status: 'pending',
      }).select().single()
      if (receiptError) throw receiptError

      await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'receipt_pending',
        content: `Receipt from ${result.merchant_name || 'Unknown merchant'} — tap to review`,
        metadata: { receipt_id: receipt.id, amount: result.total, merchant_name: result.merchant_name || 'Unknown', items_count: (result.items ?? []).length, members_count: Object.keys(profiles).length },
      })

      toast.dismiss(toastId)
      toast.success('Receipt scanned!')
      router.push(`/groups/${groupId}/receipt/${receipt.id}`)
    } catch (err: any) {
      toast.dismiss(toastId)
      toast.error(err.message || 'Failed to process receipt')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const renderMessage = (msg: Message, idx: number) => {
    const prev = messages[idx - 1]
    const isMine = msg.sender_id === currentUserId
    const sender = profiles[msg.sender_id] ?? null
    const showAvatar = !isMine && (!prev || prev.sender_id !== msg.sender_id)

    if (msg.type === 'expense') return <div key={msg.id}><ExpenseBubble message={msg} senderName={sender?.name ?? ''} isMine={isMine} /></div>
    if (msg.type === 'settlement') return <div key={msg.id}><SettlementBubble message={msg} isMine={isMine} /></div>

    if (msg.type === 'receipt_pending') {
      const meta = msg.metadata as any
      const receiptAmount = meta?.amount ?? 0
      const merchant = meta?.merchant_name ?? 'Receipt'
      const itemsCount = meta?.items_count ?? 0
      const membersCount = meta?.members_count ?? Object.keys(profiles).length
      return (
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-2`}>
          <Link
            href={`/groups/${groupId}/receipt/${meta?.receipt_id}`}
            className="block max-w-[82%] haptic"
          >
            <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-emerald-500 px-3.5 py-2.5 flex items-center gap-2">
                <Receipt size={14} className="text-white flex-shrink-0" />
                <span className="text-white text-xs font-semibold uppercase tracking-wide">Receipt scanned</span>
              </div>
              {/* Body */}
              <div className="px-3.5 py-3">
                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{merchant}</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ${receiptAmount ? Number(receiptAmount).toFixed(2) : '—'}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {itemsCount > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
                  )}
                  {membersCount > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{membersCount} member{membersCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              {/* CTA */}
              <div className="border-t border-gray-100 dark:border-neutral-700 px-3.5 py-2 bg-gray-50 dark:bg-neutral-750">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">Tap to split →</p>
              </div>
            </div>
          </Link>
        </div>
      )
    }

    return <div key={msg.id} className="py-0.5"><MessageBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} /></div>
  }

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] flex flex-col bg-white dark:bg-neutral-900 z-[60]">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 pt-safe flex-shrink-0">
        <Link href="/groups" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
          <ArrowLeft size={20} />
        </Link>
        {group && <Avatar name={group.name} size="md" />}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">{group?.name ?? '...'}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{Object.keys(profiles).length} members</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/groups/${groupId}/balances`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <Scale size={18} />
          </Link>
          <Link href={`/groups/${groupId}/recurring`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <RefreshCw size={18} />
          </Link>
          <Link href={`/groups/${groupId}/settings`} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 haptic">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 scroll-area">
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <span className="text-4xl mb-3">👋</span>
            <p className="text-sm text-gray-500 dark:text-gray-400">Say hi or upload a receipt to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">{messages.map((msg, idx) => renderMessage(msg, idx))}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 pb-safe">
        <div className="flex items-end gap-2">
          <button onClick={() => { setExpensePaidBy(currentUserId ?? ''); setShowExpenseModal(true) }} className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 haptic">
            <Plus size={18} />
          </button>
          <button onClick={() => imageInputRef.current?.click()} disabled={sendingImage} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic disabled:opacity-50">
            {sendingImage ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={18} />}
          </button>
          {/* Image / sticker picker — no capture, shows full iOS photo library + stickers */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic">
            <Camera size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
          {/* @mention dropdown */}
          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden z-10">
              {Object.entries(profiles)
                .filter(([uid, p]) => uid !== currentUserId && p.name.toLowerCase().includes(mentionQuery))
                .map(([uid, profile]) => (
                  <button
                    key={uid}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(profile.name) }}
                    onTouchStart={(e) => { e.preventDefault(); insertMention(profile.name) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700 text-left haptic"
                  >
                    <Avatar name={profile.name} size="sm" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{profile.name}</span>
                  </button>
                ))}
            </div>
          )}
          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl px-4 py-2.5 flex items-end gap-2">
            <textarea ref={textareaRef} value={text} onChange={(e) => {
              setText(e.target.value)
              const val = e.target.value
              const cursor = e.target.selectionStart ?? val.length
              const before = val.slice(0, cursor)
              const match = before.match(/@(\w*)$/)
              if (match) {
                setMentionQuery(match[1].toLowerCase())
                setShowMentions(true)
              } else {
                setShowMentions(false)
              }
            }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder="Message… or paste sticker" rows={1} className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-24" style={{ lineHeight: '1.4' }} />
            <button onMouseDown={(e) => { e.preventDefault(); const t = textareaRef.current; const pos = t?.selectionStart ?? text.length; setText(text.slice(0,pos)+'@'+text.slice(pos)); setShowMentions(true); setMentionQuery(''); t?.focus() }} className="text-gray-400 hover:text-emerald-500 transition-colors haptic pb-0.5">
              <AtSign size={15} />
            </button>
          </div>
          <button onClick={sendMessage} disabled={!text.trim() || sending} className="w-10 h-10 rounded-full bg-emerald-500 disabled:bg-emerald-200 dark:disabled:bg-neutral-700 flex items-center justify-center flex-shrink-0 haptic transition-colors">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Manual Expense Modal */}
      {showExpenseModal && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-end" onClick={(e) => e.target === e.currentTarget && setShowExpenseModal(false)}>
          <div className="w-full bg-white dark:bg-neutral-900 rounded-t-3xl px-5 pt-5 pb-safe">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Add Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center haptic">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Dinner, groceries, etc."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Paid by</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(profiles).map(([uid, profile]) => (
                    <button
                      key={uid}
                      onClick={() => setExpensePaidBy(uid)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors haptic ${
                        expensePaidBy === uid
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {uid === currentUserId ? 'You' : profile.name}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">Split equally among all {Object.keys(profiles).length} members</p>

              <button
                onClick={handleAddExpense}
                disabled={savingExpense || !expenseDesc.trim() || !expenseAmount || !expensePaidBy}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic mb-2"
              >
                {savingExpense ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
