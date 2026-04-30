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
import { ArrowLeft, Settings, Camera, Send, Receipt, Scale, RefreshCw, Plus, X, AtSign, ImageIcon, Hand, ChevronRight } from 'lucide-react'
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
  const [expenseCategory, setExpenseCategory] = useState('other')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [involvedMembers, setInvolvedMembers] = useState<string[]>([])
  const [savingExpense, setSavingExpense] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [sendingImage, setSendingImage] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])
  
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const [, startTransition] = useTransition()

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    
    // Setup realtime subscription synchronously to avoid React 18 strict mode race conditions
    const channel = supabase
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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === payload.new.id ? payload.new as Message : m))
      })
      .subscribe()

    const fetchMessages = async () => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (msgs) {
        setMessages(msgs.reverse())
        setHasMore(msgs.length === 30)
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
    }

    init()

    // Refetch when tab regains focus to catch any missed realtime events safely
    const onFocus = async () => {
      const currentMsgs = messagesRef.current
      if (!currentMsgs.length) {
        fetchMessages()
        return
      }
      const latestMsg = currentMsgs[currentMsgs.length - 1]
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .gt('created_at', latestMsg.created_at)
        .order('created_at', { ascending: true })
      
      if (msgs && msgs.length > 0) {
        setMessages(prev => {
          const newMsgs = msgs.filter(m => !prev.find(p => p.id === m.id))
          return [...prev, ...newMsgs]
        })
        setTimeout(() => scrollToBottom(true), 50)
      }
    }
    
    window.addEventListener('focus', onFocus)
    
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [groupId, scrollToBottom])

  // Document-level paste handler — catches iOS sticker keyboard pastes
  // regardless of which element is focused
  useEffect(() => {
    const handleDocPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (file) {
        e.preventDefault()
        await sendImage(file)
      }
    }
    document.addEventListener('paste', handleDocPaste)
    return () => document.removeEventListener('paste', handleDocPaste)
  }, [groupId, scrollToBottom])

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const supabase = createClient()
    const oldestMessageDate = messages[0].created_at

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .lt('created_at', oldestMessageDate)
      .order('created_at', { ascending: false })
      .limit(30)

    if (msgs) {
      if (msgs.length < 30) setHasMore(false)
      const scrollElement = scrollAreaRef.current
      const prevScrollHeight = scrollElement?.scrollHeight ?? 0

      setMessages(prev => {
        const newMsgs = msgs.reverse().filter(m => !prev.find(p => p.id === m.id))
        return [...newMsgs, ...prev]
      })

      // Use requestAnimationFrame to let DOM update before restoring scroll position
      requestAnimationFrame(() => {
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight - prevScrollHeight
        }
      })
    }
    setLoadingMore(false)
  }

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
    if (showMentions) {
      const filteredProfiles = Object.values(profiles).filter(p => p.id !== currentUserId && p.name.toLowerCase().includes(mentionQuery))
      if (filteredProfiles.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionIndex(prev => Math.min(prev + 1, filteredProfiles.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionIndex(prev => Math.max(prev - 1, 0))
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          insertMention(filteredProfiles[mentionIndex]?.name || filteredProfiles[0].name)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowMentions(false)
          return
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseAmount)
    if (!expenseDesc.trim() || isNaN(amount) || amount <= 0 || !expensePaidBy || !currentUserId || involvedMembers.length === 0) return
    setSavingExpense(true)
    const supabase = createClient()

    // Split amount only among selected members
    const splitAmount = amount / involvedMembers.length

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({ group_id: groupId, paid_by: expensePaidBy, description: expenseDesc.trim(), total_amount: amount, category: expenseCategory })
      .select()
      .single()

    if (expenseError || !expense) {
      toast.error('Failed to save expense')
      setSavingExpense(false)
      return
    }

    await supabase.from('expense_shares').insert(
      involvedMembers.map((uid) => ({ expense_id: expense.id, user_id: uid, amount: splitAmount }))
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
    setExpenseCategory('other')
    setExpenseAmount('')
    setExpensePaidBy('')
    setShowExpenseModal(false)
    setSavingExpense(false)
  }

  const sendImage = async (file: File) => {
    if (!currentUserId) return
    setSendingImage(true)
    const toastId = toast.loading('Sending…')
    try {
      const supabase = createClient()
      // Derive extension from MIME type first (more reliable on iOS)
      const mimeExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
      }
      const ext = mimeExt[file.type] ?? file.name.split('.').pop() ?? 'jpg'
      const path = `${groupId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)

      const { error: msgError } = await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'image',
        content: null, metadata: { url: publicUrl },
      })
      if (msgError) throw new Error(`Message failed: ${msgError.message}`)

      toast.dismiss(toastId)
      const senderName = profiles[currentUserId]?.name || 'Someone'
      pushNotify(`📷 ${senderName}`, `Sent an image in ${group?.name || 'your group'}`, 'message')
    } catch (err: any) {
      toast.dismiss(toastId)
      toast.error(err?.message || 'Failed to send image')
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
    
    // Format name to remove spaces so /@\S+/ regex can highlight it correctly
    const formattedName = name.replace(/\s+/g, '')
    const newText = before.slice(0, atIndex) + '@' + formattedName + ' ' + after
    
    setText(newText)
    setShowMentions(false)
    startTransition(() => { textarea.focus() })
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? [])
    // Check clipboard for image (stickers from iOS keyboard come as image/png or image/gif)
    const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) await sendImage(file)
      return
    }
    // Also check files directly (some iOS versions provide via .files)
    const files = Array.from(e.clipboardData?.files ?? [])
    const imageFile = files.find(f => f.type.startsWith('image/'))
    if (imageFile) {
      e.preventDefault()
      await sendImage(imageFile)
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
    const next = messages[idx + 1]
    const isMine = msg.sender_id === currentUserId
    const sender = profiles[msg.sender_id] ?? null
    
    const isLastInBlock = !next || next.sender_id !== msg.sender_id || new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000

    const showName = !isMine && (!prev || prev.sender_id !== msg.sender_id)
    const showAvatar = !isMine && isLastInBlock
    const showTime = isLastInBlock

    if (msg.type === 'expense') return <div key={msg.id}><ExpenseBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} /></div>
    if (msg.type === 'settlement') return <div key={msg.id}><SettlementBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} currentUserId={currentUserId} /></div>

    if (msg.type === 'receipt_pending') {
      const meta = msg.metadata as any
      const receiptAmount = meta?.amount ?? 0
      const merchant = meta?.merchant_name ?? 'Receipt'
      const itemsCount = meta?.items_count ?? 0
      const membersCount = meta?.members_count ?? Object.keys(profiles).length
      return (
        <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} my-2`}>
          <div className={`flex items-end gap-[10px] w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isMine && (
              <div className="w-7 flex-shrink-0">
                {showAvatar && sender && <Avatar name={sender.name} imageUrl={sender.avatar_url} size="sm" />}
              </div>
            )}
            
            <div className={`flex flex-col max-w-[82%] sm:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && showName && sender && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-3.5">{sender.name}</span>
              )}
              
              {isMine ? (
                <Link
                  href={`/groups/${groupId}/receipt/${meta?.receipt_id}`}
                  className="block w-full haptic"
                >
                  <div className="glass-panel p-4 rounded-3xl w-[250px] relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none">
                      <Receipt size={100} />
                    </div>
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/20 rounded-lg">
                        <Receipt size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Receipt</span>
                      </div>
                    </div>
                    
                    <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2">{merchant}</p>
                    <p className="text-[26px] font-black text-emerald-500 tracking-tight mt-0.5">
                      ${receiptAmount ? Number(receiptAmount).toFixed(2) : '—'}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-3">
                      {itemsCount > 0 && (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
                          {itemsCount} item{itemsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {membersCount > 0 && (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
                          {membersCount} ppl
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-neutral-700/50 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">Tap to split</span>
                      <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center">
                        <ChevronRight size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="glass-panel p-4 rounded-3xl w-[250px] relative overflow-hidden opacity-90">
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-5 pointer-events-none grayscale">
                    <Receipt size={100} />
                  </div>
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                      <Receipt size={12} className="text-gray-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Receipt</span>
                    </div>
                  </div>
                  
                  <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate pr-2">{merchant}</p>
                  <p className="text-[26px] font-black text-gray-800 dark:text-gray-200 tracking-tight mt-0.5">
                    ${receiptAmount ? Number(receiptAmount).toFixed(2) : '—'}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    {itemsCount > 0 && (
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
                        {itemsCount} item{itemsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {membersCount > 0 && (
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md">
                        {membersCount} ppl
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-neutral-700/50 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Waiting for {sender?.name?.split(' ')[0] ?? 'them'}...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return <div key={msg.id} className="py-0.5"><MessageBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} showTime={showTime} /></div>
  }

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] flex flex-col bg-gray-50/50 dark:bg-neutral-950 z-[60] overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/15 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] bg-teal-400/15 dark:bg-teal-600/10 rounded-full blur-[60px] pointer-events-none z-0"></div>

      <div className="flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 border-b border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl flex-shrink-0 z-20">
        <Link href="/groups" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-neutral-800/50 haptic transition-colors">
          <ArrowLeft size={20} />
        </Link>
        {group && <Avatar name={group.name} imageUrl={group.avatar_url} size="md" />}
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

      <div className="flex-1 overflow-y-auto px-3 py-4 scroll-area z-10" ref={scrollAreaRef} onScroll={(e) => {
        if (e.currentTarget.scrollTop < 150 && hasMore && !loadingMore) {
          loadMoreMessages()
        }
      }}>
        {loading ? (
          <div className="flex flex-col gap-4 py-4 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 h-7 rounded-full bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse flex-shrink-0" />
                <div className={`h-12 rounded-2xl bg-gray-200/60 dark:bg-neutral-800/60 animate-pulse ${i % 2 === 0 ? 'rounded-br-sm w-48' : 'rounded-bl-sm w-32'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <Hand size={48} className="text-emerald-500 mb-4 opacity-50" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Say hi or upload a receipt to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex gap-1.5 items-center bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {messages.map((msg, idx) => renderMessage(msg, idx))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl z-20 relative">
        <div className="flex items-end gap-2 relative">
          <button onClick={() => { setExpensePaidBy(currentUserId ?? ''); setInvolvedMembers(Object.keys(profiles)); setShowExpenseModal(true) }} className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 haptic">
            <Plus size={18} />
          </button>
          {/* Image / sticker picker — label wraps input for iOS compatibility */}
          <label className={`w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic cursor-pointer ${sendingImage ? 'opacity-50 pointer-events-none' : ''}`}>
            {sendingImage
              ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <ImageIcon size={18} />}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,image/gif,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handleImagePick}
            />
          </label>
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic">
            <Camera size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
          {/* @mention dropdown */}
          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden z-10 py-1">
              {Object.values(profiles)
                .filter(p => p.id !== currentUserId && p.name.toLowerCase().includes(mentionQuery))
                .map((profile, idx) => (
                  <button
                    key={profile.id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(profile.name) }}
                    onTouchStart={(e) => { e.preventDefault(); insertMention(profile.name) }}
                    onMouseEnter={() => setMentionIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left haptic ${
                      idx === mentionIndex ? 'bg-gray-100 dark:bg-neutral-700' : 'hover:bg-gray-50 dark:hover:bg-neutral-700/50'
                    }`}
                  >
                    <Avatar name={profile.name} imageUrl={profile.avatar_url} size="sm" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{profile.name}</span>
                  </button>
                ))}
            </div>
          )}
          
          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl px-4 py-3 flex items-end gap-2">
            <textarea ref={textareaRef} value={text} onChange={(e) => {
              setText(e.target.value)
              const val = e.target.value
              const cursor = e.target.selectionStart ?? val.length
              const before = val.slice(0, cursor)
              const match = before.match(/@([a-zA-Z0-9_\- ]*)$/)
              if (match) {
                const query = match[1].toLowerCase()
                setMentionQuery(query)
                setMentionIndex(0)
                const hasMatches = Object.values(profiles).some(p => p.id !== currentUserId && p.name.toLowerCase().includes(query))
                setShowMentions(hasMatches)
              } else {
                setShowMentions(false)
              }
            }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder="Message… or paste sticker" rows={1} className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-24" style={{ lineHeight: '1.4' }} />
            <button onMouseDown={(e) => { e.preventDefault(); const t = textareaRef.current; const pos = t?.selectionStart ?? text.length; setText(text.slice(0,pos)+'@'+text.slice(pos)); setShowMentions(true); setMentionQuery(''); t?.focus() }} className="text-gray-400 hover:text-emerald-500 transition-colors haptic pb-0.5">
              <AtSign size={15} />
            </button>
          </div>
          <button onClick={sendMessage} disabled={!text.trim() || sending} className="w-10 h-10 rounded-full bg-emerald-500 disabled:bg-emerald-200 dark:disabled:bg-neutral-700 flex items-center justify-center flex-shrink-0 haptic transition-colors mb-0.5">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Manual Expense Modal */}
      {showExpenseModal && (
        <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowExpenseModal(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl anim-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center haptic hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
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
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="food_drink">Food & Drink</option>
                  <option value="transport">Transport</option>
                  <option value="shopping">Shopping</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="bills">Bills</option>
                  <option value="other">Other</option>
                </select>
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
                  {Object.entries(profiles)
                    .sort(([uidA], [uidB]) => (uidA === currentUserId ? -1 : uidB === currentUserId ? 1 : 0))
                    .map(([uid, profile]) => (
                    <button
                      key={uid}
                      onClick={() => setExpensePaidBy(uid)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors haptic ${
                        expensePaidBy === uid
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {uid === currentUserId ? 'You' : profile.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Split between</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(profiles)
                    .sort(([uidA], [uidB]) => (uidA === currentUserId ? -1 : uidB === currentUserId ? 1 : 0))
                    .map(([uid, profile]) => {
                    const isSelected = involvedMembers.includes(uid)
                    return (
                      <button
                        key={`split-${uid}`}
                        onClick={() => {
                          if (isSelected) {
                            if (involvedMembers.length > 1) {
                              setInvolvedMembers(prev => prev.filter(id => id !== uid))
                            }
                          } else {
                            setInvolvedMembers(prev => [...prev, uid])
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors haptic flex items-center gap-1.5 border border-transparent ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                            : 'bg-gray-50 dark:bg-neutral-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        {uid === currentUserId ? 'You' : profile.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium pb-2 text-center bg-gray-50 dark:bg-neutral-800/50 rounded-lg py-2">
                Split equally among <span className="font-bold text-gray-600 dark:text-gray-300">{involvedMembers.length} member{involvedMembers.length !== 1 ? 's' : ''}</span> 
                {involvedMembers.length > 0 && expenseAmount && !isNaN(parseFloat(expenseAmount)) && ` ($${(parseFloat(expenseAmount) / involvedMembers.length).toFixed(2)} / each)`}
              </p>

              <button
                onClick={handleAddExpense}
                disabled={savingExpense || !expenseDesc.trim() || !expenseAmount || !expensePaidBy}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors haptic mt-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)]"
              >
                {savingExpense ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
