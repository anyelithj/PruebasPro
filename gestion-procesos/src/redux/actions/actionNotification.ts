import { patch, remove } from '../../services/firestoreService'
import { notify } from '../../services/notifications'
import type { AppThunk } from '../store/store'

/** Envía una notificación respetando las preferencias del destinatario. */
export const sendNotification =
  (uid: string, message: string, link: string, kind: 'assignments' | 'status'): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const state = getState()
    if (!uid || uid === state.login.user?.uid) return
    const settings = state.user.items.find((u) => u.uid === uid)?.settings
    if (settings && !(kind === 'assignments' ? settings.notifyAssignments : settings.notifyStatus)) return
    await notify(uid, message, link)
  }

export const markNotificationRead =
  (id: string): AppThunk<Promise<void>> =>
  async () =>
    patch('notifications', id, { read: true })

export const markAllNotificationsRead = (): AppThunk<Promise<void>> => async (_d, getState) => {
  await Promise.all(
    getState()
      .notification.items.filter((n) => !n.read)
      .map((n) => patch('notifications', n.id, { read: true })),
  )
}

export const deleteNotification =
  (id: string): AppThunk<Promise<void>> =>
  async () =>
    remove('notifications', id)
