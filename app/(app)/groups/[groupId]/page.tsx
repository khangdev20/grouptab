'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Group, Message, Profile } from '@/lib/types'
import MessageBubble from '@/components/feed/MessageBubble'
import ExpenseBubble from '@/components/feed/ExpenseBubble'
import SettlementBubble from '@/components/feed/SettlementBubble'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { ArrowLeft, Settings, Camera, Send, Receipt, Scale, RefreshCw } from 'lucide-react'
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: grp } = await supabase.from('groups').select('*').eq('id', groupId).single()
      if (grp) setGroup(grp)

      const { data: members } = await supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId)
      if (members) {
        const profileMap: Record<string, Profile> = {}
        members.forEach((m: any) => { if (m.profiles) profileMap[m.user_id] = m.profiles })
        setProfiles(profileMap)
      }

      const { data: msgs } = await supabase.from('messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true }).limit(100)
      if (msgs) setMessages(msgs)
      setLoading(false)
      setTimeout(() => scrollToBottom(false), 100)

      const channelName = `group-${groupId}-${Date.now()}`
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          setTimeout(() => scrollToBottom(true), 50)
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [groupId, scrollToBottom])

  const sendMessage = async () => {
    if (!text.trim() || sending || !currentUserId) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({ group_id: groupId, sender_id: currentUserId, type: 'text', content: text.trim() })
    if (error) toast.error('Failed to send')
    setText('')
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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

      const { data: receipt, error: receiptError } = await supabase.from('receipts').insert({
        group_id: groupId, uploaded_by: currentUserId, image_url: publicUrl,
        merchant_name: ocrData.result.merchant_name, receipt_date: ocrData.result.date,
        total_amount: ocrData.result.total, ocr_data: ocrData.result, status: 'pending',
      }).select().single()
      if (receiptError) throw receiptError

      await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'receipt_pending',
        content: `Receipt from ${ocrData.result.merchant_name || 'Unknown'} — tap to review`,
        metadata: { receipt_id: receipt.id, amount: ocrData.result.total },
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
      return (
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-1`}>
          <Link href={`/groups/${groupId}/receipt/${meta?.receipt_id}`} className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm max-w-[75%] ${isMine ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-sm'}`}>
            <Receipt size={14} /><span>{msg.content}</span>
          </Link>
        </div>
      )
    }

    return <div key={msg.id} className="py-0.5"><MessageBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} /></div>
  }

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] flex flex-col bg-white dark:bg-neutral-900 z-50">
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
          <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
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
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic">
            <Camera size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />
          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl px-4 py-2.5 flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Message..." rows={1} className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-24" style={{ lineHeight: '1.4' }} />
          </div>
          <button onClick={sendMessage} disabled={!text.trim() || sending} className="w-10 h-10 rounded-full bg-indigo-500 disabled:bg-indigo-200 dark:disabled:bg-neutral-700 flex items-center justify-center flex-shrink-0 haptic transition-colors">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
