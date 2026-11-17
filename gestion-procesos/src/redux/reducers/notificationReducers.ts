import type { AppNotification } from '../../models'
import { createCollectionSlice } from './collectionSlice'

export const notificationSlice = createCollectionSlice<AppNotification>('notification')
export const { setItems: setNotifications, setError: notificationError } = notificationSlice.actions
export const notificationReducer = notificationSlice.reducer
