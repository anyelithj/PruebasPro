import { create } from './firestoreService'

export const notify = (userId: string, message: string, link = '') =>
  create('notifications', { userId, message, link, read: false, createdAt: Date.now() })
