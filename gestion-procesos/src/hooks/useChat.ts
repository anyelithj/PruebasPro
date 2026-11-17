import { limitToLast, orderBy } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import type { Channel, ChatMessage, Process } from '../models'
import { create, subscribe } from '../services/firestoreService'
import { useAuth } from './useAuth'

export function useChat(channelId?: string) {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => (uid ? subscribe<Channel>('channels', [orderBy('name')], setChannels) : undefined), [uid])

  useEffect(() => {
    setMessages([])
    if (!uid || !channelId) return
    return subscribe<ChatMessage>(
      `channels/${channelId}/messages`,
      [orderBy('createdAt'), limitToLast(100)],
      setMessages,
    )
  }, [uid, channelId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!uid || !channelId || !text.trim()) return
      await create(`channels/${channelId}/messages`, {
        text: text.trim(),
        uid,
        displayName: profile?.displayName || user?.email || 'Usuario',
        createdAt: Date.now(),
      })
    },
    [uid, channelId, profile, user],
  )

  const createChannel = useCallback(
    (name: string, processId = '') =>
      create('channels', { name: name.trim(), processId, createdBy: uid ?? '', createdAt: Date.now() }),
    [uid],
  )

  /** Chat de atención: devuelve el canal de la solicitud, creándolo si todavía no existe. */
  const openProcessChannel = useCallback(
    async (process: Process): Promise<string> =>
      channels.find((c) => c.processId === process.id)?.id ?? createChannel(`Atención: ${process.title}`, process.id),
    [channels, createChannel],
  )

  return {
    channels,
    messages,
    sendMessage,
    createChannel,
    openProcessChannel,
    currentChannel: channels.find((c) => c.id === channelId),
  }
}
