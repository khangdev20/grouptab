'use client'

import { useEffect, useRef, useState, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Group, Message, Profile } from '@/lib/types'
import {
  fetchGroupMembers,
  fetchMessages,
  fetchMessagesSince,
  fetchCompletedSettlementPairs,
} from '@/lib/supabase/queries'
import { pushGroupNotify } from '@/lib/utils'

const PAGE_SIZE = 30

export function useGroupChat(groupId: string) {
  const [group, setGroup] = useState<Group | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendingImage, setSendingImage] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [settledPairs, setSettledPairs] = useState<Set<string>>(new Set())

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])

  const [, startTransition] = useTransition()

  // Keep ref in sync for visibility-change refetch
  useEffect(() => { messagesRef.current = messages }, [messages])

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // ── Setup realtime + initial fetch ────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === (payload.new as Message).id)) return prev
          return [...prev, payload.new as Message]
        })
        setTimeout(() => scrollToBottom(true), 50)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === payload.new.id ? payload.new as Message : m))
      })
      .subscribe()

    const doFetchMessages = async () => {
      const supabase = createClient()
      const { data: msgs } = await fetchMessages(supabase, groupId, PAGE_SIZE)
      if (msgs) {
        setMessages(msgs.reverse())
        setHasMore(msgs.length === PAGE_SIZE)
        setTimeout(() => scrollToBottom(false), 50)
      }
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [{ data: grp }, { data: members }] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        fetchGroupMembers(supabase, groupId),
      ])

      if (grp) setGroup(grp)
      if (members) {
        const profileMap: Record<string, Profile> = {}
        members.forEach((m: any) => { if (m.profiles) profileMap[m.user_id] = m.profiles })
        setProfiles(profileMap)
      }

      const { data: cs } = await fetchCompletedSettlementPairs(supabase, groupId)
      if (cs) setSettledPairs(new Set(cs.map((s: any) => `${s.from_user}-${s.to_user}`)))

      await doFetchMessages()
      setLoading(false)
    }

    init()

    const onFocus = async () => {
      const current = messagesRef.current
      if (!current.length) { doFetchMessages(); return }
      const latest = current[current.length - 1]
      const supabase = createClient()
      const { data: msgs } = await fetchMessagesSince(supabase, groupId, latest.created_at)
      if (msgs?.length) {
        setMessages(prev => {
          const newMsgs = msgs.filter((m: Message) => !prev.find(p => p.id === m.id))
          return [...prev, ...newMsgs]
        })
        setTimeout(() => scrollToBottom(true), 50)
      }
    }

    window.addEventListener('focus', onFocus)
    const onVisibility = () => { if (document.visibilityState === 'visible') onFocus() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [groupId, scrollToBottom])

  // ── Load older messages ───────────────────────────────────────────────────
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const supabase = createClient()
    const oldest = messages[0].created_at
    const { data: msgs } = await fetchMessages(supabase, groupId, PAGE_SIZE, oldest)
    if (msgs) {
      if (msgs.length < PAGE_SIZE) setHasMore(false)
      const el = scrollAreaRef.current
      const prevH = el?.scrollHeight ?? 0
      setMessages(prev => {
        const newMsgs = msgs.reverse().filter((m: Message) => !prev.find(p => p.id === m.id))
        return [...newMsgs, ...prev]
      })
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH })
    }
    setLoadingMore(false)
  }, [loadingMore, hasMore, messages, groupId])

  // ── Send text message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending || !currentUserId) return false
    const trimmed = text.trim()
    setSending(true)

    const tempId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: tempId, group_id: groupId, sender_id: currentUserId,
      type: 'text', content: trimmed, metadata: { _pending: true },
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 50)

    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({
      group_id: groupId, sender_id: currentUserId, type: 'text', content: trimmed,
    })

    setMessages(prev => prev.filter(m => m.id !== tempId))
    if (error) {
      setSending(false)
      return false
    }

    const senderName = profiles[currentUserId]?.name || 'Someone'
    const groupName = group?.name || 'your group'
    const mentioned = trimmed.match(/@(\S+)/g)
    if (!mentioned) {
      pushGroupNotify(groupId, `${senderName} in ${groupName}`, trimmed.slice(0, 100), 'message')
    } else {
      pushGroupNotify(groupId, `${senderName} mentioned you`, `In ${groupName}: ${trimmed.slice(0, 80)}`, 'mention')
    }
    setSending(false)
    return true
  }, [sending, currentUserId, groupId, profiles, group, scrollToBottom])

  // ── Send image ────────────────────────────────────────────────────────────
  const sendImage = useCallback(async (file: File) => {
    if (!currentUserId) return
    setSendingImage(true)

    const blobUrl = URL.createObjectURL(file)
    const tempId = `optimistic-img-${Date.now()}`
    const optimistic: Message = {
      id: tempId, group_id: groupId, sender_id: currentUserId,
      type: 'image', content: null,
      metadata: { url: blobUrl, _pending: true },
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 50)

    try {
      const supabase = createClient()
      const mimeExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
      }
      const ext = mimeExt[file.type] ?? file.name.split('.').pop() ?? 'jpg'
      const path = `${groupId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
      const { error: msgError } = await supabase.from('messages').insert({
        group_id: groupId, sender_id: currentUserId, type: 'image',
        content: null, metadata: { url: publicUrl },
      })
      if (msgError) throw new Error(msgError.message)

      setMessages(prev => prev.filter(m => m.id !== tempId))
      URL.revokeObjectURL(blobUrl)
      pushGroupNotify(groupId, profiles[currentUserId]?.name || 'Someone', `Sent an image in ${group?.name || 'your group'}`, 'message')
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      URL.revokeObjectURL(blobUrl)
      throw err
    } finally {
      setSendingImage(false)
    }
  }, [currentUserId, groupId, profiles, group, scrollToBottom])

  return {
    group, messages, profiles, currentUserId, settledPairs,
    loading, sending, sendingImage,
    hasMore, loadingMore,
    bottomRef, scrollAreaRef,
    scrollToBottom, loadMoreMessages, sendMessage, sendImage,
    startTransition,
  }
}
