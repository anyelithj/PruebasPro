import { createCollectionSlice } from './collectionSlice'
import type { UserRecord } from '../types/types'

export const userSlice = createCollectionSlice<UserRecord>('user')
export const { setItems: setUsers, setError: userError } = userSlice.actions
export const userReducer = userSlice.reducer
