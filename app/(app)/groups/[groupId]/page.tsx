'use client'

import { useEffect, useRef, useTransition, useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Message, Profile } from '@/lib/types'
import MessageBubble from '@/components/feed/MessageBubble'
import ExpenseBubble from '@/components/feed/ExpenseBubble'
import SettlementBubble from '@/components/feed/SettlementBubble'
import ReceiptBubble from '@/components/feed/ReceiptBubble'
import ChatHeader from '@/components/group/ChatHeader'
import ExpenseModal from '@/components/group/ExpenseModal'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { Send, Plus, Camera, AtSign, ImageIcon, Hand } from 'lucide-react'
import { useGroupChat } from '@/hooks/useGroupChat'
import { useExpense } from '@/hooks/useExpense'
import { pushGroupNotify } from '@/lib/utils'

export default function GroupFeedPage() {
  const { groupId } = useParams() as { groupId: string }
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [, startTransition] = useTransition()

  const {
    group, messages, profiles, currentUserId, settledPairs,
    loading, sending, sendingImage,
    hasMore, loadingMore,
    bottomRef, scrollAreaRef,
    loadMoreMessages, sendMessage, sendImage,
  } = useGroupChat(groupId)

  const {
    showModal, editingExpense,
    desc, setDesc, category, setCategory, amount, setAmount,
    paidBy, setPaidBy, involvedMembers, setInvolvedMembers,
    saving,
    openCreate, openEdit, closeModal, handleSubmit, handleDelete,
  } = useExpense({
    groupId, profiles, group, currentUserId,
    onMessageDeleted: (msgId) => {},  // realtime removes it
    onMessageUpdated: () => {},        // realtime updates it
  })

  // Document-level paste for iOS sticker keyboard
  useEffect(() => {
    const handleDocPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (file) { e.preventDefault(); await sendImage(file) }
    }
    document.addEventListener('paste', handleDocPaste)
    return () => document.removeEventListener('paste', handleDocPaste)
  }, [sendImage])

  const insertMention = useCallback((name: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const after = text.slice(cursor)
    const atIndex = before.lastIndexOf('@')
    const newText = before.slice(0, atIndex) + '@' + name.replace(/\s+/g, '') + ' ' + after
    setText(newText)
    setShowMentions(false)
    startTransition(() => textarea.focus())
  }, [text, startTransition])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      const filtered = Object.values(profiles).filter(p => p.id !== currentUserId && p.name.toLowerCase().includes(mentionQuery))
      if (filtered.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => Math.min(prev + 1, filtered.length - 1)); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => Math.max(prev - 1, 0)); return }
        if (e.key === 'Enter') { e.preventDefault(); insertMention(filtered[mentionIndex]?.name || filtered[0].name); return }
        if (e.key === 'Escape') { e.preventDefault(); setShowMentions(false); return }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSend = async () => {
    const ok = await sendMessage(text)
    if (ok) setText('')
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? [])
    const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'))
    if (imageItem) { e.preventDefault(); const file = imageItem.getAsFile(); if (file) await sendImage(file); return }
    const imageFile = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
    if (imageFile) { e.preventDefault(); await sendImage(imageFile) }
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

      const result = ocrData.result
      if (!result || (!result.merchant_name && !result.total)) throw new Error('Invalid receipt, please try again')

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

    if (msg.type === 'expense') {
      const meta = msg.metadata as any
      const paidByUser = meta?.paid_by
      const isSettled = !currentUserId || !paidByUser || currentUserId === paidByUser || settledPairs.has(`${currentUserId}-${paidByUser}`)
      return <div key={msg.id}><ExpenseBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} onEdit={openEdit} onDelete={handleDelete} currentUserId={currentUserId} groupId={groupId} isSettled={isSettled} /></div>
    }
    if (msg.type === 'settlement') return <div key={msg.id}><SettlementBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} currentUserId={currentUserId} /></div>
    if (msg.type === 'receipt_pending') return <div key={msg.id}><ReceiptBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} groupId={groupId} /></div>
    return <div key={msg.id} className="py-0.5"><MessageBubble message={msg} sender={sender} isMine={isMine} showAvatar={showAvatar} showName={showName} showTime={showTime} /></div>
  }

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] flex flex-col bg-gray-50/50 dark:bg-neutral-950 z-[60] overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-400/15 dark:bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] left-[-10%] w-[250px] h-[250px] bg-teal-400/15 dark:bg-teal-600/10 rounded-full blur-[60px] pointer-events-none z-0" />

      <ChatHeader group={group} profiles={profiles} groupId={groupId} />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 scroll-area z-10" ref={scrollAreaRef}
        onScroll={(e) => { if (e.currentTarget.scrollTop < 150 && hasMore && !loadingMore) loadMoreMessages() }}>
        {loading ? (
          <div className="flex flex-col gap-4 py-4 px-2">
            {[1,2,3,4,5,6].map((i) => (
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
                  {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => renderMessage(msg, idx))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl z-20 relative">
        <div className="flex items-end gap-2 relative">
          <button onClick={openCreate} className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 haptic">
            <Plus size={18} />
          </button>
          <label className={`w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic cursor-pointer ${sendingImage ? 'opacity-50 pointer-events-none' : ''}`}>
            {sendingImage ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={18} />}
            <input ref={imageInputRef} type="file" accept="image/*,image/gif,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f).catch(err => toast.error(err?.message || 'Failed')); if (imageInputRef.current) imageInputRef.current.value = '' }} />
          </label>
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 haptic">
            <Camera size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptUpload} />

          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden z-10 py-1">
              {Object.values(profiles).filter(p => p.id !== currentUserId && p.name.toLowerCase().includes(mentionQuery)).map((profile, idx) => (
                <button key={profile.id} onMouseDown={(e) => { e.preventDefault(); insertMention(profile.name) }} onTouchStart={(e) => { e.preventDefault(); insertMention(profile.name) }} onMouseEnter={() => setMentionIndex(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left haptic ${idx === mentionIndex ? 'bg-gray-100 dark:bg-neutral-700' : 'hover:bg-gray-50 dark:hover:bg-neutral-700/50'}`}>
                  <Avatar name={profile.name} imageUrl={profile.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{profile.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl px-4 py-3 flex items-end gap-2">
            <textarea ref={textareaRef} value={text} onChange={(e) => {
              setText(e.target.value)
              const cursor = e.target.selectionStart ?? e.target.value.length
              const before = e.target.value.slice(0, cursor)
              const match = before.match(/@([a-zA-Z0-9_\- ]*)$/)
              if (match) {
                const query = match[1].toLowerCase()
                setMentionQuery(query); setMentionIndex(0)
                setShowMentions(Object.values(profiles).some(p => p.id !== currentUserId && p.name.toLowerCase().includes(query)))
              } else { setShowMentions(false) }
            }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder="Message… or paste sticker" rows={1}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-24" style={{ lineHeight: '1.4' }} />
            <button onMouseDown={(e) => { e.preventDefault(); const t = textareaRef.current; const pos = t?.selectionStart ?? text.length; setText(text.slice(0, pos) + '@' + text.slice(pos)); setShowMentions(true); setMentionQuery(''); t?.focus() }} className="text-gray-400 hover:text-emerald-500 transition-colors haptic pb-0.5">
              <AtSign size={15} />
            </button>
          </div>
          <button onClick={handleSend} disabled={!text.trim() || sending} className="w-10 h-10 rounded-full bg-emerald-500 disabled:bg-emerald-200 dark:disabled:bg-neutral-700 flex items-center justify-center flex-shrink-0 haptic transition-colors mb-0.5">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      <ExpenseModal
        open={showModal} onClose={closeModal} isEditing={!!editingExpense}
        desc={desc} setDesc={setDesc}
        category={category} setCategory={setCategory}
        amount={amount} setAmount={setAmount}
        paidBy={paidBy} setPaidBy={setPaidBy}
        involvedMembers={involvedMembers} setInvolvedMembers={setInvolvedMembers}
        profiles={profiles} currentUserId={currentUserId}
        saving={saving} onSubmit={handleSubmit}
      />
    </div>
  )
}
