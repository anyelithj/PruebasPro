import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface RegisterState {
  loading: boolean
  error: string | null
}

export const registerSlice = createSlice({
  name: 'register',
  initialState: { loading: false, error: null } as RegisterState,
  reducers: {
    start: () => ({ loading: true, error: null }),
    end: () => ({ loading: false, error: null }),
    fail: (_s, a: PayloadAction<string>) => ({ loading: false, error: a.payload }),
  },
})

export const registerActions = registerSlice.actions
export const registerReducer = registerSlice.reducer
